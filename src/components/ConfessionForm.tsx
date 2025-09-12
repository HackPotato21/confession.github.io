import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Upload, Send } from 'lucide-react';

interface ConfessionFormProps {
  anonymousId: string | null;
}

export const ConfessionForm = ({ anonymousId }: ConfessionFormProps) => {
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Check file size (3MB limit)
      if (selectedFile.size > 3 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Please select a file smaller than 3MB',
          variant: 'destructive',
        });
        return;
      }

      // Check file type
      const allowedTypes = ['image/', 'video/'];
      const isAllowed = allowedTypes.some(type => selectedFile.type.startsWith(type));
      
      if (!isAllowed) {
        toast({
          title: 'Invalid file type',
          description: 'Please select an image or video file',
          variant: 'destructive',
        });
        return;
      }

      setFile(selectedFile);
    }
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${anonymousId}-${Date.now()}.${fileExt}`;
    
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

    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!anonymousId) {
      toast({
        title: 'Error',
        description: 'Anonymous ID not ready. Please wait a moment.',
        variant: 'destructive',
      });
      return;
    }

    if (!content.trim() && !file) {
      toast({
        title: 'Empty confession',
        description: 'Please write something or upload a file',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let mediaUrl = null;
      let mediaType = null;

      if (file) {
        mediaUrl = await uploadFile(file);
        if (!mediaUrl) {
          throw new Error('Failed to upload file');
        }
        mediaType = file.type.startsWith('image/') ? 'image' : 'video';
      }

      const { error } = await supabase
        .from('confessions')
        .insert({
          user_id: anonymousId,
          content: content.trim() || null,
          media_url: mediaUrl,
          media_type: mediaType,
        });

      if (error) throw error;

      toast({
        title: 'Confession posted',
        description: 'Your anonymous confession has been shared',
      });

      setContent('');
      setFile(null);
      
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
          
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Input
                id="file-input"
                type="file"
                accept="image/*,video/*"
                onChange={handleFileChange}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              />
              {file && (
                <p className="text-sm text-muted-foreground mt-2">
                  Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)}MB)
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="submit"
              disabled={isSubmitting || !anonymousId}
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