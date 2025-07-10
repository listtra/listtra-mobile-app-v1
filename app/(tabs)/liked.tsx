import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebViewMessageEvent } from 'react-native-webview';
import WebViewScreen from '../../components/WebViewScreen';
import { useAuth } from '../../context/AuthContext';

interface WebViewScreenRefInterface {
  injectJavaScript: (script: string) => void;
  reload: () => void;
}

// Custom Header Component for Liked Listings - Memoized
const LikedHeader = React.memo(({ onRefresh }: { onRefresh: () => void }) => {
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
});

export default function LikedScreen() {
  const { isAuthenticated, tokens, user } = useAuth();
  const webViewRef = useRef<WebViewScreenRefInterface>(null);
  const router = useRouter();

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

  // Handle refresh button
  const handleRefresh = useCallback(() => {
    if (webViewRef.current) {
      console.log('User initiated refresh');
      refreshAuthTokens();
      
      setTimeout(() => {
        webViewRef.current?.reload();
      }, 300);
    }
  }, [refreshAuthTokens]);

  // Handle WebView messages
  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      // Handle auth refresh needed
      if (data.type === 'AUTH_STATUS' && !data.isAuthenticated && isAuthenticated) {
        refreshAuthTokens();
        return;
      }
      
      // Handle listing click
      if (data.type === 'LISTING_CLICKED' && data.slug && data.product_id) {
        router.push({
          pathname: "/listings/[slug]/[product_id]/page",
          params: { slug: data.slug, product_id: data.product_id }
        });
      }
      
      // Handle seller profile click
      if (data.type === 'SELLER_PROFILE_CLICKED' && data.nickname) {
        router.push({
          pathname: "/profiles/[nickname]",
          params: { nickname: data.nickname }
        });
      }
    } catch (error) {
      console.error('Error handling WebView message:', error);
    }
  }, [router, refreshAuthTokens, isAuthenticated]);

  // Reload page and refresh auth when tab is focused
  useFocusEffect(
    useCallback(() => {
      console.log('Liked tab focused');
      if (webViewRef.current) {
        refreshAuthTokens();
      }
    }, [refreshAuthTokens])
  );

  // Minimal injected JavaScript
  const injectedJavaScript = useMemo(() => {
    return `
    (function() {
      // Setup auth first
      try {
        localStorage.setItem('token', '${tokens?.accessToken || ""}');
        localStorage.setItem('refreshToken', '${tokens?.refreshToken || ""}');
        localStorage.setItem('user', '${JSON.stringify(user || {})}');
      } catch (e) {
        console.error("Error setting auth tokens:", e);
      }
      
      // Setup link interceptors
      function setupInterceptors() {
        // Handle listing card clicks
        document.querySelectorAll('a[href^="/listings/"]:not([data-intercepted])').forEach(card => {
          card.dataset.intercepted = 'true';
          card.addEventListener('click', (e) => {
            e.preventDefault();
            const href = card.getAttribute('href');
            const match = href.match(/\\/listings\\/([^\\/]+)\\/([^\\/]+)/);
            
            if (match && match.length >= 3) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'LISTING_CLICKED',
                slug: match[1],
                product_id: match[2]
              }));
            } else {
              window.location.href = href;
            }
          });
        });
        
        // Handle profile clicks
        document.querySelectorAll('a[href^="/profiles/"]:not([data-intercepted])').forEach(link => {
          link.dataset.intercepted = 'true';
          link.addEventListener('click', (e) => {
            e.preventDefault();
            const href = link.getAttribute('href');
            const match = href.match(/\\/profiles\\/([^\\/]+)/);
            
            if (match && match.length >= 2) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'SELLER_PROFILE_CLICKED',
                nickname: match[1]
              }));
            } else {
              window.location.href = href;
            }
          });
        });
      }
      
      // Periodically check auth status
      setInterval(() => {
        const token = localStorage.getItem('token');
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'AUTH_STATUS',
          isAuthenticated: !!token,
          currentUrl: window.location.href
        }));
      }, 2000);
      
      // Initial setup
      setupInterceptors();
      
      // Set up a MutationObserver to handle dynamic content
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
  }, [tokens, user]);

  // Handle navigation state changes
  const handleNavigationStateChange = useCallback((navState: { url: string | string[]; }) => {
    console.log("Navigation state changed to:", navState.url);
    
    // If we get redirected to sign-in page but we're authenticated, refresh tokens and redirect
    if (navState.url.includes('/auth/signin') && isAuthenticated && webViewRef.current) {
      console.log("Detected redirect to sign-in while authenticated, refreshing tokens and redirecting");
      refreshAuthTokens();
      webViewRef.current.injectJavaScript(`
        (function() {
          window.location.href = '/liked';
          return true;
        })();
      `);
    }
  }, [isAuthenticated, refreshAuthTokens]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LikedHeader onRefresh={handleRefresh} />
      <View style={styles.webViewContainer}>
        <WebViewScreen
          uri="https://listtra.com/liked"
          ref={webViewRef}
          requiresAuth={true}
          injectedJavaScript={injectedJavaScript}
          onMessage={handleMessage}
          onNavigationStateChange={handleNavigationStateChange}
          showLoader={true}
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
    justifyContent: "space-between",
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