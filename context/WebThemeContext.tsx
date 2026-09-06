import React, { createContext, useContext, useMemo, useState } from 'react';

type WebTheme = 'light' | 'dark';

type WebThemeContextValue = {
  // null until the WebView's own dark-mode toggle (zirkly-web's
  // ThemeContext.jsx) has reported in at least once — before that there is
  // nothing to override the OS appearance setting with.
  webTheme: WebTheme | null;
  setWebTheme: (theme: WebTheme) => void;
};

const WebThemeContext = createContext<WebThemeContextValue | undefined>(undefined);

/**
 * Bridges the web app's in-app dark-mode toggle (a manual choice stored in
 * the WebView's own localStorage) into native state, so things like the
 * status bar — which only otherwise know about the device's OS-level
 * appearance setting — can follow it instead.
 *
 * PersistentWebView.tsx calls setWebTheme() on the THEME_CHANGED message;
 * _layout.tsx reads webTheme to decide the <StatusBar> style/backgroundColor,
 * falling back to the OS colorScheme while webTheme is still null (e.g.
 * before the WebView has finished its first load).
 */
export function WebThemeProvider({ children }: { children: React.ReactNode }) {
  const [webTheme, setWebTheme] = useState<WebTheme | null>(null);
  const value = useMemo(() => ({ webTheme, setWebTheme }), [webTheme]);
  return <WebThemeContext.Provider value={value}>{children}</WebThemeContext.Provider>;
}

export function useWebTheme() {
  const context = useContext(WebThemeContext);
  if (!context) {
    throw new Error('useWebTheme must be used within a WebThemeProvider');
  }
  return context;
}

// Shared native-side equivalent of zirkly-web's bg-gray-50/dark:bg-gray-900 —
// every native View/SafeAreaView that sits behind or around a WebView (the
// tab screens' top-inset SafeAreaViews, PersistentWebView's own container)
// should paint this instead of a hardcoded white, so the moment before the
// WebView finishes loading, and any inset it doesn't cover, matches whatever
// the web app's own theme currently is rather than defaulting to light.
export function useNativeBg() {
  const { webTheme } = useWebTheme();
  return webTheme === 'dark' ? '#111827' : '#F9FAFB';
}
