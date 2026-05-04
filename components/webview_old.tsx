import NetInfo from '@react-native-community/netinfo';
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
import { ActivityIndicator, Alert, Platform, RefreshControl, ScrollView, Share, StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useAuth } from '../context/AuthContext';
import OfflineScreen from './OfflineScreen';

// Environment-based configuration
const getBaseUrl = () => {
  if (__DEV__) {
    return 'http://192.168.31.224:3000'; // Development
  }
  return 'https://listtra-git-google-login-try-listtra.vercel.app'; // Production - replace with your actual production URL
};

const BASE_URL = getBaseUrl();

// Constants
const MAX_RETRY_ATTEMPTS = 3;
const AUTH_RESTORE_DELAY = 300;
const AUTH_LOGIN_SUCCESS_DELAY = 200;
const NAVIGATION_DELAY = 300;
const MAX_IMAGES = 5;
const IMAGE_QUALITY = 0.85;

/** -------------------------
 * 🔹 Types
 * ------------------------- */
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

type WebViewMessage =
  | { type: 'GO_BACK'; from?: string; slug?: string; product_id?: string }
  | { type: 'LISTING_CLICKED'; listing: { slug: string; product_id: string } }
  | { type: 'ADD_LISTING_CLICKED' }
  | { type: 'PROFILE_CLICKED'; nickname: string }
  | { type: 'NAVIGATE_TO_LISTINGS' }
  | { type: 'NAVIGATE_TO_LISTING'; slug: string; productId: string }
  | { type: 'NAVIGATE_TO_ADD' }
  | { type: 'NAVIGATE_CHAT'; chatId: string }
  | { type: 'VIEW_ALL_CHATS'; listingId?: string }
  | { type: 'NAVIGATE'; path: string }
  | { type: 'NAVIGATE_TO_LOCATION' }
  | { type: 'WEB_LOGOUT_SUCCESS' }
  | { type: 'AUTH_REQUIRED'; path: string }
  | { type: 'AUTH_VALIDATION_FAILED'; message: string }
  | { type: 'AUTH_VALIDATION_SUCCESS'; tokens: any; user: any }
  | { type: 'AUTH_LOGIN_SUCCESS'; tokens: any; user: any }
  | { type: 'AUTH_RESTORED'; user?: any }
  | { type: 'OPEN_IMAGE_PICKER'; options?: any }
  | { type: 'OPEN_WEB_OAUTH'; provider: 'google' }
  | { type: 'SHARE_LISTING'; data: any }
  | { type: string; [key: string]: any }; // fallback

/** -------------------------
 * 🔹 Logger (production-safe)
 * ------------------------- */
const log = (...args: any[]) => {
  if (__DEV__) {
    console.log('[PersistentWebView]', ...args);
  }
};

const logError = (...args: any[]) => {
  console.error('[PersistentWebView]', ...args);
};

/** -------------------------
 * 🔹 Utility Functions
 * ------------------------- */
const sanitizeForJavaScript = (value: string): string => {
  return JSON.stringify(value);
};

const createSafeJavaScript = (script: string): string => {
  return `
    (function() {
      try {
        ${script}
      } catch (e) {
        console.error('WebView script error:', e);
      }
    })();
  `;
};

const getPageType = (url: string, route: string) => ({
  isAddPage: url.includes('/add') || route === 'add',
  isAddSuccessPage: url.includes('/add-success') || route === 'add-success',
  isListingDetail: url.includes('/listings/'),
  isChatPage: url.includes('/chat?listing='),
  isChatIndexPage: url.includes('/chat/'),
  isChatsPage: url.includes('/chats') || route === 'chats',
  isLikedPage: url.includes('/liked') || route === 'liked',
  isSigninPage: url.includes('/auth/signin') || route === 'auth/signin',
});

/** -------------------------
 * 🔹 PersistentWebView Component
 * ------------------------- */
