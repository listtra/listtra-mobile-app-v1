import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, RefreshControl, ScrollView } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useAuth } from '../context/AuthContext';
import OfflineScreen from './OfflineScreen';
import NetInfo from '@react-native-community/netinfo';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as AuthSession from 'expo-auth-session';

//const BASE_URL = 'https://listtra.com';
//const BASE_URL = 'http://192.168.31.224:3000';
//const BASE_URL = 'https://listtra-git-google-login-listtra.vercel.app';
const BASE_URL = 'https://2b13735b333a.ngrok-free.app';

type PersistentWebViewProps = {
  route: string;
  onMessage?: (event: WebViewMessageEvent) => void;
  disableAutoNavigation?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  disableRefresh?: boolean;
};

export interface PersistentWebViewRef {
  refresh: () => void;
  reload: () => void;
  injectJavaScript: (script: string) => void;
  clearWebViewAuth: () => void;
}

// Extracted message handlers for better organization
const createMessageHandlers = (router: any, webViewRef: React.RefObject<WebView>, currentUrl: string, route: string, hasNavigated: React.MutableRefObject<boolean>, disableAutoNavigation: boolean, clearWebViewAuth: () => void, logout: () => Promise<void>, loginWithGoogle: () => Promise<void>,
  setTokensDirectly: (accessToken: string, refreshToken: string, userData?: any) => Promise<void>) => ({
    GO_BACK: () => {
      const isFromAddPage = currentUrl?.includes('/add') || route === 'add';
      const isFromAddSuccessPage = currentUrl?.includes('/add-success') || route === 'add-success';
      const isFromListingDetail = currentUrl?.includes('/listings/');
      const isFromChatPage = currentUrl?.includes('/chat?listing=');
      const isFromChatIndexPage = currentUrl?.includes('/chat/');
      const isFromChatsPage = currentUrl?.includes('/chats') || route === 'chats';
      const isFromSigninPage = currentUrl?.includes('/auth/signin') || route === 'auth/signin';

      if (isFromSigninPage) {
        router.replace('/(tabs)');
        return;
      }

      if (isFromAddPage || isFromAddSuccessPage) {
        hasNavigated.current = true;
        router.replace('/(tabs)');
        return;
      }

      if (isFromChatsPage) {
        hasNavigated.current = true;
        router.replace('/(tabs)');
        return;
      }

      if (isFromListingDetail) {
        hasNavigated.current = true;
        router.back();
        return;
      }

      if (isFromChatPage || isFromChatIndexPage) {
        hasNavigated.current = true;
        router.back();
        return;
      }

      webViewRef.current?.injectJavaScript(`
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "${BASE_URL}/chats";
      }
    `);
    },

    OPEN_WEB_OAUTH: async (data: any) => {
      try {
        const provider = data?.provider || 'google';

        // Check if running in Expo Go
        const isExpoGo = Constants.executionEnvironment === 'storeClient';

        let returnUrl: string;
        if (isExpoGo) {
          // Expo Go: use proxy URL
          returnUrl = AuthSession.makeRedirectUri({ useProxy: true } as any);
        } else {
          // Dev/Production: use custom scheme with explicit double slashes
          returnUrl = 'com.listtra.app://oauth-callback';
        }

        console.log('Original return URL before encoding:', returnUrl);

        // We'll have the web page bounce to this page and then to returnUrl with tokens
        const callbackUrl = `${BASE_URL}/auth/mobile-return?returnUrl=${encodeURIComponent(returnUrl)}`;

        console.log('Callback URL with encoded return URL:', callbackUrl);

        // Use dedicated mobile OAuth page that auto-triggers
        const authUrl = `${BASE_URL}/auth/mobile-oauth?provider=${provider}&callbackUrl=${encodeURIComponent(callbackUrl)}`;

        console.log('Opening OAuth URL:', authUrl);
        console.log('Return URL (should have double slashes):', returnUrl);
        console.log('Is Expo Go:', isExpoGo);

        const result = await WebBrowser.openAuthSessionAsync(authUrl, returnUrl);
        console.log('Auth session result type:', result.type);
        console.log('Auth session result:', JSON.stringify(result, null, 2));

        if (result.type === 'success' && result.url) {
          console.log('Success URL received:', result.url);
          const url = new URL(result.url);
          const access = url.searchParams.get('access');
          const refresh = url.searchParams.get('refresh');
          const userParam = url.searchParams.get('user');

          console.log('Extracted tokens:', { access: access ? 'present' : 'missing', refresh: refresh ? 'present' : 'missing' });

          if (access && refresh) {
            const userData = userParam ? JSON.parse(decodeURIComponent(userParam)) : undefined;
            console.log('Setting tokens directly from WebBrowser result');
            await setTokensDirectly(access, refresh, userData);
            router.replace('/(tabs)');
          } else {
            console.error('No tokens in success URL');
            router.replace('/auth/signin');
          }
        } else if (result.type === 'cancel') {
          console.log('Auth session was cancelled by user');
        } else {
          console.log('Auth session failed:', result);
          router.replace('/auth/signin');
        }
      } catch (e) {
        console.error('Failed to open web OAuth:', e);
        router.replace('/auth/signin');
      }
    },

    // AUTH_LOGIN_SUCCESS: async (data: any) => {
    //   try {
    //     if (data?.tokens?.accessToken && data?.tokens?.refreshToken) {
    //       await setTokensDirectly(data.tokens.accessToken, data.tokens.refreshToken, data.user);
    //       setTimeout(() => router.replace('/(tabs)'), 300)
    //     } else {
    //       console.error('AUTH_LOGIN_SUCCESS missing tokens');
    //     }
    //   } catch (error) {
    //     console.error('Error during AUTH_LOGIN_SUCCESS:', error);
    //   }
    // },

    LISTING_CLICKED: (data: any) => {
      if (!disableAutoNavigation && data.listing.slug && data.listing.product_id) {
        hasNavigated.current = true;
        router.push({
          pathname: "/listings/[slug]/[product_id]/page",
          params: { slug: data.listing.slug, product_id: data.listing.product_id }
        });
      }
    },

    PROFILE_CLICKED: (data: any) => {
      if (data.nickname) {
        hasNavigated.current = true;
        router.push({
          pathname: "/profiles/[nickname]",
          params: { nickname: data.nickname }
        });
      }
    },

    NAVIGATE_TO_LISTINGS: () => {
      hasNavigated.current = true;
      router.push('/(tabs)');
    },

    NAVIGATE_TO_LISTING: (data: any) => {
      if (data.slug && data.productId) {
        hasNavigated.current = true;
        router.push({
          pathname: "/listings/[slug]/[product_id]/page",
          params: { slug: data.slug, product_id: data.productId }
        });
      }
    },

    NAVIGATE_TO_ADD: () => {
      hasNavigated.current = true;
      router.push('/(tabs)/add');
    },

    NAVIGATE_CHAT: (data: any) => {
      if (data.chatId) {
        hasNavigated.current = true;
        router.push({
          pathname: "/chat/[id]",
          params: { id: data.chatId }
        });
      }
    },

    VIEW_ALL_CHATS: (data: any) => {
      hasNavigated.current = true;
      if (data.listingId) {
        router.push({
          pathname: "/chat",
          params: { listingId: data.listingId }
        });
      } else {
        router.push("/chat");
      }
    },

    NAVIGATE: (data: any) => {
      if (data.path) {
        hasNavigated.current = true;
        router.push(data.path);
      }
    },

    WEB_LOGOUT_SUCCESS: () => {
      clearWebViewAuth();
      webViewRef.current?.reload();
      logout().then(() => {
        setTimeout(() => router.replace('/auth/signin'), 100);
      });
    }
  });



