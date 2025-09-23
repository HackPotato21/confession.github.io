import React from 'react';

export const CreditLink = React.memo(() => {
  const handleClick = () => {
    window.open('https://www.instagram.com/with._.hacker/#', '_blank', 'noopener,noreferrer');
  };

  return (
    <div 
      className="fixed bottom-4 right-4 z-50 glass-card px-4 py-2 rounded-full cursor-pointer hover:scale-105 transition-all duration-300 animate-float"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick();
        }
      }}
    >
      <span className="text-sm font-medium bg-gradient-liquid-1 bg-clip-text text-transparent">
        Made By @with._.hacker
      </span>
    </div>
  );
});

CreditLink.displayName = 'CreditLink';