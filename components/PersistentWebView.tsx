import NetInfo from '@react-native-community/netinfo';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useImperativeHandle
} from 'react';
import { ActivityIndicator, Alert, Platform, RefreshControl, ScrollView, Share, StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useAuth } from '../context/AuthContext';
import OfflineScreen from './OfflineScreen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Environment-based configuration
const getBaseUrl = () => {
  if (__DEV__) {
    return 'http://192.168.31.224:3000'; // Development
  }
  return 'https://listtra.com'; // Production - replace with your actual production URL
};

const BASE_URL = getBaseUrl();

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
  isFromNavbar?: boolean;
};

export interface PersistentWebViewRef {
  refresh: () => void;
  reload: () => void;
  injectJavaScript: (script: string) => void;
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
  | { type: 'CATEGORIES_CLICKED'; category: string }
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
  | { type: string;[key: string]: any }; // fallback

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

const getPageType = (url: string, route: string) => ({
  isAddPage: url.includes('/add') || route === 'add',
  isAddSuccessPage: url.includes('/add-success') || route === 'add-success',
  isListingDetail: url.includes('/listings/'),
  isChatPage: url.includes('/chat?listing='),
  isChatIndexPage: url.includes('/chat/'),
  isChatsPage: url.includes('/chats') || route === 'chats',
  isLikedPage: url.includes('/liked') || route === 'liked',
  isSigninPage: url.includes('/auth/signin') || route === 'auth/signin',
  isCategoryPage: url.includes('/categories/') || route === 'categories',
});

/** -------------------------
 * 🔹 PersistentWebView Component
 * ------------------------- */
const PersistentWebView = forwardRef<PersistentWebViewRef, PersistentWebViewProps>(
  ({ route, onMessage, disableAutoNavigation = false, onRefresh, refreshing = false, disableRefresh = false, isFromNavbar = false }, ref) => {
    // Refs and state
    const webViewRef = useRef<WebView>(null);

    const insets = useSafeAreaInsets();

    // Auth context
    const { tokens, logout, isAuthenticated, user, handleGoogleSignIn, setTokensDirectly } = useAuth();

    // Component state
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isOffline, setIsOffline] = useState(false);
    const [currentUrl, setCurrentUrl] = useState('');

    const router = useRouter();

    /** -------------------------
     * 🔹 Imperative Handle
     * ------------------------- */
    useImperativeHandle(ref, () => ({
      refresh: () => {
        console.log('PersistentWebView refresh method called');
        if (webViewRef.current) {
          webViewRef.current.reload();
        }
      },
      reload: () => {
        console.log('PersistentWebView reload method called');
        if (webViewRef.current) {
          webViewRef.current.reload();
        }
      },
      injectJavaScript: (script: string) => {
        console.log('PersistentWebView injectJavaScript method called');
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(script);
        }
      },
    }), []);

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
          message: `${shareData.title}\n\nCheck it out: ${shareData.url}`,
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

          console.log('Calling Google Auth Success', safeTokens, safeUser);

          webViewRef.current?.postMessage(JSON.stringify({
            type: 'GOOGLE_AUTH_SUCCESS',
            tokens: safeTokens,
            user: safeUser
          }));

        } else {
          logError('Google Sign-In failed:', result.error);

          // Show error message to user
          Alert.alert(
            'Sign-In Error',
            result.error || 'Google Sign-In failed. Please try again.',
            [{ text: 'OK' }]
          );

          // Also send error back to WebView
          webViewRef.current?.postMessage(JSON.stringify({
            type: 'GOOGLE_AUTH_ERROR',
            error: result.error || 'Google Sign-In failed'
          }));
        }
      } catch (error) {
        logError('Google OAuth error:', error);

        // Show generic error message
        Alert.alert(
          'Sign-In Error',
          'An unexpected error occurred during sign-in. Please try again.',
          [{ text: 'OK' }]
        );

        // Send error back to WebView
        webViewRef.current?.postMessage(JSON.stringify({
          type: 'GOOGLE_AUTH_ERROR',
          error: 'An unexpected error occurred during sign-in'
        }));
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

          case 'AUTH_REQUIRED':
            router.replace('/auth/signin');
            return;

          case 'AUTH_LOGIN_SUCCESS':
            console.log('AUTH_LOGIN_SUCCESS received', data);

            setTokensDirectly(data.tokens.accessToken, data.tokens.refreshToken, data.user);

            setTimeout(() => {
              router.replace('/(tabs)');
            }, NAVIGATION_DELAY);
            return;

          case 'WEB_LOGOUT_SUCCESS':
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
            if (pageType.isListingDetail || pageType.isChatPage || pageType.isChatIndexPage || pageType.isCategoryPage) {
              return router.back();
            }
            return;
          }

          // Navigation handlers
          case 'LISTING_CLICKED':
            if (data.listing?.slug && data.listing?.product_id) {
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
          case 'ADD_LISTING_CLICKED':
            if (isFromNavbar) {
              router.push('/navbar-add');
            } else {
              router.push('/(tabs)/add');
            }
            return;
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
          case 'CATEGORIES_CLICKED':
            // Handle dedicated category clicks with delay in production
            if (data.category) {
              const categoryPath = `/categories/${encodeURIComponent(data.category)}`;
              log('CATEGORIES_CLICKED message received:', data.category);
              if (!__DEV__) {
                log('Adding navigation delay for production category click');
                setTimeout(() => {
                  router.push(categoryPath as any);
                }, NAVIGATION_DELAY);
              } else {
                router.push(categoryPath as any);
              }
            }
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
      logout,
      setTokensDirectly,
      tokens.accessToken,
      tokens.refreshToken
    ]);

    /** -------------------------
     * 🔹 URL Building
     * ------------------------- */
    const buildUrl = useCallback((baseRoute: string) => {
      return `${BASE_URL}/${baseRoute}`;
    }, []);

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

    const bottomInset = Math.min(insets.bottom, 12);

    const injectedJS = `
    window.SAFE_AREA_INSETS = ${JSON.stringify({
      ...insets,
      bottom: bottomInset,
    })};
    document.documentElement.style.setProperty('--safe-area-bottom', '${bottomInset}px');
    true;
  `;

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
    }, [route, buildUrl]);

    /** -------------------------
     * 🔹 WebView Props
     * ------------------------- */
    const webViewProps = useMemo(() => ({
      ref: webViewRef,
      source: { uri: currentUrl },
      injectedJavaScript: injectedJS,
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

      // Security settings - Updated for better image loading
      thirdPartyCookiesEnabled: true, // Enable for image loading
      sharedCookiesEnabled: true,
      originWhitelist: ['*'], // Allow all origins for images
      mixedContentMode: 'compatibility' as const, // Allow mixed content

      // Add these for better image support
      allowsBackForwardNavigationGestures: false,
      bounces: false,
      scrollEnabled: true,
      showsHorizontalScrollIndicator: false,
      showsVerticalScrollIndicator: false,

      // Media settings
      allowsInlineMediaPlayback: true,
      mediaPlaybackRequiresUserAction: false,

      // File access (enable for images)
      allowFileAccess: true,
      allowUniversalAccessFromFileURLs: true,

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
    backgroundColor: '#f8f8f8'
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