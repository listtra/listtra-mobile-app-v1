import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useAuth } from '../context/AuthContext';

const BASE_URL = 'http://192.168.1.2:3000';

type SingleWebViewProps = {
  currentRoute: string;
  onRouteChange: (route: string) => void;
  onBackPress?: () => boolean;
};

export default function SingleWebView({
  currentRoute,
  onRouteChange,
  onBackPress
}: SingleWebViewProps) {
  const webViewRef = useRef<WebView>(null);
  const { tokens, logout, isAuthenticated, user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  
  // Track navigation to prevent loops
  const isNavigatingRef = useRef(false);
  const currentUrlRef = useRef('');

  // Function to clear WebView authentication state
  const clearWebViewAuth = useCallback(() => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        (function() {
          try {
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            localStorage.removeItem('accessToken');
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            sessionStorage.clear();
            
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
  }, []);

  // Enhanced logout function
  const handleLogout = useCallback(async () => {
    try {
      console.log('Starting logout process...');
      clearWebViewAuth();
      await new Promise(resolve => setTimeout(resolve, 100));
      await logout();
      router.replace('/auth/signin');
      console.log('Logout completed successfully');
    } catch (error) {
      console.error('Error during logout:', error);
      await logout();
      router.replace('/auth/signin');
    }
  }, [clearWebViewAuth, logout, router]);

  // Construct URL with authentication tokens
  const getAuthenticatedUrl = useCallback((route: string) => {
    const baseUrl = `${BASE_URL}/${route}`;
    
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
  }, [tokens.accessToken, tokens.refreshToken, user?.id]);

  // Navigate to a new route in the WebView
  const navigateToRoute = useCallback((route: string) => {
    if (isNavigatingRef.current || currentUrlRef.current === route) return;
    
    console.log('Navigating to route:', route);
    isNavigatingRef.current = true;
    
    const finalUrl = isAuthenticated ? getAuthenticatedUrl(route) : `${BASE_URL}/${route}`;
    
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        (function() {
          window.location.href = "${finalUrl.replace(/"/g, '\\"')}";
          return true;
        })();
      `);
    }
    
    currentUrlRef.current = route;
    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 1000);
  }, [isAuthenticated, getAuthenticatedUrl]);

  // Handle route changes from parent
  useEffect(() => {
    if (currentRoute && currentRoute !== currentUrlRef.current) {
      navigateToRoute(currentRoute);
    }
  }, [currentRoute, navigateToRoute]);

  // Handle messages from WebView
  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('=== WebView message received ===');
      console.log('Message type:', data.type);
      console.log('Full message data:', data);

      switch (data.type) {
        case 'GO_BACK':
          console.log('GO_BACK message received');
          if (onBackPress && onBackPress()) {
            // Parent handled the back press
            return;
          }
          
          // Default back handling
          if (webViewRef.current) {
            webViewRef.current.injectJavaScript(`
              (function() {
                if (window.history.length > 1) {
                  window.history.back();
                } else {
                  window.location.href = "${BASE_URL}/listings";
                }
                return true;
              })();
            `);
          }
          break;

        case 'LISTING_CLICKED':
          if (data.slug && data.product_id) {
            console.log(`Navigating to listing: ${data.slug}/${data.product_id}`);
            router.push({
              pathname: "/listings/[slug]/[product_id]/page",
              params: { slug: data.slug, product_id: data.product_id }
            });
          }
          break;

        case 'PROFILE_CLICKED':
          if (data.nickname) {
            console.log(`Navigating to profile: ${data.nickname}`);
            router.push({
              pathname: "/profiles/[nickname]",
              params: { nickname: data.nickname }
            });
          }
          break;

        case 'NAVIGATE_CHAT':
          if (data.chatId) {
            console.log(`Navigating to chat: ${data.chatId}`);
            router.push({
              pathname: "/chat/[id]",
              params: { id: data.chatId }
            });
          }
          break;

        case 'VIEW_ALL_CHATS':
          console.log('VIEW_ALL_CHATS', data);
          if (data.listingId) {
            router.push({
              pathname: "/chat",
              params: { listingId: data.listingId }
            });
          } else {
            router.push("/chat");
          }
          break;

        case 'NAVIGATE':
          if (data.path) {
            console.log(`General navigation to: ${data.path}`);
            router.push(data.path);
          }
          break;

        case 'ROUTE_CHANGED':
          // WebView is telling us the route changed
          if (data.route && data.route !== currentRoute) {
            console.log('Route changed in WebView:', data.route);
            onRouteChange(data.route);
          }
          break;

        case 'AUTH_LOGOUT':
          console.log('Logout request received from web app');
          handleLogout();
          break;

        case 'AUTH_VALIDATION_FAILED':
          console.error('Token validation failed:', data.message);
          if (Constants.executionEnvironment !== 'storeClient') {
            handleLogout();
          }
          break;

        default:
          console.log('Unhandled message type:', data.type);
      }
    } catch (err) {
      console.error('Error handling WebView message:', err);
    }
  }, [currentRoute, onRouteChange, onBackPress, router, handleLogout]);

  // Handle navigation state changes
  const handleNavigationStateChange = useCallback((navState: any) => {
    console.log('Navigation state change:', navState.url);
    
    // Extract route from URL
    const url = new URL(navState.url);
    let route = url.pathname.substring(1) || 'listings'; // Remove leading slash
    
    // Remove query parameters for route detection
    route = route.split('?')[0];
    
    if (route !== currentRoute && route !== currentUrlRef.current) {
      console.log('Detected route change to:', route);
      onRouteChange(route);
    }
  }, [currentRoute, onRouteChange]);

  // Create the injected JavaScript
  const injectedJavaScript = `
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
        try {
          if (window.AuthContext && window.AuthContext.logout) {
            window.AuthContext.logout();
          }
        } catch (e) {
          console.log('Web app logout cleanup completed');
        }
      });
      
      // Native app interface
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
        },
        notifyRouteChange: function(route) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'ROUTE_CHANGED',
            route: route
          }));
        }
      };
      
      // Setup link interceptors
      function setupInterceptors() {
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
              window.nativeApp.navigateToListing(slug, productId);
            }
          });
        });
        
        // Profile links
        document.querySelectorAll('a[href^="/profiles/"]').forEach(function(link) {
          if (link.getAttribute('data-intercepted') === 'true') return;
          link.setAttribute('data-intercepted', 'true');
          
          link.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const href = link.getAttribute('href');
            const nickname = href.split('/profiles/')[1];
            
            if (nickname) {
              window.nativeApp.navigateToProfile(nickname);
            }
          });
        });
        
        // Chat links
        document.querySelectorAll('a[href^="/chat/"]').forEach(function(link) {
          if (link.getAttribute('data-intercepted') === 'true') return;
          link.setAttribute('data-intercepted', 'true');
          
          link.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const href = link.getAttribute('href');
            const chatId = href.split('/chat/')[1];
            
            if (chatId) {
              window.nativeApp.navigateToChat(chatId);
            }
          });
        });
      }
      
      setupInterceptors();
      
      // Monitor DOM changes
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
      
      // Monitor route changes
      let lastPath = window.location.pathname;
      setInterval(function() {
        if (window.location.pathname !== lastPath) {
          lastPath = window.location.pathname;
          const route = lastPath.substring(1) || 'listings';
          window.nativeApp.notifyRouteChange(route);
        }
      }, 1000);
      
      return true;
    })();
  `;

  // Get initial URL
  const initialUrl = isAuthenticated && tokens.accessToken && tokens.refreshToken
    ? getAuthenticatedUrl(currentRoute)
    : `${BASE_URL}/${currentRoute}`;

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: initialUrl }}
        style={styles.webView}
        onLoad={() => setIsLoading(false)}
        onError={(e) => setError(`WebView error: ${e.nativeEvent.description}`)}
        onHttpError={(e) => setError(`HTTP error: ${e.nativeEvent.statusCode}`)}
        onNavigationStateChange={handleNavigationStateChange}
        onMessage={handleMessage}
        injectedJavaScript={injectedJavaScript}
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