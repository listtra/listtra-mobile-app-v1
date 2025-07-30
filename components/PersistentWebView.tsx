// Enhanced PersistentWebView with proper back navigation handling and refresh methods
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useAuth } from '../context/AuthContext';

// Common base URL configuration
const BASE_URL = 'http://192.168.31.224:3000';

type PersistentWebViewProps = {
  route: string;
  onMessage?: (event: WebViewMessageEvent) => void;
  disableAutoNavigation?: boolean;
};

export interface PersistentWebViewRef {
  refresh: () => void;
  reload: () => void;
  injectJavaScript: (script: string) => void;
  clearWebViewAuth: () => void;
}

const PersistentWebView = forwardRef<PersistentWebViewRef, PersistentWebViewProps>(({
  route,
  onMessage,
  disableAutoNavigation = false,
}, ref) => {
  const webViewRef = useRef<WebView>(null);
  const { tokens, logout, isAuthenticated, user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const hasNavigated = useRef(false);
  const [currentUrl, setCurrentUrl] = useState('');
  const isDetailPage = useRef(route.includes('/listings/') && route !== 'listings');

  // Function to clear WebView authentication state
  // Function to clear WebView authentication state (simplified for HttpOnly cookies)
  // Function to clear WebView authentication state (simplified for HttpOnly cookies)
  const clearWebViewAuth = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
      (function() {
        try {
          console.log('Clearing WebView authentication state');
          
          // Clear only what you actually use
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          
          // Clear sessionStorage for safety
          sessionStorage.clear();
          
          // Note: HttpOnly cookies (__Secure-authjs.session-token, etc.) 
          // are handled by the server-side logout process
          // We can't clear them from JavaScript, but that's by design for security
          
          console.log('WebView authentication state cleared');
          
          // Notify mobile app that auth state is cleared
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
    }
  };

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    refresh: () => {
      if (webViewRef.current) {
        // Smart refresh - try to refresh data without full page reload
        webViewRef.current.injectJavaScript(`
          (function() {
            try {
              // Try to call a specific refresh function first
              if (typeof window.refreshData === 'function') {
                console.log('Calling window.refreshData()');
                window.refreshData();
                return true;
              }
              
              // Try to refresh listings specifically
              if (typeof window.refreshListings === 'function') {
                console.log('Calling window.refreshListings()');
                window.refreshListings();
                return true;
              }
              
              // Fallback to location reload
              console.log('Fallback to location.reload()');
              location.reload();
              return true;
            } catch (error) {
              console.error('Error during refresh:', error);
              location.reload();
              return false;
            }
          })();
        `);
      }
    },
    reload: () => {
      if (webViewRef.current) {
        webViewRef.current.reload();
      }
    },
    injectJavaScript: (script: string) => {
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(script);
      }
    },
    clearWebViewAuth
  }));

  // Handle message from WebView
  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('=== WebView message received ===');
      console.log('Message type:', data.type);
      console.log('Full message data:', data);

      if (onMessage) {
        onMessage(event);
      }

      if (data.type === 'GO_BACK') {
        console.log('GO_BACK message received');
        console.log("currentUrl", currentUrl);
        console.log("route", route);

        const isFromAddPage = currentUrl?.includes('/add') || route === 'add';
        const isFromListingDetail = currentUrl?.includes('/listings/');
        const isFromChatPage = currentUrl?.includes('/chat?listing=');
        const isFromChatIndexPage = currentUrl?.includes('/chat/');
        const isFromSigninPage = currentUrl?.includes('/auth/signin') || route === 'auth/signin';

        if (isFromSigninPage) {
          console.log('GO_BACK from signin page, clearing auth and navigating to tabs');
          router.replace('/(tabs)');
          // Let the SignInScreen handle this case
          return;
        }

        // Handle add page navigation back to tabs
        if (isFromAddPage || isFromListingDetail) {
          console.log('GO_BACK from add or listing detail page, navigating to tabs');
          hasNavigated.current = true;
          setCurrentUrl('');
          setIsLoading(true);
          router.replace('/(tabs)');
          return;
        }

        if (isFromChatPage || isFromChatIndexPage) {
          console.log('GO_BACK from chat page, navigating to chats');
          hasNavigated.current = true;
          router.back();
          return;
        }

        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(`
            (function() {
              // Use browser history instead of direct URL change
              if (window.history.length > 1) {
                console.log('Using window.history.back()');
                window.history.back();
              } else {
                // Fallback for when history is empty
                console.log('History empty, navigating to base URL');
                window.location.href = "${BASE_URL}/chats";
              }
              return true;
            })();
          `);
        }

        // Don't update router or current URL here, let the navigation state change handler do it
        return;
      }

      if (data.type === 'AUTH_REQUIRED') {
        console.log('AUTH_REQUIRED', data);
        router.replace('/auth/signin');
        return;
      }

      // FIXED: Only handle listing clicks if auto navigation is NOT disabled
      if (data.type === 'LISTING_CLICKED' && !disableAutoNavigation) {
        console.log("LISTING_CLICKED", data);
        if (data.listing.slug && data.listing.product_id) {
          console.log(`Navigating to listing: ${data.listing.slug}/${data.listing.product_id}`);
          hasNavigated.current = true;
          router.push({
            pathname: "/listings/[slug]/[product_id]/page",
            params: { slug: data.listing.slug, product_id: data.listing.product_id }
          });
        }
        return;
      }

      // If auto navigation is disabled, log but don't navigate
      if (data.type === 'LISTING_CLICKED' && disableAutoNavigation) {
        console.log('LISTING_CLICKED ignored due to disableAutoNavigation');
        return;
      }

      if (data.type === 'PROFILE_CLICKED') {
        if (data.nickname) {
          console.log(`Navigating to profile: ${data.nickname}`);
          hasNavigated.current = true;
          router.push({
            pathname: "/profiles/[nickname]",
            params: { nickname: data.nickname }
          });
        }
        return;
      }

      if (data.type === 'NAVIGATE_TO_LISTINGS') {
        console.log("currentUrl", currentUrl);
        console.log("route", route);
        console.log('NAVIGATE_TO_LISTINGS', data);
        hasNavigated.current = true;
        router.push('/(tabs)');
        return;
      }

      if (data.type === 'NAVIGATE_TO_ADD') {
        console.log("currentUrl", currentUrl);
        console.log("route", route);
        console.log('NAVIGATE_TO_ADD', data);
        hasNavigated.current = true;
        router.push('/(tabs)/add');
        return;
      }

      if (data.type === 'NAVIGATE_CHAT') {
        if (data.chatId) {
          console.log(`Navigating to chat: ${data.chatId}`);
          hasNavigated.current = true;
          router.push({
            pathname: "/chat/[id]",
            params: { id: data.chatId }
          });
        }
        return;
      }

      if (data.type === 'VIEW_ALL_CHATS') {
        console.log('VIEW_ALL_CHATS', data);
        if (data.listingId) {
          console.log(`Navigating to chat index with listing: ${data.listingId}`);
          hasNavigated.current = true;
          router.push({
            pathname: "/chat",
            params: { listingId: data.listingId }
          });
        } else {
          console.log('Navigating to chat index');
          hasNavigated.current = true;
          router.push("/chat");
        }
        return;
      }

      if (data.type === 'NAVIGATE') {
        if (data.path) {
          console.log(`General navigation to: ${data.path}`);
          hasNavigated.current = true;
          router.push(data.path);
        }
        return;
      }

      if (data.type === 'AUTH_LOGIN_SUCCESS' && data.tokens) {
        console.log('Login success received from web app');
        // Optionally handle login success from web
      }

      // Enhanced logout handler
      // Enhanced logout handler
      if (data.type === 'WEB_LOGOUT_SUCCESS') {
        console.log("Web logout confirmed");
        console.log('data', data);

        // Clear WebView authentication state first
        clearWebViewAuth();

        // Force WebView to reload immediately (no setTimeout needed)
        if (webViewRef.current) {
          console.log('Forcing WebView reload after logout');
          webViewRef.current.reload();
        }

        // Then clear mobile app tokens and navigate
        logout().then(() => {
          // Add a small delay to ensure reload happens
          setTimeout(() => {
            router.replace('/auth/signin');
          }, 100);
        });
      }

      // Handle WebView auth cleared confirmation
      if (data.type === 'WEBVIEW_AUTH_CLEARED') {
        console.log('WebView authentication state cleared successfully');
      }

      if (data.type === 'AUTH_VALIDATION_FAILED') {
        console.error('Token validation failed:', data.message);

        if (Constants.executionEnvironment === 'storeClient') {
          console.log('Expo Go detected, attempting to continue without validation');
          return;
        }

        // Handle token validation failure by logging out
        return;
      }

      if (onMessage) {
        onMessage(event);
      }
    } catch (err) {
      console.error('Error handling WebView message:', err);
      if (onMessage) {
        onMessage(event);
      }
    }
  };

  const buildUrl = (baseRoute: string) => {
    const url = new URL(`${BASE_URL}/${baseRoute}`);

    // Only pass tokens if authenticated
    if (isAuthenticated && tokens.accessToken && tokens.refreshToken) {
      url.searchParams.set('access_token', tokens.accessToken);
      url.searchParams.set('refresh_token', tokens.refreshToken);
      url.searchParams.set('isNativeAuth', 'true');

      // Add user ID for ownership checks
      if (user?.id) {
        url.searchParams.set('user_id', user.id);
      }
    } else {
      // Clear any existing tokens from URL if not authenticated
      url.searchParams.delete('access_token');
      url.searchParams.delete('refresh_token');
      url.searchParams.delete('isNativeAuth');
      url.searchParams.delete('user_id');
    }

    return url.toString();
  };

  // Update URL when authentication state changes
  useEffect(() => {
    const newUrl = buildUrl(route);
    setCurrentUrl(newUrl);
  }, [route, isAuthenticated, tokens.accessToken, tokens.refreshToken, user?.id]);

  // Clear WebView auth state when mobile app logs out
  useEffect(() => {
    if (!isAuthenticated && !tokens.accessToken) {
      // Clear WebView authentication state when mobile app is not authenticated
      clearWebViewAuth();
    }
  }, [isAuthenticated, tokens.accessToken]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: currentUrl }}
        style={styles.webView}
        onLoad={() => setIsLoading(false)}
        onError={(e) => setError(`WebView error: ${e.nativeEvent.description}`)}
        onHttpError={(e) => setError(`HTTP error: ${e.nativeEvent.statusCode}`)}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        cacheEnabled={true}
        thirdPartyCookiesEnabled={true}
        sharedCookiesEnabled={true}
        originWhitelist={['*']}
        mixedContentMode="always"
        allowsInlineMediaPlayback={true}
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        injectedJavaScript={`
          (function() {
            try {
              console.log('WebView authentication state manager initialized');
              
              // Check if we're in a mobile WebView
              const isInWebView = !!(window.ReactNativeWebView || 
                window.webkit?.messageHandlers || 
                navigator.userAgent.includes('wv'));
              
              if (isInWebView) {
                console.log('Running in mobile WebView - setting up auth state management');
                
                // Set up periodic check for authentication state
                setInterval(() => {
                  const token = localStorage.getItem('token');
                  const refreshToken = localStorage.getItem('refreshToken');
                  const user = localStorage.getItem('user');
                  
                  // If no tokens but we're on a protected page, notify mobile app
                  if (!token && !refreshToken) {
                    const protectedRoutes = ['/profile', '/add', '/chats', '/liked'];
                    const currentPath = window.location.pathname;
                    
                    if (protectedRoutes.some(route => currentPath.startsWith(route))) {
                      console.log('No tokens found on protected route, notifying mobile app');
                      if (window.ReactNativeWebView) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'AUTH_REQUIRED',
                          path: currentPath
                        }));
                      }
                    }
                  }
                }, 5000); // Check every 5 seconds
                
                // Override logout function to ensure proper cleanup
                const originalLogout = window.logout;
                window.logout = function() {
                  console.log('Logout called from WebView');
                  
                  // Clear all auth state
                  localStorage.removeItem('token');
                  localStorage.removeItem('refreshToken');
                  localStorage.removeItem('user');
                  localStorage.removeItem('next-auth.session-token');
                  localStorage.removeItem('next-auth.refresh-token');
                  sessionStorage.clear();
                  
                  // Clear cookies
                  document.cookie.split(";").forEach(function(c) { 
                    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
                  });
                  
                  // Notify mobile app
                  if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'AUTH_LOGOUT',
                      message: 'Logout initiated from WebView'
                    }));
                  }
                  
                  // Call original logout if it exists
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
        `}
      />
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
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  webView: {
    flex: 1,
  },
  loaderContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
});