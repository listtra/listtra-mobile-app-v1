import NetInfo from '@react-native-community/netinfo';
import * as ImageManipulator from 'expo-image-manipulator';
import { useRouter } from 'expo-router';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react';
import { ActivityIndicator, Alert, Platform, RefreshControl, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useAuth } from '../context/AuthContext';
import CameraModal from './CameraModal';
import OfflineScreen from './OfflineScreen';

// Environment-based configuration
const getBaseUrl = () => {
  if (__DEV__) {
    return 'http://192.168.31.224:3000'; // Development
  }
  return 'https://listtra.com'; // Production - replace with your actual production URL
};

const BASE_URL = getBaseUrl();

const NAVIGATION_DELAY = 300;
const MAX_IMAGES = 3;

// Enhanced image configuration
const IMAGE_CONFIG = {
  QUALITY: 0.85,
  MAX_WIDTH: 1600,
  MAX_HEIGHT: 1600,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  SUPPORTED_FORMATS: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] as const,
};

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
  maxPhotos?: number;
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
  | { type: 'NAVIGATE_SEARCH' }
  | { type: 'CATEGORIES_CLICKED'; category: string }
  | { type: 'NAVIGATE_TO_CATEGORY'; category: string }
  | { type: 'NAVIGATE_TO_SUBCATEGORY'; subcategory: string }
  | { type: 'NAVIGATE_TO_LOCATION' }
  | { type: 'NAVIGATE_TO_PROFILE_TAB' }
  | { type: 'NAVIGATE_TO_PROFILE'; nickname: string }
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

const logImageDebug = (message: string, data?: any) => {
  if (__DEV__) {
    console.log(`[PersistentWebView:ImageDebug] ${message}`, data || '');
  }
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
  isProfilePage: url.includes('/profiles/') || route === 'profiles',
  isSearchPage: url.includes('/search') || route === 'search',
});

/** -------------------------
 * 🔹 Image Compression Utilities
 * ------------------------- */
const calculateImageSize = (base64String: string): number => {
  // More accurate base64 size calculation
  const padding = (base64String.match(/=/g) || []).length;
  return Math.round((base64String.length * 0.75) - padding);
};

const shouldCompressImage = (asset: any): boolean => {
  const sizeInBytes = calculateImageSize(asset.base64 || '');
  const shouldCompress = asset.width > IMAGE_CONFIG.MAX_WIDTH ||
    asset.height > IMAGE_CONFIG.MAX_HEIGHT ||
    sizeInBytes > IMAGE_CONFIG.MAX_FILE_SIZE;

  logImageDebug('Compression check', {
    width: asset.width,
    height: asset.height,
    sizeInBytes,
    shouldCompress,
    maxWidth: IMAGE_CONFIG.MAX_WIDTH,
    maxHeight: IMAGE_CONFIG.MAX_HEIGHT,
    maxSize: IMAGE_CONFIG.MAX_FILE_SIZE
  });

  return shouldCompress;
};

const getOptimalQuality = (originalSize: number): number => {
  // Adaptive quality based on file size
  if (originalSize > 5 * 1024 * 1024) return 0.7;  // 5MB+ -> 70%
  if (originalSize > 2 * 1024 * 1024) return 0.75; // 2MB+ -> 75%
  if (originalSize > 1 * 1024 * 1024) return 0.8;  // 1MB+ -> 80%
  return IMAGE_CONFIG.QUALITY; // Default 85%
};

const calculateOptimalDimensions = (width: number, height: number) => {
  const { MAX_WIDTH, MAX_HEIGHT } = IMAGE_CONFIG;

  if (width <= MAX_WIDTH && height <= MAX_HEIGHT) {
    return { width, height };
  }

  const widthRatio = MAX_WIDTH / width;
  const heightRatio = MAX_HEIGHT / height;
  const ratio = Math.min(widthRatio, heightRatio);

  const newWidth = Math.round(width * ratio);
  const newHeight = Math.round(height * ratio);

  logImageDebug('Dimension optimization', {
    original: { width, height },
    optimized: { width: newWidth, height: newHeight },
    ratio
  });

  return { width: newWidth, height: newHeight };
};

