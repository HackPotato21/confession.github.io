-- Remove the problematic index on device_fingerprint
DROP INDEX IF EXISTS idx_anonymous_users_device_fingerprint;

-- Ensure we're using the hash-based unique constraint instead
DROP INDEX IF EXISTS anonymous_users_device_fingerprint_hash_key;
CREATE UNIQUE INDEX IF NOT EXISTS anonymous_users_device_fingerprint_hash_key ON public.anonymous_users(device_fingerprint_hash);

-- Also ensure anonymous_id is unique
CREATE UNIQUE INDEX IF NOT EXISTS anonymous_users_anonymous_id_key ON public.anonymous_users(anonymous_id);