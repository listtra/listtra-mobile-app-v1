import NetInfo from '@react-native-community/netinfo';
import * as ImagePicker from 'expo-image-picker';
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
const MAX_IMAGES = 5;

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
     * 🔹 Updated Image Picker Handler
     * ------------------------- */
    const handleImagePicker = useCallback(async (options: any = {}) => {
      const startTime = Date.now();
      logImageDebug('Image picker started', { options });

      try {
        // Request permissions
        const [mediaResult, cameraResult] = await Promise.all([
          ImagePicker.requestMediaLibraryPermissionsAsync(),
          ImagePicker.requestCameraPermissionsAsync(),
        ]);

        if (mediaResult.status !== 'granted' && cameraResult.status !== 'granted') {
          logError('Image picker permissions denied');
          Alert.alert(
            'Permission Required',
            'Please grant permission to access photos and camera.',
            [{ text: 'OK' }]
          );
          return;
        }

        logImageDebug('Permissions granted', {
          media: mediaResult.status,
          camera: cameraResult.status
        });

        // Get images with high quality for our processing
        const result = await new Promise<any>((resolve) => {
          const handleSelection = (pickerFunction: () => Promise<any>) => {
            pickerFunction().then(resolve).catch((error) => {
              logError('Image picker selection error:', error);
              resolve({ canceled: true });
            });
          };

          // Use high quality initially, we'll compress properly afterwards
          const baseOptions = {
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: options.allowsEditing || false,
            quality: 1.0, // Maximum quality for initial capture
            base64: false, // We'll get base64 after compression
            exif: false,
            aspect: [4, 3] as [number, number],
          };

          const cameraOptions = {
            ...baseOptions,
          };

          const galleryOptions = {
            ...baseOptions,
            allowsMultipleSelection: true,
            allowsEditing: false,
            selectionLimit: options.maxImages || MAX_IMAGES,
          };

          logImageDebug('Using high-quality initial capture for better compression control');

          if (Platform.OS === 'ios') {
            const ActionSheetIOS = require('react-native').ActionSheetIOS;
            ActionSheetIOS.showActionSheetWithOptions(
              {
                options: ['Cancel', 'Take Photo', 'Choose from Gallery'],
                cancelButtonIndex: 0,
              },
              (buttonIndex: number) => {
                logImageDebug('iOS action sheet selection', { buttonIndex });
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

        if (result.canceled || !result.assets || result.assets.length === 0) {
          logImageDebug('Image picker canceled or no images selected');
          return;
        }

        logImageDebug('Raw images selected', {
          count: result.assets.length,
          firstImageSize: result.assets[0] ? {
            width: result.assets[0].width,
            height: result.assets[0].height,
            type: result.assets[0].type,
            uri: result.assets[0].uri?.substring(0, 50) + '...',
            fileSize: result.assets[0].fileSize
          } : null
        });

        // Process images with ACTUAL compression using ImageManipulator
        const maxImages = options.maxImages || MAX_IMAGES;
        const processedImages = [];
        let totalOriginalSize = 0;
        let totalCompressedSize = 0;

        for (let i = 0; i < Math.min(result.assets.length, maxImages); i++) {
          const asset = result.assets[i];
          const processingStart = Date.now();

          try {
            logImageDebug(`Processing image ${i + 1}/${result.assets.length}`, {
              width: asset.width,
              height: asset.height,
              type: asset.type,
              fileSize: asset.fileSize,
              uri: asset.uri?.substring(0, 50) + '...'
            });

            // Estimate original size from file size or dimensions
            const originalSize = asset.fileSize || (asset.width * asset.height * 3); // Rough estimate
            totalOriginalSize += originalSize;

            // Determine if we need compression
            const needsProcessing = asset.width > IMAGE_CONFIG.MAX_WIDTH ||
              asset.height > IMAGE_CONFIG.MAX_HEIGHT ||
              originalSize > IMAGE_CONFIG.MAX_FILE_SIZE;

            let finalBase64: string;
            let finalWidth = asset.width;
            let finalHeight = asset.height;
            let finalType = 'image/jpeg';
            let actualFinalSize = originalSize;

            if (needsProcessing) {
              logImageDebug(`Image ${i + 1} needs compression - using ImageManipulator`);

              // Get optimal settings
              const optimalQuality = getOptimalQuality(originalSize);
              const { width: optimalWidth, height: optimalHeight } = calculateOptimalDimensions(asset.width, asset.height);

              logImageDebug(`Applying compression settings`, {
                originalDimensions: `${asset.width}x${asset.height}`,
                targetDimensions: `${optimalWidth}x${optimalHeight}`,
                quality: optimalQuality,
                originalSize: `${Math.round(originalSize / 1024)}KB`
              });

              try {
                // ACTUALLY COMPRESS THE IMAGE using ImageManipulator
                const compressionResult = await compressImageWithManipulator(
                  asset.uri,
                  optimalWidth,
                  optimalHeight,
                  optimalQuality
                );

                finalBase64 = compressionResult.base64;
                finalWidth = compressionResult.width;
                finalHeight = compressionResult.height;
                actualFinalSize = calculateImageSize(finalBase64);

                logImageDebug(`ImageManipulator compression completed`, {
                  originalSize: `${Math.round(originalSize / 1024)}KB`,
                  compressedSize: `${Math.round(actualFinalSize / 1024)}KB`,
                  dimensions: `${finalWidth}x${finalHeight}`,
                  compressionRatio: `${Math.round((1 - actualFinalSize / originalSize) * 100)}%`
                });
              } catch (compressionError) {
                logError(`ImageManipulator compression failed for image ${i + 1}:`, compressionError);

                // Fall back to getting base64 from original
                try {
                  const fallbackResult = await ImageManipulator.manipulateAsync(
                    asset.uri,
                    [],
                    {
                      compress: IMAGE_CONFIG.QUALITY,
                      format: ImageManipulator.SaveFormat.JPEG,
                      base64: true,
                    }
                  );
                  finalBase64 = fallbackResult.base64 || '';
                  actualFinalSize = calculateImageSize(finalBase64);
                  logImageDebug(`Used fallback compression for image ${i + 1}`);
                } catch (fallbackError) {
                  logError(`Fallback compression also failed for image ${i + 1}:`, fallbackError);
                  continue; // Skip this image
                }
              }
            } else {
              logImageDebug(`Image ${i + 1} doesn't need compression - getting base64`);

              // Just get base64 without compression
              try {
                const base64Result = await ImageManipulator.manipulateAsync(
                  asset.uri,
                  [],
                  {
                    compress: IMAGE_CONFIG.QUALITY,
                    format: ImageManipulator.SaveFormat.JPEG,
                    base64: true,
                  }
                );
                finalBase64 = base64Result.base64 || '';
                actualFinalSize = calculateImageSize(finalBase64);
              } catch (base64Error) {
                logError(`Failed to get base64 for image ${i + 1}:`, base64Error);
                continue; // Skip this image
              }
            }

            totalCompressedSize += actualFinalSize;

            const processedImage = {
              uri: `data:${finalType};base64,${finalBase64}`,
              type: finalType,
              name: `image_${Date.now()}_${i}.jpg`,
              width: finalWidth,
              height: finalHeight,
              size: Math.round(actualFinalSize / 1024), // Size in KB
              originalSize: Math.round(originalSize / 1024), // Original size in KB
              compressionRatio: originalSize > 0 ? Math.round((1 - actualFinalSize / originalSize) * 100) : 0,
              processingTime: Date.now() - processingStart,
            };

            processedImages.push(processedImage);

            logImageDebug(`Image ${i + 1} processed successfully`, {
              originalSize: `${Math.round(originalSize / 1024)}KB`,
              finalSize: `${Math.round(actualFinalSize / 1024)}KB`,
              compressionRatio: `${processedImage.compressionRatio}%`,
              processingTime: `${processedImage.processingTime}ms`,
              dimensions: `${finalWidth}x${finalHeight}`
            });

          } catch (error) {
            logError(`Failed to process image ${i + 1}:`, error);
            continue;
          }
        }

        const totalProcessingTime = Date.now() - startTime;

        logImageDebug('Image processing completed', {
          totalImages: processedImages.length,
          totalOriginalSize: `${Math.round(totalOriginalSize / 1024)}KB`,
          totalCompressedSize: `${Math.round(totalCompressedSize / 1024)}KB`,
          overallCompressionRatio: totalOriginalSize > 0 ? `${Math.round((1 - totalCompressedSize / totalOriginalSize) * 100)}%` : '0%',
          totalProcessingTime: `${totalProcessingTime}ms`,
          averageProcessingTime: processedImages.length > 0 ? `${Math.round(totalProcessingTime / processedImages.length)}ms per image` : '0ms'
        });

        if (processedImages.length > 0) {
          const messagePayload = {
            type: 'IMAGES_SELECTED',
            images: processedImages,
            metadata: {
              totalOriginalSize: Math.round(totalOriginalSize / 1024),
              totalCompressedSize: Math.round(totalCompressedSize / 1024),
              compressionRatio: totalOriginalSize > 0 ? Math.round((1 - totalCompressedSize / totalOriginalSize) * 100) : 0,
              processingTime: totalProcessingTime,
              timestamp: Date.now()
            }
          };

          logImageDebug('Sending compressed images to WebView', {
            imageCount: processedImages.length,
            payloadSize: `${Math.round(JSON.stringify(messagePayload).length / 1024)}KB`
          });

          webViewRef.current?.postMessage(JSON.stringify(messagePayload));
        } else {
          logError('No images were successfully processed');
          Alert.alert('Error', 'Failed to process selected images. Please try again.');
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
            logImageDebug('Image picker requested from WebView', data.options);
            handleImagePicker(data.options);
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
            if (pageType.isListingDetail || pageType.isChatPage || pageType.isChatIndexPage || pageType.isCategoryPage || pageType.isProfilePage) {
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