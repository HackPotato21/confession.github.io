import { useState } from 'react';
import { ConfessionForm } from '@/components/ConfessionForm';
import { ConfessionFeed } from '@/components/ConfessionFeed';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAnonymousId } from '@/hooks/useAnonymousId';
import { Card } from '@/components/ui/card';

const Index = () => {
  const { anonymousId, isLoading: idLoading } = useAnonymousId();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleConfessionPosted = () => {
    setRefreshTrigger(prev => prev + 1);
  };

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
      {/* Header with user info and theme toggle */}
      <div className="bg-card border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold">Confession 0</h1>
              {anonymousId && (
                <Card className="px-3 py-1 bg-primary/10">
                  <p className="text-sm">
                    Your ID: <span className="font-mono font-bold">{anonymousId}</span>
                  </p>
                </Card>
              )}
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <p className="text-xl text-muted-foreground">
            Share your thoughts anonymously
          </p>
        </div>

        <div className="max-w-2xl mx-auto space-y-8">
          <ConfessionForm 
            anonymousId={anonymousId} 
            onConfessionPosted={handleConfessionPosted}
          />
          <ConfessionFeed 
            anonymousId={anonymousId}
            refreshTrigger={refreshTrigger}
          />
        </div>
      </div>
    </div>
  );
};

export default Index;
