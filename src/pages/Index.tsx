import React, { useState, useCallback, lazy, Suspense } from 'react';
import { ConfessionForm } from '@/components/ConfessionForm';
import { ConfessionFeed } from '@/components/ConfessionFeed';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CreditLink } from '@/components/CreditLink';
import { useAnonymousId } from '@/hooks/useAnonymousId';
import { Card } from '@/components/ui/card';

const Index = () => {
  const { anonymousId, isLoading: idLoading } = useAnonymousId();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleConfessionPosted = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  if (idLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center glass-card p-8 animate-glow-pulse">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-liquid-1 bg-clip-text text-transparent">Confession 0</h1>
          <p className="text-muted-foreground">Initializing anonymous identity...</p>
          <div className="mt-4 w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated background blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="liquid-blob absolute top-10 left-10 w-32 h-32 opacity-30"></div>
        <div className="liquid-blob absolute top-40 right-20 w-24 h-24 opacity-20" style={{ animationDelay: '2s' }}></div>
        <div className="liquid-blob absolute bottom-20 left-1/4 w-40 h-40 opacity-25" style={{ animationDelay: '4s' }}></div>
        <div className="liquid-blob absolute bottom-40 right-10 w-20 h-20 opacity-30" style={{ animationDelay: '6s' }}></div>
      </div>

      {/* Header with user info and theme toggle */}
      <div className="relative z-10 glass-card border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold bg-gradient-liquid-1 bg-clip-text text-transparent">
                Confession 0
              </h1>
              {anonymousId && (
                <div className="glass-card px-4 py-2 animate-float">
                  <p className="text-sm">
                    Your ID: <span className="font-mono font-bold text-primary-glow">{anonymousId}</span>
                  </p>
                </div>
              )}
            </div>
            <div className="liquid-button p-2 rounded-lg">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <p className="text-xl text-muted-foreground animate-float" style={{ animationDelay: '0.5s' }}>
            Share your thoughts anonymously in a beautiful glassy interface
          </p>
        </div>

        <div className="max-w-2xl mx-auto space-y-8">
          <div className="glass-card p-8 animate-glow-pulse">
            <div className="relative">
              <div className="absolute -top-2 -left-2 w-4 h-4 bg-primary-glow rounded-full blur-sm animate-pulse"></div>
              <div className="absolute -bottom-2 -right-2 w-3 h-3 bg-accent-glow rounded-full blur-sm animate-pulse" style={{ animationDelay: '1s' }}></div>
              <ConfessionForm 
                anonymousId={anonymousId} 
                onConfessionPosted={handleConfessionPosted}
              />
            </div>
          </div>
          
          <ConfessionFeed 
            anonymousId={anonymousId}
            refreshTrigger={refreshTrigger}
          />
        </div>
      </div>
      
      {/* Credit Link */}
      <CreditLink />
    </div>
  );
};

export default Index;
