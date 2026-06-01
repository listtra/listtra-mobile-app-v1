import NetInfo from "@react-native-community/netinfo";
import * as Location from "expo-location";
import { useNavigation, useRouter } from "expo-router";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Linking,
  Platform,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { useAuth } from "../context/AuthContext";
import CameraModal from "./CameraModal";
import OfflineScreen from "./OfflineScreen";

const BASE_URL = __DEV__
  ? "https://staging.zirkly.com"
  : "https://staging.zirkly.com";

export interface PersistentWebViewRef {
  refresh: () => void;
  reload: () => void;
  injectJavaScript: (script: string) => void;
}

type Props = {
  route: string;
  onMessage?: (event: WebViewMessageEvent) => void;
};

const MAX_PHOTOS = 3;

const calculateImageSize = (base64String: string): number => {
  const padding = (base64String.match(/=/g) || []).length;
  return Math.round(base64String.length * 0.75 - padding);
};

const PersistentWebView = forwardRef<PersistentWebViewRef, Props>(
  ({ route, onMessage }, ref) => {
    const webViewRef = useRef<WebView>(null);
    const canGoBackRef = useRef(false);
    const justLoggedOut = useRef(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isOffline, setIsOffline] = useState(false);
    const [cameraModalVisible, setCameraModalVisible] = useState(false);
    const [currentPhotoCount, setCurrentPhotoCount] = useState(0);
    const { handleGoogleSignIn, handleAppleSignIn, setTokensDirectly, logout } =
      useAuth();
    const router = useRouter();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();

    // Route the iOS edge-swipe / Android system-back through the WebView's
    // internal history before letting the native stack pop. Without this, a
    // back gesture on a screen whose WebView has navigated internally would
    // dismiss the native screen (or exit the app at a stack root) instead of
    // going back inside the web app.
    useEffect(() => {
      const sub = navigation.addListener("beforeRemove", (e: any) => {
        if (e.data?.action?.type !== "GO_BACK") return;
        if (canGoBackRef.current && webViewRef.current) {
          e.preventDefault();
          webViewRef.current.goBack();
        }
      });
      return sub;
    }, [navigation]);

    useEffect(() => {
      if (Platform.OS !== "android") return;
      const onBack = () => {
        if (canGoBackRef.current && webViewRef.current) {
          webViewRef.current.goBack();
          return true;
        }
        return false;
      };
      const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
      return () => sub.remove();
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        refresh: () => webViewRef.current?.reload(),
        reload: () => webViewRef.current?.reload(),
        injectJavaScript: (script: string) =>
          webViewRef.current?.injectJavaScript(script),
      }),
      [],
    );

    // Auto-recover: when connectivity returns, hide the offline screen and
    // reload the WebView. WebView errors will flip us back to offline if the
    // load still fails.
    useEffect(() => {
      const unsubscribe = NetInfo.addEventListener((state) => {
        const connected = state.isConnected === true;
        setIsOffline((prev) => {
          if (!connected) return true;
          if (prev) {
            webViewRef.current?.reload();
            setIsLoading(true);
          }
          return false;
        });
      });
      return unsubscribe;
    }, []);

    const handleWebViewError = useCallback(() => {
      setIsOffline(true);
      setIsLoading(false);
    }, []);

    const handleWebViewHttpError = useCallback((e: any) => {
      const statusCode = e?.nativeEvent?.statusCode;
      if (typeof statusCode === "number" && statusCode >= 500) {
        setIsOffline(true);
        setIsLoading(false);
      }
    }, []);

    const handleRetry = useCallback(async () => {
      const state = await NetInfo.fetch();
      if (state.isConnected) {
        setIsOffline(false);
        setIsLoading(true);
        webViewRef.current?.reload();
      }
    }, []);

    const handleMessage = useCallback(
      async (event: WebViewMessageEvent) => {
        try {
          const data = JSON.parse(event.nativeEvent.data);

          switch (data.type) {
            // ---- Image Picker ----
            case "OPEN_IMAGE_PICKER": {
              if (__DEV__)
                console.log(
                  "[WebView] OPEN_IMAGE_PICKER received",
                  data.options,
                );
              if (data.options?.maxImages !== undefined) {
                const alreadySelected = MAX_PHOTOS - data.options.maxImages;
                setCurrentPhotoCount(Math.max(0, alreadySelected));
              } else {
                setCurrentPhotoCount(0);
              }
              setCameraModalVisible(true);
              break;
            }

            // ---- OAuth ----
            case "OPEN_WEB_OAUTH": {
              const isGoogle = data.provider === "google";
              const handler = isGoogle ? handleGoogleSignIn : handleAppleSignIn;
              const result = await handler(data.referralCode);

              if (result.success && result.tokens && result.user) {
                webViewRef.current?.postMessage(
                  JSON.stringify({
                    type: isGoogle
                      ? "GOOGLE_AUTH_SUCCESS"
                      : "APPLE_AUTH_SUCCESS",
                    tokens: JSON.stringify(result.tokens),
                    user: JSON.stringify(result.user),
                    referralCode: data.referralCode || null,
                  }),
                );
              } else {
                Alert.alert("Sign-In Error", result.error || "Sign-In failed.");
                webViewRef.current?.postMessage(
                  JSON.stringify({
                    type: isGoogle ? "GOOGLE_AUTH_ERROR" : "APPLE_AUTH_ERROR",
                    error: result.error || "Sign-In failed",
                  }),
                );
              }
              break;
            }

            // ---- Auth ----
            case "AUTH_LOGIN_SUCCESS":
              setTokensDirectly(
                data.tokens.accessToken,
                data.tokens.refreshToken,
                data.user,
              );
              break;

            case "AUTH_REQUIRED":
              // Don't redirect to sign-in if user just logged out
              if (!justLoggedOut.current) {
                router.replace("/auth/signin" as any);
              }
              break;

            case "WEB_LOGOUT_SUCCESS":
              console.log(
                "🔴 WEB_LOGOUT_SUCCESS received - clearing native auth",
              );
              justLoggedOut.current = true;
              await logout();
              console.log("🔴 Native logout completed");
              // Don't navigate the WebView — let the web finish its own logout
              // (NextAuth signOut needs to complete to clear HttpOnly cookies)
              // Reset flag after a delay
              setTimeout(() => {
                justLoggedOut.current = false;
              }, 5000);
              break;

            // ---- Navigation ----
            case "LISTING_CLICKED":
              if (data.listing?.slug && data.listing?.product_id) {
                const params: any = {
                  slug: data.listing.slug,
                  product_id: data.listing.product_id,
                };
                if (data.listing.queryParams?.source)
                  params.source = data.listing.queryParams.source;
                if (data.listing.queryParams?.q)
                  params.q = data.listing.queryParams.q;
                router.push({
                  pathname: "/listings/[slug]/[product_id]/page",
                  params,
                } as any);
              }
              break;

            case "PROFILE_CLICKED":
            case "NAVIGATE_TO_PROFILE":
              if (data.publicId) {
                router.push({
                  pathname: "/profiles/[publicId]",
                  params: { publicId: data.publicId },
                } as any);
              }
              break;

            case "NAVIGATE_TO_PROFILE_TAB":
              router.push("/(tabs)/profile" as any);
              break;

            case "NAVIGATE_TO_LISTINGS":
            case "NAVIGATE_TO_HOME":
              router.push("/(tabs)" as any);
              break;

            case "NAVIGATE_TO_LISTING":
              if (data.slug && data.productId) {
                router.push({
                  pathname: "/listings/[slug]/[product_id]/page",
                  params: { slug: data.slug, product_id: data.productId },
                } as any);
              }
              break;

            case "ADD_LISTING_CLICKED":
            case "NAVIGATE_TO_ADD":
              router.push("/(tabs)/add" as any);
              break;

            case "NAVIGATE_CHAT":
              if (data.chatId) {
                router.push({
                  pathname: "/chat/[id]",
                  params: { id: data.chatId },
                } as any);
              }
              break;

            case "NAVIGATE_PROFILE_REVIEWS":
              router.push({
                pathname: "/(tabs)/profile",
                params: {
                  tab: "Reviews",
                  subTab: data.subTab, // 'all', 'buyer', or 'seller'
                },
              } as any);
              break;

            case "VIEW_ALL_CHATS":
              router.push(
                data.listingId
                  ? (`/(tabs)/chats?tab=selling&listing=${data.listingId}` as any)
                  : ("/(tabs)/chats" as any),
              );
              break;

            case "NAVIGATE":
              if (data.path) router.push(data.path as any);
              break;

            case "NAVIGATE_SEARCH":
              if (data.query) {
                router.push(
                  `/search/page?q=${encodeURIComponent(data.query)}` as any,
                );
              } else {
                router.push("/search/page" as any);
              }
              break;

            case "CATEGORIES_CLICKED":
            case "NAVIGATE_TO_CATEGORY":
              if (data.category) {
                router.push(
                  `/categories/${encodeURIComponent(data.category)}` as any,
                );
              }
              break;

            case "NAVIGATE_TO_SUBCATEGORY":
              if (data.subcategory) {
                router.push(
                  `/categories/${encodeURIComponent(data.subcategory)}` as any,
                );
              }
              break;

            case "NAVIGATE_TO_LOCATION":
              router.push("/location" as any);
              break;

            case "WALLET_CLICKED":
              router.push(
                data.returnTo
                  ? (`/wallet/page?returnTo=${encodeURIComponent(data.returnTo)}` as any)
                  : ("/wallet/page" as any),
              );
              break;

            case "RETURN_TO_WALLET":
              router.push("/wallet/page" as any);
              break;

            case "GO_BACK": {
              if (canGoBackRef.current) {
                webViewRef.current?.goBack();
              } else {
                router.back();
              }
              break;
            }

            case "OPEN_SETTINGS":
              router.push("/settings" as any);
              break;

            // ---- Native Share ----
            case "SHARE_LISTING": {
              const shareData = data.shareData || data.data;
              const msg =
                shareData.text ||
                `${shareData.title}\n\n${shareData.url || ""}`;
              await Share.share(
                Platform.OS === "ios"
                  ? { message: msg }
                  : { title: shareData.title, message: msg },
              );
              break;
            }

            // ---- Native Location ----
            case "REQUEST_NATIVE_LOCATION": {
              const { status } =
                await Location.requestForegroundPermissionsAsync();
              if (status !== "granted") {
                webViewRef.current?.postMessage(
                  JSON.stringify({
                    type: "NATIVE_LOCATION_ERROR",
                    error: "PERMISSION_DENIED",
                    message: "Location permission denied.",
                  }),
                );
                return;
              }
              const loc = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
              });
              webViewRef.current?.postMessage(
                JSON.stringify({
                  type: "NATIVE_LOCATION_SUCCESS",
                  location: {
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                    accuracy: loc.coords.accuracy,
                  },
                }),
              );
              break;
            }

            // Auto-fetch on launch:
            //  - granted        -> fetch coords silently
            //  - undetermined   -> prompt once (first launch UX), fetch if user allows
            //  - denied         -> silent skip (iOS won't re-show the dialog anyway)
            case "REQUEST_NATIVE_LOCATION_IF_GRANTED": {
              try {
                const initial = await Location.getForegroundPermissionsAsync();
                console.log(
                  "[NATIVE_LOCATION_IF_GRANTED] permission status:",
                  initial.status,
                );

                let status = initial.status;
                if (status === "undetermined") {
                  const requested =
                    await Location.requestForegroundPermissionsAsync();
                  status = requested.status;
                  console.log(
                    "[NATIVE_LOCATION_IF_GRANTED] post-prompt status:",
                    status,
                  );
                }

                if (status !== "granted") {
                  webViewRef.current?.postMessage(
                    JSON.stringify({ type: "NATIVE_LOCATION_NOT_GRANTED" }),
                  );
                  return;
                }

                const loc = await Location.getCurrentPositionAsync({
                  accuracy: Location.Accuracy.Balanced,
                });
                console.log(
                  "[NATIVE_LOCATION_IF_GRANTED] got coords:",
                  loc.coords.latitude,
                  loc.coords.longitude,
                );
                webViewRef.current?.postMessage(
                  JSON.stringify({
                    type: "NATIVE_LOCATION_SUCCESS",
                    location: {
                      latitude: loc.coords.latitude,
                      longitude: loc.coords.longitude,
                      accuracy: loc.coords.accuracy,
                    },
                  }),
                );
              } catch (err) {
                console.warn(
                  "[NATIVE_LOCATION_IF_GRANTED] failed silently:",
                  err,
                );
                webViewRef.current?.postMessage(
                  JSON.stringify({ type: "NATIVE_LOCATION_NOT_GRANTED" }),
                );
              }
              break;
            }

            default:
              if (__DEV__) console.log("WebView message:", data.type);
              break;
          }

          onMessage?.(event);
        } catch (error) {
          console.error("Error parsing WebView message:", error);
          onMessage?.(event);
        }
      },
      [
        handleGoogleSignIn,
        handleAppleSignIn,
        setTokensDirectly,
        logout,
        router,
        onMessage,
      ],
    );

    const handlePhotosSelected = useCallback((photos: any[]) => {
      const formattedImages = photos.map((photo: any, index: number) => ({
        base64: photo.base64,
        type: "image/jpeg",
        name: `camera_${Date.now()}_${index}.jpg`,
        width: photo.width,
        height: photo.height,
        size: Math.round(
          photo.base64 ? calculateImageSize(photo.base64) / 1024 : 0,
        ),
      }));

      webViewRef.current?.postMessage(
        JSON.stringify({
          type: "IMAGES_SELECTED",
          images: formattedImages,
          metadata: {
            totalOriginalSize: formattedImages.reduce(
              (sum: number, img: any) => sum + img.size,
              0,
            ),
            totalCompressedSize: formattedImages.reduce(
              (sum: number, img: any) => sum + img.size,
              0,
            ),
            timestamp: Date.now(),
          },
        }),
      );
    }, []);

    const INTERNAL_DOMAINS = ["zirkly.com", "staging.zirkly.com", "localhost"];

    const handleNavigationRequest = (request: any) => {
      const url = request.url;

      const isInternal = INTERNAL_DOMAINS.some((domain) =>
        url.includes(domain),
      );

      if (!isInternal) {
        Linking.openURL(url);
        return false;
      }

      return true;
    };

    const bottomInset = Math.min(insets.bottom, 12);

    // Runs before the page's own scripts. Setting the viewport meta here means
    // iOS WKWebView honors user-scalable=no at parse time instead of letting
    // the page establish a zoomable layout first.
    const injectedJSBeforeContentLoaded = `
    (function () {
      var setViewport = function () {
        var head = document.head || document.getElementsByTagName('head')[0];
        if (!head) return;
        var m = document.querySelector('meta[name="viewport"]');
        var content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover';
        if (!m) {
          m = document.createElement('meta');
          m.setAttribute('name', 'viewport');
          head.appendChild(m);
        }
        m.setAttribute('content', content);
      };
      setViewport();
      // Re-apply if the page (or SPA route change) injects/replaces its own viewport meta.
      try {
        var obs = new MutationObserver(setViewport);
        obs.observe(document.documentElement, { childList: true, subtree: true });
      } catch (e) {}
    })();
    true;`;

    const injectedJS = `
    window.SAFE_AREA_INSETS = ${JSON.stringify({ ...insets, bottom: bottomInset })};
    document.documentElement.style.setProperty('--safe-area-bottom', '${bottomInset}px');
    (function () {
      // Block iOS Safari pinch gestures (gesturestart/change/end are iOS-only).
      ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (name) {
        document.addEventListener(name, function (e) { e.preventDefault(); }, { passive: false });
      });
      // Block multi-touch pinch on Android (and as a fallback on iOS).
      document.addEventListener('touchmove', function (e) {
        if (e.touches && e.touches.length > 1) e.preventDefault();
      }, { passive: false });
      // Block iOS double-tap-to-zoom.
      var lastTouchEnd = 0;
      document.addEventListener('touchend', function (e) {
        var now = Date.now();
        if (now - lastTouchEnd < 300) e.preventDefault();
        lastTouchEnd = now;
      }, { passive: false });
    })();
    true;`;

    return (
      <View style={styles.container}>
        <WebView
          ref={webViewRef}
          source={{ uri: `${BASE_URL}/${route}` }}
          style={styles.webView}
          injectedJavaScriptBeforeContentLoaded={injectedJSBeforeContentLoaded}
          injectedJavaScript={injectedJS}
          onLoadEnd={() => setIsLoading(false)}
          onError={handleWebViewError}
          onHttpError={handleWebViewHttpError}
          onMessage={handleMessage}
          onNavigationStateChange={(navState) => {
            canGoBackRef.current = navState.canGoBack;
          }}
          onShouldStartLoadWithRequest={handleNavigationRequest}
          onOpenWindow={(event) => {
            Linking.openURL(event.nativeEvent.targetUrl);
          }}
          javaScriptEnabled
          domStorageEnabled
          allowsBackForwardNavigationGestures
          allowsInlineMediaPlayback
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          pullToRefreshEnabled={false}
          bounces={false}
          startInLoadingState
          userAgent={`Zirkly-Mobile/${Platform.OS}`}
          originWhitelist={["https://*", "http://localhost:*"]}
          thirdPartyCookiesEnabled
          allowFileAccess
          mediaPlaybackRequiresUserAction={false}
          keyboardDisplayRequiresUserAction={false}
          renderLoading={() => (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color="#2528be" />
            </View>
          )}
          onContentProcessDidTerminate={() => webViewRef.current?.reload()}
          onRenderProcessGone={() => webViewRef.current?.reload()}
          webviewDebuggingEnabled={__DEV__}
        />

        <CameraModal
          visible={cameraModalVisible}
          onClose={() => {
            setCameraModalVisible(false);
            setCurrentPhotoCount(0);
          }}
          onPhotosSelected={handlePhotosSelected}
          maxPhotos={MAX_PHOTOS}
          currentPhotoCount={currentPhotoCount}
        />

        {isOffline && (
          <View style={StyleSheet.absoluteFill}>
            <OfflineScreen onRetry={handleRetry} />
          </View>
        )}
      </View>
    );
  },
);

PersistentWebView.displayName = "PersistentWebView";
export default PersistentWebView;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  webView: { flex: 1, backgroundColor: "#ffffff" },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
});
