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
  const hasInitialized = useRef(false);

  // Add user_id parameter to the URL to help with authentication
  const webViewUrl = (() => {
    let url = `https://listtra.com/listings/${slug}/${product_id}`;
    if (user?.id) {
      url += `?user_id=${user.id}`;
    }
    return url;
  })();

  // Wait for auth to initialize
  useEffect(() => {
    if (!isInitializing) {
      setIsReady(true);
    }
  }, [isInitializing]);

  // Modified useFocusEffect to only initialize once and avoid unnecessary reloads
  useFocusEffect(
    useCallback(() => {
      if (!hasInitialized.current && isReady && webViewRef.current) {
        console.log('Listing detail page focused for first time, injecting auth tokens');
        // Only inject auth tokens on first focus, don't reload
        setTimeout(() => {
          injectAuthTokens();
        }, 1000);
        hasInitialized.current = true;
      }
      return () => {};
    }, [isReady, webViewUrl])
  );

  // Handle refresh action
  const onRefresh = () => {
    if (webViewRef.current) {
      console.log('User initiated retry');
      injectAuthTokens();
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
          console.log('🟢 Navigating to individual chat:', data.chatId);
          router.push(`/chat/${data.chatId}`);
          break;

        case 'VIEW_ALL_CHATS':
          if (!data.listingId) {
            console.error('View all chats failed: Missing listingId');
            return;
          }
          console.log('🟢 Navigating to listing chats:', data.listingId);
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
          console.log("Auth required, injecting tokens and retrying");
          injectAuthTokens();
          break;

        case 'AUTH_STATUS':
          if (!data.isAuthenticated && isAuthenticated && tokens?.accessToken) {
            console.log("Auth status mismatch, injecting tokens");
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

        case 'CHAT_CREATION_FAILED':
          console.error("Chat creation failed:", data.error);
          if (data.error?.includes('401') || data.error?.includes('unauthorized')) {
            injectAuthTokens();
          }
          break;

        default:
          console.log("Unhandled message type:", data.type);
      }
    } catch (error) {
      console.error('Error processing WebView message:', error);
    }
  };

  const injectAuthTokens = () => {
    if (!webViewRef.current || !tokens?.accessToken) {
      console.log("Cannot inject tokens: WebView or tokens not available");
      return;
    }

    console.log("Injecting auth tokens");
    const authScript = `
      (function() {
        try {
          console.log("Injecting auth tokens into localStorage");
          localStorage.setItem('token', '${tokens.accessToken}');
          localStorage.setItem('refreshToken', '${tokens.refreshToken || ""}');
          localStorage.setItem('user', '${JSON.stringify(user || {}).replace(/'/g, "\\'")}');
          
          // Dispatch storage event to notify the page
          window.dispatchEvent(new Event('storage'));
          
          console.log("Auth tokens injected successfully");
          return true;
        } catch (error) {
          console.error("Error injecting auth tokens:", error);
          return false;
        }
      })();
    `;

    webViewRef.current.injectJavaScript(authScript);
  };

  // Enhanced injected JavaScript with better seller/buyer detection
  const injectedJavaScript = `
    (function() {
      try {
        console.log("Initializing listing detail page");
        
        // Set auth tokens with error handling
        try {
          const authData = {
            'token': '${tokens?.accessToken || ""}',
            'refreshToken': '${tokens?.refreshToken || ""}',
            'user': '${JSON.stringify(user || {}).replace(/'/g, "\\'")}'
          };
          
          Object.entries(authData).forEach(([key, value]) => {
            if (value) {
              localStorage.setItem(key, value);
            }
          });
          
          console.log("Auth tokens set successfully");
        } catch (e) {
          console.error("Error setting initial auth tokens:", e);
        }
        
        // Check auth status periodically
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
        
        // Initial auth check
        checkAuthStatus();
        
        // Check auth every 3 seconds
        setInterval(checkAuthStatus, 3000);
        
        // Helper function to determine if user is seller
        function isUserSeller() {
          // Check for seller-specific elements
          const sellerIndicators = [
            '[data-testid="view-all-chats-button"]',
            '[data-testid="seller-dashboard"]',
            '.seller-view',
            '[data-role="seller"]'
          ];
          
          for (const selector of sellerIndicators) {
            if (document.querySelector(selector)) {
              console.log('Seller detected via selector:', selector);
              return true;
            }
          }
          
          // Check URL parameters
          const urlParams = new URLSearchParams(window.location.search);
          const currentUserId = urlParams.get('user_id');
          
          // Check if current user owns this listing
          const userFromStorage = localStorage.getItem('user');
          if (userFromStorage && currentUserId) {
            try {
              const user = JSON.parse(userFromStorage);
              const isSeller = user.id === currentUserId;
              console.log('Seller check via user ID:', isSeller);
              return isSeller;
            } catch (e) {
              console.error('Error parsing user from storage:', e);
            }
          }
          
          return false;
        }
        
        function setupChatInterceptors() {
          console.log('Setting up chat interceptors');
          
          const userIsSeller = isUserSeller();
          console.log('User is seller:', userIsSeller);
          
          // Enhanced Make Offer button interceptor (only for buyers)
          function interceptMakeOfferButtons() {
            if (userIsSeller) {
              console.log('Skipping Make Offer button setup - user is seller');
              return;
            }
            
            const makeOfferSelectors = [
              '[data-testid="make-offer-button"]',
              'button.bg-primary.text-white.flex-1',
              'button.bg-primary.text-white',
              'button:contains("Make Offer")'
            ];

            makeOfferSelectors.forEach(function(selector) {
              const buttons = document.querySelectorAll(selector);
              console.log(\`Found \${buttons.length} buttons with selector: \${selector}\`);

              buttons.forEach(function(button) {
                if (!button.dataset.intercepted) {
                  button.dataset.intercepted = 'true';
                  console.log('Adding click listener to Make Offer button');
                  
                  button.addEventListener('click', async (e) => {
                    console.log('Make Offer button clicked!');
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const token = localStorage.getItem('token');
                    if (!token) {
                      console.log('No token found, requesting auth');
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
                          'Authorization': \`Bearer \${token}\`
                        },
                        body: JSON.stringify({
                          listing: '${product_id}'
                        })
                      });
                      
                      if (!response.ok) {
                        const errorText = await response.text();
                        console.error('Chat creation failed:', response.status, errorText);
                        
                        if (response.status === 401) {
                          console.log('Unauthorized, requesting fresh tokens');
                          window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'AUTH_REQUIRED',
                            returnTo: '/listings/${slug}/${product_id}'
                          }));
                          return;
                        }
                        
                        throw new Error(\`HTTP \${response.status}: \${errorText}\`);
                      }
                      
                      const data = await response.json();
                      console.log('Chat created successfully:', data);
                      
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'NAVIGATE_CHAT',
                        chatId: data.id
                      }));
                    } catch (error) {
                      console.error('Error creating chat:', error);
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'CHAT_CREATION_FAILED',
                        error: error.message
                      }));
                    }
                  });
                }
              });
            });
          }

          // Enhanced View All Chats button interceptor (only for sellers)
          function interceptViewAllChatsButtons() {
            if (!userIsSeller) {
              console.log('Skipping View All Chats button setup - user is not seller');
              return;
            }
            
            const viewAllChatsButton = document.querySelector('[data-testid="view-all-chats-button"]');
            if (viewAllChatsButton && !viewAllChatsButton.dataset.intercepted) {
              viewAllChatsButton.dataset.intercepted = 'true';
              console.log('Adding click listener to View All Chats button');
              
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
          }

          // Enhanced Chat icon buttons interceptor
          function interceptChatIconButtons() {
            const chatIconButtons = document.querySelectorAll('[data-testid="chat-icon-button"]');
            chatIconButtons.forEach(button => {
              if (!button.dataset.intercepted) {
                button.dataset.intercepted = 'true';
                console.log('Adding click listener to Chat icon button');
                
                button.addEventListener('click', async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Chat icon clicked');
                  
                  if (userIsSeller) {
                    console.log('Seller clicking chat icon - navigating to all chats');
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'VIEW_ALL_CHATS',
                      listingId: '${product_id}'
                    }));
                  } else {
                    console.log('Buyer clicking chat icon - creating new chat');
                    const token = localStorage.getItem('token');
                    if (!token) {
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
                          'Authorization': \`Bearer \${token}\`
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
                        throw new Error(\`HTTP \${response.status}\`);
                      }
                      
                      const data = await response.json();
                      console.log('Chat created:', data);
                      
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'NAVIGATE_CHAT',
                        chatId: data.id
                      }));
                    } catch (error) {
                      console.error('Error creating chat:', error);
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'CHAT_CREATION_FAILED',
                        error: error.message
                      }));
                    }
                  }
                });
              }
            });
          }

          // Run all interceptors
          interceptMakeOfferButtons();
          interceptViewAllChatsButtons();
          interceptChatIconButtons();
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

        // Wait for page to fully load before setting up interceptors
        function waitForPageLoad() {
          return new Promise((resolve) => {
            if (document.readyState === 'complete') {
              resolve();
            } else {
              window.addEventListener('load', resolve);
            }
          });
        }

        // Initial setup with delay to ensure page is fully loaded
        waitForPageLoad().then(() => {
          setTimeout(() => {
            console.log('Page loaded, setting up interceptors');
            setupChatInterceptors();
            setupProfileInterceptors();
          }, 1000);
        });

        // Set up observer for dynamic content
        const observer = new MutationObserver((mutations) => {
          let shouldSetup = false;
          mutations.forEach(mutation => {
            if (mutation.addedNodes.length > 0) {
              shouldSetup = true;
            }
          });
          if (shouldSetup) {
            console.log('DOM changed, re-running setup');
            setTimeout(() => {
              setupChatInterceptors();
              setupProfileInterceptors();
            }, 500);
          }
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true
        });

        // Handle auth redirect blocking
        if (window.location.pathname.includes('/auth/signin') && ${isAuthenticated}) {
          console.log("Detected sign-in page while user is authenticated, blocking redirect");
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'REDIRECT_BLOCKED',
            action: 'refresh',
            destination: '/auth/signin'
          }));
          // Redirect back to listing
          window.location.href = '${webViewUrl}';
        }

        console.log("Listing detail page initialization complete");
        return true;
      } catch (error) {
        console.error("Error in injected JavaScript:", error);
        return false;
      }
    })();
  `;

  // Handle navigation state changes (URL changes)
  const handleNavigationStateChange = (navState: any) => {
    console.log("Navigation state changed to:", navState.url);
    
    if (navState.url.includes('/auth/signin') && isAuthenticated) {
      console.log("Detected redirect to sign-in while authenticated, injecting tokens");
      injectAuthTokens();
      setTimeout(() => {
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(`
            window.location.href = '${webViewUrl}';
          `);
        }
      }, 1000);
    }
  };

  // Show loading spinner while initializing
  if (isInitializing || !isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200EA" />
        <Text style={styles.loadingText}>Loading...</Text>
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
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
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