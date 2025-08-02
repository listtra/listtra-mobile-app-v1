// Enhanced PersistentWebView with proper back navigation handling and refresh methods
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, RefreshControl, ScrollView } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useAuth } from '../context/AuthContext';
import OfflineScreen from './OfflineScreen';
import NetInfo from '@react-native-community/netinfo';

// Common base URL configuration
const BASE_URL = 'https://listtra.com';
//const BASE_URL = 'http://192.168.31.224:3000';


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

const PersistentWebView = forwardRef<PersistentWebViewRef, PersistentWebViewProps>(({
  route,
  onMessage,
  disableAutoNavigation = false,
  onRefresh,
  refreshing = false,
  disableRefresh = false
}, ref) => {
  const webViewRef = useRef<WebView>(null);
  const { tokens, logout, isAuthenticated, user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [isDeviceOffline, setIsDeviceOffline] = useState(false);
  const router = useRouter();
  const hasNavigated = useRef(false);
  const [currentUrl, setCurrentUrl] = useState('');
  const isDetailPage = useRef(route.includes('/listings/') && route !== 'listings');

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

  // Function to check if error is network-related
  const isNetworkError = (errorMessage: string) => {
    const networkErrors = [
      'net::ERR_INTERNET_DISCONNECTED',
      'net::ERR_NETWORK_CHANGED',
      'net::ERR_CONNECTION_REFUSED',
      'net::ERR_CONNECTION_TIMED_OUT',
      'net::ERR_NAME_NOT_RESOLVED',
      'ERR_INTERNET_DISCONNECTED',
      'ERR_NETWORK_CHANGED',
      'ERR_CONNECTION_REFUSED',
      'ERR_CONNECTION_TIMED_OUT',
      'ERR_NAME_NOT_RESOLVED'
    ];

    return networkErrors.some(error => errorMessage.includes(error));
  };

  // Function to handle retry
  const handleRetry = () => {
    setIsOffline(false);
    setError(null);
    setIsLoading(true);

    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  };

  // Function to clear WebView authentication state
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

  // Add this new function to restore WebView authentication state
  const restoreWebViewAuth = () => {
    if (webViewRef.current && isAuthenticated && tokens.accessToken && tokens.refreshToken) {
      webViewRef.current.injectJavaScript(`
        (function() {
          try {
            console.log('Restoring WebView authentication state');
            
            // Store tokens in localStorage
            localStorage.setItem('token', '${tokens.accessToken}');
            localStorage.setItem('refreshToken', '${tokens.refreshToken}');
            
            // Set user data if available
            ${user ? `localStorage.setItem('user', JSON.stringify(${JSON.stringify(user)}));` : ''}
            
            // Notify the web app that authentication has been restored
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'AUTH_RESTORED',
                user: ${user ? JSON.stringify(user) : 'null'}
              }));
            }
            
            console.log('WebView authentication state restored');
            return true;
          } catch (error) {
            console.error('Error restoring WebView auth state:', error);
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
        const isFromAddSuccessPage = currentUrl?.includes('/add-success') || route === 'add-success';
        const isFromListingDetail = currentUrl?.includes('/listings/');
        const isFromChatPage = currentUrl?.includes('/chat?listing=');
        const isFromChatIndexPage = currentUrl?.includes('/chat/');
        const isFromChatsPage = currentUrl?.includes('/chats') || route === 'chats';
        const isFromSigninPage = currentUrl?.includes('/auth/signin') || route === 'auth/signin';

        if (isFromSigninPage) {
          console.log('GO_BACK from signin page, clearing auth and navigating to tabs');
          router.replace('/(tabs)');
          // Let the SignInScreen handle this case
          return;
        }

        // Handle add page navigation back to tabs
        if (isFromAddPage || isFromAddSuccessPage) {
          console.log('GO_BACK from add or add success page, navigating to tabs');
          hasNavigated.current = true;
          setCurrentUrl('');
          setIsLoading(true);
          router.replace('/(tabs)');
          return;
        }

        if (isFromChatsPage) {
          console.log('GO_BACK from chats page, navigating to (tabs)');
          hasNavigated.current = true;
          router.replace('/(tabs)');
          return;
        }

        if (isFromListingDetail) {
          console.log('GO_BACK from listing detail, navigating back to listings');
          hasNavigated.current = true;
          router.back();
          return;
        }

        if (isFromChatPage) {
          console.log('GO_BACK from chat page, navigating to chats');
          hasNavigated.current = true;
          router.back();
          return;
        }

        if (isFromChatIndexPage) {
          console.log('GO_BACK from chat index page, navigating to chats');
          hasNavigated.current = true;
          router.push('/(tabs)/chats');
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

      if (data.type === 'NAVIGATE_TO_LISTING') {
        console.log('NAVIGATE_TO_LISTING message received:', data);
        if (data.slug && data.productId) {
          console.log(`Navigating to listing: ${data.slug}/${data.productId}`);
          hasNavigated.current = true;
          router.push({
            pathname: "/listings/[slug]/[product_id]/page",
            params: { slug: data.slug, product_id: data.productId }
          });
        }
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
          console.log('Current route before navigation:', route);
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
    console.log('buildUrl', url);

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

    // Restore WebView authentication state when tokens are available
    if (isAuthenticated && tokens.accessToken && tokens.refreshToken) {
      // Add a small delay to ensure WebView is loaded
      setTimeout(() => {
        restoreWebViewAuth();
      }, 500);
    }
  }, [route, isAuthenticated, tokens.accessToken, tokens.refreshToken, user?.id]);

  // Clear WebView auth state when mobile app logs out
  useEffect(() => {
    if (!isAuthenticated && !tokens.accessToken) {
      // Clear WebView authentication state when mobile app is not authenticated
      clearWebViewAuth();
    }
  }, [isAuthenticated, tokens.accessToken]);

  // Handle pull-to-refresh
  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    } else {
      // Default refresh behavior
      if (webViewRef.current) {
        webViewRef.current.reload();
      }
    }
  };

  const handleError = (e: any) => {
    const errorMessage = e.nativeEvent.description || e.nativeEvent.message || '';
    console.error('WebView error:', errorMessage);
    console.log('Error event:', e.nativeEvent);
    console.log('Is network error?', isNetworkError(errorMessage));

    if (isNetworkError(errorMessage)) {
      console.log('Setting offline state to true');
      setIsOffline(true);
      setError('No internet connection');
    } else {
      console.log('Setting regular error');
      setError(`WebView error: ${errorMessage}`);
    }
    setIsLoading(false);
  };

  // Handle HTTP errors
  const handleHttpError = (e: any) => {
    const errorMessage = `HTTP error: ${e.nativeEvent.statusCode}`;
    console.error(errorMessage);
    console.log('HTTP error event:', e.nativeEvent);

    if (e.nativeEvent.statusCode >= 500) {
      // Server errors might be network-related
      console.log('Setting offline state to true for server error');
      setIsOffline(true);
      setError('Server error - please check your connection');
    } else {
      console.log('Setting regular HTTP error');
      setError(errorMessage);
    }
    setIsLoading(false);
  };

  // Add this useEffect for debugging
  useEffect(() => {
    console.log('Current state:', {
      isOffline,
      error,
      isLoading,
      currentUrl
    });
  }, [isOffline, error, isLoading, currentUrl]);

  return (
    <View style={styles.container}>
      {isOffline ? (
        <OfflineScreen onRetry={handleRetry} message={error || 'No internet connection'} />
      ) :
        disableRefresh ? (
          <WebView
            ref={webViewRef}
            source={{ uri: currentUrl }}
            style={styles.webView}
            onLoad={() => {
              setIsLoading(false);
              setIsOffline(false);
              setError(null);
            }}
            onError={handleError}
            onHttpError={handleHttpError}
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
            <WebView
              ref={webViewRef}
              source={{ uri: currentUrl }}
              style={styles.webView}
              onLoad={() => {
                setIsLoading(false);
                setIsOffline(false);
                setError(null);
              }}
              onError={handleError}
              onHttpError={handleHttpError}
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
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  webView: {
    flex: 1,
    minHeight: '100%',
  },
  loaderContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
});