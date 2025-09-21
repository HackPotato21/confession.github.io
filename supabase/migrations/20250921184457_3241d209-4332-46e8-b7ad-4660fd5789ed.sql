-- Fix the device fingerprint index issue by using MD5 hash instead of full fingerprint
DROP INDEX IF EXISTS anonymous_users_device_fingerprint_key;

-- Add a new column for MD5 hash of device fingerprint
ALTER TABLE public.anonymous_users ADD COLUMN IF NOT EXISTS device_fingerprint_hash TEXT;

-- Create index on the hash instead
CREATE UNIQUE INDEX anonymous_users_device_fingerprint_hash_key ON public.anonymous_users(device_fingerprint_hash);

-- Update existing records to have the hash (will be empty for now, but new records will populate it)
-- The application code will handle generating MD5 hashes going forward