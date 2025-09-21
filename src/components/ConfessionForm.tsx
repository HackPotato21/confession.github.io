import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Upload, Send, X } from 'lucide-react';
import CryptoJS from 'crypto-js';

interface MediaItem {
  url: string;
  type: 'image' | 'video';
}

interface ConfessionFormProps {
  anonymousId: string | null;
  onConfessionPosted: () => void;
}

export const ConfessionForm = ({ anonymousId, onConfessionPosted }: ConfessionFormProps) => {
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Generate device fingerprint from browser/device characteristics (stable)
  const generateDeviceFingerprint = (): string => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Device fingerprint', 2, 2);
    }
    const fingerprint = btoa(
      JSON.stringify({
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        screenResolution: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        canvas: canvas.toDataURL(),
      })
    );
    return fingerprint;
  };

  // Ensure an anonymous ID exists for this device/IP
  const ensureAnonymousId = async (): Promise<string> => {
    const deviceFingerprint = generateDeviceFingerprint();
    const fingerprintHash = CryptoJS.MD5(deviceFingerprint).toString();

    // 1) Try local cache first (keeps the same ID on this device)
    try {
      const cached = localStorage.getItem('anonymous_id');
      if (cached) return cached;
    } catch {}

    // 2) Lookup by device fingerprint hash in DB
    const { data: existingUser } = await supabase
      .from('anonymous_users')
      .select('anonymous_id')
      .eq('device_fingerprint_hash', fingerprintHash)
      .maybeSingle();

    if (existingUser?.anonymous_id) {
      try { localStorage.setItem('anonymous_id', existingUser.anonymous_id); } catch {}
      return existingUser.anonymous_id;
    }

    // 3) Create a new unique 5-digit ID with retry on conflicts
    const generateAnonymousId = () => Math.floor(10000 + Math.random() * 90000).toString();

    for (let attempt = 0; attempt < 5; attempt++) {
      const newId = generateAnonymousId();

      const { error: insertError } = await supabase
        .from('anonymous_users')
        .insert({ 
          anonymous_id: newId, 
          device_fingerprint: deviceFingerprint.substring(0, 500), // Keep first 500 chars for debugging
          device_fingerprint_hash: fingerprintHash 
        });

      if (!insertError) {
        try { localStorage.setItem('anonymous_id', newId); } catch {}
        return newId;
      }

      // If unique violation, re-select using fingerprint hash and return if found
      const code = (insertError as any)?.code;
      if (code === '23505') {
        const { data: afterConflict } = await supabase
          .from('anonymous_users')
          .select('anonymous_id')
          .eq('device_fingerprint_hash', fingerprintHash)
          .maybeSingle();
        if (afterConflict?.anonymous_id) {
          try { localStorage.setItem('anonymous_id', afterConflict.anonymous_id); } catch {}
          return afterConflict.anonymous_id;
        }
        // otherwise, try again with a new ID
      }
    }

    // 4) Final fallback: derive a deterministic ID from the fingerprint (stable per device)
    const hash = fingerprintHash.split('').reduce((acc, ch) => ((acc << 5) - acc) + ch.charCodeAt(0), 0);
    const fallbackId = String(Math.abs(hash) % 90000 + 10000);
    try { localStorage.setItem('anonymous_id', fallbackId); } catch {}
    return fallbackId;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    
    // Check if adding these files would exceed the limit
    if (files.length + selectedFiles.length > 7) {
      toast({
        title: 'Too many files',
        description: 'You can upload maximum 7 files per confession',
        variant: 'destructive',
      });
      return;
    }

    const validFiles: File[] = [];
    
    for (const file of selectedFiles) {
      // Check file size (3MB limit)
      if (file.size > 3 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: `${file.name} is larger than 3MB`,
          variant: 'destructive',
        });
        continue;
      }

      // Check file type
      const allowedTypes = ['image/', 'video/'];
      const isAllowed = allowedTypes.some(type => file.type.startsWith(type));
      
      if (!isAllowed) {
        toast({
          title: 'Invalid file type',
          description: `${file.name} is not an image or video`,
          variant: 'destructive',
        });
        continue;
      }

      validFiles.push(file);
    }

    setFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (files: File[], userId: string): Promise<MediaItem[]> => {
    const uploadPromises = files.map(async (file, index) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}-${index}.${fileExt}`;
      
      const { error } = await supabase.storage
        .from('confession-media')
        .upload(fileName, file);

      if (error) {
        console.error('Upload error:', error);
        return null;
      }

      const { data } = supabase.storage
        .from('confession-media')
        .getPublicUrl(fileName);

      return {
        url: data.publicUrl,
        type: file.type.startsWith('image/') ? 'image' as const : 'video' as const
      };
    });

    const results = await Promise.all(uploadPromises);
    return results.filter(result => result !== null) as MediaItem[];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let userId = anonymousId;
    if (!userId) {
      try {
        userId = await ensureAnonymousId();
      } catch (err) {
        toast({
          title: 'Error',
          description: 'Failed to initialize anonymous ID. Please try again.',
          variant: 'destructive',
        });
        return;
      }
    }

    if (!content.trim() && files.length === 0) {
      toast({
        title: 'Empty confession',
        description: 'Please write something or upload files',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let mediaUrls: MediaItem[] = [];

      if (files.length > 0) {
        mediaUrls = await uploadFiles(files, userId);
        if (mediaUrls.length !== files.length) {
          throw new Error('Some files failed to upload');
        }
      }

      const { error } = await supabase
        .from('confessions')
        .insert({
          user_id: userId,
          content: content.trim() || null,
          media_urls: JSON.stringify(mediaUrls),
          media_type: files.length > 0 ? 'mixed' : null,
        });

      if (error) throw error;

      toast({
        title: 'Confession posted',
        description: 'Your anonymous confession has been shared',
      });

      setContent('');
      setFiles([]);
      onConfessionPosted();
      
      // Reset file input
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (error) {
      console.error('Error posting confession:', error);
      toast({
        title: 'Error',
        description: 'Failed to post confession. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Share Your Confession</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            placeholder="What's on your mind? Share anonymously..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[120px] resize-none"
          />
          
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Input
                  id="file-input"
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleFileChange}
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
                <p className="text-sm text-muted-foreground mt-2">
                  {files.length}/7 files selected. Max 3MB per file.
                </p>
              </div>
            </div>

            {files.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {files.map((file, index) => (
                  <div key={index} className="relative group">
                    <div className="bg-muted rounded-lg p-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="truncate">{file.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive/80"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)}MB
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="submit"
              disabled={isSubmitting || (!content.trim() && files.length === 0)}
              className="flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Upload className="h-4 w-4 animate-spin" />
                  Posting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Post Confession
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};