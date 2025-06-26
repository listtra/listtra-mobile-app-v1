import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import NotificationBell from '../../components/NotificationBell';
import WebViewScreen from '../../components/WebViewScreen';
import { useAuth } from '../../context/AuthContext';

// Custom Header Component
const ListingsHeader = ({ onSearchPress }: { onSearchPress: () => void }) => {
  const router = useRouter();
  
  return (
    <View style={styles.headerContainer}>
      {/*<TouchableOpacity 
        style={styles.headerButton} 
        onPress={() => router.push('/(tabs)')}
      >
        <Ionicons name="close" size={24} color="#333" />
      </TouchableOpacity>*/}
      <TouchableOpacity onPress={() => router.push('/(tabs)')}>
        <Text style={styles.logoText}>Listtra</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.searchBar}
        onPress={onSearchPress}
      >
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <Text style={styles.searchPlaceholder}>Search listings...</Text>
      </TouchableOpacity>
      
      <NotificationBell />
    </View>
  );
};

export default function ListingsScreen() {
  const { isInitializing, isAuthenticated, tokens, user } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [listingsUrl, setListingsUrl] = useState("https://listtra.com/listings");
  const webViewRef = useRef<WebView>(null);
  const router = useRouter();
  const pathname = usePathname();
  const lastFocusRef = useRef<string | null>(null);
  
  // Function to handle search button press
  const handleSearchPress = () => {
    // Navigate to search page
    router.push('/search/page' as any);
  };
  
  // Wait for auth to initialize
  useEffect(() => {
    if (!isInitializing) {
      setIsReady(true);
      
      // Use the base URL without token parameters to avoid issues with redirects
      setListingsUrl("https://listtra.com/listings");
    }
  }, [isInitializing, isAuthenticated, tokens]);

  // Use useFocusEffect to reload the listings page every time it comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('Listings page focused, performing quick reload');
      
      // Force reload the WebView immediately on focus
      if (webViewRef.current?.injectJavaScript) {
        const reloadScript = `
          (function() {
            console.log('Forcing quick reload of listings page');
            if (window.location.href.includes('listtra.com/listings')) {
              // If already on listings page, use reload for speed
              window.location.reload();
            } else {
              // Otherwise navigate to listings
              window.location.href = 'https://listtra.com/listings';
            }
            return true;
          })();
        `;
        
        // Execute immediately for faster reload
        webViewRef.current.injectJavaScript(reloadScript);
      }
      
      return () => {
        // Cleanup if needed
      };
    }, [])
  );
  
  // Keep the existing tab focus detection for backward compatibility
  useEffect(() => {
    // Check if this is the root tab path
    if (pathname === '/') {
      // If this is the first time or we're returning to this tab
      if (lastFocusRef.current !== pathname) {
        console.log('Listings tab focused, reloading base URL');
        
        // Reset to base URL and reload
        setListingsUrl("https://listtra.com/listings");
      }
      
      // Update last focused path
      lastFocusRef.current = pathname;
    }
  }, [pathname]);

  // Handle messages from WebView
  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      // Handle listing click in WebView
      if (data.type === 'LISTING_CLICKED') {
        console.log('Listing clicked:', data);
        
        if (data.slug && data.product_id) {
          // Navigate to native listing detail page using segment configuration
          router.push({
            pathname: "/listings/[slug]/[product_id]/page",
            params: { slug: data.slug, product_id: data.product_id }
          });
        }
      }
      
      // Handle auth status
      if (data.type === 'AUTH_STATUS') {
        //console.log('Auth status from WebView:', data.isAuthenticated);
        
        // If WebView reports not authenticated but we have tokens, inject them again
        if (!data.isAuthenticated && isAuthenticated && tokens.accessToken) {
          injectAuthTokens();
        }
      }
    } catch (error) {
      console.error('Error handling WebView message:', error);
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
          
          // Force reload the app to apply authentication
          if (window.location.pathname.includes('/auth/signin')) {
            window.location.href = '/listings';
          } else {
            // Notify any components that auth state has changed
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
      // Set auth tokens immediately when page loads
      try {
        console.log("Setting auth tokens in localStorage on page load");
        localStorage.setItem('token', '${tokens?.accessToken || ""}');
        localStorage.setItem('refreshToken', '${tokens?.refreshToken || ""}');
        localStorage.setItem('user', '${JSON.stringify(user || {})}');
      } catch (e) {
        console.error("Error setting initial auth tokens:", e);
      }
      
      // Check and report auth status periodically
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
      
      // Check auth status on load and periodically
      checkAuthStatus();
      setInterval(checkAuthStatus, 3000);
      
      // Function to intercept listing card clicks
      function setupListingCardClickInterceptors() {
        console.log('Setting up listing card click interceptors');
        
        // Get all listing card links
        const listingCards = document.querySelectorAll('a[href^="/listings/"]');
        
        listingCards.forEach(card => {
          if (!card.dataset.intercepted) {
            card.dataset.intercepted = 'true';
            
            card.addEventListener('click', (e) => {
              e.preventDefault();
              
              // Extract slug and product_id from href
              const href = card.getAttribute('href');
              const match = href.match(/\\/listings\\/([^\\/]+)\\/([^\\/]+)/);
              
              if (match && match.length >= 3) {
                const slug = match[1];
                const product_id = match[2];
                
                console.log('Intercepted listing click:', { slug, product_id });
                
                // Send message to native code
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'LISTING_CLICKED',
                  slug,
                  product_id
                }));
              } else {
                console.log('Could not parse listing URL:', href);
                window.location.href = href; // Fall back to normal navigation
              }
            });
          }
        });
      }
      
      // Handle redirects to sign-in page
      if (window.location.pathname.includes('/auth/signin') && ${isAuthenticated}) {
        console.log("Detected sign-in page while user is authenticated, redirecting to listings");
        window.location.href = '/listings';
      }
      
      // Run immediately and then with delays to catch dynamically loaded cards
      setupListingCardClickInterceptors();
      setTimeout(setupListingCardClickInterceptors, 1000);
      setTimeout(setupListingCardClickInterceptors, 2000);
      
      // Also set up a MutationObserver to watch for new cards
      const observer = new MutationObserver(mutations => {
        let shouldSetup = false;
        
        mutations.forEach(mutation => {
          if (mutation.addedNodes.length) {
            shouldSetup = true;
          }
        });
        
        if (shouldSetup) {
          setupListingCardClickInterceptors();
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
    
    // If we get redirected to sign-in page but we're authenticated, inject tokens again
    if (navState.url.includes('/auth/signin') && isAuthenticated) {
      console.log("Detected redirect to sign-in while authenticated, injecting tokens");
      setTimeout(injectAuthTokens, 500); // Slight delay to ensure page is loaded
    }
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ListingsHeader onSearchPress={handleSearchPress} />
      <View style={styles.webViewContainer}>
        <WebViewScreen 
          uri={listingsUrl} 
          requiresAuth={true}
          injectedJavaScript={injectedJavaScript}
          onMessage={handleMessage}
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomColor: '#e0e0e0',
    borderBottomWidth: 1,
    zIndex: 10,
    marginBottom:10
  },
  headerButton: {
    padding: 8,
    borderRadius: 20,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    marginHorizontal: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchPlaceholder: {
    color: '#999',
    fontSize: 16,
  },
  logoContainer: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2528be',
  },
});