import { Feather } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
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

  // Construct WebView URL (WebViewScreen will add user_id and tokens)
  const webViewUrl = React.useMemo(() => {
    const baseUrl = listingId 
      ? `https://listtra.com/chat?listing=${listingId}` 
      : "https://listtra.com/chat";
    
    console.log('Chat WebView base URL:', baseUrl);
    return baseUrl;
  }, [listingId]);

  // Debug authentication state
  console.log('Chat screen auth state:', {
    isInitializing,
    hasUser: !!user,
    hasTokens: !!(tokens?.accessToken && tokens?.refreshToken),
    userId: user?.id,
    listingId
  });

  // Enhancement script for chat functionality
  const chatEnhancementScript = `
    (function() {
      console.log('Chat enhancement script running');
      console.log('Current URL:', window.location.href);
      console.log('URL params:', window.location.search);
      
      // Force navigation to chat page if we're on the wrong page
      if (!window.location.pathname.includes('/chat')) {
        console.log('Not on chat page, forcing navigation to chat');
        const targetUrl = '${webViewUrl}';
        console.log('Forcing navigation to:', targetUrl);
        window.location.href = targetUrl;
        return;
      }
      
      // Check if user_id is present in URL
      const urlParams = new URLSearchParams(window.location.search);
      const userId = urlParams.get('user_id');
      const listingId = urlParams.get('listing');
      console.log('URL parameters - user_id:', userId, 'listing:', listingId);
      
      // Handle chat navigation clicks
      document.addEventListener('click', function(e) {
        const chatLink = e.target.closest('a[href^="/chat/"]');
        if (chatLink) {
          e.preventDefault();
          const chatId = chatLink.href.split('/chat/')[1];
          console.log('Chat link clicked, navigating to:', chatId);
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'NAVIGATE_CHAT',
            chatId: chatId
          }));
        }
      });
      
      // Monitor content loading and report status
      function checkContentStatus() {
        // Check if we're still on the right page
        if (!window.location.pathname.includes('/chat')) {
          console.log('Page navigated away from chat, reporting error');
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'CONTENT_STATUS',
            status: 'error',
            error: 'Page navigated away from chat'
          }));
          return;
        }
        
        const conversations = document.querySelectorAll('a[href^="/chat/"]');
        const emptyState = document.querySelector('p.text-gray-500');
        const loadingIndicator = document.querySelector('.animate-spin');
        
        console.log('Content check - conversations:', conversations.length, 'loading:', !!loadingIndicator, 'empty:', !!emptyState);
        
        let status = 'loading';
        
        if (conversations.length > 0) {
          status = 'success';
          console.log('Chat content loaded successfully');
        } else if (emptyState && emptyState.textContent.includes('No conversations found')) {
          status = 'empty';
          console.log('No conversations found');
        } else if (!loadingIndicator) {
          status = 'error';
          console.log('Error state detected');
        }
        
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'CONTENT_STATUS',
          status: status,
          conversationsCount: conversations.length
        }));
      }
      
      // Check status after page loads
      setTimeout(checkContentStatus, 2000);
      setTimeout(checkContentStatus, 5000);
      setTimeout(checkContentStatus, 8000);
      
      return true;
    })();
  `;

  // Handle WebView messages
  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      switch (data.type) {
        case 'CONTENT_STATUS':
          console.log('Content status received:', data.status, data.error);
          
          if (data.status === 'success' || data.status === 'empty') {
            setIsLoading(false);
            setHasError(false);
          } else if (data.status === 'error') {
            setIsLoading(false);
            setHasError(true);
            
            // If the error is navigation-related, try to reload
            if (data.error === 'Page navigated away from chat') {
              console.log('Attempting to reload WebView due to navigation error');
              setTimeout(() => {
                if (webViewRef.current) {
                  webViewRef.current.reload();
                }
              }, 1000);
            }
          }
          break;

        case 'NAVIGATE_CHAT':
          if (data.chatId) {
            router.push(`/chat/${data.chatId}`);
          }
          break;
      }
    } catch (error) {
      console.error("Error processing WebView message:", error);
    }
  };

  // Handle reload
  const handleReload = () => {
    setIsLoading(true);
    setHasError(false);
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  };

  // Wait for auth initialization and tokens
  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2528be" />
        <Text style={styles.loadingText}>Connecting to chat...</Text>
      </View>
    );
  }

  // Wait for tokens to be available
  if (!tokens?.accessToken || !tokens?.refreshToken) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2528be" />
        <Text style={styles.loadingText}>Loading authentication...</Text>
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
          <Text style={styles.errorText}>Unable to load your chats</Text>
          <Text style={styles.errorSubtext}>
            Please check your internet connection and try again
          </Text>
          <TouchableOpacity 
            style={styles.reloadButtonLarge}
            onPress={handleReload}
          >
            <Text style={styles.reloadButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}
      
      <WebViewScreen 
        ref={webViewRef}
        uri={webViewUrl} 
        showLoader={isLoading} 
        requiresAuth={true}
        injectedJavaScript={chatEnhancementScript}
        onMessage={handleMessage}
        onNavigationStateChange={(navState) => {
          console.log('Navigation state changed:', navState.url);
          
          // If WebView navigates away from chat page, force it back
          if (navState.url && !navState.url.includes('/chat') && navState.url.includes('listtra.com')) {
            console.log('WebView navigated away from chat, forcing back to chat');
            if (webViewRef.current) {
              // Inject script to force navigation back to chat
              const forceNavigationScript = `
                console.log('Forcing navigation back to chat page');
                window.location.href = '${webViewUrl}';
                true;
              `;
              webViewRef.current.injectJavaScript(forceNavigationScript);
            }
          }
        }}
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
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtext: {
    color: '#999',
    fontSize: 14,
    marginBottom: 15,
    textAlign: 'center',
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