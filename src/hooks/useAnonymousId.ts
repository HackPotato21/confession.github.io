import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import CryptoJS from 'crypto-js';

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

// Generate 5-digit random ID
const generateAnonymousId = (): string => {
  return Math.floor(10000 + Math.random() * 90000).toString();
};

export const useAnonymousId = () => {
  const [anonymousId, setAnonymousId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const createOrRetrieveAnonymousId = async () => {
      try {
        const deviceFingerprint = generateDeviceFingerprint();
        const fingerprintHash = CryptoJS.MD5(deviceFingerprint).toString();
        
        // 1) Try local cache first (keeps the same ID on this device)
        try {
          const cached = localStorage.getItem('anonymous_id');
          if (cached) {
            setAnonymousId(cached);
            setIsLoading(false);
            return;
          }
        } catch { }
        
        // 2) First check if we already have an anonymous ID for this device
        const { data: existingUser } = await supabase
          .from('anonymous_users')
          .select('anonymous_id')
          .eq('device_fingerprint_hash', fingerprintHash)
          .maybeSingle();
          
        if (existingUser) {
          setAnonymousId(existingUser.anonymous_id);
          try { localStorage.setItem('anonymous_id', existingUser.anonymous_id); } catch { }
        } else {
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
              setAnonymousId(newId);
              try { localStorage.setItem('anonymous_id', newId); } catch { }
              break;
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
                setAnonymousId(afterConflict.anonymous_id);
                try { localStorage.setItem('anonymous_id', afterConflict.anonymous_id); } catch { }
                break;
              }
            }
          }
        }
      } catch (error) {
        console.error('Error creating anonymous ID:', error);
        // 4) Final fallback: derive a deterministic ID from the fingerprint (stable per device)
        const deviceFingerprint = generateDeviceFingerprint();
        const fingerprintHash = CryptoJS.MD5(deviceFingerprint).toString();
        const hash = fingerprintHash.split('').reduce((acc, ch) => ((acc << 5) - acc) + ch.charCodeAt(0), 0);
        const fallbackId = String(Math.abs(hash) % 90000 + 10000);
        setAnonymousId(fallbackId);
        try { localStorage.setItem('anonymous_id', fallbackId); } catch { }
      }
      setIsLoading(false);
    };

    createOrRetrieveAnonymousId();
  }, []);

  return { anonymousId, isLoading };
};
