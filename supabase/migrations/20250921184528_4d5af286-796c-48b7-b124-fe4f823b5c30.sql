-- Fix the device fingerprint constraint and index issue
ALTER TABLE public.anonymous_users DROP CONSTRAINT IF EXISTS anonymous_users_device_fingerprint_key;

-- Add a new column for MD5 hash of device fingerprint
ALTER TABLE public.anonymous_users ADD COLUMN IF NOT EXISTS device_fingerprint_hash TEXT;

-- Create unique index on the hash instead
CREATE UNIQUE INDEX anonymous_users_device_fingerprint_hash_key ON public.anonymous_users(device_fingerprint_hash);