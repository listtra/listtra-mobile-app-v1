import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebViewMessageEvent } from 'react-native-webview';
import WebViewScreen from '../../../../components/WebViewScreen';
import { useAuth } from '../../../../context/AuthContext';

// Custom Header Component for Listing Details
const ListingDetailHeader = ({ onBack }: { onBack: () => void }) => {
  return (
    <View style={styles.headerContainer}>
      <TouchableOpacity style={styles.headerButton} onPress={onBack}>
        <Ionicons name="arrow-back" size={24} color="#333" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Listing Details</Text>
    </View>
  );
};

export default function ListingDetailScreen() {
  const params = useLocalSearchParams();
  const slug = typeof params.slug === 'string' ? params.slug : String(params.slug || '');
  const product_id = typeof params.product_id === 'string' ? params.product_id : String(params.product_id || '');
  const { isInitializing, isAuthenticated, tokens, user } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const webViewRef = useRef<{ injectJavaScript: (script: string) => void; reload: () => void }>(null);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const webViewUrl = `https://listtra.com/listings/${slug}/${product_id}`;

  // Wait for auth to initialize
  useEffect(() => {
    if (!isInitializing) {
      setIsReady(true);
    }
  }, [isInitializing]);

  // Use useFocusEffect to reload the WebView when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('Listing detail page focused, performing quick reload');
      if (webViewRef.current?.injectJavaScript) {
        const reloadScript = `
          (function() {
            console.log('Forcing quick reload of listing detail page');
            if (window.location.href.includes('listtra.com/listings')) {
              window.location.reload();
            } else {
              window.location.href = '${webViewUrl}';
            }
            return true;
          })();
        `;
        webViewRef.current.injectJavaScript(reloadScript);
      }
      return () => { };
    }, [])
  );

  // Handle refresh action
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
      console.log("Error: WebView not initialized");
    }
  };

  // Handle back navigation
  const onBack = () => {
    router.back();
  };

  // Handle messages from WebView
  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log("WebView message:", data);

      switch (data.type) {
        case 'NAVIGATE_CHAT':
          if (!data.chatId) {
            console.error('Chat navigation failed: Missing chatId');
            return;
          }
          router.push(`/chat/${data.chatId}`);
          break;

        case 'VIEW_ALL_CHATS':
          if (!data.listingId) {
            console.error('View all chats failed: Missing listingId');
            return;
          }
          router.push(`/chat?listing=${data.listingId}`);
          break;

        case 'SELLER_PROFILE_CLICKED':
          if (!data.nickname) {
            console.error('Profile navigation failed: Missing nickname');
            return;
          }
          router.push(`/profiles/${data.nickname}`);
          break;

        case 'AUTH_REQUIRED':
          router.push({
            pathname: '/auth/signin',
            params: { returnTo: data.returnTo }
          });
          break;

        case 'AUTH_STATUS':
          if (!data.isAuthenticated && isAuthenticated && tokens.accessToken) {
            injectAuthTokens();
          }
          break;

        case 'REDIRECT_BLOCKED':
          console.log("Redirect to sign-in blocked, reinjecting tokens and reloading");
          injectAuthTokens();
          setTimeout(() => {
            if (webViewRef.current) {
              webViewRef.current.reload();
            }
          }, 500);
          break;

        default:
          console.log("Unhandled message type:", data.type);
      }
    } catch (error) {
      console.error('Error processing WebView message:', error);
    }
  };

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
            window.location.href = '/listings/${slug}/${product_id}';
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

  // Inject JS to handle authentication and navigation
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
      
      function setupChatInterceptors() {
        console.log('Setting up chat interceptors');
        
        // For buyers - Make Offer button - try multiple selectors
        const makeOfferSelectors = [
          '[data-testid="make-offer-button"]',
          'button:contains("Make Offer")',
          'button.bg-primary.text-white.flex-1',
          'button.bg-primary.text-white'
        ];

        makeOfferSelectors.forEach(function(selector) {
          const makeOfferButtons = document.querySelectorAll(selector);
          console.log('Found ' + makeOfferButtons.length + ' buttons with selector: ' + selector);

          makeOfferButtons.forEach(function(button) {
            if (!button.dataset.intercepted) {
              button.dataset.intercepted = 'true';
              console.log('Adding click listener to Make Offer button');
              
              button.addEventListener('click', async (e) => {
                console.log('Make Offer button clicked!');
                e.preventDefault();
                e.stopPropagation();
                
                if (!localStorage.getItem('token')) {
                  console.log('No token found, redirecting to auth');
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'AUTH_REQUIRED',
                    returnTo: '/listings/${slug}/${product_id}'
                  }));
                  return;
                }
                
                try {
                  console.log('Creating chat conversation...');
                  const response = await fetch('/api/chat/conversations/', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': 'Bearer ' + localStorage.getItem('token')
                    },
                    body: JSON.stringify({
                      listing: '${product_id}'
                    })
                  });
                  
                  if (!response.ok) {
                    if (response.status === 401) {
                      console.log('Unauthorized, redirecting to auth');
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'AUTH_REQUIRED',
                        returnTo: '/listings/${slug}/${product_id}'
                      }));
                      return;
                    }
                    throw new Error('Failed to create chat');
                  }
                  
                  const data = await response.json();
                  console.log('Chat created successfully:', data);
                  
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'NAVIGATE_CHAT',
                    chatId: data.id
                  }));
                } catch (error) {
                  console.error('Error creating chat:', error);
                }
              });
            }
          });
        });

        // For sellers - View all chats button
        const viewAllChatsButton = document.querySelector('[data-testid="view-all-chats-button"]');
        if (viewAllChatsButton && !viewAllChatsButton.dataset.intercepted) {
          viewAllChatsButton.dataset.intercepted = 'true';
          viewAllChatsButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('View all chats clicked');
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'VIEW_ALL_CHATS',
              listingId: '${product_id}'
            }));
          });
        }

        // Chat icon buttons (both cases)
        const chatIconButtons = document.querySelectorAll('button.bg-white.rounded-lg.p-4');
        chatIconButtons.forEach(button => {
          if (!button.dataset.intercepted) {
            button.dataset.intercepted = 'true';
            button.addEventListener('click', async (e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Chat icon clicked');
              
              // Check if this is a seller's view
              const isSellerView = !!document.querySelector('[data-testid="view-all-chats-button"]');
              
              if (isSellerView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'VIEW_ALL_CHATS',
                  listingId: '${product_id}'
                }));
              } else {
                if (!localStorage.getItem('token')) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'AUTH_REQUIRED',
                    returnTo: '/listings/${slug}/${product_id}'
                  }));
                  return;
                }
                
                try {
                  const response = await fetch('/api/chat/conversations/', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': 'Bearer ' + localStorage.getItem('token')
                    },
                    body: JSON.stringify({
                      listing: '${product_id}'
                    })
                  });
                  
                  if (!response.ok) {
                    if (response.status === 401) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'AUTH_REQUIRED',
                        returnTo: '/listings/${slug}/${product_id}'
                      }));
                      return;
                    }
                    throw new Error('Failed to create chat');
                  }
                  
                  const data = await response.json();
                  console.log('Chat created:', data);
                  
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'NAVIGATE_CHAT',
                    chatId: data.id
                  }));
                } catch (error) {
                  console.error('Error creating chat:', error);
                }
              }
            });
          }
        });
      }

      function setupProfileInterceptors() {
        console.log('Setting up profile interceptors');
        const profileLinks = document.querySelectorAll('a[href^="/profiles/"]');
        profileLinks.forEach(link => {
          if (!link.dataset.intercepted) {
            link.dataset.intercepted = 'true';
            link.addEventListener('click', (e) => {
              e.preventDefault();
              const nickname = link.href.split('/').pop();
              console.log('Profile link clicked:', nickname);
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'SELLER_PROFILE_CLICKED',
                nickname
              }));
            });
          }
        });
      }

      // Initial setup
      setupChatInterceptors();
      setupProfileInterceptors();

      // Set up a single observer for both chat and profile interceptors
      const observer = new MutationObserver((mutations) => {
        let shouldSetup = false;
        mutations.forEach(mutation => {
          if (mutation.addedNodes.length) {
            shouldSetup = true;
          }
        });
        if (shouldSetup) {
          console.log('DOM changed, re-running setup');
          setupChatInterceptors();
          setupProfileInterceptors();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      // Handle auth redirect
      if (window.location.pathname.includes('/auth/signin') && ${isAuthenticated}) {
        console.log("Detected sign-in page while user is authenticated, blocking redirect");
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'REDIRECT_BLOCKED',
            action: 'refresh',
            destination: '/auth/signin'
          }));
        }
        window.location.href = '${webViewUrl}';
      }

      return true;
    })();
  `;

  // Handle navigation state changes (URL changes)
  const handleNavigationStateChange = (navState: any) => {
    console.log("Navigation state changed to:", navState.url);
    if (navState.url.includes('/auth/signin') && isAuthenticated) {
      console.log("Detected redirect to sign-in while authenticated, injecting tokens");
      setTimeout(() => {
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(injectedJavaScript);
        }
      }, 500);
    }
  };

  // Show loading spinner while initializing
  if (isInitializing || !isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200EA" />
      </View>
    );
  }

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