const PersistentWebView = forwardRef<PersistentWebViewRef, PersistentWebViewProps>(({
  route,
  onMessage,
  disableAutoNavigation = false,
  onRefresh,
  refreshing = false,
  disableRefresh = false
}, ref) => {
  const webViewRef = useRef<WebView>(null);
  const { tokens, logout, isAuthenticated, user, loginWithGoogle, setTokensDirectly } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [isDeviceOffline, setIsDeviceOffline] = useState(false);
  const router = useRouter();
  const hasNavigated = useRef(false);
  const [currentUrl, setCurrentUrl] = useState('');
  const isDetailPage = useRef(route.includes('/listings/') && route !== 'listings');

  // Memoized injected JavaScript
  const injectedJavaScript = useMemo(() => `
(function() {
  try {
    console.log('WebView authentication state manager initialized');
    
    const isInWebView = !!(window.ReactNativeWebView || 
      window.webkit?.messageHandlers || 
      navigator.userAgent.includes('wv'));
    
    if (isInWebView) {
      console.log('Running in mobile WebView - setting up auth state management');
      
      setInterval(() => {
        const token = localStorage.getItem('token');
        const refreshToken = localStorage.getItem('refreshToken');
        
        if (!token && !refreshToken) {
          const protectedRoutes = ['/profile', '/add', '/chats', '/liked'];
          const currentPath = window.location.pathname;
          
          if (protectedRoutes.some(route => currentPath.startsWith(route))) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'AUTH_REQUIRED',
                path: currentPath
              }));
            }
          }
        }
      }, 5000);

      // Keep logout bridge
      const originalLogout = window.logout;
      window.logout = function() {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        localStorage.removeItem('next-auth.session-token');
        localStorage.removeItem('next-auth.refresh-token');
        sessionStorage.clear();
        
        document.cookie.split(";").forEach(function(c) { 
          document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
        });
        
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'AUTH_LOGOUT',
            message: 'Logout initiated from WebView'
          }));
        }
        
        if (typeof originalLogout === 'function') {
          originalLogout();
        }
      };
      
      console.log('WebView auth state management setup complete');
    }
  } catch (error) {
    console.error('Error setting up WebView auth state management:', error);
  }
})();
`, []);

  // Clear WebView authentication state
  const clearWebViewAuth = useCallback(() => {
    webViewRef.current?.injectJavaScript(`
      (function() {
        try {
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          sessionStorage.clear();
          
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'WEBVIEW_AUTH_CLEARED'
            }));
          }
          return true;
        } catch (error) {
          console.error('Error clearing WebView auth state:', error);
          return false;
        }
      })();
    `);
  }, []);

  // Restore WebView authentication state
  const restoreWebViewAuth = useCallback(() => {
    if (webViewRef.current && isAuthenticated && tokens.accessToken && tokens.refreshToken) {
      webViewRef.current.injectJavaScript(`
        (function() {
          try {
            localStorage.setItem('token', '${tokens.accessToken}');
            localStorage.setItem('refreshToken', '${tokens.refreshToken}');
            ${user ? `localStorage.setItem('user', JSON.stringify(${JSON.stringify(user)}));` : ''}
            
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'AUTH_RESTORED',
                user: ${user ? JSON.stringify(user) : 'null'}
              }));
            }
            return true;
          } catch (error) {
            console.error('Error restoring WebView auth state:', error);
            return false;
          }
        })();
      `);
    }
  }, [isAuthenticated, tokens.accessToken, tokens.refreshToken, user]);

  // Memoized message handlers
  const messageHandlers = useMemo(() =>
    createMessageHandlers(
      router,
      webViewRef as React.RefObject<WebView<{}>>,
      currentUrl,
      route,
      hasNavigated,
      disableAutoNavigation,
      clearWebViewAuth,
      logout,
      loginWithGoogle,
      setTokensDirectly
    ),
    [router, currentUrl, route, disableAutoNavigation, logout, loginWithGoogle, setTokensDirectly]
  );

  // Network error detection
  const isNetworkError = useCallback((errorMessage: string) => {
    const networkErrors = [
      'net::ERR_INTERNET_DISCONNECTED', 'net::ERR_NETWORK_CHANGED',
      'net::ERR_CONNECTION_REFUSED', 'net::ERR_CONNECTION_TIMED_OUT',
      'net::ERR_NAME_NOT_RESOLVED', 'ERR_INTERNET_DISCONNECTED',
      'ERR_NETWORK_CHANGED', 'ERR_CONNECTION_REFUSED',
      'ERR_CONNECTION_TIMED_OUT', 'ERR_NAME_NOT_RESOLVED'
    ];
    return networkErrors.some(error => errorMessage.includes(error));
  }, []);





  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    refresh: () => {
      webViewRef.current?.injectJavaScript(`
        (function() {
          try {
            if (typeof window.refreshData === 'function') {
              window.refreshData();
              return true;
            }
            if (typeof window.refreshListings === 'function') {
              window.refreshListings();
              return true;
            }
            location.reload();
            return true;
          } catch (error) {
            console.error('Error during refresh:', error);
            location.reload();
            return false;
          }
        })();
      `);
    },
    reload: () => webViewRef.current?.reload(),
    injectJavaScript: (script: string) => webViewRef.current?.injectJavaScript(script),
    clearWebViewAuth
  }), [clearWebViewAuth]);

  // Handle message from WebView
  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('WebView message received:', data.type, data);

      if (onMessage) {
        onMessage(event);
      }

      const handler = messageHandlers[data.type as keyof typeof messageHandlers];
      if (handler) {
        handler(data);
        return;
      }
      // Handle special cases
      if (data.type === 'AUTH_REQUIRED') {
        router.replace('/auth/signin');
        return;
      }

      if (data.type === 'AUTH_VALIDATION_FAILED' && Constants.executionEnvironment !== 'storeClient') {
        console.error('Token validation failed:', data.message);
        return;
      }

    } catch (err) {
      console.error('Error handling WebView message:', err);
      if (onMessage) {
        onMessage(event);
      }
    }
  }, [onMessage, messageHandlers, router]);

  // Build URL with authentication
  const buildUrl = useCallback((baseRoute: string) => {
    const url = new URL(`${BASE_URL}/${baseRoute}`);

    if (isAuthenticated && tokens.accessToken && tokens.refreshToken) {
      url.searchParams.set('access_token', tokens.accessToken);
      url.searchParams.set('refresh_token', tokens.refreshToken);
      url.searchParams.set('isNativeAuth', 'true');
      if (user?.id) {
        url.searchParams.set('user_id', user.id);
      }
    } else {
      ['access_token', 'refresh_token', 'isNativeAuth', 'user_id'].forEach(param =>
        url.searchParams.delete(param)
      );
    }

    return url.toString();
  }, [isAuthenticated, tokens.accessToken, tokens.refreshToken, user?.id]);

  // Combined effects for better performance
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsDeviceOffline(!state.isConnected);
      if (!state.isConnected) {
        setIsOffline(true);
        setError('No internet connection');
      } else {
        setIsOffline(false);
        setError(null);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const newUrl = buildUrl(route);
    setCurrentUrl(newUrl);

    if (isAuthenticated && tokens.accessToken && tokens.refreshToken) {
      setTimeout(restoreWebViewAuth, 500);
    }
  }, [route, buildUrl, isAuthenticated, tokens.accessToken, tokens.refreshToken, restoreWebViewAuth]);

  useEffect(() => {
    if (!isAuthenticated && !tokens.accessToken) {
      clearWebViewAuth();
    }
  }, [isAuthenticated, tokens.accessToken, clearWebViewAuth]);

  // Error handlers
  const handleError = useCallback((e: any) => {
    const errorMessage = e.nativeEvent.description || e.nativeEvent.message || '';
    console.error('WebView error:', errorMessage);

    if (isNetworkError(errorMessage)) {
      setIsOffline(true);
      setError('No internet connection');
    } else {
      setError(`WebView error: ${errorMessage}`);
    }
    setIsLoading(false);
  }, [isNetworkError]);

  const handleHttpError = useCallback((e: any) => {
    const errorMessage = `HTTP error: ${e.nativeEvent.statusCode}`;
    console.error(errorMessage);

    if (e.nativeEvent.statusCode >= 500) {
      setIsOffline(true);
      setError('Server error - please check your connection');
    } else {
      setError(errorMessage);
    }
    setIsLoading(false);
  }, []);

  const handleRetry = useCallback(() => {
    setIsOffline(false);
    setError(null);
    setIsLoading(true);
    webViewRef.current?.reload();
  }, []);

  const handleRefresh = useCallback(() => {
    if (onRefresh) {
      onRefresh();
    } else {
      webViewRef.current?.reload();
    }
  }, [onRefresh]);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setIsOffline(false);
    setError(null);
  }, []);

  // Memoized WebView props
  const webViewProps = useMemo(() => ({
    ref: webViewRef,
    source: { uri: currentUrl },
    style: styles.webView,
    onLoad: handleLoad,
    onError: handleError,
    onHttpError: handleHttpError,
    onMessage: handleMessage,
    javaScriptEnabled: true,
    domStorageEnabled: true,
    cacheEnabled: true,
    thirdPartyCookiesEnabled: true,
    sharedCookiesEnabled: true,
    originWhitelist: ['*'],
    mixedContentMode: "always" as const,
    allowsInlineMediaPlayback: true,
    allowFileAccess: true,
    allowUniversalAccessFromFileURLs: true,
    injectedJavaScript,
    onShouldStartLoadWithRequest: (req: any) => {
      try {
        const url = req?.url || '';
        console.log('Webview navigation request:', url);
        return true;
      } catch (error) {
        console.log('Error in onShouldStartLoadWithRequest:', error);
        return true;
      }
    }
  }), [currentUrl, handleLoad, handleError, handleHttpError, handleMessage, injectedJavaScript]);

  return (
    <View style={styles.container}>
      {isOffline ? (
        <OfflineScreen onRetry={handleRetry} message={error || 'No internet connection'} />
      ) : disableRefresh ? (
        <WebView {...webViewProps} />
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#2528be']}
              tintColor="#2528be"
            />
          }
          scrollEventThrottle={16}
        >
          <WebView {...webViewProps} />
        </ScrollView>
      )}
      {isLoading && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#2528be" />
        </View>
      )}
    </View>
  );
});

PersistentWebView.displayName = 'PersistentWebView';

export default PersistentWebView;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  scrollView: { flex: 1 },
  scrollViewContent: { flexGrow: 1 },
  webView: { flex: 1, minHeight: '100%' },
  loaderContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
});