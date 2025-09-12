-- Create confessions table
CREATE TABLE public.confessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create anonymous_users table to store device-based IDs
CREATE TABLE public.anonymous_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  anonymous_id TEXT NOT NULL UNIQUE,
  device_fingerprint TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.confessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anonymous_users ENABLE ROW LEVEL SECURITY;

-- Create policies for confessions (allow anyone to read and insert)
CREATE POLICY "Anyone can view confessions" 
ON public.confessions 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create confessions" 
ON public.confessions 
FOR INSERT 
WITH CHECK (true);

-- Create policies for anonymous users
CREATE POLICY "Anyone can view anonymous users" 
ON public.anonymous_users 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create anonymous users" 
ON public.anonymous_users 
FOR INSERT 
WITH CHECK (true);

-- Create storage bucket for confession media
INSERT INTO storage.buckets (id, name, public) 
VALUES ('confession-media', 'confession-media', true);

-- Create storage policies for confession media
CREATE POLICY "Anyone can upload confession media" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'confession-media');

CREATE POLICY "Anyone can view confession media" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'confession-media');

-- Create index for better performance
CREATE INDEX idx_confessions_created_at ON public.confessions(created_at DESC);
CREATE INDEX idx_anonymous_users_device_fingerprint ON public.anonymous_users(device_fingerprint);