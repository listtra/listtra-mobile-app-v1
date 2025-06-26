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
  
  // Enhanced script to inject into the WebView to help with seller chat view
  const chatEnhancementScript = `
    (function() {
      try {
        console.log("Enhancing chat view for native app");
        
        // Set auth tokens in localStorage
        localStorage.setItem('token', '${tokens?.accessToken || ""}');
        localStorage.setItem('refreshToken', '${tokens?.refreshToken || ""}');
        localStorage.setItem('user', '${JSON.stringify(user || {})}');
        
        // Set global flags
        window.__isNativeApp = true;
        window.__userId = "${user?.id || ''}";
        window.__listingId = "${listingId || ''}";
        
        // Debug function to help diagnose issues
        window.debugChatListDOM = function() {
          const main = document.querySelector('main');
          const loadingElements = document.querySelectorAll('.animate-spin, .loading');
          const conversationList = document.querySelector('.divide-y');
          const headerInfo = document.querySelector('.z-10');
          
          const debug = {
            url: window.location.href,
            isAuthenticated: !!localStorage.getItem('token'),
            userId: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).id : null,
            hasMainElement: !!main,
            loadingElementsCount: loadingElements.length,
            hasConversationList: !!conversationList,
            hasHeaderInfo: !!headerInfo,
            bodyClasses: document.body.className
          };
          
          console.log("Chat List Debug:", debug);
          
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'DOM_DEBUG',
              info: debug
            }));
          }
          
          return "Debug info sent to native app";
        };
        
        // Run the debug function after a delay to ensure page is loaded
        setTimeout(window.debugChatListDOM, 2000);
        setTimeout(window.debugChatListDOM, 5000);
        
        // Force remove loading states after a timeout if still present
        setTimeout(() => {
          const loadingElements = document.querySelectorAll('.animate-spin, .loading');
          if (loadingElements.length > 0) {
            console.log("Removing stuck loading elements:", loadingElements.length);
            loadingElements.forEach(el => el.remove());
            
            // Force refresh the conversation list if needed
            const refreshButton = document.querySelector('button[aria-label="Refresh"]');
            if (refreshButton) {
              console.log("Clicking refresh button");
              refreshButton.click();
            }
            
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'LOADING_REMOVED',
                count: loadingElements.length
              }));
            }
          }
        }, 8000);
        
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
          
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'CONTENT_STATUS',
              status: status,
              conversationsCount: conversations.length
            }));
          }
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
      
      if (data.type === 'DOM_DEBUG') {
        console.log("DOM Debug info:", data.info);
      }
      
      if (data.type === 'CONTENT_STATUS') {
        setIsLoading(false);
        if (data.status === 'error') {
          setHasError(true);
        }
      }
      
      if (data.type === 'LOADING_REMOVED') {
        console.log(`Removed ${data.count} stuck loading elements`);
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
        // If still loading after 15 seconds, try reloading
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
          title: 'Chats',
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
    marginTop: -50,
    alignItems: 'center',
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#ff3b30',
    marginBottom: 15,
  },
  reloadButton: {
    padding: 8,
  },
  reloadButtonLarge: {
    backgroundColor: '#2528be',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  reloadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
}); 