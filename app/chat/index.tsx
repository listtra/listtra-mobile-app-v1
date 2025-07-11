import { Feather } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import WebViewScreen from '../../components/WebViewScreen';
import { useAuth } from '../../context/AuthContext';

export default function ChatListScreen() {
  const { isInitializing, user, tokens } = useAuth();
  const params = useLocalSearchParams();
  const listingId = params.listing as string;
  const router = useRouter();
  const webViewRef = useRef<{ injectJavaScript: (script: string) => void; reload: () => void }>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  // Construct base URL for chat, with listing ID if provided
  const baseUrl = listingId 
    ? `https://listtra.com/chat?listing=${listingId}` 
    : "https://listtra.com/chat";
  
  // Enhanced script to inject into the WebView
  const chatEnhancementScript = `
    (function() {
      try {
        console.log("Enhancing chat view for native app");
        
        // Set auth tokens in localStorage
        localStorage.setItem('token', '${tokens?.accessToken || ""}');
        localStorage.setItem('refreshToken', '${tokens?.refreshToken || ""}');
        localStorage.setItem('user', '${JSON.stringify(user || {})}');
        
        // Hide header and footer elements
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

        // Handle chat navigation
        document.body.addEventListener('click', (e) => {
          const chatLink = e.target.closest('a[href^="/chat/"]');
          if (chatLink) {
            e.preventDefault();
            const chatId = chatLink.href.split('/chat/')[1];
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'NAVIGATE_CHAT',
              chatId
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
        
        // Check for content loading success
        setTimeout(() => {
          const emptyState = document.querySelector('p.text-gray-500');
          const conversations = document.querySelectorAll('a[href^="/chat/"]');
          
          let status = 'unknown';
          
          if (conversations.length > 0) {
            status = 'success';
          } else if (emptyState && emptyState.textContent.includes('No conversations found')) {
            status = 'empty';
          } else {
            const loadingIndicator = document.querySelector('.animate-spin');
            status = loadingIndicator ? 'loading' : 'error';
          }
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'CONTENT_STATUS',
            status: status,
            conversationsCount: conversations.length
          }));
        }, 6000);
        
        return true;
      } catch (error) {
        console.error("Error enhancing chat view:", error);
        return false;
      }
    })();
  `;
  
  // Handle WebView messages
  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log("Received message from WebView:", data.type);
      
      switch (data.type) {
        case 'CONTENT_STATUS':
          setIsLoading(false);
          if (data.status === 'error') {
            setHasError(true);
          }
          break;

        case 'NAVIGATE_CHAT':
          if (data.chatId) {
            router.push(`/chat/${data.chatId}`);
          }
          break;

        case 'AUTH_REFRESH_NEEDED':
          if (webViewRef.current && tokens?.accessToken) {
            webViewRef.current.injectJavaScript(chatEnhancementScript);
          }
          break;
      }
    } catch (error) {
      console.error("Error processing WebView message:", error);
    }
  };
  
  // Handle reload button press
  const handleReload = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(chatEnhancementScript);
      setTimeout(() => {
        webViewRef.current?.reload();
        setIsLoading(true);
        setHasError(false);
      }, 300);
    }
  };
  
  // Auto-reload if no communication from WebView
  useEffect(() => {
    if (isLoading) {
      const timeoutId = setTimeout(() => {
        if (isLoading && !hasError) {
          console.log('No response from WebView after 15 seconds, trying reload');
          handleReload();
        }
      }, 15000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [isLoading, hasError]);
  
  // Wait for auth initialization before loading WebView
  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2528be" />
        <Text style={styles.loadingText}>Initializing...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          title: listingId ? 'Listing Chats' : 'Chats',
          headerShown: true,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <Feather name="chevron-left" size={24} color="#2528be" />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={handleReload} style={styles.reloadButton}>
              <Feather name="refresh-cw" size={20} color="#2528be" />
            </TouchableOpacity>
          ),
        }} 
      />
      
      {hasError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>There was a problem loading chats</Text>
          <TouchableOpacity 
            style={styles.reloadButtonLarge}
            onPress={handleReload}
          >
            <Text style={styles.reloadButtonText}>Reload</Text>
          </TouchableOpacity>
        </View>
      )}
      
      <WebViewScreen 
        ref={webViewRef}
        uri={baseUrl} 
        showLoader={true} 
        requiresAuth={true}
        injectedJavaScript={chatEnhancementScript}
        onMessage={handleMessage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  errorContainer: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
    backgroundColor: 'white',
    padding: 20,
  },
  errorText: {
    color: '#666',
    fontSize: 16,
    marginBottom: 15,
  },
  reloadButton: {
    padding: 8,
  },
  reloadButtonLarge: {
    backgroundColor: '#2528be',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  reloadButtonText: {
    color: 'white',
    fontSize: 16,
  },
});