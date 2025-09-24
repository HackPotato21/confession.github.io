import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { BrowserRouter, HashRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const App = () => {
  // GitHub Pages SPA redirect handling
  React.useEffect(() => {
    if (window.location.search.startsWith('?/')) {
      const redirect = window.location.search.slice(2).split('&').map(s => s.replace(/~and~/g, '&')).join('?');
      window.history.replaceState(null, '', window.location.pathname + redirect + window.location.hash);
    }
  }, []);

  return (
    <ThemeProvider defaultTheme="system" storageKey="confession-0-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {import.meta.env.PROD ? (
          <HashRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </HashRouter>
        ) : (
          <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Routes>
              <Route path="/" element={<Index />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        )}
      </TooltipProvider>
    </ThemeProvider>
  );
};

export default App;
