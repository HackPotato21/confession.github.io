import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDistanceToNow } from 'date-fns';
import { ThumbsUp, ThumbsDown, MessageCircle, Reply } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface MediaItem {
  url: string;
  type: 'image' | 'video';
}

interface Confession {
  id: string;
  user_id: string;
  content: string | null;
  media_urls: MediaItem[];
  created_at: string;
  likes_count?: number;
  dislikes_count?: number;
  comments_count?: number;
  user_reaction?: boolean | null;
}

interface Comment {
  id: string;
  confession_id: string;
  parent_comment_id: string | null;
  user_id: string;
  content: string;
  created_at: string;
  likes_count?: number;
  dislikes_count?: number;
  user_reaction?: boolean | null;
  replies?: Comment[];
}

interface ConfessionFeedProps {
  anonymousId: string | null;
  refreshTrigger: number;
}

type SortOption = 'latest' | 'oldest' | 'popular';

export const ConfessionFeed = React.memo(({ anonymousId, refreshTrigger }: ConfessionFeedProps) => {
  const [confessions, setConfessions] = useState<Confession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('latest');
  const [commentingOn, setCommentingOn] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<{ [key: string]: Comment[] }>({});
  const [showComments, setShowComments] = useState<{ [key: string]: boolean }>({});

  const fetchConfessions = useCallback(async () => {
    try {
      let query = supabase.from('confessions').select(`
        *,
        confession_likes (is_like),
        confession_comments (id)
      `);

      switch (sortBy) {
        case 'oldest':
          query = query.order('created_at', { ascending: true });
          break;
        case 'popular':
          // For popularity, we'll sort by likes count on frontend for simplicity
          query = query.order('created_at', { ascending: false });
          break;
        default:
          query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;

      // Process confessions with counts and user reactions
      const processedConfessions = (data || []).map(confession => {
        const likes = confession.confession_likes?.filter((like: any) => like.is_like) || [];
        const dislikes = confession.confession_likes?.filter((like: any) => !like.is_like) || [];
        const userReaction = anonymousId 
          ? confession.confession_likes?.find((like: any) => like.user_id === anonymousId)?.is_like
          : null;

        // Parse media_urls if it exists and is valid JSON
        let parsedMediaUrls: MediaItem[] = [];
        try {
          if (confession.media_urls && typeof confession.media_urls === 'string') {
            parsedMediaUrls = JSON.parse(confession.media_urls);
          } else if (Array.isArray(confession.media_urls)) {
            parsedMediaUrls = confession.media_urls as unknown as MediaItem[];
          }
        } catch (error) {
          console.error('Error parsing media URLs:', error);
          parsedMediaUrls = [];
        }

        return {
          id: confession.id,
          user_id: confession.user_id,
          content: confession.content,
          media_urls: parsedMediaUrls,
          created_at: confession.created_at,
          likes_count: likes.length,
          dislikes_count: dislikes.length,
          comments_count: confession.confession_comments?.length || 0,
          user_reaction: userReaction ?? null
        };
      });

      // Sort by popularity if needed
      if (sortBy === 'popular') {
        processedConfessions.sort((a, b) => 
          (b.likes_count - b.dislikes_count) - (a.likes_count - a.dislikes_count)
        );
      }

      setConfessions(processedConfessions);
    } catch (error) {
      console.error('Error fetching confessions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [sortBy, anonymousId]);

  const fetchComments = async (confessionId: string) => {
    try {
      const { data, error } = await supabase
        .from('confession_comments')
        .select(`
          *,
          comment_likes (is_like, user_id)
        `)
        .eq('confession_id', confessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Process comments with counts and organize replies
      const processedComments = (data || []).map(comment => {
        const likes = comment.comment_likes?.filter((like: any) => like.is_like) || [];
        const dislikes = comment.comment_likes?.filter((like: any) => !like.is_like) || [];
        const userReaction = anonymousId 
          ? comment.comment_likes?.find((like: any) => like.user_id === anonymousId)?.is_like
          : null;

        return {
          ...comment,
          likes_count: likes.length,
          dislikes_count: dislikes.length,
          user_reaction: userReaction ?? null
        };
      });

      // Organize comments and replies
      const parentComments = processedComments.filter(c => !c.parent_comment_id);
      const commentsWithReplies = parentComments.map(parent => ({
        ...parent,
        replies: processedComments.filter(c => c.parent_comment_id === parent.id)
      }));

      setComments(prev => ({ ...prev, [confessionId]: commentsWithReplies }));
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleReaction = useCallback(async (confessionId: string, isLike: boolean) => {
    if (!anonymousId) return;

    try {
      const { data: existingReaction } = await supabase
        .from('confession_likes')
        .select('*')
        .eq('confession_id', confessionId)
        .eq('user_id', anonymousId)
        .maybeSingle();

      if (existingReaction) {
        if (existingReaction.is_like === isLike) {
          // Remove reaction
          await supabase
            .from('confession_likes')
            .delete()
            .eq('id', existingReaction.id);
        } else {
          // Update reaction
          await supabase
            .from('confession_likes')
            .update({ is_like: isLike })
            .eq('id', existingReaction.id);
        }
      } else {
        // Add new reaction
        await supabase
          .from('confession_likes')
          .insert({
            confession_id: confessionId,
            user_id: anonymousId,
            is_like: isLike
          });
      }

      fetchConfessions();
    } catch (error) {
      console.error('Error handling reaction:', error);
    }
  }, [anonymousId, fetchConfessions]);

  const handleCommentReaction = async (commentId: string, isLike: boolean) => {
    if (!anonymousId) return;

    try {
      const { data: existingReaction } = await supabase
        .from('comment_likes')
        .select('*')
        .eq('comment_id', commentId)
        .eq('user_id', anonymousId)
        .maybeSingle();

      if (existingReaction) {
        if (existingReaction.is_like === isLike) {
          await supabase
            .from('comment_likes')
            .delete()
            .eq('id', existingReaction.id);
        } else {
          await supabase
            .from('comment_likes')
            .update({ is_like: isLike })
            .eq('id', existingReaction.id);
        }
      } else {
        await supabase
          .from('comment_likes')
          .insert({
            comment_id: commentId,
            user_id: anonymousId,
            is_like: isLike
          });
      }

      // Refresh comments for this confession
      const confession = confessions.find(c => 
        comments[c.id]?.some(comment => 
          comment.id === commentId || comment.replies?.some(reply => reply.id === commentId)
        )
      );
      if (confession) {
        fetchComments(confession.id);
      }
    } catch (error) {
      console.error('Error handling comment reaction:', error);
    }
  };

  const handleComment = async (confessionId: string, parentCommentId?: string) => {
    if (!anonymousId || !commentText.trim()) return;

    try {
      const { error } = await supabase
        .from('confession_comments')
        .insert({
          confession_id: confessionId,
          parent_comment_id: parentCommentId || null,
          user_id: anonymousId,
          content: commentText.trim()
        });

      if (error) throw error;

      setCommentText('');
      setCommentingOn(null);
      setReplyingTo(null);
      fetchComments(confessionId);
      fetchConfessions(); // Refresh to update comment count
      
      toast({
        title: 'Comment posted',
        description: 'Your comment has been added',
      });
    } catch (error) {
      console.error('Error posting comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to post comment',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchConfessions();
  }, [sortBy, refreshTrigger]);

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
      <div className="flex items-center justify-between glass-card p-4 rounded-xl">
        <h2 className="text-2xl font-bold bg-gradient-liquid-1 bg-clip-text text-transparent">Recent Confessions</h2>
        <div className="glass-card p-2 rounded-lg">
          <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
            <SelectTrigger className="w-[180px] glass-input border-white/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="glass-card border-white/20 backdrop-blur-xl">
              <SelectItem value="latest">Latest Posts</SelectItem>
              <SelectItem value="oldest">Oldest Posts</SelectItem>
              <SelectItem value="popular">Most Popular</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {confessions.length === 0 ? (
        <div className="glass-card p-12 text-center animate-float">
          <div className="w-16 h-16 bg-gradient-liquid-2 rounded-full mx-auto mb-4 flex items-center justify-center">
            <MessageCircle className="h-8 w-8 text-white" />
          </div>
          <p className="text-muted-foreground text-lg">
            No confessions yet. Be the first to share!
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {confessions.map((confession, index) => (
            <div key={confession.id} className="glass-card p-6 animate-float hover:bg-white/10 transition-all duration-300" style={{ animationDelay: `${index * 0.1}s` }}>
              <div className="flex items-center justify-between mb-4">
                <div className="glass-card px-3 py-1 rounded-full bg-gradient-liquid-2">
                  <span className="font-mono text-sm text-white font-bold">
                    anonymous-{confession.user_id}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground bg-black/20 px-2 py-1 rounded-full backdrop-blur-sm">
                  {formatDistanceToNow(new Date(confession.created_at), { addSuffix: true })}
                </span>
              </div>

              {confession.content && (
                <p className="text-foreground mb-4 whitespace-pre-wrap leading-relaxed">
                  {confession.content}
                </p>
              )}

              {confession.media_urls && confession.media_urls.length > 0 && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {confession.media_urls.map((media: MediaItem, index: number) => (
                    <div key={index} className="glass-card p-2 rounded-xl overflow-hidden group hover:scale-105 transition-transform duration-300">
                      {media.type === 'image' ? (
                        <img
                          src={media.url}
                          alt="Confession media"
                          className="w-full h-48 object-cover rounded-lg"
                        />
                      ) : (
                        <video
                          src={media.url}
                          controls
                          className="w-full h-48 object-cover rounded-lg"
                        >
                          Your browser does not support the video tag.
                        </video>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Reaction buttons */}
              <div className="flex items-center gap-4 mt-6 pt-4 border-t border-white/10">
                <button
                  onClick={() => handleReaction(confession.id, true)}
                  className={`liquid-button px-4 py-2 rounded-xl flex items-center gap-2 transition-all duration-300 ripple ${
                    confession.user_reaction === true ? 'bg-gradient-liquid-1' : 'bg-white/10'
                  }`}
                >
                  <ThumbsUp className="h-4 w-4" />
                  <span className="font-medium">{confession.likes_count || 0}</span>
                </button>
                
                <button
                  onClick={() => handleReaction(confession.id, false)}
                  className={`liquid-button px-4 py-2 rounded-xl flex items-center gap-2 transition-all duration-300 ripple ${
                    confession.user_reaction === false ? 'bg-red-500/80' : 'bg-white/10'
                  }`}
                >
                  <ThumbsDown className="h-4 w-4" />
                  <span className="font-medium">{confession.dislikes_count || 0}</span>
                </button>

                <button
                  onClick={() => {
                    setShowComments(prev => ({ ...prev, [confession.id]: !prev[confession.id] }));
                    if (!comments[confession.id]) {
                      fetchComments(confession.id);
                    }
                  }}
                  className="liquid-button px-4 py-2 rounded-xl flex items-center gap-2 transition-all duration-300 ripple bg-white/10"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span className="font-medium">{confession.comments_count || 0}</span>
                </button>
              </div>

                {/* Comments section */}
                {showComments[confession.id] && (
                  <div className="mt-6 space-y-4 glass-card p-4 rounded-xl">
                    {/* Add comment form */}
                    <div className="flex gap-3">
                      <Textarea
                        placeholder="Write a comment..."
                        value={commentingOn === confession.id ? commentText : ''}
                        onChange={(e) => {
                          setCommentText(e.target.value);
                          setCommentingOn(confession.id);
                          setReplyingTo(null);
                        }}
                        className="glass-input flex-1 min-h-16 border-white/20"
                      />
                      <button
                        onClick={() => handleComment(confession.id)}
                        disabled={!commentText.trim()}
                        className="liquid-button px-6 py-2 rounded-xl text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Post
                      </button>
                    </div>

                    {/* Comments list */}
                    {comments[confession.id]?.map((comment) => (
                      <div key={comment.id} className="bg-muted/50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            anonymous-{comment.user_id}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        
                        <p className="text-sm mb-2">{comment.content}</p>
                        
                        {/* Comment reactions */}
                        <div className="flex items-center gap-2">
                          <Button
                            variant={comment.user_reaction === true ? "default" : "ghost"}
                            size="sm"
                            onClick={() => handleCommentReaction(comment.id, true)}
                            className="h-6 text-xs px-2"
                          >
                            <ThumbsUp className="h-3 w-3 mr-1" />
                            {comment.likes_count || 0}
                          </Button>
                          
                          <Button
                            variant={comment.user_reaction === false ? "destructive" : "ghost"}
                            size="sm"
                            onClick={() => handleCommentReaction(comment.id, false)}
                            className="h-6 text-xs px-2"
                          >
                            <ThumbsDown className="h-3 w-3 mr-1" />
                            {comment.dislikes_count || 0}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setReplyingTo(comment.id);
                              setCommentingOn(confession.id);
                              setCommentText('');
                            }}
                            className="h-6 text-xs px-2"
                          >
                            <Reply className="h-3 w-3 mr-1" />
                            Reply
                          </Button>
                        </div>

                        {/* Reply form */}
                        {replyingTo === comment.id && (
                          <div className="mt-2 flex gap-2">
                            <Textarea
                              placeholder="Write a reply..."
                              value={commentText}
                              onChange={(e) => setCommentText(e.target.value)}
                              className="flex-1 min-h-[50px] text-sm"
                            />
                            <Button
                              onClick={() => handleComment(confession.id, comment.id)}
                              disabled={!commentText.trim()}
                              size="sm"
                            >
                              Reply
                            </Button>
                          </div>
                        )}

                        {/* Replies */}
                        {comment.replies && comment.replies.length > 0 && (
                          <div className="mt-3 ml-4 space-y-2">
                            {comment.replies.map((reply) => (
                              <div key={reply.id} className="bg-background/50 rounded p-3">
                                <div className="flex items-center justify-between mb-1">
                            <Badge variant="outline" className="font-mono text-xs">
                              anonymous-{reply.user_id}
                            </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                                  </span>
                                </div>
                                
                                <p className="text-sm mb-2">{reply.content}</p>
                                
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant={reply.user_reaction === true ? "default" : "ghost"}
                                    size="sm"
                                    onClick={() => handleCommentReaction(reply.id, true)}
                                    className="h-6 text-xs px-2"
                                  >
                                    <ThumbsUp className="h-3 w-3 mr-1" />
                                    {reply.likes_count || 0}
                                  </Button>
                                  
                                  <Button
                                    variant={reply.user_reaction === false ? "destructive" : "ghost"}
                                    size="sm"
                                    onClick={() => handleCommentReaction(reply.id, false)}
                                    className="h-6 text-xs px-2"
                                  >
                                    <ThumbsDown className="h-3 w-3 mr-1" />
                                    {reply.dislikes_count || 0}
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
    </div>
  );
});