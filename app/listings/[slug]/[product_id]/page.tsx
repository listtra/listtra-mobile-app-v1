import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useRef, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebViewMessageEvent } from 'react-native-webview';
import WebViewScreen from '../../../../components/WebViewScreen';
import { useAuth } from '../../../../context/AuthContext';

interface WebViewScreenRefInterface {
  injectJavaScript: (script: string) => void;
  reload: () => void;
}

// Custom Header Component for Listing Details - Memoized
const ListingDetailHeader = React.memo(({ onBack }: { onBack: () => void }) => {
  return (
    <View style={styles.headerContainer}>
      <TouchableOpacity style={styles.headerButton} onPress={onBack}>
        <Ionicons name="arrow-back" size={24} color="#333" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Listing Details</Text>
    </View>
  );
});

export default function ListingDetailScreen() {
  const params = useLocalSearchParams();
  const slug = typeof params.slug === 'string' ? params.slug : String(params.slug || '');
  const product_id = typeof params.product_id === 'string' ? params.product_id : String(params.product_id || '');
  const { isAuthenticated, tokens, user } = useAuth();
  const webViewRef = useRef<WebViewScreenRefInterface>(null);
  const router = useRouter();
  const redirectAttempts = useRef(0);
  
  const webViewUrl = `https://listtra.com/listings/${slug}/${product_id}`;

  // Refresh auth tokens in WebView localStorage
  const refreshAuthTokens = useCallback(() => {
    if (webViewRef.current && tokens?.accessToken) {
      console.log('Refreshing auth tokens in WebView');
      webViewRef.current.injectJavaScript(`
        (function() {
          localStorage.setItem('token', '${tokens.accessToken}');
          localStorage.setItem('refreshToken', '${tokens.refreshToken || ""}');
          localStorage.setItem('user', '${JSON.stringify(user || {})}');
          return true;
        })();
      `);
    }
  }, [tokens, user]);

  // Handle back navigation
  const onBack = useCallback(() => {
    router.back();
  }, [router]);

  // Use a focused approach to refresh tokens when coming back to the screen
  useFocusEffect(
    useCallback(() => {
      console.log('Listing detail focused');
      if (webViewRef.current) {
        refreshAuthTokens();
      }
    }, [refreshAuthTokens])
  );

  // Handle WebView messages
  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      // Handle auth status
      if (data.type === 'AUTH_STATUS' && !data.isAuthenticated && isAuthenticated) {
        refreshAuthTokens();
        return;
      }
      
      // Chat navigation
      if (data.type === 'NAVIGATE_CHAT' && data.chatId) {
        router.push(`/chat/${data.chatId}`);
      }
      
      // Profile navigation
      if (data.type === 'SELLER_PROFILE_CLICKED' && data.nickname) {
        router.push(`/profiles/${data.nickname}`);
      }
      
      // Handle redirect blocked (avoid infinite loops with a counter)
      if (data.type === 'REDIRECT_BLOCKED') {
        redirectAttempts.current += 1;
        
        // Only try a fixed number of times to avoid infinite loops
        if (redirectAttempts.current <= 3) {
          console.log(`Redirect attempt ${redirectAttempts.current}: Trying to recover`);
          
          refreshAuthTokens();
          
          // Wait briefly then try to navigate directly to the listing
          setTimeout(() => {
            if (webViewRef.current) {
              webViewRef.current.injectJavaScript(`
                (function() {
                  window.location.replace('${webViewUrl}?t=${Date.now()}');
                  return true;
                })();
              `);
            }
          }, 500);
        } else if (redirectAttempts.current === 4) {
          console.log("Multiple redirect attempts failed, forcing reload with clean state");
          if (webViewRef.current) {
            webViewRef.current.reload();
            redirectAttempts.current = 0;
          }
        }
      }
    } catch (error) {
      console.error('Error processing WebView message:', error);
    }
  }, [router, refreshAuthTokens, webViewUrl, isAuthenticated]);

  // Minimal injected JavaScript to handle routing and auth
  const injectedJavaScript = useMemo(() => {
    return `
    (function() {
      // Initialize auth tokens
      try {
        localStorage.setItem('token', '${tokens?.accessToken || ""}');
        localStorage.setItem('refreshToken', '${tokens?.refreshToken || ""}');
        localStorage.setItem('user', '${JSON.stringify(user || {})}');
      } catch (e) {
        console.error("Error setting auth tokens:", e);
      }
      
      // Detect and handle sign-in redirects
      if (window.location.pathname.includes('/auth/signin')) {
        console.log("Detected sign-in page, notifying app");
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'REDIRECT_BLOCKED',
          destination: '/auth/signin'
        }));
        return true;
      }
      
      // Set up interceptors for navigation
      function setupInterceptors() {
        // Handle chat button clicks
        document.querySelectorAll('[data-chat-button]:not([data-intercepted])').forEach(button => {
          button.dataset.intercepted = 'true';
          button.addEventListener('click', (e) => {
            e.preventDefault();
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'NAVIGATE_CHAT',
              chatId: button.dataset.chatId
            }));
          });
        });
        
        // Handle profile links
        document.querySelectorAll('a[href^="/profiles/"]:not([data-intercepted])').forEach(link => {
          link.dataset.intercepted = 'true';
          link.addEventListener('click', (e) => {
            e.preventDefault();
            const nickname = link.href.split('/').pop();
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'SELLER_PROFILE_CLICKED',
              nickname
            }));
          });
        });
        
        // Intercept all like buttons
        document.querySelectorAll('button[aria-label*="like"], .like-button, [data-like-button], svg[data-like]').forEach(btn => {
          if (!btn.dataset.intercepted) {
            btn.dataset.intercepted = 'true';
            btn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              
              const token = localStorage.getItem('token');
              if (!token) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'AUTH_STATUS',
                  isAuthenticated: false
                }));
                return;
              }
              
              // Extract listing ID - try multiple methods
              let listingId = '${product_id}'; // Default to current product
              
              // Try to get from button data attribute
              const btnListingId = btn.getAttribute('data-listing-id');
              if (btnListingId) listingId = btnListingId;
              
              // Make API call directly with auth token
              fetch('https://backend.listtra.com/api/listings/like/', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({ listing_id: listingId })
              })
              .then(response => {
                if (response.ok) {
                  // Update UI to show liked state
                  btn.classList.toggle('liked');
                  const icon = btn.querySelector('svg, path');
                  if (icon) icon.setAttribute('fill', '#ff4757');
                } else if (response.status === 401) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'AUTH_STATUS',
                    isAuthenticated: false
                  }));
                }
              })
              .catch(error => {
                console.error('Error liking:', error);
              });
            });
          }
        });
      }
      
      // Check auth status periodically
      setInterval(() => {
        const token = localStorage.getItem('token');
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'AUTH_STATUS',
          isAuthenticated: !!token,
          currentUrl: window.location.href
        }));
      }, 2000);
      
      // Run initial setup
      setupInterceptors();
      
      // Watch for dynamic content
      const observer = new MutationObserver(() => {
        setupInterceptors();
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      return true;
    })();
    `;
  }, [tokens, user, product_id]);

  // Handle navigation state changes
  const handleNavigationStateChange = useCallback((navState: { url: string | string[]; }) => {
    console.log("Navigation state changed to:", navState.url);
    
    if (navState.url.includes('/auth/signin') && isAuthenticated) {
      redirectAttempts.current += 1;
      
      if (redirectAttempts.current <= 3) {
        console.log(`Navigation redirect attempt ${redirectAttempts.current}: Refreshing tokens and redirecting`);
        refreshAuthTokens();
        
        setTimeout(() => {
          if (webViewRef.current) {
            webViewRef.current.injectJavaScript(`
              (function() {
                window.location.replace('${webViewUrl}?t=${Date.now()}');
                return true;
              })();
            `);
          }
        }, 300);
      }
    } else if (navState.url.includes(webViewUrl)) {
      // Reset counter when we successfully get to the correct page
      redirectAttempts.current = 0;
    }
  }, [isAuthenticated, refreshAuthTokens, webViewUrl]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ListingDetailHeader onBack={onBack} />
      <View style={styles.webViewContainer}>
        <WebViewScreen
          ref={webViewRef}
          uri={webViewUrl}
          showLoader={true}
          requiresAuth={true}
          injectedJavaScript={injectedJavaScript}
          onMessage={handleMessage}
          onNavigationStateChange={handleNavigationStateChange}
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
  headerContainer: {
    flexDirection: 'row',
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
    flex: 1,
    textAlign: 'center',
  },
  headerButton: {
    padding: 8,
    borderRadius: 20,
    width: 40,
  },
});