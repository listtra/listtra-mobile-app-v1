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
import { ActivityIndicator, Platform, RefreshControl, ScrollView, Share, StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useAuth } from '../context/AuthContext';
import OfflineScreen from './OfflineScreen';

//const BASE_URL = 'http://10.147.95.190:3000'; // adjust for prod/dev
//const BASE_URL = 'https://merger-parking-shadows-sphere.trycloudflare.com';
const BASE_URL = 'https://listtra-git-redesign2-listtra.vercel.app';

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
  | { type: 'AUTH_RESTORED'; user?: any }
  | { type: 'OPEN_IMAGE_PICKER'; options?: any }
  | { type: 'OPEN_WEB_OAUTH'; provider: 'google' }
  | { type: 'SHARE_LISTING'; data: any }
  | { type: string;[key: string]: any }; // fallback

/** -------------------------
 * 🔹 Logger (dev only)
 * ------------------------- */
const log = (...args: any[]) => {
  if (__DEV__) console.log('[PersistentWebView]', ...args);
};

/** -------------------------
 * 🔹 Helpers
 * ------------------------- */
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
 * 🔹 PersistentWebView
 * ------------------------- */
const PersistentWebView = forwardRef<PersistentWebViewRef, PersistentWebViewProps>(
  ({ route, onMessage, disableAutoNavigation = false, onRefresh, refreshing = false, disableRefresh = false }, ref) => {
    const webViewRef = useRef<WebView>(null);
    const { tokens, logout, isAuthenticated, user, handleGoogleSignIn, setTokensDirectly } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isOffline, setIsOffline] = useState(false);
    const router = useRouter();
    const hasNavigated = useRef(false);
    const [currentUrl, setCurrentUrl] = useState('');

    // Flags to avoid re-injecting repeatedly
    const authInjectedRef = useRef(false);
    const authRestoredRef = useRef(false);

    /** -------------------------
     * 🔹 Clear WebView auth
     * ------------------------- */
    const clearWebViewAuth = useCallback(() => {
      webViewRef.current?.injectJavaScript(`
        try {
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          sessionStorage.clear();
          window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'WEBVIEW_AUTH_CLEARED' }));
        } catch (e) { console.error(e); }
      `);
    }, []);

    /** -------------------------
     * 🔹 Restore WebView auth
     * ------------------------- */
    const restoreWebViewAuth = useCallback(() => {
      if (webViewRef.current && isAuthenticated && tokens.accessToken && tokens.refreshToken) {
        const safeAccess = JSON.stringify(tokens.accessToken);
        const safeRefresh = JSON.stringify(tokens.refreshToken);
        const safeUser = user ? JSON.stringify(user) : 'null';

        // Inject tokens and trigger auth validation
        webViewRef.current.injectJavaScript(`
          try {
            console.log('Native app injecting auth tokens');
            localStorage.setItem('token', ${safeAccess});
            localStorage.setItem('refreshToken', ${safeRefresh});
            ${user ? `localStorage.setItem('user', ${safeUser});` : ''}
            
            // Dispatch a custom event to notify the web app that auth has been restored
            window.dispatchEvent(new CustomEvent('mobileAuthRestored', {
              detail: {
                tokens: {
                  accessToken: ${safeAccess},
                  refreshToken: ${safeRefresh}
                },
                user: ${safeUser}
              }
            }));
            
            // Also send the standard message
            window.ReactNativeWebView?.postMessage(JSON.stringify({ 
              type: 'AUTH_RESTORED', 
              user: ${safeUser},
              tokens: {
                accessToken: ${safeAccess},
                refreshToken: ${safeRefresh}
              }
            }));
            
            console.log('Auth tokens injected and events dispatched');
          } catch (e) { 
            console.error('Error injecting auth:', e); 
          }
        `);
      }
    }, [isAuthenticated, tokens.accessToken, tokens.refreshToken, user]);

    const handleShare = async (shareData: any) => {
      try {
        const shareOptions = {
          title: shareData.title,
          message: `${shareData.title}\n\n${shareData.description}\n\nCheck it out: ${shareData.url}`,
          url: shareData.url,
        };
        const result = await Share.share(shareOptions);
        if (result.action === Share.sharedAction) {
          if (result.activityType) {
            log('Shared via:', result.activityType);
          } else {
            log('Content shared successfully');
          }
        } else if (result.action === Share.dismissedAction) {
          log('Share dismissed');
        }
      } catch (error) {
        log('Error sharing:', error);
        // Send error back to WebView
        webViewRef.current?.postMessage(JSON.stringify({
          type: 'SHARE_ERROR',
          error: 'Failed to share content'
        }));
      }
    }

    /** -------------------------
     * 🔹 Handle WebView messages
     * ------------------------- */
    const handleMessage = useCallback(
      (event: WebViewMessageEvent) => {
        try {
          const data: WebViewMessage = JSON.parse(event.nativeEvent.data);
          log('Message received:', data.type, data);

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
              return;

            case 'AUTH_REQUIRED':
              router.replace('/auth/signin');
              return;

            case 'AUTH_VALIDATION_FAILED':
              clearWebViewAuth();
              logout().finally(() => router.replace('/auth/signin'));
              return;

            case 'AUTH_VALIDATION_SUCCESS':
              console.log('AUTH_VALIDATION_SUCCESS 🔥', data);
              setTokensDirectly(data.tokens.accessToken, data.tokens.refreshToken, data.user);
              restoreWebViewAuth();
              return;

            case 'AUTH_LOGIN_SUCCESS':
              console.log('AUTH_LOGIN_SUCCESS received:', data);
              setTokensDirectly(data.tokens.accessToken, data.tokens.refreshToken, data.user);

              // Wait a bit for tokens to be stored
              setTimeout(() => {
                restoreWebViewAuth();
                // Navigate after auth is restored
                setTimeout(() => router.push('/(tabs)'), 500);
              }, 200);
              return;

            case 'WEB_LOGOUT_SUCCESS':
              hasNavigated.current = true;
              clearWebViewAuth();
              logout().finally(() => router.replace('/auth/signin'));
              return;

            case 'GO_BACK': {
              const { isAddPage, isAddSuccessPage, isListingDetail, isChatPage, isChatIndexPage, isChatsPage, isLikedPage, isSigninPage } =
                getPageType(currentUrl, route);

              if (isSigninPage) return router.replace('/(tabs)');
              if (data.from === 'edit-page' && data.slug && data.product_id) {
                return router.replace({ pathname: '/listings/[slug]/[product_id]/page', params: { slug: data.slug, product_id: data.product_id } });
              }
              if (isLikedPage || isAddPage || isAddSuccessPage || isChatsPage) return router.replace('/(tabs)');
              if (isListingDetail || isChatPage || isChatIndexPage) return router.back();

              webViewRef.current?.injectJavaScript(`
                if (window.history.length > 1) window.history.back();
                else window.location.href = "${BASE_URL}/chats";
              `);
              return;
            }

            case 'LISTING_CLICKED':
              if (!disableAutoNavigation && data.listing?.slug && data.listing?.product_id) {
                router.push({ pathname: '/listings/[slug]/[product_id]/page', params: data.listing });
              }
              return;

            case 'PROFILE_CLICKED':
              if (data.nickname) router.push({ pathname: '/profiles/[nickname]', params: { nickname: data.nickname } });
              return;

            case 'NAVIGATE_TO_LISTINGS': router.push('/(tabs)'); return;
            case 'NAVIGATE_TO_LISTING': router.push({ pathname: '/listings/[slug]/[product_id]/page', params: { slug: data.slug, product_id: data.productId } }); return;
            case 'ADD_LISTING_CLICKED': router.push('/add'); return;
            case 'NAVIGATE_CHAT': router.push({ pathname: '/chat/[id]', params: { id: data.chatId } }); return;
            case 'VIEW_ALL_CHATS': router.push(data.listingId ? { pathname: '/chat', params: { listingId: data.listingId } } : '/chat'); return;
            case 'NAVIGATE': if (data.path) router.push(data.path); return;
            case 'NAVIGATE_TO_LOCATION': router.push('/location'); return;

            default:
              break;
          }

          onMessage?.(event);
        } catch (err) {
          log('Error parsing WebView message:', err);
          onMessage?.(event);
        }
      },
      [onMessage, router, currentUrl, route, disableAutoNavigation, clearWebViewAuth, logout]
    );

    const handleGoogleOAuth = async () => {
      try {
        log('Handling Google OAuth request - opening in system browser');
        const result = await handleGoogleSignIn();

        if (result.success) {
          console.log('Google OAuth successful, tokens and user available');
          console.log('Result tokens:', result.tokens);
          console.log('Result user:', result.user);

          // Give a moment for state to update, then restore WebView auth
          setTimeout(() => {
            console.log('Restoring WebView auth after Google OAuth success');
            restoreWebViewAuth();

            // Send success message to WebView
            webViewRef.current?.postMessage(JSON.stringify({
              type: 'AUTH_LOGIN_SUCCESS',
              tokens: result.tokens,
              user: result.user
            }));
          }, 300);

        } else {
          log('Google OAuth failed:', result.error);
          webViewRef.current?.postMessage(JSON.stringify({
            type: 'AUTH_LOGIN_FAILED',
            error: result.error
          }));
        }
      } catch (error) {
        log('Error in Google OAuth flow:', error);
        webViewRef.current?.postMessage(JSON.stringify({
          type: 'AUTH_LOGIN_FAILED',
          error: 'Authentication failed'
        }));
      }
    };

    /** -------------------------
     * 🔹 Image Picker
     * ------------------------- */
    const handleImagePicker = async (options: any) => {
      try {
        // Request both camera and media library permissions
        const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();

        if (mediaStatus !== 'granted' && cameraStatus !== 'granted') {
          return alert('Permission needed to access photos and camera.');
        }

        // Show action sheet to choose between camera and gallery
        const result = await new Promise<any>((resolve) => {
          const showActionSheet = () => {
            if (Platform.OS === 'ios') {
              // For iOS, use ActionSheetIOS
              const ActionSheetIOS = require('react-native').ActionSheetIOS;
              ActionSheetIOS.showActionSheetWithOptions(
                {
                  options: ['Cancel', 'Take Photo', 'Choose from Gallery'],
                  cancelButtonIndex: 0,
                },
                (buttonIndex: number) => {
                  if (buttonIndex === 1) {
                    // Take Photo
                    ImagePicker.launchCameraAsync({
                      mediaTypes: ImagePicker.MediaTypeOptions.Images,
                      allowsEditing: options?.allowsEditing || false,
                      quality: options?.quality || 0.85,
                      base64: true,
                      exif: false,
                      aspect: [4, 3],
                    }).then(resolve);
                  } else if (buttonIndex === 2) {
                    // Choose from Gallery
                    ImagePicker.launchImageLibraryAsync({
                      mediaTypes: ImagePicker.MediaTypeOptions.Images,
                      allowsMultipleSelection: true,
                      quality: options?.quality || 0.85,
                      base64: true,
                      exif: false,
                      allowsEditing: false,
                      aspect: [4, 3],
                    }).then(resolve);
                  } else {
                    resolve({ canceled: true });
                  }
                }
              );
            } else {
              // For Android, use Alert
              const Alert = require('react-native').Alert;
              Alert.alert(
                'Select Image',
                'Choose an option',
                [
                  { text: 'Cancel', style: 'cancel', onPress: () => resolve({ canceled: true }) },
                  {
                    text: 'Camera',
                    onPress: () => {
                      ImagePicker.launchCameraAsync({
                        mediaTypes: ImagePicker.MediaTypeOptions.Images,
                        allowsEditing: options?.allowsEditing || false,
                        quality: options?.quality || 0.85,
                        base64: true,
                        exif: false,
                        aspect: [4, 3],
                      }).then(resolve);
                    }
                  },
                  {
                    text: 'Gallery',
                    onPress: () => {
                      ImagePicker.launchImageLibraryAsync({
                        mediaTypes: ImagePicker.MediaTypeOptions.Images,
                        allowsMultipleSelection: true,
                        quality: options?.quality || 0.85,
                        base64: true,
                        exif: false,
                        allowsEditing: false,
                        aspect: [4, 3],
                      }).then(resolve);
                    }
                  }
                ],
                { cancelable: true }
              );
            }
          };

          showActionSheet();
        });

        if (!result.canceled && result.assets) {
          const images = result.assets.slice(0, options?.maxImages || 5).map((asset: any, index: number) => ({
            uri: `data:image/jpeg;base64,${asset.base64}`,
            type: 'image/jpeg',
            name: `image_${Date.now()}_${index}.jpg`,
            width: asset.width,
            height: asset.height,
            size: Math.round((asset.base64?.length || 0) * 0.75 / 1024),
          }));

          webViewRef.current?.postMessage(JSON.stringify({ type: 'IMAGES_SELECTED', images }));
        }
      } catch (error) {
        log('Error picking images:', error);
        alert('Error selecting images. Please try again.');
      }
    };

    /** -------------------------
     * 🔹 Network status
     * ------------------------- */
    useEffect(() => {
      const unsubscribe = NetInfo.addEventListener((state) => {
        setIsOffline(!state.isConnected);
        setError(!state.isConnected ? 'No internet connection' : null);
      });
      return unsubscribe;
    }, []);

    /** -------------------------
     * 🔹 Build initial URL
     * ------------------------- */
    const buildUrl = useCallback(
      (baseRoute: string) => {
        const url = new URL(`${BASE_URL}/${baseRoute}`);
        if (user?.id) url.searchParams.set('user_id', user.id);
        if (!authInjectedRef.current && isAuthenticated && tokens.accessToken && tokens.refreshToken) {
          url.searchParams.set('access_token', tokens.accessToken);
          url.searchParams.set('refresh_token', tokens.refreshToken);
          url.searchParams.set('isNativeAuth', 'true');
        }
        return url.toString();
      },
      [isAuthenticated, tokens.accessToken, tokens.refreshToken, user?.id]
    );

    useEffect(() => {
      const newUrl = buildUrl(route);
      setCurrentUrl(newUrl);
      if (!authRestoredRef.current && isAuthenticated && tokens.accessToken && tokens.refreshToken) {
        setTimeout(restoreWebViewAuth, 300);
      }
    }, [route, buildUrl, isAuthenticated, tokens.accessToken, tokens.refreshToken, restoreWebViewAuth]);

    useEffect(() => {
      if (!isAuthenticated && !tokens.accessToken) clearWebViewAuth();
    }, [isAuthenticated, tokens.accessToken, clearWebViewAuth]);

    /** -------------------------
     * 🔹 Error handlers
     * ------------------------- */
    const handleError = useCallback((e: any) => {
      const msg = e.nativeEvent.description || e.nativeEvent.message || '';
      log('WebView error:', msg);
      setError(msg);
      setIsOffline(true);
      setIsLoading(false);
    }, []);

    const handleHttpError = useCallback((e: any) => {
      const msg = `HTTP error: ${e.nativeEvent.statusCode}`;
      log(msg);
      setError(msg);
      setIsOffline(e.nativeEvent.statusCode >= 500);
      setIsLoading(false);
    }, []);

    /** -------------------------
     * 🔹 Expose methods
     * ------------------------- */
    useImperativeHandle(ref, () => ({
      refresh: () => webViewRef.current?.injectJavaScript(`(window.refreshData?.() || window.refreshListings?.() || location.reload())`),
      reload: () => webViewRef.current?.reload(),
      injectJavaScript: (script: string) => webViewRef.current?.injectJavaScript(script),
      clearWebViewAuth,
    }));

    /** -------------------------
     * 🔹 Render
     * ------------------------- */
    const webViewProps = useMemo(
      () => ({
        ref: webViewRef,
        source: { uri: currentUrl },
        style: styles.webView,
        onLoad: () => setIsLoading(false),
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
      }),
      [currentUrl, handleError, handleHttpError, handleMessage]
    );

    return (
      <View style={styles.container}>
        {isOffline ? (
          <OfflineScreen onRetry={() => webViewRef.current?.reload()} message={error || 'No internet connection'} />
        ) : disableRefresh ? (
          <WebView {...webViewProps} />
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollViewContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh || (() => webViewRef.current?.reload())} colors={['#2528be']} tintColor="#2528be" />
            }>
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
