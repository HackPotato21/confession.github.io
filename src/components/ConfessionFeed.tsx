import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface Confession {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
}

export const ConfessionFeed = () => {
  const [confessions, setConfessions] = useState<Confession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchConfessions = async () => {
      try {
        const { data, error } = await supabase
          .from('confessions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        setConfessions(data || []);
      } catch (error) {
        console.error('Error fetching confessions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfessions();

    // Subscribe to new confessions
    const subscription = supabase
      .channel('confessions')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'confessions' 
        }, 
        (payload) => {
          setConfessions(prev => [payload.new as Confession, ...prev]);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
              <div className="h-20 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-center">Recent Confessions</h2>
      
      {confessions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              No confessions yet. Be the first to share!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {confessions.map((confession) => (
            <Card key={confession.id} className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Badge variant="secondary" className="font-mono">
                    #{confession.user_id}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(confession.created_at), { addSuffix: true })}
                  </span>
                </div>

                {confession.content && (
                  <p className="text-foreground mb-4 whitespace-pre-wrap">
                    {confession.content}
                  </p>
                )}

                {confession.media_url && (
                  <div className="mt-4">
                    {confession.media_type === 'image' ? (
                      <img
                        src={confession.media_url}
                        alt="Confession media"
                        className="max-w-full h-auto rounded-lg max-h-96 object-contain"
                      />
                    ) : confession.media_type === 'video' ? (
                      <video
                        src={confession.media_url}
                        controls
                        className="max-w-full h-auto rounded-lg max-h-96"
                      >
                        Your browser does not support the video tag.
                      </video>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};