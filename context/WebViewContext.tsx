import React, { createContext, useContext, useState, useCallback } from 'react';

type WebViewContextType = {
  currentRoute: string;
  setCurrentRoute: (route: string) => void;
  navigateToRoute: (route: string) => void;
  canGoBack: boolean;
  setCanGoBack: (canGoBack: boolean) => void;
};

const WebViewContext = createContext<WebViewContextType | undefined>(undefined);

export const useWebView = () => {
  const context = useContext(WebViewContext);
  if (!context) {
    throw new Error('useWebView must be used within a WebViewProvider');
  }
  return context;
};

export const WebViewProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentRoute, setCurrentRoute] = useState('listings');
  const [canGoBack, setCanGoBack] = useState(false);

  const navigateToRoute = useCallback((route: string) => {
    console.log('WebViewContext: Navigating to route:', route);
    setCurrentRoute(route);
  }, []);

  return (
    <WebViewContext.Provider
      value={{
        currentRoute,
        setCurrentRoute,
        navigateToRoute,
        canGoBack,
        setCanGoBack,
      }}
    >
      {children}
    </WebViewContext.Provider>
  );
};