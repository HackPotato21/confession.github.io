import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Generate device fingerprint from browser/device characteristics
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
      timestamp: Date.now(),
    })
  );
  
  return fingerprint;
};

// Generate 5-digit random ID
const generateAnonymousId = (): string => {
  return Math.floor(10000 + Math.random() * 90000).toString();
};

export const useAnonymousId = () => {
  const [anonymousId, setAnonymousId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const getOrCreateAnonymousId = async () => {
      try {
        const deviceFingerprint = generateDeviceFingerprint();
        
        // Check if this device already has an ID
        const { data: existingUser } = await supabase
          .from('anonymous_users')
          .select('anonymous_id')
          .eq('device_fingerprint', deviceFingerprint)
          .single();

        if (existingUser) {
          setAnonymousId(existingUser.anonymous_id);
        } else {
          // Create new anonymous ID
          let newId: string;
          let isUnique = false;
          
          // Ensure the ID is unique
          while (!isUnique) {
            newId = generateAnonymousId();
            const { data: existingId } = await supabase
              .from('anonymous_users')
              .select('id')
              .eq('anonymous_id', newId)
              .single();
            
            if (!existingId) {
              isUnique = true;
            }
          }

          // Insert new anonymous user
          const { error } = await supabase
            .from('anonymous_users')
            .insert({
              anonymous_id: newId!,
              device_fingerprint: deviceFingerprint
            });

          if (!error) {
            setAnonymousId(newId!);
          }
        }
      } catch (error) {
        console.error('Error managing anonymous ID:', error);
      } finally {
        setIsLoading(false);
      }
    };

    getOrCreateAnonymousId();
  }, []);

  return { anonymousId, isLoading };
};