-- Add likes table for confessions
CREATE TABLE public.confession_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  confession_id UUID NOT NULL REFERENCES public.confessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  is_like BOOLEAN NOT NULL, -- true for like, false for dislike
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(confession_id, user_id)
);

-- Add comments table
CREATE TABLE public.confession_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  confession_id UUID NOT NULL REFERENCES public.confessions(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES public.confession_comments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add likes table for comments
CREATE TABLE public.comment_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID NOT NULL REFERENCES public.confession_comments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  is_like BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

-- Add media_urls column to confessions (for multiple files)
ALTER TABLE public.confessions 
DROP COLUMN media_url,
ADD COLUMN media_urls JSONB DEFAULT '[]'::jsonb;

-- Enable RLS on new tables
ALTER TABLE public.confession_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.confession_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

-- Create policies for confession_likes
CREATE POLICY "Anyone can view confession likes" 
ON public.confession_likes 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can manage confession likes" 
ON public.confession_likes 
FOR ALL
USING (true)
WITH CHECK (true);

-- Create policies for confession_comments
CREATE POLICY "Anyone can view comments" 
ON public.confession_comments 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create comments" 
ON public.confession_comments 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update their own comments" 
ON public.confession_comments 
FOR UPDATE 
USING (user_id = user_id);

-- Create policies for comment_likes
CREATE POLICY "Anyone can view comment likes" 
ON public.comment_likes 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can manage comment likes" 
ON public.comment_likes 
FOR ALL
USING (true)
WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_confession_likes_confession_id ON public.confession_likes(confession_id);
CREATE INDEX idx_confession_comments_confession_id ON public.confession_comments(confession_id);
CREATE INDEX idx_confession_comments_parent_id ON public.confession_comments(parent_comment_id);
CREATE INDEX idx_comment_likes_comment_id ON public.comment_likes(comment_id);