/** -------------------------
 * 🔹 PersistentWebView Component
 * ------------------------- */
const PersistentWebView = forwardRef<PersistentWebViewRef, PersistentWebViewProps>(
  ({ route, onMessage, disableAutoNavigation = false, onRefresh, refreshing = false, disableRefresh = false, isFromNavbar = false, maxPhotos = 3 }, ref) => {
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
    // Add state to track if WebView is at top
    const [isAtTop, setIsAtTop] = useState(true);
    // Camera modal state
    const [cameraModalVisible, setCameraModalVisible] = useState(false);

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
 * 🔹 React Native Image Compression Function
 * ------------------------- */
    const compressImageWithManipulator = async (
      uri: string,
      targetWidth: number,
      targetHeight: number,
      quality: number
    ): Promise<{ base64: string, width: number, height: number }> => {
      try {
        logImageDebug('Starting image manipulation', {
          targetWidth,
          targetHeight,
          quality,
          originalUri: uri.substring(0, 50) + '...'
        });

        const manipulateResult = await ImageManipulator.manipulateAsync(
          uri,
          [
            {
              resize: {
                width: targetWidth,
                height: targetHeight,
              },
            },
          ],
          {
            compress: quality,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: true,
          }
        );

        logImageDebug('Image manipulation completed', {
          newWidth: manipulateResult.width,
          newHeight: manipulateResult.height,
          newUri: manipulateResult.uri.substring(0, 50) + '...',
          hasBase64: !!manipulateResult.base64
        });

        if (!manipulateResult.base64) {
          throw new Error('Failed to generate base64 from manipulated image');
        }

        return {
          base64: manipulateResult.base64,
          width: manipulateResult.width || targetWidth,
          height: manipulateResult.height || targetHeight
        };
      } catch (error) {
        logError('Image manipulation failed:', error);
        throw error;
      }
    };

    /** -------------------------
     * 🔹 Camera Modal Handler
     * ------------------------- */
    const handleOpenCameraModal = useCallback(() => {
      setCameraModalVisible(true);
    }, []);

    /** -------------------------
     * 🔹 Camera Modal Photo Handler
     * ------------------------- */
    const handlePhotosSelected = useCallback((photos: any[]) => {
      logImageDebug('Photos selected from camera modal', {
        count: photos.length,
        photos: photos.map(p => ({
          width: p.width,
          height: p.height,
          hasBase64: !!p.base64
        }))
      });

      // Format photos for WebView - INCLUDE base64 data
      const formattedImages = photos.map((photo, index) => ({
        base64: photo.base64,  // ✅ ADD THIS - pure base64 string
        type: 'image/jpeg',
        name: `camera_${Date.now()}_${index}.jpg`,
        width: photo.width,
        height: photo.height,
        size: Math.round(photo.base64 ? calculateImageSize(photo.base64) / 1024 : 0),
        originalSize: Math.round(photo.base64 ? calculateImageSize(photo.base64) / 1024 : 0),
        compressionRatio: 0,
        processingTime: 0,
      }));

      const messagePayload = {
        type: 'IMAGES_SELECTED',
        images: formattedImages,
        metadata: {
          totalOriginalSize: formattedImages.reduce((sum, img) => sum + img.size, 0),
          totalCompressedSize: formattedImages.reduce((sum, img) => sum + img.size, 0),
          compressionRatio: 0,
          processingTime: 0,
          timestamp: Date.now()
        }
      };

      logImageDebug('Sending camera photos to WebView', {
        imageCount: formattedImages.length,
        payloadSize: `${Math.round(JSON.stringify(messagePayload).length / 1024)}KB`
      });

      webViewRef.current?.postMessage(JSON.stringify(messagePayload));
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
            logImageDebug('Camera modal requested from WebView', data.options);
            handleOpenCameraModal();
            return;

          case 'NAVIGATE_TO_PROFILE':
            if (data.nickname) {
              router.push({ pathname: '/profiles/[nickname]', params: { nickname: data.nickname } });
            }
            return;

          case 'NAVIGATE_TO_PROFILE_TAB':
            router.push('/(tabs)/profile');
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
            if (pageType.isChatPage || pageType.isChatIndexPage || pageType.isCategoryPage || pageType.isProfilePage || pageType.isSearchPage) {
              return router.back();
            }
            if (pageType.isListingDetail) {
              router.back();
              return;
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
              `/(tabs)/chats?tab=selling&listing=${data.listingId}` :
              '/(tabs)/chats'
            );
            return;

          case 'NAVIGATE':
            if (data.path) router.push(data.path);
            return;

          case 'NAVIGATE_SEARCH':
            router.push('/search/page');
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

          case 'NAVIGATE_TO_CATEGORY':
            // Handle category navigation from ListItem or other components
            if (data.category) {
              const categoryPath = `/categories/${encodeURIComponent(data.category)}`;
              log('NAVIGATE_TO_CATEGORY message received:', data.category);
              if (!__DEV__) {
                log('Adding navigation delay for production category navigation');
                setTimeout(() => {
                  router.push(categoryPath as any);
                }, NAVIGATION_DELAY);
              } else {
                router.push(categoryPath as any);
              }
            }
            return;

          case 'NAVIGATE_TO_SUBCATEGORY':
            // Handle subcategory navigation - navigate directly to subcategory URL
            if (data.subcategory) {
              const subcategoryPath = `/categories/${encodeURIComponent(data.subcategory)}`;
              log('NAVIGATE_TO_SUBCATEGORY/SUBCATEGORY_CLICKED message received:', data.subcategory);
              if (!__DEV__) {
                log('Adding navigation delay for production subcategory navigation');
                setTimeout(() => {
                  router.push(subcategoryPath as any);
                }, NAVIGATION_DELAY);
              } else {
                router.push(subcategoryPath as any);
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
      handleOpenCameraModal,
      handlePhotosSelected,
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
    true;`

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
     * 🔹 WebView Scroll Handler
     * ------------------------- */
    const handleScroll = useCallback((event: any) => {
      const { contentOffset } = event.nativeEvent;
      const isCurrentlyAtTop = contentOffset.y <= 0;

      // Only update state if it changed to avoid unnecessary re-renders
      if (isCurrentlyAtTop !== isAtTop) {
        setIsAtTop(isCurrentlyAtTop);
      }
    }, [isAtTop]);

    /** -------------------------
     * 🔹 WebView Props
     * ------------------------- */
    const webViewProps = useMemo(() => ({
      ref: webViewRef,
      source: { uri: currentUrl },
      injectedJavaScript: injectedJS,
      style: [styles.webView, { backgroundColor: '#f8f8f8' }],
      onLoad: handleLoadEnd,
      onLoadEnd: handleLoadEnd,
      onError: handleError,
      onHttpError: handleHttpError,
      onMessage: handleMessage,
      onScroll: handleScroll, // Add scroll handler

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

    }), [currentUrl, handleLoadEnd, handleError, handleHttpError, handleMessage, handleScroll]);

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
          <WebView {...webViewProps} pullToRefreshEnabled={true} />
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
                enabled={isAtTop}
              />
            }
          >
            <WebView {...webViewProps} pullToRefreshEnabled={false} />
          </ScrollView>
        )}

        {isLoading && (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#2528be" />
          </View>
        )}

        {/* Camera Modal */}
        <CameraModal
          visible={cameraModalVisible}
          onClose={() => setCameraModalVisible(false)}
          onPhotosSelected={handlePhotosSelected}
          maxPhotos={maxPhotos}
        />
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
    minHeight: '100%',
    backgroundColor: '#f8f8f8'
  },
  loaderContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
});