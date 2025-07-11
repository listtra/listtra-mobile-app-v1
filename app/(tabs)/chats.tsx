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

// Custom Header Component for Chats - Memoized
const ChatsHeader = React.memo(({ onSearchPress }: { onSearchPress: () => void }) => {
  return (
    <View style={styles.headerContainer}>
      <View style={styles.titleContainer}>
        <View style={styles.title}>
          <Ionicons name="chatbubble-ellipses" size={24} color="black" />
          <Text style={styles.titleText}>Chats</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.searchButton} onPress={onSearchPress}>
        <Ionicons name="search-outline" size={24} color="black" />
      </TouchableOpacity>
    </View>
  );
});

export default function ChatsScreen() {
  const webViewRef = useRef<WebViewScreenRefInterface>(null);
  const router = useRouter();
  const { isAuthenticated, tokens, user } = useAuth();
  const lastNavigationRef = useRef<string | null>(null);

  // URL to load in WebView
  const webUrl = 'https://listtra.com/chats';

  // Handle search button press
  const handleSearchPress = useCallback(() => {
    router.push('/search');
  }, [router]);

  // Handle WebView messages
  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      console.log('🔵 WebView message received:', event.nativeEvent.data);

      const data = JSON.parse(event.nativeEvent.data);
      console.log('🟢 Parsed message data:', data);

      if (data.type === 'NAVIGATE') {
        console.log('🟡 NAVIGATE event detected with path:', data.path);

        // Handle navigation to a specific chat
        if (data.path.startsWith('/chat/')) {
          const chatId = data.path.split('/chat/')[1].split('?')[0].split('#')[0];
          console.log('🟣 Attempting to navigate to chat ID:', chatId);

          // Store the current navigation to prevent duplicate navigations
          if (lastNavigationRef.current === chatId) {
            console.log('🔴 Ignoring duplicate navigation request');
            return;
          }
          lastNavigationRef.current = chatId;

          console.log('🟡 About to navigate to:', `/chat/${chatId}`);
          router.push({
            pathname: `/chat/${chatId}`,
          });
          console.log('🟢 Navigation instruction sent');
        }
      }
    } catch (error) {
      console.error('🔴 Error in handleMessage:', error);
    }
  }, [router]);

  // Refresh auth tokens in WebView
  const refreshAuthTokens = useCallback(() => {
    if (webViewRef.current && tokens?.accessToken) {
      console.log('Refreshing auth tokens in Chat Webview');
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

  // Refresh tokens when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('Chats screen focused');
      if (webViewRef.current && isAuthenticated) {
        refreshAuthTokens();

        // Always ensure we're on the chats list when coming back
        webViewRef.current.injectJavaScript(`
          (function() {
            if (!window.location.href.endsWith('/chats')) {
              window.location.replace('${webUrl}?t=${Date.now()}');
            }
            return true;
          })();
        `);
      }
    }, [refreshAuthTokens, isAuthenticated, webUrl])
  );

  // Custom JavaScript to inject into the WebView
  const injectedJavaScript = useMemo(() => {
    return `
    (function() {
      // Set up auth
      localStorage.setItem('token', '${tokens?.accessToken || ""}');
      localStorage.setItem('refreshToken', '${tokens?.refreshToken || ""}');
      localStorage.setItem('user', '${JSON.stringify(user || {}).replace(/'/g, "\\'")}');
      
      // Add click logging
      document.body.addEventListener('click', function(e) {
        const chatLink = e.target.closest('a[href*="/chat/"]');
        if (chatLink) {
          e.preventDefault();
          console.log('🟡 Chat link clicked:', chatLink.href);
          const chatId = chatLink.href.split('/chat/')[1].split(/[?#]/)[0];
          console.log('🟢 Extracted chat ID:', chatId);
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'NAVIGATE',
            path: '/chat/' + chatId
          }));
          console.log('🟣 Message sent to React Native');
        }
      });
  
      // Log when script is injected
      console.log('🟢 Chat enhancement script injected');
      return true;
    })();
    `;
  }, [tokens, user]);

  // Handle navigation state changes - THIS IS KEY
  const handleNavigationStateChange = useCallback((navState: { url: string }) => {
    console.log("Navigation state changed to:", navState.url);

    // Check if navigation is to a chat page
    if (navState.url.includes('/chat/') && !navState.url.endsWith('/chats')) {
      console.log('Detected WebView navigation to chat page, redirecting to native');

      // Extract chat ID from URL
      const urlParts = navState.url.split('/chat/');
      if (urlParts.length > 1) {
        const chatId = urlParts[1].split('?')[0].split('#')[0];

        // Prevent duplicate navigations
        if (lastNavigationRef.current === chatId) {
          console.log('Ignoring duplicate navigation');
          return;
        }
        lastNavigationRef.current = chatId;

        console.log('Extracted chat ID from URL:', chatId);

        // Navigate to native chat screen
        router.push({
          pathname: `/chat/${chatId}`,
        });

        // Navigate WebView back to chats list immediately
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(`
            (function() {
              window.location.replace('${webUrl}?t=${Date.now()}');
              return true;
            })();
          `);
        }

        // Clear navigation ref after a delay
        setTimeout(() => {
          lastNavigationRef.current = null;
        }, 1000);
      }
    } else if (navState.url.includes('/auth/signin') && isAuthenticated) {
      console.log('Detected redirect to sign-in page, refreshing tokens');
      refreshAuthTokens();

      // After refreshing tokens, redirect back to chats
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
  }, [isAuthenticated, refreshAuthTokens, webUrl, router]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ChatsHeader onSearchPress={handleSearchPress} />
      <View style={styles.webViewContainer}>
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
    backgroundColor: 'white',
  },
  webViewContainer: {
    flex: 1,
  },
  webView: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleText: {
    marginLeft: 8,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  searchButton: {
    padding: 8,
  },
});