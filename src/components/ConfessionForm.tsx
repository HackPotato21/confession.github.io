import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Upload, Send, X } from 'lucide-react';

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
    
    // Generate a fallback ID if anonymousId is not ready
    const userId = anonymousId || Math.floor(10000 + Math.random() * 90000).toString();

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
              ) : !anonymousId ? (
                <>
                  <Upload className="h-4 w-4 animate-spin" />
                  Loading...
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