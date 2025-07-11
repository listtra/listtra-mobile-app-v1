import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useRef, useMemo, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebViewMessageEvent } from 'react-native-webview';
import WebViewScreen from '../../components/WebViewScreen';
import { useAuth } from '../../context/AuthContext';

interface WebViewScreenRefInterface {
  injectJavaScript: (script: string) => void;
  reload: () => void;
}

export default function ChatConversation() {
  const webViewRef = useRef<WebViewScreenRefInterface>(null);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, tokens, isAuthenticated } = useAuth();

  useEffect(() => {
    console.log('🟢 ChatConversation mounted with ID:', id);
  }, [id]);

  // Build URL for specific chat
  const webUrl = useMemo(() => {
    console.log('🟡 Loading chat URL:', `https://listtra.com/chat/${id}`);
    return `https://listtra.com/chat/${id}`;
  }, [id]);

  // Handle back button press
  const handleBackPress = useCallback(() => {
    router.back();
  }, [router]);

  // Handle refresh of authentication tokens
  const refreshAuthTokens = useCallback(() => {
    if (webViewRef.current && tokens?.accessToken) {
      console.log('Refreshing auth tokens in Chat Detail WebView');
      webViewRef.current.injectJavaScript(`
        (function() {
          localStorage.setItem('token', '${tokens.accessToken}');
          localStorage.setItem('refreshToken', '${tokens.refreshToken || ""}');
          localStorage.setItem('user', '${JSON.stringify(user || {}).replace(/'/g, "\\'")}');
          return true;
        })();
      `);
    }
  }, [tokens, user]);

  // Handle WebView messages
  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('Chat detail message received:', data);

      if (data.type === 'NAVIGATE') {
        // Handle navigation from the chat detail
        if (data.path) {
          router.push(data.path);
        }
      } else if (data.type === 'AUTH_REFRESH_NEEDED') {
        refreshAuthTokens();
      } else if (data.type === 'GO_BACK') {
        router.back();
      }
    } catch (error) {
      console.error('Error handling WebView message in chat detail:', error);
    }
  }, [router, refreshAuthTokens]);

  // Custom JavaScript to inject into the WebView
  const injectedJavaScript = useMemo(() => {
    return `
    (function() {
      // Initialize auth tokens in one go
      const authData = {
        token: '${tokens?.accessToken || ""}',
        refreshToken: '${tokens?.refreshToken || ""}',
        user: '${JSON.stringify(user || {}).replace(/'/g, "\\'")}'
      };
      
      Object.entries(authData).forEach(([key, value]) => {
        try {
          localStorage.setItem(key, value);
        } catch (e) {
          console.error(\`Error setting \${key}:\`, e);
        }
      });
  
      // Hide header/footer elements
      const hideStyles = document.createElement('style');
      hideStyles.textContent = \`
        header, nav, footer, .navbar, .site-header, .nav-container,
        [role="banner"], [role="navigation"], .app-header, .header {
          display: none !important;
          height: 0 !important;
          min-height: 0 !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
        #__next > *, body > * { padding-top: 0 !important; }
        body { padding-top: 0 !important; margin-top: 0 !important; }
      \`;
      document.head.appendChild(hideStyles);
  
      // Handle navigation
      document.body.addEventListener('click', (e) => {
        // Handle back button
        if (e.target.closest('button[aria-label="Back"], .back-button, [data-back-button]')) {
          e.preventDefault();
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'GO_BACK'
          }));
          return;
        }
  
        // Handle navigation links
        const link = e.target.closest('a[href]');
        if (link && 
            !link.href.includes('/chat/${id}') && 
            !link.href.includes('#') && 
            link.href !== window.location.href) {
          e.preventDefault();
          const path = link.href.replace(window.location.origin, '');
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'NAVIGATE',
            path
          }));
        }
      });
  
      // Monitor auth status
      let lastAuthCheck = Date.now();
      const authObserver = new MutationObserver(() => {
        const now = Date.now();
        if (now - lastAuthCheck > 1000) {
          lastAuthCheck = now;
          if (!localStorage.getItem('token')) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'AUTH_REFRESH_NEEDED'
            }));
          }
        }
      });
      
      authObserver.observe(document.body, { 
        subtree: true, 
        childList: true,
        attributes: true,
        attributeFilter: ['class', 'style'] 
      });
  
      return true;
    })();
    `;
  }, [tokens, user, id]);

  // Handle navigation state changes
  const handleNavigationStateChange = useCallback((navState: { url: string }) => {
    console.log("Chat detail navigation state changed to:", navState.url);

    // Handle sign-in redirects
    if (navState.url.includes('/auth/signin') && isAuthenticated) {
      console.log('Detected redirect to sign-in page in chat detail, refreshing tokens');
      refreshAuthTokens();

      // After refreshing tokens, redirect back to the chat
      setTimeout(() => {
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(`
            (function() {
              window.location.replace('${webUrl}?t=${Date.now()}');
              return true;
            })();
          `);
        }
      }, 300);
    }
  }, [isAuthenticated, refreshAuthTokens, webUrl]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="black" />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <View style={styles.title}>
              <Ionicons name="chatbubble-ellipses-outline" size={24} color="black" />
            </View>
          </View>
        </View>

        <WebViewScreen
          ref={webViewRef}
          uri={webUrl}
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
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    marginRight: 10,
    padding: 5,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});