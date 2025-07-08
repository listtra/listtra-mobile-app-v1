import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebViewMessageEvent } from 'react-native-webview';
import WebViewScreen from '../../components/WebViewScreen';
import { useAuth } from '../../context/AuthContext';

// Custom Header Component for Liked Listings
const LikedHeader = ({ onRefresh }: { onRefresh: () => void }) => {
  const router = useRouter();

  return (
    <View style={styles.headerContainer}>
      <TouchableOpacity
        style={styles.headerButton}
        onPress={() => router.push('/(tabs)')}
      >
        <Ionicons name="close" size={24} color="#333" />
      </TouchableOpacity>

      <Text style={styles.headerTitle}>Liked Listings</Text>

      <TouchableOpacity style={styles.headerButton} onPress={onRefresh}>
        <Ionicons name="refresh" size={24} color="#333" />
      </TouchableOpacity>
    </View>
  );
};

export default function LikedScreen() {
  const { isInitializing, isAuthenticated, tokens, user } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [likedUrl, setLikedUrl] = useState("https://listtra.com/liked");
  const webViewRef = useRef<{ injectJavaScript: (script: string) => void; reload: () => void }>(null);
  const router = useRouter();
  const pathname = usePathname();
  const lastFocusRef = useRef<string | null>(null);
  
  // Wait for auth to initialize
  useEffect(() => {
    if (!isInitializing) {
      setIsReady(true);
      setLikedUrl("https://listtra.com/liked");
    }
  }, [isInitializing, isAuthenticated, tokens]);

  // Use useFocusEffect to reload the liked page every time it comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('Liked page focused, performing quick reload');
      
      if (webViewRef.current?.injectJavaScript) {
        const reloadScript = `
          (function() {
            console.log('Forcing quick reload of liked page');
            if (window.location.href.includes('listtra.com/liked')) {
              window.location.reload();
            } else {
              window.location.href = 'https://listtra.com/liked';
            }
            return true;
          })();
        `;
        webViewRef.current.injectJavaScript(reloadScript);
      }
      
      return () => {};
    }, [])
  );
  
  // Keep tab focus detection for backward compatibility
  useEffect(() => {
    if (pathname === '/liked') {
      if (lastFocusRef.current !== pathname) {
        console.log('Liked tab focused, reloading base URL');
        setLikedUrl("https://listtra.com/liked");
      }
      lastFocusRef.current = pathname;
    }
  }, [pathname]);

  // Handle messages from WebView
  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'LISTING_CLICKED') {
        console.log('Listing clicked:', data);
        if (data.slug && data.product_id) {
          router.push({
            pathname: "/listings/[slug]/[product_id]/page",
            params: { slug: data.slug, product_id: data.product_id }
          });
        }
      }
      
      if (data.type === 'SELLER_PROFILE_CLICKED') {
        console.log('Seller profile clicked:', data);
        if (data.nickname) {
          router.push({
            pathname: "/profiles/[nickname]",
            params: { nickname: data.nickname }
          });
        }
      }
      
      if (data.type === 'AUTH_STATUS') {
        if (!data.isAuthenticated && isAuthenticated && tokens.accessToken) {
          injectAuthTokens();
        }
      }
    } catch (error) {
      console.error('Error handling WebView message:', error);
    }
  };

  const onRefresh = () => {
    if (webViewRef.current) {
      console.log('User initiated retry, resetting retry count');

      if (isAuthenticated && tokens?.accessToken) {
        console.log('Injecting tokens before reload');
        webViewRef.current.injectJavaScript(`
          (function() {
            try {
              localStorage.setItem('token', '${tokens.accessToken}');
              localStorage.setItem('refreshToken', '${tokens.refreshToken || ""}');
              localStorage.setItem('user', '${JSON.stringify(user || {})}');
              return true;
            } catch (e) {
              console.error('Error injecting tokens on refresh:', e);
              return false;
            }
          })();
        `);
      }

      setTimeout(() => {
        console.log('Reloading WebView');
        webViewRef.current?.reload();
      }, 500);
    } else {
      console.log("errorrrr")
    }
  };
  
  // Function to inject auth tokens into the WebView
  const injectAuthTokens = () => {
    if (!webViewRef.current || !tokens.accessToken) return;
    
    const authScript = `
      (function() {
        try {
          console.log("Injecting auth tokens into localStorage");
          localStorage.setItem('token', '${tokens.accessToken}');
          localStorage.setItem('refreshToken', '${tokens.refreshToken || ""}');
          localStorage.setItem('user', '${JSON.stringify(user || {})}');
          
          if (window.location.pathname.includes('/auth/signin')) {
            window.location.href = '/liked';
          } else {
            window.dispatchEvent(new Event('storage'));
          }
          
          return true;
        } catch (error) {
          console.error("Error injecting auth tokens:", error);
          return false;
        }
      })();
    `;
    
    webViewRef.current.injectJavaScript(authScript);
  };
  
  // Inject JS to intercept listing card clicks and handle auth
  const injectedJavaScript = `
    (function() {
      try {
        console.log("Setting auth tokens in localStorage on page load");
        localStorage.setItem('token', '${tokens?.accessToken || ""}');
        localStorage.setItem('refreshToken', '${tokens?.refreshToken || ""}');
        localStorage.setItem('user', '${JSON.stringify(user || {})}');
      } catch (e) {
        console.error("Error setting initial auth tokens:", e);
      }
      
      function checkAuthStatus() {
        const token = localStorage.getItem('token');
        const isAuthenticated = !!token;
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'AUTH_STATUS',
            isAuthenticated,
            currentUrl: window.location.href
          }));
        }
      }
      
      checkAuthStatus();
      setInterval(checkAuthStatus, 3000);
      
      function setupListingCardClickInterceptors() {
        console.log('Setting up listing card click interceptors');
        const listingCards = document.querySelectorAll('a[href^="/listings/"]');
        listingCards.forEach(card => {
          if (!card.dataset.intercepted) {
            card.dataset.intercepted = 'true';
            card.addEventListener('click', (e) => {
              e.preventDefault();
              const href = card.getAttribute('href');
              const match = href.match(/\\/listings\\/([^\\/]+)\\/([^\\/]+)/);
              if (match && match.length >= 3) {
                const slug = match[1];
                const product_id = match[2];
                console.log('Intercepted listing click:', { slug, product_id });
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'LISTING_CLICKED',
                  slug,
                  product_id
                }));
              } else {
                console.log(' Could not parse listing URL:', href);
                window.location.href = href;
              }
            });
          }
        });
      }
      
      function setupSellerProfileClickInterceptors() {
        console.log('Setting up seller profile click interceptors');
        const profileLinks = document.querySelectorAll('a[href^="/profiles/"]');
        profileLinks.forEach(link => {
          if (!link.dataset.intercepted) {
            link.dataset.intercepted = 'true';
            link.addEventListener('click', (e) => {
              e.preventDefault();
              const href = link.getAttribute('href');
              const match = href.match(/\\/profiles\\/([^\\/]+)/);
              if (match && match.length >= 2) {
                const nickname = match[1];
                console.log('Intercepted seller profile click:', { nickname });
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'SELLER_PROFILE_CLICKED',
                  nickname
                }));
              } else {
                console.log('Could not parse profile URL:', href);
                window.location.href = href;
              }
            });
          }
        });
      }
      
      if (window.location.pathname.includes('/auth/signin') && ${isAuthenticated}) {
        console.log("Detected sign-in page while user is authenticated, redirecting to liked");
        window.location.href = '/liked';
      }
      
      setupListingCardClickInterceptors();
      setupSellerProfileClickInterceptors();
      setTimeout(() => {
        setupListingCardClickInterceptors();
        setupSellerProfileClickInterceptors();
      }, 1000);
      setTimeout(() => {
        setupListingCardClickInterceptors();
        setupSellerProfileClickInterceptors();
      }, 2000);
      
      const observer = new MutationObserver(mutations => {
        let shouldSetup = false;
        mutations.forEach(mutation => {
          if (mutation.addedNodes.length) {
            shouldSetup = true;
          }
        });
        if (shouldSetup) {
          setupListingCardClickInterceptors();
          setupSellerProfileClickInterceptors();
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      return true;
    })();
  `;
  
  // Show loading spinner while initializing
  if (isInitializing || !isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200EA" />
      </View>
    );
  }
  
  // Handle navigation state changes (URL changes)
  const handleNavigationStateChange = (navState: any) => {
    console.log("Navigation state changed to:", navState.url);
    if (navState.url.includes('/auth/signin') && isAuthenticated) {
      console.log("Detected redirect to sign-in while authenticated, injecting tokens");
      setTimeout(injectAuthTokens, 500);
    }
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LikedHeader onRefresh={onRefresh}/>
      <View style={styles.webViewContainer}>
        <WebViewScreen 
          uri={likedUrl} 
          requiresAuth={true}
          injectedJavaScript={injectedJavaScript}
          onMessage={handleMessage}
          onNavigationStateChange={handleNavigationStateChange}
          ref={webViewRef}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  headerContainer: {
    justifyContent:"space-between",
    flexDirection:'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomColor: '#e0e0e0',
    borderBottomWidth: 1,
    zIndex: 10,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 10,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2528be',
  },
  headerButton: {
    padding: 8,
    borderRadius: 20,
  },
});