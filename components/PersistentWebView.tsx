// Enhanced PersistentWebView with proper back navigation handling
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
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

export default function PersistentWebView({
  route,
  onMessage,
  disableAutoNavigation = false
}: PersistentWebViewProps) {
  const webViewRef = useRef<WebView>(null);
  const { tokens, logout, isAuthenticated, user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState(`${BASE_URL}/${route}`);
  const router = useRouter();
  const hasNavigated = useRef(false);
  const isDetailPage = useRef(route.includes('/listings/') && route !== 'listings');

  // Function to clear WebView authentication state
  const clearWebViewAuth = () => {
    if (webViewRef.current) {
      // Clear localStorage and sessionStorage in WebView
      webViewRef.current.injectJavaScript(`
        (function() {
          try {
            // Clear all auth-related items from localStorage
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            localStorage.removeItem('accessToken');
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            
            // Clear sessionStorage as well
            sessionStorage.clear();
            
            // Dispatch logout event to notify web app
            window.dispatchEvent(new CustomEvent('native-auth-logout', { 
              detail: { isAuthenticated: false }
            }));
            
            console.log('WebView authentication state cleared');
            return true;
          } catch (error) {
            console.error('Error clearing WebView auth state:', error);
            return false;
          }
        })();
      `);
    }
  };

  // Enhanced logout function
  const handleLogout = async () => {
    try {
      console.log('Starting logout process...');

      // 1. Clear WebView authentication state first
      clearWebViewAuth();

      // 2. Wait a bit for WebView to process
      await new Promise(resolve => setTimeout(resolve, 100));

      // 3. Call the context logout function
      await logout();

      // 4. Navigate to login screen
      router.replace('/auth/signin');

      console.log('Logout completed successfully');
    } catch (error) {
      console.error('Error during logout:', error);
      // Even if there's an error, try to clear tokens and redirect
      await logout();
      router.replace('/auth/signin');
    }
  };

  // Construct proper URL with tokens as query parameters
  const getAuthenticatedUrl = (baseUrl: string) => {
    if (!tokens.accessToken || !tokens.refreshToken) {
      return baseUrl;
    }

    try {
      const url = new URL(baseUrl);
      url.searchParams.append('access_token', tokens.accessToken);
      url.searchParams.append('refresh_token', tokens.refreshToken);
      url.searchParams.append('isNativeApp', 'true');

      if (user?.id) {
        url.searchParams.append('user_id', user.id.toString());
      }

      return url.toString();
    } catch (e) {
      console.error('Error constructing URL:', e);
      return baseUrl;
    }
  };

  // Handle message from WebView
  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('=== WebView message received ===');
      console.log('Message type:', data.type);
      console.log('Full message data:', data);

      if (data.type === 'GO_BACK') {
        console.log('GO_BACK message received');
        console.log("currentUrl", currentUrl);
        console.log("route", route);

        const isFromAddPage = currentUrl?.includes('/add') || route === 'add';
        const isFromListingDetail = currentUrl?.includes('/listings/');
        const isFromChatPage = currentUrl?.includes('/chat?listing=');

        // Handle add page navigation back to tabs
        if (isFromAddPage || isFromListingDetail) {
          console.log('GO_BACK from add or listing detail page, navigating to tabs');
          hasNavigated.current = true;
          setCurrentUrl('');
          setIsLoading(true);
          router.replace('/(tabs)');
          return;
        }

        if (isFromChatPage) {
          console.log('GO_BACK from chat page, navigating to chats');
          hasNavigated.current = true;
          router.back();
          return;
        }

        // For other pages (like chat), use browser history
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

      // FIXED: Only handle listing clicks if auto navigation is NOT disabled
      if (data.type === 'LISTING_CLICKED' && !disableAutoNavigation) {
        if (data.slug && data.product_id) {
          console.log(`Navigating to listing: ${data.slug}/${data.product_id}`);
          hasNavigated.current = true;
          router.push({
            pathname: "/listings/[slug]/[product_id]/page",
            params: { slug: data.slug, product_id: data.product_id }
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
      if (data.type === 'AUTH_LOGOUT') {
        console.log('Logout request received from web app');
        //handleLogout();
        //return;
      }

      if (data.type === 'AUTH_VALIDATION_FAILED') {
        console.error('Token validation failed:', data.message);

        if (Constants.executionEnvironment === 'storeClient') {
          console.log('Expo Go detected, attempting to continue without validation');
          return;
        }

        // Handle token validation failure by logging out
        handleLogout();
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

  // Update WebView when route changes
  useEffect(() => {
    const newUrl = `${BASE_URL}/${route}`;
    if (webViewRef.current && currentUrl !== newUrl && !hasNavigated.current) {
      const finalUrl = isAuthenticated ? getAuthenticatedUrl(newUrl) : newUrl;
      webViewRef.current.injectJavaScript(`
        (function() {
          window.location.href = "${finalUrl.replace(/"/g, '\\"')}";
          return true;
        })();
      `);
      setCurrentUrl(newUrl);
    }
    hasNavigated.current = false;
    isDetailPage.current = route.includes('/listings/') && route !== 'listings';
  }, [route, isAuthenticated]);

  // Handle navigation state changes
  const handleNavigationStateChange = (navState: any) => {
    if (navState.url !== currentUrl) {
      console.log('Navigation state change:', navState.url);
      setCurrentUrl(navState.url);

      // Skip auto-navigation if disabled or if we're already on a detail page
      if (disableAutoNavigation || isDetailPage.current) {
        console.log('Auto-navigation skipped:', disableAutoNavigation ? 'disabled by prop' : 'already on detail page');
        return;
      }

      // Handle listing detail navigation
      if (navState.url.includes('/listings/') && !navState.url.endsWith('/listings/')) {
        const match = navState.url.match(/\/listings\/([^\/]+)\/([^\/]+)/);
        if (match && match.length >= 3) {
          const slug = match[1];
          let productId = match[2];
          const queryIndex = productId.indexOf('?');
          if (queryIndex !== -1) {
            productId = productId.substring(0, queryIndex);
          }

          console.log('Detected navigation to listing detail:', slug, productId);

          if (!hasNavigated.current) {
            hasNavigated.current = true;
            router.push({
              pathname: "/listings/[slug]/[product_id]/page",
              params: { slug, product_id: productId }
            });
          }
        }
      }

      // Check if we've navigated to the chats page from a chat detail
      if (navState.url.includes('/chats') && route.includes('chat/')) {
        console.log('Detected navigation from chat detail to chats list');
        if (!hasNavigated.current) {
          hasNavigated.current = true;
          router.back();
        }
      }

      // Handle chat navigation - BUT ONLY if we're NOT already on a chat page
      if (navState.url.includes('/chat') && !route.includes('chat')) {
        if (navState.url.includes('/chat?listing=')) {
          const match = navState.url.match(/\/chat\?listing=([^&]+)/);
          if (match && match.length >= 2) {
            const listingId = match[1];
            console.log('Detected navigation to chat with listing:', listingId);

            if (!hasNavigated.current) {
              hasNavigated.current = true;
              router.push({
                pathname: "/chat",
                params: { listingId: listingId }
              });
            }
          }
        }
        else if (navState.url.match(/\/chat\/\d+/)) {
          const match = navState.url.match(/\/chat\/(\d+)/);
          if (match && match.length >= 2) {
            const chatId = match[1];
            console.log('Detected navigation to specific chat:', chatId);

            if (!hasNavigated.current) {
              hasNavigated.current = true;
              router.push({
                pathname: "/chat/[id]",
                params: { id: chatId }
              });
            }
          }
        }
      }
    }
  };

  // Create final URL with tokens if authenticated
  const finalUrl = isAuthenticated && tokens.accessToken && tokens.refreshToken
    ? getAuthenticatedUrl(`${BASE_URL}/${route}`)
    : `${BASE_URL}/${route}`;

  // Enhanced combined script with conditional listing interception
  const combinedScript = `
    (function() {
      // Auth and navigation script
      try {
        if ("${tokens.accessToken}") {
          localStorage.setItem('token', "${tokens.accessToken}");
          localStorage.setItem('refreshToken', "${tokens.refreshToken}");
          localStorage.setItem('user', '${user ? JSON.stringify(user).replace(/'/g, "\\'").replace(/"/g, '\\"') : "{}"}');
          console.log('Auth tokens injected from native app');
          
          window.dispatchEvent(new CustomEvent('native-auth-changed', { 
            detail: { isAuthenticated: true }
          }));
        }
      } catch (e) {
        console.error('Error injecting auth data:', e);
      }
      
      // Listen for logout events from native app
      window.addEventListener('native-auth-logout', function(event) {
        console.log('Native app logout event received');
        // Additional cleanup if needed
        try {
          // Clear any auth-related UI state
          if (window.AuthContext && window.AuthContext.logout) {
            window.AuthContext.logout();
          }
        } catch (e) {
          console.log('Web app logout cleanup completed');
        }
      });
      
      window.nativeApp = {
        login: function(tokens, user) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'AUTH_LOGIN_SUCCESS',
            tokens: tokens,
            user: user
          }));
        },
        logout: function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'AUTH_LOGOUT'
          }));
        },
        navigate: function(path) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'NAVIGATE',
            path: path
          }));
        },
        navigateToListing: function(slug, productId) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'LISTING_CLICKED',
            slug: slug,
            product_id: productId
          }));
        },
        navigateToProfile: function(nickname) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'PROFILE_CLICKED',
            nickname: nickname
          }));
        },
        navigateToChat: function(chatId) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'NAVIGATE_CHAT',
            chatId: chatId
          }));
        },
        viewAllChats: function(listingId) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'VIEW_ALL_CHATS',
            listingId: listingId
          }));
        }
      };
      
      function setupInterceptors() {
        // Only intercept listing links if auto navigation is enabled
        const shouldInterceptListings = ${!disableAutoNavigation};
        
        if (shouldInterceptListings) {
          // Listing card links
          document.querySelectorAll('a[href^="/listings/"]').forEach(function(link) {
            if (link.getAttribute('data-intercepted') === 'true') return;
            link.setAttribute('data-intercepted', 'true');
            
            link.addEventListener('click', function(e) {
              e.preventDefault();
              e.stopPropagation();
              
              const href = link.getAttribute('href');
              const match = href.match(/\\/listings\\/([^\\/]+)\\/([^\\/]+)/);
              
              if (match && match.length >= 3) {
                const slug = match[1];
                const productId = match[2];
                console.log('Listing card clicked:', slug, productId);
                window.nativeApp.navigateToListing(slug, productId);
              }
            });
          });
          
          // Product cards
          document.querySelectorAll('.product-card, .listing-card, [data-listing-id]').forEach(function(card) {
            if (card.getAttribute('data-intercepted') === 'true') return;
            card.setAttribute('data-intercepted', 'true');
            
            card.addEventListener('click', function(e) {
              const slug = card.getAttribute('data-slug') || 'item';
              const productId = card.getAttribute('data-listing-id') || card.getAttribute('data-product-id');
              
              if (productId) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Product card clicked:', slug, productId);
                window.nativeApp.navigateToListing(slug, productId);
              }
            });
          });
        } else {
          console.log('Listing interception disabled for this WebView');
        }
        
        // Always intercept profile links
        document.querySelectorAll('a[href^="/profiles/"]').forEach(function(link) {
          if (link.getAttribute('data-intercepted') === 'true') return;
          link.setAttribute('data-intercepted', 'true');
          
          link.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const href = link.getAttribute('href');
            const nickname = href.split('/profiles/')[1];
            
            if (nickname) {
              console.log('Profile link clicked:', nickname);
              window.nativeApp.navigateToProfile(nickname);
            }
          });
        });
        
        // Always intercept chat links
        document.querySelectorAll('a[href^="/chat/"]').forEach(function(link) {
          if (link.getAttribute('data-intercepted') === 'true') return;
          link.setAttribute('data-intercepted', 'true');
          
          link.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const href = link.getAttribute('href');
            const chatId = href.split('/chat/')[1];
            
            if (chatId) {
              console.log('Chat link clicked:', chatId);
              window.nativeApp.navigateToChat(chatId);
            }
          });
        });
      }
      
      setupInterceptors();
      
      const contentObserver = new MutationObserver(function(mutations) {
        let shouldSetupInterceptors = false;
        
        mutations.forEach(function(mutation) {
          if (mutation.addedNodes.length > 0) {
            shouldSetupInterceptors = true;
          }
        });
        
        if (shouldSetupInterceptors) {
          setupInterceptors();
        }
      });
      
      contentObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      return true;
    })();
  `;

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: finalUrl }}
        style={styles.webView}
        onLoad={() => setIsLoading(false)}
        onError={(e) => setError(`WebView error: ${e.nativeEvent.description}`)}
        onHttpError={(e) => setError(`HTTP error: ${e.nativeEvent.statusCode}`)}
        onNavigationStateChange={handleNavigationStateChange}
        onMessage={handleMessage}
        injectedJavaScript={combinedScript}
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
      />
      {isLoading && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#2528be" />
        </View>
      )}
    </View>
  );
}

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