const PersistentWebView = forwardRef<PersistentWebViewRef, PersistentWebViewProps>(
  ({ route, onMessage, disableAutoNavigation = false, onRefresh, refreshing = false, disableRefresh = false }, ref) => {
    // Refs and state
    const webViewRef = useRef<WebView>(null);
    const retryAttemptRef = useRef(0);
    const authInjectedRef = useRef(false);
    const authRestoredRef = useRef(false);
    const hasNavigated = useRef(false);
    // Add a new ref to track auth restoration state
    const authValidationInProgress = useRef(false);

    // Auth context
    const { tokens, logout, isAuthenticated, user, handleGoogleSignIn, setTokensDirectly } = useAuth();
    
    // Component state
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isOffline, setIsOffline] = useState(false);
    const [currentUrl, setCurrentUrl] = useState('');
    
    const router = useRouter();

    /** -------------------------
     * 🔹 Authentication Functions
     * ------------------------- */
    const clearWebViewAuth = useCallback(() => {
      if (!webViewRef.current) return;

      const script = createSafeJavaScript(`
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        sessionStorage.clear();
        
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ 
            type: 'WEBVIEW_AUTH_CLEARED' 
          }));
        }
      `);

      webViewRef.current.injectJavaScript(script);
      authInjectedRef.current = false;
      authRestoredRef.current = false;
    }, []);

    const restoreWebViewAuth = useCallback(() => {
      if (!webViewRef.current || !isAuthenticated || !tokens.accessToken || !tokens.refreshToken || authValidationInProgress.current) {
        return;
      }

      authValidationInProgress.current = true;
      
      const safeAccess = sanitizeForJavaScript(tokens.accessToken);
      const safeRefresh = sanitizeForJavaScript(tokens.refreshToken);
      const safeUser = user ? sanitizeForJavaScript(JSON.stringify(user)) : 'null';

      const script = createSafeJavaScript(`
        console.log('Native app injecting auth tokens');
        
        localStorage.setItem('token', ${safeAccess});
        localStorage.setItem('refreshToken', ${safeRefresh});
        ${user ? `localStorage.setItem('user', ${safeUser});` : ''}
        
        // Set a flag to prevent duplicate auth events
        window._authRestored = true;
        
        // Dispatch custom event for web app
        if (window.dispatchEvent && !window._authEventSent) {
          window.dispatchEvent(new CustomEvent('mobileAuthRestored', {
            detail: {
              tokens: {
                accessToken: ${safeAccess},
                refreshToken: ${safeRefresh}
              },
              user: ${safeUser}
            }
          }));
          window._authEventSent = true;
        }
        
        // Send message to mobile app
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ 
            type: 'AUTH_RESTORED', 
            user: ${safeUser},
            tokens: {
              accessToken: ${safeAccess},
              refreshToken: ${safeRefresh}
            }
          }));
        }
        
        console.log('Auth tokens injected successfully');
      `);

      webViewRef.current.injectJavaScript(script);
      authInjectedRef.current = true;
      
      // Reset the flag after a delay
      setTimeout(() => {
        authValidationInProgress.current = false;
      }, 1000);
    }, [isAuthenticated, tokens.accessToken, tokens.refreshToken, user]);

    /** -------------------------
     * 🔹 Share Functionality
     * ------------------------- */
    const handleShare = useCallback(async (shareData: any) => {
      try {
        if (!shareData?.title || !shareData?.url) {
          throw new Error('Invalid share data');
        }

        const shareOptions = {
          title: shareData.title,
          message: `${shareData.title}\n\n${shareData.description || ''}\n\nCheck it out: ${shareData.url}`,
          url: shareData.url,
        };

        const result = await Share.share(shareOptions);
        
        if (result.action === Share.sharedAction) {
          log('Content shared successfully:', result.activityType || 'default');
        } else {
          log('Share dismissed by user');
        }
      } catch (error) {
        logError('Share error:', error);
        
        // Send error back to WebView
        webViewRef.current?.postMessage(JSON.stringify({
          type: 'SHARE_ERROR',
          error: 'Failed to share content'
        }));
      }
    }, []);

    /** -------------------------
     * 🔹 Google OAuth Handler
     * ------------------------- */
    const handleGoogleOAuth = useCallback(async () => {
      try {
        log('Starting Google OAuth flow');

        const result = await handleGoogleSignIn();

        if (result.success && result.tokens && result.user) {
          log('Google Sign-In successful');

          const safeTokens = JSON.stringify(result.tokens);
          const safeUser = JSON.stringify(result.user);

          const script = createSafeJavaScript(`
            console.log('WebView received Google auth success');
            
            // Send AUTH_LOGIN_SUCCESS message (same as email/password flow)
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: "AUTH_LOGIN_SUCCESS",
                tokens: ${safeTokens},
                user: ${safeUser}
              }));
            } else {
              console.error('ReactNativeWebView not available');
            }
          `);

          webViewRef.current?.injectJavaScript(script);
        } else {
          logError('Google Sign-In failed:', result.error);
          
          const script = createSafeJavaScript(`
            console.error('Google Sign-In failed: ${result.error || 'Unknown error'}');
            alert('Google Sign-In failed. Please try again.');
          `);

          webViewRef.current?.injectJavaScript(script);
        }
      } catch (error) {
        logError('Google OAuth error:', error);
        
        const script = createSafeJavaScript(`
          console.error('Authentication failed');
          alert('Authentication failed. Please try again.');
        `);

        webViewRef.current?.injectJavaScript(script);
      }
    }, [handleGoogleSignIn]);

    /** -------------------------
     * 🔹 Image Picker Handler
     * ------------------------- */
    const handleImagePicker = useCallback(async (options: any = {}) => {
      try {
        // Request permissions
        const [mediaResult, cameraResult] = await Promise.all([
          ImagePicker.requestMediaLibraryPermissionsAsync(),
          ImagePicker.requestCameraPermissionsAsync(),
        ]);

        if (mediaResult.status !== 'granted' && cameraResult.status !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Please grant permission to access photos and camera.',
            [{ text: 'OK' }]
          );
          return;
        }

        // Show platform-appropriate picker
        const result = await new Promise<any>((resolve) => {
          const handleSelection = (pickerFunction: () => Promise<any>) => {
            pickerFunction().then(resolve).catch((error) => {
              logError('Image picker error:', error);
              resolve({ canceled: true });
            });
          };

          const cameraOptions = {
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: options.allowsEditing || false,
            quality: options.quality || IMAGE_QUALITY,
            base64: true,
            exif: false,
            aspect: [4, 3] as [number, number],
          };

          const galleryOptions = {
            ...cameraOptions,
            allowsMultipleSelection: true,
            allowsEditing: false,
          };

          if (Platform.OS === 'ios') {
            const ActionSheetIOS = require('react-native').ActionSheetIOS;
            ActionSheetIOS.showActionSheetWithOptions(
              {
                options: ['Cancel', 'Take Photo', 'Choose from Gallery'],
                cancelButtonIndex: 0,
              },
              (buttonIndex: number) => {
                if (buttonIndex === 1) {
                  handleSelection(() => ImagePicker.launchCameraAsync(cameraOptions));
                } else if (buttonIndex === 2) {
                  handleSelection(() => ImagePicker.launchImageLibraryAsync(galleryOptions));
                } else {
                  resolve({ canceled: true });
                }
              }
            );
          } else {
            Alert.alert(
              'Select Image',
              'Choose an option',
              [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve({ canceled: true }) },
                { text: 'Camera', onPress: () => handleSelection(() => ImagePicker.launchCameraAsync(cameraOptions)) },
                { text: 'Gallery', onPress: () => handleSelection(() => ImagePicker.launchImageLibraryAsync(galleryOptions)) },
              ],
              { cancelable: true }
            );
          }
        });

        if (!result.canceled && result.assets) {
          const maxImages = options.maxImages || MAX_IMAGES;
          const images = result.assets.slice(0, maxImages).map((asset: any, index: number) => ({
            uri: `data:image/jpeg;base64,${asset.base64}`,
            type: 'image/jpeg',
            name: `image_${Date.now()}_${index}.jpg`,
            width: asset.width,
            height: asset.height,
            size: Math.round((asset.base64?.length || 0) * 0.75 / 1024),
          }));

          webViewRef.current?.postMessage(JSON.stringify({ 
            type: 'IMAGES_SELECTED', 
            images 
          }));
        }
      } catch (error) {
        logError('Image picker error:', error);
        Alert.alert('Error', 'Failed to select images. Please try again.');
      }
    }, []);

    /** -------------------------
     * 🔹 Message Handler
     * ------------------------- */
    const handleMessage = useCallback((event: WebViewMessageEvent) => {
      try {
        const data: WebViewMessage = JSON.parse(event.nativeEvent.data);
        log('Message received:', data.type);

        switch (data.type) {
          case 'OPEN_IMAGE_PICKER':
            handleImagePicker(data.options);
            return;

          case 'SHARE_LISTING':
            handleShare(data.data);
            return;

          case 'OPEN_WEB_OAUTH':
            if (data.provider === 'google') {
              handleGoogleOAuth();
            }
            return;

          case 'AUTH_RESTORED':
            authRestoredRef.current = true;
            authInjectedRef.current = true;
            authValidationInProgress.current = false;
            return;

          case 'AUTH_REQUIRED':
            router.replace('/auth/signin');
            return;

          case 'AUTH_VALIDATION_FAILED':
            log('Auth validation failed, attempting restore');
            
            retryAttemptRef.current += 1;
            if (retryAttemptRef.current <= MAX_RETRY_ATTEMPTS) {
              setTimeout(() => {
                restoreWebViewAuth();
              }, 1000);
            } else {
              logError('Max retry attempts reached, logging out');
              clearWebViewAuth();
              logout().finally(() => router.replace('/auth/signin'));
            }
            return;

          case 'AUTH_VALIDATION_SUCCESS':
            retryAttemptRef.current = 0;
            authValidationInProgress.current = false;
            
            // Only process if we don't already have the same tokens
            if (data.tokens.accessToken !== tokens.accessToken || data.tokens.refreshToken !== tokens.refreshToken) {
              setTokensDirectly(data.tokens.accessToken, data.tokens.refreshToken, data.user);
            }
            restoreWebViewAuth();
            return;

          case 'AUTH_LOGIN_SUCCESS':
            log('AUTH_LOGIN_SUCCESS received');
            console.log('AUTH_LOGIN_SUCCESS received', data);
            retryAttemptRef.current = 0;
            
            setTokensDirectly(data.tokens.accessToken, data.tokens.refreshToken, data.user);
            
            setTimeout(() => {
              restoreWebViewAuth();
              setTimeout(() => {
                router.replace('/(tabs)');
              }, NAVIGATION_DELAY);
            }, AUTH_LOGIN_SUCCESS_DELAY);
            return;

          case 'WEB_LOGOUT_SUCCESS':
            hasNavigated.current = true;
            clearWebViewAuth();
            logout().finally(() => router.replace('/auth/signin'));
            return;

          case 'GO_BACK': {
            const pageType = getPageType(currentUrl, route);
            
            if (pageType.isSigninPage) return router.replace('/(tabs)');
            if (data.from === 'edit-page' && data.slug && data.product_id) {
              return router.replace({ 
                pathname: '/listings/[slug]/[product_id]/page', 
                params: { slug: data.slug, product_id: data.product_id } 
              });
            }
            if (pageType.isLikedPage || pageType.isAddPage || pageType.isAddSuccessPage || pageType.isChatsPage) {
              return router.replace('/(tabs)');
            }
            if (pageType.isListingDetail || pageType.isChatPage || pageType.isChatIndexPage) {
              return router.back();
            }

            const script = createSafeJavaScript(`
              if (window.history.length > 1) {
                window.history.back();
              } else {
                window.location.href = "${BASE_URL}/chats";
              }
            `);
            webViewRef.current?.injectJavaScript(script);
            return;
          }

          // Navigation handlers
          case 'LISTING_CLICKED':
            if (!disableAutoNavigation && data.listing?.slug && data.listing?.product_id) {
              router.push({ pathname: '/listings/[slug]/[product_id]/page', params: data.listing });
            }
            return;

          case 'PROFILE_CLICKED':
            if (data.nickname) {
              router.push({ pathname: '/profiles/[nickname]', params: { nickname: data.nickname } });
            }
            return;

          // Simple navigation cases
          case 'NAVIGATE_TO_LISTINGS': router.push('/(tabs)'); return;
          case 'NAVIGATE_TO_LISTING': 
            router.push({ 
              pathname: '/listings/[slug]/[product_id]/page', 
              params: { slug: data.slug, product_id: data.productId } 
            }); 
            return;
          case 'ADD_LISTING_CLICKED': router.push('/add'); return;
          case 'NAVIGATE_CHAT': 
            router.push({ pathname: '/chat/[id]', params: { id: data.chatId } }); 
            return;
          case 'VIEW_ALL_CHATS': 
            router.push(data.listingId ? 
              { pathname: '/chat', params: { listingId: data.listingId } } : 
              '/chat'
            ); 
            return;
          case 'NAVIGATE': 
            if (data.path) router.push(data.path); 
            return;
          case 'NAVIGATE_TO_LOCATION': router.push('/location'); return;

          default:
            // Handle unknown message types
            log('Unknown message type:', data.type);
            break;
        }

        // Call custom message handler if provided
        onMessage?.(event);
      } catch (error) {
        logError('Error parsing WebView message:', error);
        onMessage?.(event);
      }
    }, [
      onMessage, 
      router, 
      currentUrl, 
      route, 
      disableAutoNavigation, 
      handleImagePicker,
      handleShare,
      handleGoogleOAuth,
      clearWebViewAuth, 
      logout, 
      restoreWebViewAuth, 
      setTokensDirectly,
      tokens.accessToken,
      tokens.refreshToken
    ]);

    /** -------------------------
     * 🔹 URL Building
     * ------------------------- */
    const buildUrl = useCallback((baseRoute: string) => {
      try {
        const url = new URL(`${BASE_URL}/${baseRoute}`);
        
        if (user?.id) {
          url.searchParams.set('user_id', user.id);
        }
        
        if (!authInjectedRef.current && isAuthenticated && tokens.accessToken && tokens.refreshToken) {
          url.searchParams.set('access_token', tokens.accessToken);
          url.searchParams.set('refresh_token', tokens.refreshToken);
          url.searchParams.set('isNativeAuth', 'true');
        }
        
        return url.toString();
      } catch (error) {
        logError('Error building URL:', error);
        return `${BASE_URL}/${baseRoute}`;
      }
    }, [isAuthenticated, tokens.accessToken, tokens.refreshToken, user?.id]);

    /** -------------------------
     * 🔹 Error Handlers
     * ------------------------- */
    const handleError = useCallback((e: any) => {
      const msg = e.nativeEvent.description || e.nativeEvent.message || 'Unknown WebView error';
      logError('WebView error:', msg);
      setError(msg);
      setIsOffline(true);
      setIsLoading(false);
    }, []);

    const handleHttpError = useCallback((e: any) => {
      const statusCode = e.nativeEvent.statusCode;
      const msg = `HTTP error: ${statusCode}`;
      logError(msg);
      setError(msg);
      setIsOffline(statusCode >= 500);
      setIsLoading(false);
    }, []);

    const handleLoadEnd = useCallback(() => {
      setIsLoading(false);
      setError(null);
    }, []);

    /** -------------------------
     * 🔹 Effects
     * ------------------------- */
    
    // Network status monitoring
    useEffect(() => {
      const unsubscribe = NetInfo.addEventListener((state) => {
        const isConnected = state.isConnected === true;
        setIsOffline(!isConnected);
        
        if (!isConnected) {
          setError('No internet connection');
        } else if (error === 'No internet connection') {
          setError(null);
        }
      });
      
      return unsubscribe;
    }, [error]);

    // URL and auth restoration
    useEffect(() => {
      const newUrl = buildUrl(route);
      setCurrentUrl(newUrl);
      
      // Only restore auth if we haven't done it yet and we have valid tokens
      if (!authRestoredRef.current && 
          !authValidationInProgress.current && 
          isAuthenticated && 
          tokens.accessToken && 
          tokens.refreshToken) {
        setTimeout(restoreWebViewAuth, AUTH_RESTORE_DELAY);
      }
    }, [route, buildUrl, isAuthenticated, tokens.accessToken, tokens.refreshToken, restoreWebViewAuth]);

    // Auth state cleanup
    useEffect(() => {
      if (!isAuthenticated && !tokens.accessToken) {
        clearWebViewAuth();
      }
    }, [isAuthenticated, tokens.accessToken, clearWebViewAuth]);

    /** -------------------------
     * 🔹 Imperative Handle
     * ------------------------- */
    useImperativeHandle(ref, () => ({
      refresh: () => {
        const script = createSafeJavaScript(`
          if (window.refreshData) {
            window.refreshData();
          } else if (window.refreshListings) {
            window.refreshListings();
          } else {
            location.reload();
          }
        `);
        webViewRef.current?.injectJavaScript(script);
      },
      reload: () => webViewRef.current?.reload(),
      injectJavaScript: (script: string) => {
        webViewRef.current?.injectJavaScript(createSafeJavaScript(script));
      },
      clearWebViewAuth,
    }), [clearWebViewAuth]);

    /** -------------------------
     * 🔹 WebView Props
     * ------------------------- */
    const webViewProps = useMemo(() => ({
      ref: webViewRef,
      source: { uri: currentUrl },
      style: styles.webView,
      onLoad: handleLoadEnd,
      onLoadEnd: handleLoadEnd,
      onError: handleError,
      onHttpError: handleHttpError,
      onMessage: handleMessage,
      
      // Performance optimizations
      javaScriptEnabled: true,
      domStorageEnabled: true,
      cacheEnabled: true,
      
      // Security settings
      thirdPartyCookiesEnabled: false,
      sharedCookiesEnabled: true,
      originWhitelist: [BASE_URL, 'https://*'],
      mixedContentMode: 'never' as const,
      
      // Media settings
      allowsInlineMediaPlayback: true,
      mediaPlaybackRequiresUserAction: false,
      
      // File access (disabled for security)
      allowFileAccess: false,
      allowUniversalAccessFromFileURLs: false,
      
      // User agent
      userAgent: `Listtra-Mobile/${Platform.OS}`,
      
    }), [currentUrl, handleLoadEnd, handleError, handleHttpError, handleMessage]);

    /** -------------------------
     * 🔹 Render
     * ------------------------- */
    return (
      <View style={styles.container}>
        {isOffline ? (
          <OfflineScreen 
            onRetry={() => {
              setError(null);
              webViewRef.current?.reload();
            }} 
            message={error || 'No internet connection'} 
          />
        ) : disableRefresh ? (
          <WebView {...webViewProps} />
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollViewContent}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={onRefresh || (() => webViewRef.current?.reload())} 
                colors={['#2528be']} 
                tintColor="#2528be"
                title="Pull to refresh"
              />
            }
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

/** -------------------------
 * 🔹 Styles
 * ------------------------- */
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: 'white' 
  },
  scrollView: { 
    flex: 1 
  },
  scrollViewContent: { 
    flexGrow: 1 
  },
  webView: { 
    flex: 1, 
    minHeight: '100%' 
  },
  loaderContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
});