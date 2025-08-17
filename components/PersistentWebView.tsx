import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useAuth } from '../context/AuthContext';
import OfflineScreen from './OfflineScreen';

//const BASE_URL = 'https://listtra.com';
const BASE_URL = 'http://192.168.31.224:3000';
//const BASE_URL = 'https://50015a6e9d8e.ngrok-free.app'

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

// Extracted message handlers
const createMessageHandlers = (
  router: any,
  webViewRef: React.RefObject<WebView>,
  currentUrl: string,
  route: string,
  hasNavigated: React.MutableRefObject<boolean>,
  disableAutoNavigation: boolean,
  clearWebViewAuth: () => void,
  logout: () => Promise<void>
) => ({
  GO_BACK: (data: any) => {
    const isFromAddPage = currentUrl?.includes('/add') || route === 'add';
    const isFromAddSuccessPage = currentUrl?.includes('/add-success') || route === 'add-success';
    const isFromListingDetail = currentUrl?.includes('/listings/');
    const isFromChatPage = currentUrl?.includes('/chat?listing=');
    const isFromChatIndexPage = currentUrl?.includes('/chat/');
    const isFromChatsPage = currentUrl?.includes('/chats') || route === 'chats';
    const isFromLikedPage = currentUrl?.includes('/liked') || route === 'liked';
    const isFromSigninPage = currentUrl?.includes('/auth/signin') || route === 'auth/signin';

    if (isFromSigninPage) {
      router.replace('/(tabs)');
      return;
    }
    if (data.from === 'edit-page') {
      console.log('GO_BACK', data);
      hasNavigated.current = true;
      router.replace({
        pathname: '/listings/[slug]/[product_id]/page',
        params: { slug: data.slug, product_id: data.product_id },
      });
      return;
    }

    if (isFromLikedPage) {
      hasNavigated.current = true;
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

  LISTING_CLICKED: (data: any) => {
    if (!disableAutoNavigation && data.listing.slug && data.listing.product_id) {
      hasNavigated.current = true;
      router.push({
        pathname: '/listings/[slug]/[product_id]/page',
        params: { slug: data.listing.slug, product_id: data.listing.product_id },
      });
    }
  },

  PROFILE_CLICKED: (data: any) => {
    if (data.nickname) {
      hasNavigated.current = true;
      router.push({
        pathname: '/profiles/[nickname]',
        params: { nickname: data.nickname },
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
        pathname: '/listings/[slug]/[product_id]/page',
        params: { slug: data.slug, product_id: data.productId },
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
        pathname: '/chat/[id]',
        params: { id: data.chatId },
      });
    }
  },

  VIEW_ALL_CHATS: (data: any) => {
    hasNavigated.current = true;
    if (data.listingId) {
      router.push({
        pathname: '/chat',
        params: { listingId: data.listingId },
      });
    } else {
      router.push('/chat');
    }
  },

  NAVIGATE: (data: any) => {
    if (data.path) {
      hasNavigated.current = true;
      router.push(data.path);
    }
  },

  WEB_LOGOUT_SUCCESS: () => {
    // Immediately navigate to native sign-in without reloading the WebView
    hasNavigated.current = true;
    clearWebViewAuth();
    logout()
      .catch(() => { })
      .finally(() => {
        router.replace('/auth/signin');
      });
  },
});

const PersistentWebView = forwardRef<PersistentWebViewRef, PersistentWebViewProps>(
  ({ route, onMessage, disableAutoNavigation = false, onRefresh, refreshing = false, disableRefresh = false }, ref) => {
    const webViewRef = useRef<WebView>(null);
    const { tokens, logout, isAuthenticated, user, loginWithGoogleForWebView } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isOffline, setIsOffline] = useState(false);
    const [isDeviceOffline, setIsDeviceOffline] = useState(false);
    const router = useRouter();
    const hasNavigated = useRef(false);
    const [currentUrl, setCurrentUrl] = useState('');
    const isDetailPage = useRef(route.includes('/listings/') && route !== 'listings');

    // Flags to avoid re-injecting tokens and re-validating repeatedly
    const authInjectedRef = useRef(false);
    const authRestoredRef = useRef(false);

    // Injected script for WebView auth state management
    const injectedJavaScript = useMemo(
      () => `
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
`,
      []
    );

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

    // Restore WebView authentication state from native tokens
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
    const messageHandlers = useMemo(
      () =>
        createMessageHandlers(
          router,
          webViewRef as React.RefObject<WebView<{}>>,
          currentUrl,
          route,
          hasNavigated,
          disableAutoNavigation,
          clearWebViewAuth,
          logout
        ),
      [router, currentUrl, route, disableAutoNavigation, logout, clearWebViewAuth]
    );

    // Handle Google OAuth from WebView
    const handleWebViewGoogleAuth = useCallback(async () => {
      try {
        console.log('Handling Google OAuth from WebView...');
        
        // Trigger native Google OAuth without navigation
        const result = await loginWithGoogleForWebView();
        
        if (result.success && result.tokens && result.user) {
          console.log('Google OAuth completed successfully, updating WebView...');
          
          // Inject the tokens into WebView localStorage
          const script = `
            (function() {
              try {
                localStorage.setItem('token', '${result.tokens.accessToken}');
                localStorage.setItem('refreshToken', '${result.tokens.refreshToken}');
                localStorage.setItem('user', JSON.stringify(${JSON.stringify(result.user)}));
                
                // Trigger auth ready event in WebView
                if (window.dispatchEvent) {
                  window.dispatchEvent(new Event('MOBILE_AUTH_READY'));
                }
                
                // Send success message back to native
                if (window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'GOOGLE_AUTH_SUCCESS',
                    user: ${JSON.stringify(result.user)},
                    tokens: ${JSON.stringify(result.tokens)}
                  }));
                }
                
                // Reload the current page to apply auth state
                window.location.reload();
                
                return true;
              } catch (error) {
                console.error('Error setting WebView auth state:', error);
                return false;
              }
            })();
          `;
          
          webViewRef.current?.injectJavaScript(script);
          
        } else {
          console.error('Google OAuth failed:', result.error);
          
          // Send error back to WebView
          webViewRef.current?.postMessage(JSON.stringify({
            type: 'GOOGLE_AUTH_ERROR',
            error: result.error || 'Google authentication failed'
          }));
        }
        
      } catch (error) {
        console.error('Google OAuth from WebView failed:', error);
        
        // Send error back to WebView
        webViewRef.current?.postMessage(JSON.stringify({
          type: 'GOOGLE_AUTH_ERROR',
          error: 'Google authentication failed'
        }));
      }
    }, [loginWithGoogleForWebView]);

    // Handle message from WebView
    const handleMessage = useCallback(
      (event: WebViewMessageEvent) => {
        try {
          const data = JSON.parse(event.nativeEvent.data);
          console.log('WebView message received:', data.type, data);

          if (data.type === 'OPEN_IMAGE_PICKER') {
            console.log('OPEN_IMAGE_PICKER', data.options);
            handleImagePicker(data.options);
            return;
          }

          // Handle Google OAuth request from WebView
          if (data.type === 'OPEN_WEB_OAUTH' && data.provider === 'google') {
            console.log('OPEN_WEB_OAUTH received for Google');
            handleWebViewGoogleAuth();
            return;
          }

          // One-time mark when auth is successfully restored from native → web
          if (data.type === 'AUTH_RESTORED') {
            console.log('WebView auth restored');
            authRestoredRef.current = true;
            authInjectedRef.current = true;
          }

          if (onMessage) {
            onMessage(event);
          }

          const handler = messageHandlers[data.type as keyof typeof messageHandlers];
          if (handler) {
            handler(data);
            return;
          }

          // Special cases
          if (data.type === 'AUTH_REQUIRED') {
            console.log('AUTH_REQUIRED');
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
      },
      [onMessage, messageHandlers, router, handleWebViewGoogleAuth]
    );

    const handleImagePicker = async (options: any) => {
      try {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          alert('Sorry, we need camera roll permissions to upload images!');
          return;
        }
        // Launch image picker
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsMultipleSelection: true,
          quality: options?.quality || 0.85,
          base64: true,
          exif: false,
          allowsEditing: false,
          aspect: [4, 3],
        });
        if (!result.canceled && result.assets) {
          // Process images with additional metadata
          const images = result.assets.slice(0, options?.maxImages || 5).map((asset, index) => {
            // Calculate file size estimate (for logging/debugging)
            const base64Length = asset.base64?.length || 0;
            const fileSizeKB = Math.round(base64Length * 0.75 / 1024);

            console.log(`Image ${index + 1} size: ~${fileSizeKB}KB, dimensions: ${asset.width}x${asset.height}`);

            return {
              uri: `data:image/jpeg;base64,${asset.base64}`,
              type: 'image/jpeg',
              name: `image_${Date.now()}_${index}.jpg`,
              width: asset.width,
              height: asset.height,
              size: fileSizeKB
            };
          });

          // Send images back to WebView
          webViewRef.current?.postMessage(JSON.stringify({
            type: 'IMAGES_SELECTED',
            images: images
          }));
        }
      } catch (error) {
        console.error('Error picking images:', error);
        alert('Error selecting images. Please try again.');
      }
    }

    // Network status
    useEffect(() => {
      const unsubscribe = NetInfo.addEventListener((state) => {
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

    // Build URL with authentication once per session (or when tokens rotate)
    const buildUrl = useCallback(
      (baseRoute: string) => {
        const url = new URL(`${BASE_URL}/${baseRoute}`);

        if (!authInjectedRef.current && isAuthenticated && tokens.accessToken && tokens.refreshToken) {
          url.searchParams.set('access_token', tokens.accessToken);
          url.searchParams.set('refresh_token', tokens.refreshToken);
          url.searchParams.set('isNativeAuth', 'true');
          if (user?.id) url.searchParams.set('user_id', user.id);
        }

        return url.toString();
      },
      [isAuthenticated, tokens.accessToken, tokens.refreshToken, user?.id]
    );

    // Mark injection complete when tokens are present (covers initial mount)
    useEffect(() => {
      if (isAuthenticated && tokens.accessToken && tokens.refreshToken) {
        authInjectedRef.current = true;
      }
    }, [isAuthenticated, tokens.accessToken, tokens.refreshToken]);

    // Build/refresh URL on route change; attempt restore only if not already restored
    useEffect(() => {
      const newUrl = buildUrl(route);
      console.log('Building URL:', newUrl);
      setCurrentUrl(newUrl);

      if (!authRestoredRef.current && isAuthenticated && tokens.accessToken && tokens.refreshToken) {
        setTimeout(restoreWebViewAuth, 300);
      }
    }, [route, buildUrl, isAuthenticated, tokens.accessToken, tokens.refreshToken, restoreWebViewAuth]);

    // Clear WebView auth when native auth is gone
    useEffect(() => {
      if (!isAuthenticated && !tokens.accessToken) {
        clearWebViewAuth();
      }
    }, [isAuthenticated, tokens.accessToken, clearWebViewAuth]);

    // Error handlers
    const isNetworkError = useCallback((errorMessage: string) => {
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
        'ERR_NAME_NOT_RESOLVED',
      ];
      return networkErrors.some((error) => errorMessage.includes(error));
    }, []);

    const handleError = useCallback(
      (e: any) => {
        const errorMessage = e.nativeEvent.description || e.nativeEvent.message || '';
        console.error('WebView error:', errorMessage);

        if (isNetworkError(errorMessage)) {
          setIsOffline(true);
          setError('No internet connection');
        } else {
          setError(`WebView error: ${errorMessage}`);
        }
        setIsLoading(false);
      },
      [isNetworkError]
    );

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

    // Expose methods to parent
    useImperativeHandle(
      ref,
      () => ({
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
        clearWebViewAuth,
      }),
      [clearWebViewAuth]
    );

    // WebView props
    const webViewProps = useMemo(
      () => ({
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
        mixedContentMode: 'always' as const,
        allowsInlineMediaPlayback: true,
        allowFileAccess: true,
        allowUniversalAccessFromFileURLs: true,
        injectedJavaScript,
      }),
      [currentUrl, handleLoad, handleError, handleHttpError, handleMessage, injectedJavaScript]
    );

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
  }
);

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