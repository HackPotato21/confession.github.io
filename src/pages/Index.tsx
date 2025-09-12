import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ConfessionForm } from '@/components/ConfessionForm';
import { ConfessionFeed } from '@/components/ConfessionFeed';
import { useAnonymousId } from '@/hooks/useAnonymousId';
import { Card } from '@/components/ui/card';

const Index = () => {
  const { anonymousId, isLoading: idLoading } = useAnonymousId();

  if (idLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Confession 0</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-4">Confession 0</h1>
          <p className="text-xl text-muted-foreground mb-2">
            Share your thoughts anonymously
          </p>
          {anonymousId && (
            <Card className="inline-block px-4 py-2 bg-primary/10">
              <p className="text-sm">
                Your ID: <span className="font-mono font-bold">{anonymousId}</span>
              </p>
            </Card>
          )}
        </header>

        <div className="max-w-2xl mx-auto space-y-8">
          <ConfessionForm anonymousId={anonymousId} />
          <ConfessionFeed />
        </div>
      </div>
    </div>
  );
};

export default Index;
