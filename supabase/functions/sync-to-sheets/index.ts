import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GoogleServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  universe_domain: string;
}

async function getAccessToken(serviceAccount: GoogleServiceAccount): Promise<string> {
  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: serviceAccount.token_uri,
    exp: now + 3600,
    iat: now
  };

  // Base64url encode
  const base64url = (obj: any) => {
    return btoa(JSON.stringify(obj))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  const headerEncoded = base64url(header);
  const claimEncoded = base64url(claim);
  const unsignedToken = `${headerEncoded}.${claimEncoded}`;

  // Import private key
  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  // Sign the token
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureEncoded = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const jwt = `${unsignedToken}.${signatureEncoded}`;

  // Exchange JWT for access token
  const response = await fetch(serviceAccount.token_uri, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Token exchange failed:", error);
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function updateSheet(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  values: any[][]
) {
  const range = `${sheetName}!A1`;
  
  // Clear existing data
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}:clear`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  // Update with new data
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values,
      }),
    }
  );

  return response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { spreadsheetId } = await req.json();
    
    if (!spreadsheetId) {
      throw new Error('Spreadsheet ID is required');
    }

    // Get service account credentials
    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
    if (!serviceAccountJson) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not configured');
    }

    const serviceAccount: GoogleServiceAccount = JSON.parse(serviceAccountJson);
    
    // Get access token
    console.log('Getting Google Sheets access token...');
    const accessToken = await getAccessToken(serviceAccount);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Fetching data from Supabase...');

    // Fetch confessions
    const { data: confessions, error: confError } = await supabase
      .from('confessions')
      .select('*')
      .order('created_at', { ascending: false });

    if (confError) throw confError;

    // Fetch anonymous users
    const { data: users, error: usersError } = await supabase
      .from('anonymous_users')
      .select('*')
      .order('created_at', { ascending: false });

    if (usersError) throw usersError;

    // Fetch confession likes
    const { data: confessionLikes, error: likesError } = await supabase
      .from('confession_likes')
      .select('*')
      .order('created_at', { ascending: false });

    if (likesError) throw likesError;

    // Fetch comments
    const { data: comments, error: commentsError } = await supabase
      .from('confession_comments')
      .select('*')
      .order('created_at', { ascending: false });

    if (commentsError) throw commentsError;

    // Fetch comment likes
    const { data: commentLikes, error: commentLikesError } = await supabase
      .from('comment_likes')
      .select('*')
      .order('created_at', { ascending: false });

    if (commentLikesError) throw commentLikesError;

    console.log('Syncing to Google Sheets...');

    // Prepare confessions data
    const confessionsData = [
      ['ID', 'User ID', 'Content', 'Media URLs', 'Media Type', 'Created At'],
      ...confessions.map(c => [
        c.id,
        c.user_id,
        c.content || '',
        JSON.stringify(c.media_urls),
        c.media_type || '',
        c.created_at
      ])
    ];

    // Prepare users data
    const usersData = [
      ['ID', 'Anonymous ID', 'Device Fingerprint', 'Created At'],
      ...users.map(u => [
        u.id,
        u.anonymous_id,
        u.device_fingerprint,
        u.created_at
      ])
    ];

    // Prepare confession likes data
    const confessionLikesData = [
      ['ID', 'Confession ID', 'User ID', 'Is Like', 'Created At'],
      ...confessionLikes.map(l => [
        l.id,
        l.confession_id,
        l.user_id,
        l.is_like ? 'Like' : 'Dislike',
        l.created_at
      ])
    ];

    // Prepare comments data
    const commentsData = [
      ['ID', 'Confession ID', 'Parent Comment ID', 'User ID', 'Content', 'Created At'],
      ...comments.map(c => [
        c.id,
        c.confession_id,
        c.parent_comment_id || '',
        c.user_id,
        c.content,
        c.created_at
      ])
    ];

    // Prepare comment likes data
    const commentLikesData = [
      ['ID', 'Comment ID', 'User ID', 'Is Like', 'Created At'],
      ...commentLikes.map(l => [
        l.id,
        l.comment_id,
        l.user_id,
        l.is_like ? 'Like' : 'Dislike',
        l.created_at
      ])
    ];

    // Update all sheets
    await updateSheet(accessToken, spreadsheetId, 'Confessions', confessionsData);
    await updateSheet(accessToken, spreadsheetId, 'Users', usersData);
    await updateSheet(accessToken, spreadsheetId, 'Confession Likes', confessionLikesData);
    await updateSheet(accessToken, spreadsheetId, 'Comments', commentsData);
    await updateSheet(accessToken, spreadsheetId, 'Comment Likes', commentLikesData);

    console.log('Sync completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Data synced to Google Sheets successfully',
        stats: {
          confessions: confessions.length,
          users: users.length,
          confessionLikes: confessionLikes.length,
          comments: comments.length,
          commentLikes: commentLikes.length
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in sync-to-sheets function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
