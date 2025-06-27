import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useAuth } from '../context/AuthContext';

type WebViewScreenProps = {
  uri: string;
  showLoader?: boolean;
  requiresAuth?: boolean;
  injectedJavaScript?: string;
  onMessage?: (event: WebViewMessageEvent) => void;
};

const WebViewScreen = React.forwardRef<{ injectJavaScript: (script: string) => void; reload: () => void }, WebViewScreenProps>(({ 
  uri, 
  showLoader = true,
  requiresAuth = false,
  injectedJavaScript = '',
  onMessage
}, ref) => {
  const webViewRef = useRef<WebView>(null);
  const { tokens, logout, isAuthenticated, setTokensDirectly, user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState(uri);
  const router = useRouter();

  // Expose the webViewRef to parent components via the forwardRef pattern
  React.useImperativeHandle(ref, () => ({
    injectJavaScript: (script: string) => {
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(script);
      }
    },
    reload: () => {
      if (webViewRef.current) {
        webViewRef.current.reload();
      }
    }
  }));

  // Construct proper URL with auth indicator
  const getAuthenticatedUrl = (baseUrl: string) => {
    // If URL already has isNativeAuth parameter, don't add it again
    if (baseUrl.includes('isNativeAuth=true')) {
      return baseUrl;
    }
    
    // Add a query parameter to indicate authenticated state to the web app
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}isNativeAuth=true&token=${encodeURIComponent(tokens.accessToken || '')}`;
  };

  // Inject auth tokens to WebView for seamless authentication
  const injectTokensToWebView = () => {
    if (!webViewRef.current || !tokens.accessToken || !tokens.refreshToken || !user) return;
    
    console.log('Injecting tokens and user data to WebView for URL:', currentUrl);
    
    const script = `
      (function() {
        try {
          // STEP 1: Set tokens in localStorage
          console.log('Setting auth tokens in web app localStorage');
          localStorage.setItem('token', '${tokens.accessToken}');
          localStorage.setItem('refreshToken', '${tokens.refreshToken}');
          
          // STEP 2: Parse and store user data
          const userDataString = '${JSON.stringify(user)}';
          const userData = JSON.parse(userDataString);
          console.log('Setting user data:', userData);
          localStorage.setItem('user', userDataString);
          
          // STEP 3: Make user data globally available
            window.userData = userData;
            
          // STEP 4: Detect if we're on a chat page and log info
          if (window.location.pathname.includes('/chat/')) {
            console.log('On chat page, enhancing token access');
            
            // Check if there's any loading elements
            const loadingElements = document.querySelectorAll('.animate-spin, .loading');
            console.log('Found loading elements:', loadingElements.length);
            
            // Force bypass any loading screen after 2 seconds
            setTimeout(() => {
              const loadingElements = document.querySelectorAll('.animate-spin, .loading');
              loadingElements.forEach(el => {
                console.log('Removing loading element:', el);
                el.remove();
              });
            }, 2000);
          }
            
          // Rest of the original function...
          // Add ownership check function
          window.checkIsOwner = function(sellerId) {
            const user = window.userData || JSON.parse(localStorage.getItem('user') || 'null');
            const isOwner = user && user.id === sellerId;
            console.log('Ownership check:', { userId: user?.id, sellerId, isOwner });
            return isOwner;
          };
          
          // STEP 5: Update React's AuthContext if possible
          if (window.updateAuthContext) {
            window.updateAuthContext(userData, '${tokens.accessToken}', '${tokens.refreshToken}');
            console.log('Updated AuthContext using global handler');
          }
          
          true; // Return success
        } catch (error) {
          console.error('Error in token injection:', error);
          false; // Return failure
        }
      })();
    `;
    
    webViewRef.current.injectJavaScript(script);
  };

  // Ensure tokens are injected when URL changes or authentication state changes
  useEffect(() => {
    if (isAuthenticated && tokens.accessToken && tokens.refreshToken) {
      injectTokensToWebView();
    }
  }, [currentUrl, isAuthenticated, tokens.accessToken, tokens.refreshToken]);

  // Handle navigation state changes
  const handleNavigationStateChange = (navState: any) => {
    // Skip if URL hasn't actually changed to prevent loops
    if (navState.url === currentUrl) {
      return;
    }
    
    console.log('Navigation state change:', navState.url);
    setCurrentUrl(navState.url);
    
    // Handle redirects to sign-in page when we have valid tokens
    if (navState.url.includes('/auth/signin') && isAuthenticated && tokens.accessToken) {
      console.log('Detected redirect to sign-in while authenticated, injecting tokens and redirecting back');
      
      setTimeout(() => {
        if (webViewRef.current) {
          // Inject tokens and redirect to original destination or listings
          const redirectScript = `
            (function() {
              try {
                console.log('Injecting tokens and redirecting from sign-in page');
                localStorage.setItem('token', '${tokens.accessToken}');
                localStorage.setItem('refreshToken', '${tokens.refreshToken}');
                localStorage.setItem('user', '${JSON.stringify(user || {})}');
                
                // Redirect back to listings
                window.location.href = '/listings';
                return true;
              } catch (error) {
                console.error('Error handling auth redirect:', error);
                return false;
              }
            })();
          `;
          
          webViewRef.current.injectJavaScript(redirectScript);
        }
      }, 500);
    }
    
    // Special handling for chat detail pages
    if (navState.url.includes('/chat/') && navState.url.includes('listtra.com')) {
      console.log('Detected chat detail page, injecting tokens immediately');
      setTimeout(() => {
        if (isAuthenticated && tokens.accessToken) {
          injectTokensToWebView();
        }
      }, 300);
    }
  };

  // Update the handleWebViewMessage function to handle chat-specific messages
  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      // Handle log messages from the WebView
      if (data.type === 'LOG') {
        console.log('WebView Log:', data.message, data.data || data.error || '');
                    return;
                  }
                  
      // Handle chat-specific messages
      if (data.type === 'CHAT_ACTION') {
        console.log('Chat action received:', data.action, data);
        
        // Just log the actions for now - the WebView will handle the actual API calls
        // These messages are mainly for debugging and tracking
        switch (data.action) {
          case 'MAKE_OFFER':
            console.log('Make offer action with amount:', data.amount);
            break;
          case 'ACCEPT_OFFER':
            console.log('Accept offer action for offer ID:', data.offerId);
            break;
          case 'REJECT_OFFER':
            console.log('Reject offer action for conversation:', data.conversationId);
            break;
          case 'CANCEL_OFFER':
            console.log('Cancel offer action for conversation:', data.conversationId);
            break;
        }
        
                        return;
                      }
                      
      // Handle NAVIGATE_CHAT message specifically
      if (data.type === 'NAVIGATE_CHAT' && data.chatId) {
        console.log('Navigating to chat:', data.chatId);
        router.push(`/chat/${data.chatId}`);
        return;
      }
      
      // Handle REDIRECT_BLOCKED specifically
      if (data.type === 'REDIRECT_BLOCKED') {
        console.log('Handling blocked redirect:', data);
        
        // If webview is trying to redirect to auth page when showing profile
        if (data.destination && (data.destination.includes('/auth/') || data.destination.includes('/signin'))) {
          console.log('Auth redirect detected, trying more aggressive approach');
          
          if (webViewRef.current && isAuthenticated) {
            // Try a more aggressive approach - directly inject HTML into the page
            const directInjectHTML = `
              (function() {
                try {
                  console.log('Directly injecting profile HTML');
                  
                  // Store tokens in localStorage
                  localStorage.setItem('token', '${tokens.accessToken}');
                  localStorage.setItem('refreshToken', '${tokens.refreshToken}');
                  localStorage.setItem('user', '${JSON.stringify(user || {})}');
                  
                  // Replace entire document content with direct HTML for profile
                  document.open();
                  document.write(\`
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                      <meta charset="UTF-8">
                      <meta name="viewport" content="width=device-width, initial-scale=1.0">
                      <title>User Profile</title>
                      <style>
                        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
                        body { background-color: #f5f5f5; }
                        .header { background-color: #4046F9; color: white; padding: 30px 20px 50px 20px; border-bottom-left-radius: 20px; border-bottom-right-radius: 20px; }
                        .avatar { width: 80px; height: 80px; border-radius: 50%; background-color: #e0e0e0; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px auto; border: 4px solid white; font-size: 32px; color: #757575; }
                        .profile-info { text-align: center; }
                        .user-name { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
                        .user-email { opacity: 0.8; font-size: 14px; }
                        .stats { display: flex; justify-content: center; margin-top: 20px; }
                        .stat-item { padding: 0 20px; text-align: center; }
                        .stat-value { font-size: 18px; font-weight: bold; }
                        .stat-label { font-size: 12px; opacity: 0.8; }
                        .tabs { display: flex; border-bottom: 1px solid #e0e0e0; margin: 20px 10px; }
                        .tab { flex: 1; text-align: center; padding: 10px; font-weight: bold; color: #757575; position: relative; }
                        .tab.active { color: #4046F9; }
                        .tab.active:after { content: ""; position: absolute; bottom: -1px; left: 0; width: 100%; height: 2px; background-color: #4046F9; }
                        .content { padding: 20px; }
                        .empty-message { text-align: center; padding: 30px; color: #757575; }
                        .card { background: white; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 15px; overflow: hidden; }
                        .card-img { height: 160px; background-color: #f0f0f0; display: flex; align-items: center; justify-content: center; color: #757575; }
                        .card-content { padding: 15px; }
                        .card-title { font-weight: 500; margin-bottom: 5px; }
                        .card-price { color: #4046F9; font-weight: bold; }
                      </style>
                    </head>
                    <body>
                      <div class="header">
                        <div class="avatar">${user?.nickname?.charAt(0)?.toUpperCase() || 'U'}</div>
                        <div class="profile-info">
                          <div class="user-name">${user?.nickname || 'User'}</div>
                          <div class="user-email">${user?.email || ''}</div>
                          <div class="stats">
                            <div class="stat-item">
                              <div class="stat-value">0</div>
                              <div class="stat-label">Reviews</div>
                            </div>
                            <div class="stat-item">
                              <div class="stat-value">0</div>
                              <div class="stat-label">Listings</div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div class="tabs">
                        <div class="tab active">My Listings</div>
                        <div class="tab">Liked</div>
                        <div class="tab">Reviews</div>
                      </div>
                      
                      <div class="content">
                        <div class="empty-message">
                          Loading your listings...
                        </div>
                        
                        <!-- Will be populated via API call -->
                        <div id="listings-container"></div>
                      </div>
                      
                      <script>
                        // Set up auth tokens for API calls
                        const token = '${tokens.accessToken}';
                        const userId = '${user?.id}';
                        
                        // Fetch listings when page loads
                        window.onload = function() {
                          fetchListings();
                          
                          // Set up tab switching
                          document.querySelectorAll('.tab').forEach((tab, index) => {
                            tab.addEventListener('click', () => {
                              document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                              tab.classList.add('active');
                              
                              // Show appropriate content based on tab
                              if (index === 0) {
                                fetchListings();
                              } else if (index === 1) {
                                fetchLiked();
                              } else {
                                fetchReviews();
                              }
                            });
                          });
                        };
                        
                        // Fetch user's listings
                        function fetchListings() {
                          document.querySelector('.empty-message').textContent = 'Loading your listings...';
                          document.querySelector('.empty-message').style.display = 'block';
                          document.getElementById('listings-container').innerHTML = '';
                          
                          fetch('https://backend.listtra.com/api/listings/?seller=' + userId, {
                            headers: {
                              'Authorization': 'Bearer ' + token
                            }
                          })
                          .then(response => response.json())
                          .then(data => {
                            const listings = data.listings || [];
                            if (listings.length === 0) {
                              document.querySelector('.empty-message').textContent = 'No listings found';
                            } else {
                              document.querySelector('.empty-message').style.display = 'none';
                              renderListings(listings);
                            }
                          })
                          .catch(error => {
                            document.querySelector('.empty-message').textContent = 'Error loading listings';
                            console.error('Error fetching listings:', error);
                          });
                        }
                        
                        // Fetch liked listings
                        function fetchLiked() {
                          document.querySelector('.empty-message').textContent = 'Loading liked items...';
                          document.querySelector('.empty-message').style.display = 'block';
                          document.getElementById('listings-container').innerHTML = '';
                          
                          fetch('https://backend.listtra.com/api/listings/liked/', {
                            headers: {
                              'Authorization': 'Bearer ' + token
                            }
                          })
                          .then(response => response.json())
                          .then(listings => {
                            if (!listings || listings.length === 0) {
                              document.querySelector('.empty-message').textContent = 'No liked items found';
                            } else {
                              document.querySelector('.empty-message').style.display = 'none';
                              renderListings(listings);
                            }
                          })
                          .catch(error => {
                            document.querySelector('.empty-message').textContent = 'Error loading liked items';
                            console.error('Error fetching liked items:', error);
                          });
                        }
                        
                        // Fetch reviews
                        function fetchReviews() {
                          document.querySelector('.empty-message').textContent = 'Loading reviews...';
                          document.querySelector('.empty-message').style.display = 'block';
                          document.getElementById('listings-container').innerHTML = '';
                          
                          fetch('https://backend.listtra.com/api/reviews/seller/' + userId + '/', {
                            headers: {
                              'Authorization': 'Bearer ' + token
                            }
                          })
                          .then(response => response.json())
                          .then(reviews => {
                            if (!reviews || reviews.length === 0) {
                              document.querySelector('.empty-message').textContent = 'No reviews yet';
                            } else {
                              document.querySelector('.empty-message').style.display = 'none';
                              document.getElementById('listings-container').innerHTML = reviews.map(review => \`
                                <div class="card">
                                  <div class="card-content">
                                    <div style="display: flex; align-items: center; margin-bottom: 10px;">
                                      <div style="width: 40px; height: 40px; border-radius: 50%; background-color: #e0e0e0; display: flex; align-items: center; justify-content: center; margin-right: 10px;">
                                        <span>\${review.reviewer_nickname?.charAt(0).toUpperCase() || 'U'}</span>
                                      </div>
                                      <div>
                                        <div style="font-weight: bold;">\${review.reviewer_nickname || 'User'}</div>
                                        <div style="color: #F9A825; font-size: 14px;">★ \${review.rating || 0}</div>
                                      </div>
                                    </div>
                                    <div style="color: #424242; font-size: 14px;">
                                      \${review.review_text || 'No comment provided'}
                                    </div>
                                  </div>
                                </div>
                              \`).join('');
                            }
                          })
                          .catch(error => {
                            document.querySelector('.empty-message').textContent = 'Error loading reviews';
                            console.error('Error fetching reviews:', error);
                          });
                        }
                        
                        // Render listings in a grid
                        function renderListings(listings) {
                          const container = document.getElementById('listings-container');
                          const grid = document.createElement('div');
                          grid.style.display = 'grid';
                          grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
                          grid.style.gap = '15px';
                          
                          listings.forEach(item => {
                            const card = document.createElement('div');
                            card.className = 'card';
                            
                            const imageUrl = item.images && item.images.length > 0 
                              ? item.images[0].image_url 
                              : '';
                            
                            card.innerHTML = \`
                              <div class="card-img">
                                \${imageUrl ? \`<img src="\${imageUrl}" alt="\${item.title}" style="width: 100%; height: 100%; object-fit: cover;">\` : 'No Image'}
                              </div>
                              <div class="card-content">
                                <div class="card-title">\${item.title}</div>
                                <div class="card-price">A$\${item.price}</div>
                              </div>
                            \`;
                            
                            card.addEventListener('click', () => {
                              // Navigate to listing detail
                              window.location.href = '/listings/' + item.slug + '/' + item.product_id;
                            });
                            
                            grid.appendChild(card);
                          });
                          
                          container.appendChild(grid);
                        }
                      </script>
                    </body>
                    </html>
                  \`);
                  document.close();
                  
                  return true;
                } catch(e) {
                  console.error('Error in direct HTML injection:', e);
                  return false;
                }
              })();
            `;
            
            webViewRef.current.injectJavaScript(directInjectHTML);
          }
        }
        
        return;
      }
      
      // Rest of your existing message handler code...
      // ... existing message handler code ...
    } catch (error) {
      console.error('Failed to process WebView message', error);
    }
  };

  // Add the optimized chat enhancement script to the original useEffect 
  useEffect(() => {
    // Wait for webViewRef to be available and page to fully load
    if (!webViewRef.current || isLoading) return;
    
    console.log('Checking if page-specific scripts need to be injected for:', currentUrl);
    
    // Inject script with a delay to ensure page is ready
    const injectWithDelay = (script: string, delay: number = 1000) => {
      setTimeout(() => {
        if (webViewRef.current) {
          console.log('Injecting script after delay');
          webViewRef.current.injectJavaScript(script);
        }
      }, delay);
    };
    
    // Always inject the hideNavbar script regardless of URL
    injectWithDelay(hideNavbarScript, 800);
    
    // Use a different approach based on URL
    if (currentUrl.includes('/chat/')) {
      console.log('Chat page detected, preparing chat scripts');
      
      // Create a chat enhancement script that doesn't depend on external variables
      // This version is optimized to prevent freezing
      const enhanceChatScript = `
        (function() {
          // If script has already run on this page, don't run again
          if (window.__chatScriptApplied) {
            console.log('Chat script already applied, skipping');
              return true;
            }
            
          try {
            console.log('Running optimized chat enhancement script');
            
            // Mark as applied immediately to prevent double execution
            window.__chatScriptApplied = true;
            
            // Function to detect if user is buyer or seller - run only once
            const detectUserRole = () => {
              // Try URL parameter first (most reliable)
              const urlParams = new URLSearchParams(window.location.search);
              const isBuyerParam = urlParams.get('isBuyer');
              if (isBuyerParam !== null) {
                const isBuyer = isBuyerParam === 'true';
                console.log('Using isBuyer parameter:', isBuyer);
                setUserRole(isBuyer);
                  return;
                }
                
              // Get user data from localStorage as fallback
              try {
                const userData = JSON.parse(localStorage.getItem('user') || '{}');
                const userID = userData.id;
                
                if (!userID) {
                  console.warn('No user ID found, defaulting to buyer view');
                  setUserRole(true);
                  return;
                }
                
                // Simplified UI detection - just check for one element type
                const hasSellerControls = !!document.querySelector('button[class*="bg-green"]') || 
                                         !!document.querySelector('button[class*="bg-red"]');
                
                // Set role opposite of seller controls presence
                setUserRole(!hasSellerControls);
              } catch (e) {
                console.error('Error detecting role:', e);
                setUserRole(true); // Default to buyer
              }
            };
            
            // Function to apply UI changes based on role - simpler version
            const setUserRole = (isBuyer) => {
              console.log('Setting user role:', isBuyer ? 'Buyer' : 'Seller');
              
              // Add a class to the body for CSS targeting
              document.body.classList.add(isBuyer ? 'is-buyer' : 'is-seller');
              window.__isBuyer = isBuyer;
              
              // Add styles instead of manipulating DOM directly
              const styleId = 'chat-role-styles';
              if (!document.getElementById(styleId)) {
                const style = document.createElement('style');
                style.id = styleId;
                style.textContent = \`
                  /* When user is buyer */
                  body.is-buyer .flex.gap-3.justify-center.mt-1 {
                    display: none !important;
                  }
                  
                  /* When user is seller */
                  body.is-seller .mt-2:has(input[type="number"]) {
                    display: none !important;
                  }
                \`;
                document.head.appendChild(style);
              }
            };
            
            // Run role detection after a short delay to ensure DOM is ready
            setTimeout(detectUserRole, 500);
            
            // Add a single, limited mutation observer with debounce
            let debounceTimeout = null;
                  const observer = new MutationObserver(() => {
              if (debounceTimeout) clearTimeout(debounceTimeout);
              debounceTimeout = setTimeout(() => {
                // Only check for a few specific elements to avoid heavy processing
                const needsUpdate = !document.body.classList.contains('is-buyer') && 
                                   !document.body.classList.contains('is-seller');
                if (needsUpdate) {
                  detectUserRole();
                }
              }, 500);
            });
            
            // Observe only body class changes and additions
                  observer.observe(document.body, {
              attributes: true,
              attributeFilter: ['class']
                  });
                  
            // Force clean stop after 10 seconds to prevent memory leaks
                  setTimeout(() => {
              observer.disconnect();
              console.log('Chat enhancement observer stopped after timeout');
            }, 10000);
          } catch(e) {
            console.error('Error in chat enhancement script:', e);
          }
          return true;
        })();
      `;
      
      // Inject only once with longer delay to ensure page is fully loaded
      injectWithDelay(enhanceChatScript, 1500);
    } else if (currentUrl.includes('/listings/')) {
      console.log('Listing page detected, preparing listing scripts');
      
      // Create a listing enhancement script that doesn't depend on external variables
      const enhanceListingScript = `
        (function() {
          try {
            console.log('Running listing enhancement script');
            
            // Function to handle Make Offer button
            const setupMakeOfferButton = () => {
              document.querySelectorAll('button').forEach(btn => {
                if (btn.innerText && btn.innerText.includes('Make Offer') && !btn.dataset.handlerAdded) {
                  console.log('Found Make Offer button, adding handler');
                  btn.dataset.handlerAdded = 'true';
                  
                  // Add click handler
                  btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    console.log('Make Offer clicked, handling with custom script');
                    
                    // Get product ID from URL
                    const matches = window.location.pathname.match(/\\/listings\\/[^\\/]+\\/([^\\/]+)/);
                    const productId = matches ? matches[1] : null;
                    
                    if (!productId) {
                      console.error('Could not extract product ID from URL');
                      return;
                    }
                    
                    // Show loading state
                    const originalText = btn.innerText;
                    btn.innerText = 'Processing...';
                    btn.disabled = true;
                    
                    try {
                      // Make API call to create conversation
                      const API_URL = 'https://backend.listtra.com';
                      const token = localStorage.getItem('token');
                      
                      if (!token) {
                        console.error('No authentication token found');
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'AUTH_REQUIRED',
                          returnTo: window.location.pathname
                        }));
                        return;
                      }
                      
                      const response = await fetch(\`\${API_URL}/api/chat/conversations/\`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': \`Bearer \${token}\`
                        },
                        body: JSON.stringify({ listing: productId })
                      });
                      
                      if (!response.ok) {
                        throw new Error('Failed to create conversation');
                      }
                      
                      const data = await response.json();
                      console.log('Conversation created:', data);
                      
                      // Notify the native app to navigate to chat
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'NAVIGATE_CHAT',
                        chatId: data.id
                      }));
                    } catch (error) {
                      console.error('Error creating conversation:', error);
                      alert('Failed to start chat. Please try again.');
                    } finally {
                      // Restore button state
                      btn.innerText = originalText;
                      btn.disabled = false;
                    }
                  });
                }
              });
            };
            
            // Run immediately and with delays
            setupMakeOfferButton();
            setTimeout(setupMakeOfferButton, 1000);
            setTimeout(setupMakeOfferButton, 2000);
          } catch(e) {
            console.error('Error in listing enhancement script:', e);
          }
          return true;
        })();
      `;
      
      injectWithDelay(enhanceListingScript);
    }
  }, [currentUrl, isLoading, webViewRef.current]);

  // Rename the existing injectedJavaScript variable to baseInjectedJavaScript to avoid conflict
  const baseInjectedJavaScript = `
    (function() {
      // Function to fix Cloudinary image URLs
      function fixCloudinaryImages() {
        const images = document.querySelectorAll('img[src*="res.cloudinary.com"]');
        images.forEach(img => {
          // Ensure HTTPS
          if (img.src.startsWith('http://')) {
            img.src = img.src.replace('http://', 'https://');
          }
          
          // Add loading="lazy" for better performance
          img.loading = 'lazy';
                  
          // Add error handling
          img.onerror = function() {
            console.error('Failed to load image:', img.src);
            // Retry loading with a different protocol
            if (!img.retried) {
              img.retried = true;
              img.src = img.src.replace('https://', 'http://');
            }
          };
        });
      }

      // Run immediately
      fixCloudinaryImages();
                              
      // Also run when DOM changes
      const observer = new MutationObserver(function(mutations) {
        fixCloudinaryImages();
        
        // Also intercept chat link clicks
        interceptChatLinks();
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      // Function to intercept chat link clicks
      function interceptChatLinks() {
        // Look for chat links in the page
        document.querySelectorAll('a[href^="/chat/"]').forEach(link => {
          // Check if we already processed this link
          if (!link.dataset.intercepted) {
            link.dataset.intercepted = 'true';
            
            // Add click handler
            link.addEventListener('click', function(e) {
              // Get the chat ID from the href
              const chatId = link.href.match(/\\/chat\\/([^\\/\\?]+)/)?.[1];
              
              if (chatId) {
                e.preventDefault();
                
                // Notify the native app
              window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'CHAT_CLICKED',
                  chatId: chatId
              }));
            }
            });
          }
        });
        
        // Also handle chat items in list
        document.querySelectorAll('.hover\\\\:bg-gray-50, [class*="hover:bg-gray-50"]').forEach(item => {
          if (!item.dataset.intercepted && item.onclick) {
            item.dataset.intercepted = 'true';
            
            // Capture original onclick
            const originalOnClick = item.onclick;
            
            // Replace with our handler
            item.onclick = function(e) {
              // Try to get chat ID from href or onclick function
              const href = item.getAttribute('href') || '';
              const chatId = href.match(/\\/chat\\/([^\\/\\?]+)/)?.[1];
              
              if (chatId) {
                e.preventDefault();
                
                // Notify the native app
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'CHAT_CLICKED',
                  chatId: chatId
                }));
              } else {
                // Fall back to original handler
                return originalOnClick.call(this, e);
              }
            };
          }
        });
      }

      // Run the chat link interception immediately
      setTimeout(interceptChatLinks, 1000);
      setTimeout(interceptChatLinks, 3000);
      
      // Also run after a short delay to catch dynamically loaded images
      setTimeout(fixCloudinaryImages, 1000);
      setTimeout(fixCloudinaryImages, 3000);
    
    true;
    })();
  `;

  // Inject JavaScript to prevent redirects to signin when authenticated
  const preventAuthRedirectScript = `
    (function() {
      // Override window.location and history methods to intercept redirects
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      const originalAssign = window.location.assign;
      const originalReplace = window.location.replace;
      
      // Check if a URL is an auth page
      function isAuthUrl(url) {
        return url.includes('/auth/') || url.includes('/signin') || url.includes('/login');
      }
      
      // Block navigation to auth pages if we're already authenticated
      function shouldBlockNavigation(url) {
        // If we have tokens in localStorage, block auth redirects
        const hasToken = localStorage.getItem('token');
        const hasUser = localStorage.getItem('user');
        return hasToken && hasUser && isAuthUrl(url);
      }
      
      // Override pushState
      history.pushState = function() {
        const url = arguments[2];
        if (url && shouldBlockNavigation(url)) {
          console.log('Blocked redirect to auth page:', url);
          
          // Try to refresh current page with tokens instead
          if (localStorage.getItem('token')) {
            console.log('Attempting to reload current page with tokens');
            // Send message to React Native
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'REDIRECT_BLOCKED',
              destination: url,
              action: 'refresh'
            }));
            return;
          }
        }
        return originalPushState.apply(this, arguments);
      };
      
      // Override replaceState
      history.replaceState = function() {
        const url = arguments[2];
        if (url && shouldBlockNavigation(url)) {
          console.log('Blocked history replace to auth page:', url);
          return;
        }
        return originalReplaceState.apply(this, arguments);
      };
      
      // Override location.assign
      window.location.assign = function(url) {
        if (shouldBlockNavigation(url)) {
          console.log('Blocked location.assign to auth page:', url);
          return;
        }
        return originalAssign.call(window.location, url);
      };
      
      // Override location.replace
      window.location.replace = function(url) {
        if (shouldBlockNavigation(url)) {
          console.log('Blocked location.replace to auth page:', url);
          return;
        }
        return originalReplace.call(window.location, url);
      };
      
      // Monitor navigation attempts through links
      document.addEventListener('click', function(e) {
        // Check if click is on a link
        let target = e.target;
        while (target && target.tagName !== 'A') {
          target = target.parentElement;
        }
        
        if (target && target.href && shouldBlockNavigation(target.href)) {
          e.preventDefault();
          console.log('Blocked link click to auth page:', target.href);
        }
      }, true);
      
      console.log('Navigation protection installed');
    })();
  `;

  // Add new script to hide navbar
  const hideNavbarScript = `
    (function() {
      // Function to hide navbar and reclaim its space
      function hideNavbar() {
        // Find and hide the navbar element
        const navbar = document.querySelector('nav');
        if (navbar) {
          console.log('Found navbar, hiding it');
          navbar.style.display = 'none';
          
          // Also adjust the main content container to reclaim space
          const mainContent = document.querySelector('main');
          if (mainContent) {
            console.log('Adjusting main content to reclaim navbar space');
            mainContent.style.marginTop = '0';
            mainContent.style.paddingTop = '0';
          }
          
          // Look for container with mt-16 class (likely spacing for navbar)
          document.querySelectorAll('[class*="mt-16"]').forEach(element => {
            element.classList.remove('mt-16');
            element.classList.add('mt-0');
          });
          
          // Also adjust any fixed positioning that might be relative to navbar
          document.querySelectorAll('[class*="top-"]').forEach(element => {
            // Check if it's likely positioned relative to navbar
            if (element.classList.contains('top-14') || 
                element.classList.contains('top-16') || 
                element.classList.contains('top-20')) {
              element.style.top = '0';
            }
          });
        }
      }
      
      // Run immediately
      hideNavbar();
      
      // Also run after DOM changes in case navbar is loaded dynamically
      const observer = new MutationObserver(function() {
        hideNavbar();
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      // Run again after a delay to catch any late-rendered elements
      setTimeout(hideNavbar, 500);
      setTimeout(hideNavbar, 1500);
      
      console.log('Navbar hiding script installed');
      return true;
    })();
  `;

  // Create a more aggressive token injection that forces reload if needed
  const forceTokenInjection = `
    (function() {
      try {
        // Set tokens in localStorage
        localStorage.setItem('token', '${tokens.accessToken || ""}');
        localStorage.setItem('refreshToken', '${tokens.refreshToken || ""}');
        
        // Parse and store user data
        const userDataString = '${JSON.stringify(user || {})}';
        localStorage.setItem('user', userDataString);
        
        // Make user data globally available
        window.userData = JSON.parse(userDataString);
        
        // Check if we're on an auth page that we should redirect from
        const isAuthPage = window.location.pathname.includes('/auth/') || 
                           window.location.pathname.includes('/signin') || 
                           window.location.pathname.includes('/login');
        
        if (isAuthPage) {
          console.log('Detected auth page, redirecting to profile');
          window.location.replace('/profile');
          return true;
        }
        
        // Add global auth state
        window.isNativeAuthenticated = true;
        
        console.log('Tokens forcefully injected');
        return true;
      } catch(e) {
        console.error('Error in force token injection:', e);
        return false;
      }
    })();
  `;

  // Enhance injected JavaScript with specific profile page handling
  const profilePageScript = `
    (function() {
      // Check if we're on the profile page
      if (window.location.pathname === '/profile' || window.location.pathname.startsWith('/profile/')) {
        console.log('Profile page detected, applying fixes');
        
        // Ensure auth tokens are available
        if (!localStorage.getItem('token') || !localStorage.getItem('user')) {
          console.log('Missing auth tokens on profile page, applying tokens');
          localStorage.setItem('token', '${tokens.accessToken || ""}');
          localStorage.setItem('refreshToken', '${tokens.refreshToken || ""}');
          localStorage.setItem('user', '${JSON.stringify(user || {})}');
          
          // Force reload after setting tokens
          setTimeout(() => window.location.reload(), 100);
          return true;
        }
        
        // Monitor for auth redirects
        const checkInterval = setInterval(() => {
          // Check if we're somehow redirected to auth page
          if (window.location.pathname.includes('/auth/') || 
              window.location.pathname.includes('/signin') || 
              window.location.pathname.includes('/login')) {
            
            console.log('Detected redirect to auth page, forcing back to profile');
            clearInterval(checkInterval);
            
            // Re-apply tokens
            localStorage.setItem('token', '${tokens.accessToken || ""}');
            localStorage.setItem('refreshToken', '${tokens.refreshToken || ""}');
            localStorage.setItem('user', '${JSON.stringify(user || {})}');
            
            // Redirect back to profile
            window.location.replace('/profile');
          }
        }, 200);
        
        // Clean up interval after some time
        setTimeout(() => clearInterval(checkInterval), 10000);
      }
      return true;
    })();
  `;

  // Combine all injected scripts
  const injectInitialScripts = `
    ${preventAuthRedirectScript}
    ${hideNavbarScript}
    ${forceTokenInjection}
    ${profilePageScript}
    true;
  `;

  // Create a script specifically for loading profile page with authentication
  const profileAuthOverrideScript = `
    (function() {
      // Override AuthContext handling in the web app
      console.log("Installing auth override for profile page");

      // Override React hooks and contexts used for auth
      const installHookOverrides = () => {
        // First, save the original React hooks if they exist
        if (window.React) {
          console.log("Found React, installing hook overrides");
          
          // Save original useState
          const originalUseState = window.React.useState;
          
          // Override useState to intercept auth-related state
          window.React.useState = function(initialState) {
            // Check if this is likely an auth-related state
            if (
              // When initialState is an object with auth properties
              (initialState && 
               typeof initialState === 'object' && 
               (initialState.hasOwnProperty('isAuthenticated') || 
                initialState.hasOwnProperty('user') || 
                initialState.hasOwnProperty('token'))) ||
              // When it's the authLoading flag
              initialState === true
            ) {
              console.log("Intercepted likely auth state:", initialState);
              
              // Replace with authenticated state
              if (typeof initialState === 'object') {
                const authState = {
                  ...initialState,
                  isAuthenticated: true,
                  user: JSON.parse(localStorage.getItem('user') || '{}'),
                  token: localStorage.getItem('token'),
                  isLoading: false,
                  loading: false,
                  authLoading: false
                };
                return originalUseState(authState);
              } else if (initialState === true && 
                       (new Error().stack || "").includes("AuthContext") || 
                       (new Error().stack || "").includes("useAuth")) {
                // This is likely a loading state in AuthContext
                console.log("Intercepted auth loading state");
                return originalUseState(false);
              }
            }
            
            // Default behavior for non-auth state
            return originalUseState(initialState);
          };
          
          // Also save and override useEffect if needed
          const originalUseEffect = window.React.useEffect;
          
          // Override useEffect to prevent auth checks running on load
          window.React.useEffect = function(effect, deps) {
            // Check if this is likely an auth effect by examining the stack trace
            const stack = new Error().stack || "";
            
            if (stack.includes("AuthContext") || stack.includes("useAuth")) {
              console.log("Intercepted likely auth effect");
              
              // Wrap the effect to prevent redirects
              const wrappedEffect = () => {
                // Replace router.push if it's being used to redirect to signin
                const originalPush = window.router && window.router.push;
                if (originalPush) {
                  window.router.push = function(path, ...args) {
                    if (path.includes('signin') || path.includes('auth')) {
                      console.log("Blocked redirect to:", path);
                      return Promise.resolve(false);
                    }
                    return originalPush.call(window.router, path, ...args);
                  };
                }
                
                // Call the original effect
                return effect();
              };
              
              return originalUseEffect(wrappedEffect, deps);
            }
            
            // Default behavior for non-auth effects
            return originalUseEffect(effect, deps);
          };
        }
      };
      
      // Function to override authentication API
      const overrideAuthAPI = () => {
        // Create a fake auth API that always returns authenticated
        window.authAPI = {
          isAuthenticated: () => true,
          getUser: () => JSON.parse(localStorage.getItem('user') || '{}'),
          getToken: () => localStorage.getItem('token'),
          login: () => Promise.resolve(true),
          logout: () => {},
          checkAuth: () => Promise.resolve(true)
        };
        
        // Export globally for use by React components
        window.isAuthenticated = true;
        window.userData = JSON.parse(localStorage.getItem('user') || '{}');
      };
      
      // Monitor for React loading and apply overrides
      const checkForReact = setInterval(() => {
        if (window.React) {
          clearInterval(checkForReact);
          installHookOverrides();
        }
      }, 100);
      
      // Apply API overrides immediately
      overrideAuthAPI();
      
      // Also monitor for redirect attempts
      const originalPush = history.pushState;
      history.pushState = function() {
        const url = arguments[2];
        if (url && (url.includes('/auth/') || url.includes('/signin'))) {
          console.log("Blocked pushState to auth page:", url);
          return;
        }
        return originalPush.apply(this, arguments);
      };
      
      return true;
    })();
  `;

  // Function to handle Make Offer button on listing detail pages
  const handleMakeOfferScript = `
    (function() {
      try {
        console.log('Setting up Make Offer button handler');
        
        // Check if we're on a listing detail page
        if (window.location.pathname.match(/\\/listings\\/[^\\/]+\\/[^\\/]+/)) {
          console.log('On listing detail page, looking for Make Offer button');
          
          // Function to set up button handlers
          const setupMakeOfferButton = () => {
            document.querySelectorAll('button').forEach(btn => {
              if (btn.innerText && btn.innerText.includes('Make Offer') && !btn.dataset.handlerAdded) {
                console.log('Found Make Offer button, adding handler');
                btn.dataset.handlerAdded = 'true';
                
                // Add click handler
                btn.addEventListener('click', async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  console.log('Make Offer clicked, handling with custom script');
                  
                  // Get product ID from URL
                  const matches = window.location.pathname.match(/\\/listings\\/[^\\/]+\\/([^\\/]+)/);
                  const productId = matches ? matches[1] : null;
                  
                  if (!productId) {
                    console.error('Could not extract product ID from URL');
                    return;
                  }
                  
                  // Show loading state
                  const originalText = btn.innerText;
                  btn.innerText = 'Processing...';
                  btn.disabled = true;
                  
                  try {
                    // Make API call to create conversation
                    const API_URL = 'https://backend.listtra.com';
                    const token = localStorage.getItem('token');
                    
                    if (!token) {
                      console.error('No authentication token found');
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'AUTH_REQUIRED',
                        returnTo: window.location.pathname
                      }));
                      return;
                    }
                    
                    const response = await fetch(\`\${API_URL}/api/chat/conversations/\`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': \`Bearer \${token}\`
                      },
                      body: JSON.stringify({ listing: productId })
                    });
                    
                    if (!response.ok) {
                      throw new Error('Failed to create conversation');
                    }
                    
                    const data = await response.json();
                    console.log('Conversation created:', data);
                    
                    // Notify the native app to navigate to chat
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'NAVIGATE_CHAT',
                      chatId: data.id
                    }));
                  } catch (error) {
                    console.error('Error creating conversation:', error);
                    alert('Failed to start chat. Please try again.');
                  } finally {
                    // Restore button state
                    btn.innerText = originalText;
                    btn.disabled = false;
                  }
                });
              }
            });
          };
          
          // Run immediately and then on a small delay to catch dynamically added buttons
          setupMakeOfferButton();
          setTimeout(setupMakeOfferButton, 1000);
          setTimeout(setupMakeOfferButton, 2000);
        }
      } catch (error) {
        console.error('Error in Make Offer handler:', error);
      }
      return true;
    })();
  `;

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {error}
          </Text>
        </View>
      ) : (
        <>
          <WebView
            ref={webViewRef}
            source={{ uri: getAuthenticatedUrl(currentUrl) }}
            style={styles.webview}
            originWhitelist={['*']}
            domStorageEnabled={true}
            allowUniversalAccessFromFileURLs={true}
            javaScriptCanOpenWindowsAutomatically={true}
            onMessage={onMessage || handleWebViewMessage}
            javaScriptEnabled={true}
            startInLoadingState={true}
            cacheEnabled={true}
            cacheMode="LOAD_DEFAULT"
            mixedContentMode="always"
            injectedJavaScriptBeforeContentLoaded={`
              ${isAuthenticated ? `
                window.isNativeAuth = true;
                window.authToken = "${tokens.accessToken || ""}";
                window.refreshToken = "${tokens.refreshToken || ""}";
                window.userData = ${JSON.stringify(user || {})};
                // Add profile page specific overrides
                ${currentUrl.includes('/profile') ? profileAuthOverrideScript : ''}
              ` : ''}
              ${injectedJavaScript}
              true;
            `}
            onShouldStartLoadWithRequest={(request) => {
              // Block redirect to signin page if authenticated
              if (isAuthenticated && tokens.accessToken && 
                  (request.url.includes('/auth/signin') || 
                   request.url.includes('/login'))) {
                console.log('Blocking redirect to auth page:', request.url);
                // Inject tokens again
                setTimeout(() => {
                  injectTokensToWebView();
                  if (webViewRef.current) {
                    webViewRef.current.injectJavaScript(`
                      (function() {
                        if (window.location.pathname.includes('/auth/')) {
                          window.location.replace('/profile');
                        }
                        return true;
                      })();
                    `);
                  }
                }, 100);
                return false;
              }
              return true;
            }}
            onLoad={() => {
              setIsLoading(false);
              
              // When page loads, inject tokens if authenticated
              if (isAuthenticated && tokens.accessToken && tokens.refreshToken) {
                // Give time for page to fully initialize
                injectTokensToWebView();
                
                // Inject our combined scripts
                setTimeout(() => {
                  if (webViewRef.current) {
                    webViewRef.current.injectJavaScript(injectInitialScripts);
                    
                    // Also inject the custom script if provided
                    if (injectedJavaScript) {
                      webViewRef.current.injectJavaScript(injectedJavaScript);
                    }
                  }
                }, 300);
              }
            }}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              setError(`WebView error: ${nativeEvent.description}`);
              setIsLoading(false);
            }}
            onHttpError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              if (nativeEvent.statusCode >= 400) {
                setError(`Network error: ${nativeEvent.statusCode}`);
              }
              setIsLoading(false);
            }}
            onNavigationStateChange={handleNavigationStateChange}
            injectedJavaScript={baseInjectedJavaScript}
            sharedCookiesEnabled={true}
            allowsBackForwardNavigationGestures={true}
            pullToRefreshEnabled={true}
            thirdPartyCookiesEnabled={true}
          />

          {showLoader && isLoading && (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color="#4046F9" />
            </View>
          )}
        </>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: 'white',
  },
  loaderContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
});

export default WebViewScreen; 