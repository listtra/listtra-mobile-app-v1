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
  onHttpError?: (syntheticEvent: any) => void;
  onNavigationStateChange?:(navState:any) => void;

};

const WebViewScreen = React.forwardRef<{ injectJavaScript: (script: string) => void; reload: () => void }, WebViewScreenProps>(({ 
  uri, 
  showLoader = true,
  requiresAuth = false,
  injectedJavaScript = '',
  onMessage,
  onHttpError,
  onNavigationStateChange
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
    if (baseUrl.includes('isNativeAuth=true')) {
      return baseUrl;
    }
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
          console.log('Setting auth tokens in web app localStorage');
          localStorage.setItem('token', '${tokens.accessToken}');
          localStorage.setItem('refreshToken', '${tokens.refreshToken}');
          const userDataString = '${JSON.stringify(user)}';
          const userData = JSON.parse(userDataString);
          console.log('Setting user data:', userData);
          localStorage.setItem('user', userDataString);
          window.userData = userData;
          if (window.location.pathname.includes('/chat/')) {
            console.log('On chat page, enhancing token access');
            const loadingElements = document.querySelectorAll('.animate-spin, .loading');
            console.log('Found loading elements:', loadingElements.length);
            setTimeout(() => {
              loadingElements.forEach(el => {
                console.log('Removing loading element:', el);
                el.remove();
              });
            }, 2000);
          }
          window.checkIsOwner = function(sellerId) {
            const user = window.userData || JSON.parse(localStorage.getItem('user') || 'null');
            const isOwner = user && user.id === sellerId;
            console.log('Ownership check:', { userId: user?.id, sellerId, isOwner });
            return isOwner;
          };
          if (window.updateAuthContext) {
            window.updateAuthContext(userData, '${tokens.accessToken}', '${tokens.refreshToken}');
            console.log('Updated AuthContext using global handler');
          }
          return true;
        } catch (error) {
          console.error('Error in token injection:', error);
          return false;
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
    if (navState.url === currentUrl) {
      return;
    }
    
    console.log('Navigation state change:', navState.url);
    setCurrentUrl(navState.url);
    
    if (navState.url.includes('/auth/signin') && isAuthenticated && tokens.accessToken) {
      console.log('Detected redirect to sign-in while authenticated, injecting tokens and redirecting back');
      
      setTimeout(() => {
        if (webViewRef.current) {
          const redirectScript = `
            (function() {
              try {
                console.log('Injecting tokens and redirecting from sign-in page');
                localStorage.setItem('token', '${tokens.accessToken}');
                localStorage.setItem('refreshToken', '${tokens.refreshToken}');
                localStorage.setItem('user', '${JSON.stringify(user || {})}');
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
    
    if (navState.url.includes('/chat/') && navState.url.includes('listtra.com')) {
      console.log('Detected chat detail page, injecting tokens immediately');
      setTimeout(() => {
        if (isAuthenticated && tokens.accessToken) {
          injectTokensToWebView();
        }
      }, 300);
    }
  };

  // Add the optimized chat enhancement script
  useEffect(() => {
    if (!webViewRef.current || isLoading) return;
    
    console.log('Checking if page-specific scripts need to be injected for:', currentUrl);
    
    const injectWithDelay = (script: string, delay: number = 1000) => {
      setTimeout(() => {
        if (webViewRef.current) {
          console.log('Injecting script after delay');
          webViewRef.current.injectJavaScript(script);
        }
      }, delay);
    };
    
    injectWithDelay(hideNavbarScript, 800);
    
    if (currentUrl.includes('/chat/')) {
      console.log('Chat page detected, preparing chat scripts');
      
      const enhanceChatScript = `
        (function() {
          if (window.__chatScriptApplied) {
            console.log('Chat script already applied, skipping');
            return true;
          }
          
          try {
            console.log('Running optimized chat enhancement script');
            window.__chatScriptApplied = true;
            
            const detectUserRole = () => {
              const urlParams = new URLSearchParams(window.location.search);
              const isBuyerParam = urlParams.get('isBuyer');
              if (isBuyerParam !== null) {
                const isBuyer = isBuyerParam === 'true';
                console.log('Using isBuyer parameter:', isBuyer);
                setUserRole(isBuyer);
                return;
              }
              
              try {
                const userData = JSON.parse(localStorage.getItem('user') || '{}');
                const userID = userData.id;
                
                if (!userID) {
                  console.warn('No user ID found, defaulting to buyer view');
                  setUserRole(true);
                  return;
                }
                
                const hasSellerControls = !!document.querySelector('button[class*="bg-green"]') || 
                                        !!document.querySelector('button[class*="bg-red"]');
                
                setUserRole(!hasSellerControls);
              } catch (e) {
                console.error('Error detecting role:', e);
                setUserRole(true);
              }
            };
            
            const setUserRole = (isBuyer) => {
              console.log('Setting user role:', isBuyer ? 'Buyer' : 'Seller');
              document.body.classList.add(isBuyer ? 'is-buyer' : 'is-seller');
              window.__isBuyer = isBuyer;
              
              const styleId = 'chat-role-styles';
              if (!document.getElementById(styleId)) {
                const style = document.createElement('style');
                style.id = styleId;
                style.textContent = \`
                  body.is-buyer .flex.gap-3.justify-center.mt-1 { display: none !important; }
                  body.is-seller .mt-2:has(input[type="number"]) { display: none !important; }
                \`;
                document.head.appendChild(style);
              }
            };
            
            setTimeout(detectUserRole, 500);
            
            let debounceTimeout = null;
            const observer = new MutationObserver(() => {
              if (debounceTimeout) clearTimeout(debounceTimeout);
              debounceTimeout = setTimeout(() => {
                const needsUpdate = !document.body.classList.contains('is-buyer') && 
                                  !document.body.classList.contains('is-seller');
                if (needsUpdate) {
                  detectUserRole();
                }
              }, 500);
            });
            
            observer.observe(document.body, {
              attributes: true,
              attributeFilter: ['class']
            });
            
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
      
      injectWithDelay(enhanceChatScript, 1500);
    } else if (currentUrl.includes('/listings/')) {
      console.log('Listing page detected, preparing listing scripts');
      
      const enhanceListingScript = `
        (function() {
          try {
            console.log('Running listing enhancement script');
            
            const setupMakeOfferButton = () => {
              document.querySelectorAll('button').forEach(btn => {
                if (btn.innerText && btn.innerText.includes('Make Offer') && !btn.dataset.handlerAdded) {
                  console.log('Found Make Offer button, adding handler');
                  btn.dataset.handlerAdded = 'true';
                  
                  btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    console.log('Make Offer clicked, handling with custom script');
                    
                    const matches = window.location.pathname.match(/\\/listings\\/[^\\/]+\\/([^\\/]+)/);
                    const productId = matches ? matches[1] : null;
                    
                    if (!productId) {
                      console.error('Could not extract product ID from URL');
                      return;
                    }
                    
                    const originalText = btn.innerText;
                    btn.innerText = 'Processing...';
                    btn.disabled = true;
                    
                    try {
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
                      
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'NAVIGATE_CHAT',
                        chatId: data.id
                      }));
                    } catch (error) {
                      console.error('Error creating conversation:', error);
                      alert('Failed to start chat. Please try again.');
                    } finally {
                      btn.innerText = originalText;
                      btn.disabled = false;
                    }
                  });
                }
              });
            };
            
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

  const baseInjectedJavaScript = `
    (function() {
      function fixCloudinaryImages() {
        const images = document.querySelectorAll('img[src*="res.cloudinary.com"]');
        images.forEach(img => {
          if (img.src.startsWith('http://')) {
            img.src = img.src.replace('http://', 'https://');
          }
          img.loading = 'lazy';
          img.onerror = function() {
            console.error('Failed to load image:', img.src);
            if (!img.retried) {
              img.retried = true;
              img.src = img.src.replace('https://', 'http://');
            }
          };
        });
      }

      fixCloudinaryImages();
      const observer = new MutationObserver(fixCloudinaryImages);
      observer.observe(document.body, { childList: true, subtree: true });
      
      function interceptChatLinks() {
        document.querySelectorAll('a[href^="/chat/"]').forEach(link => {
          if (!link.dataset.intercepted) {
            link.dataset.intercepted = 'true';
            link.addEventListener('click', function(e) {
              const chatId = link.href.match(/\\/chat\\/([^\\/\\?]+)/)?.[1];
              if (chatId) {
                e.preventDefault();
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'CHAT_CLICKED',
                  chatId: chatId
                }));
              }
            });
          }
        });
        
        document.querySelectorAll('.hover\\\\:bg-gray-50, [class*="hover:bg-gray-50"]').forEach(item => {
          if (!item.dataset.intercepted && item.onclick) {
            item.dataset.intercepted = 'true';
            const originalOnClick = item.onclick;
            item.onclick = function(e) {
              const href = item.getAttribute('href') || '';
              const chatId = href.match(/\\/chat\\/([^\\/\\?]+)/)?.[1];
              if (chatId) {
                e.preventDefault();
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'CHAT_CLICKED',
                  chatId: chatId
                }));
              } else {
                return originalOnClick.call(this, e);
              }
            };
          }
        });
      }

      setTimeout(interceptChatLinks, 1000);
      setTimeout(interceptChatLinks, 3000);
      setTimeout(fixCloudinaryImages, 1000);
      setTimeout(fixCloudinaryImages, 3000);
      
      return true;
    })();
  `;

  const preventAuthRedirectScript = `
    (function() {
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      const originalAssign = window.location.assign;
      const originalReplace = window.location.replace;
      
      function isAuthUrl(url) {
        return url.includes('/auth/') || url.includes('/signin') || url.includes('/login');
      }
      
      function shouldBlockNavigation(url) {
        const hasToken = localStorage.getItem('token');
        const hasUser = localStorage.getItem('user');
        return hasToken && hasUser && isAuthUrl(url);
      }
      
      history.pushState = function() {
        const url = arguments[2];
        if (url && shouldBlockNavigation(url)) {
          console.log('Blocked redirect to auth page:', url);
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'REDIRECT_BLOCKED',
            destination: url,
            action: 'refresh'
          }));
          return;
        }
        return originalPushState.apply(this, arguments);
      };
      
      history.replaceState = function() {
        const url = arguments[2];
        if (url && shouldBlockNavigation(url)) {
          console.log('Blocked history replace to auth page:', url);
          return;
        }
        return originalReplaceState.apply(this, arguments);
      };
      
      window.location.assign = function(url) {
        if (shouldBlockNavigation(url)) {
          console.log('Blocked location.assign to auth page:', url);
          return;
        }
        return originalAssign.call(window.location, url);
      };
      
      window.location.replace = function(url) {
        if (shouldBlockNavigation(url)) {
          console.log('Blocked location.replace to auth page:', url);
          return;
        }
        return originalReplace.call(window.location, url);
      };
      
      document.addEventListener('click', function(e) {
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
      return true;
    })();
  `;

  const hideNavbarScript = `
    (function() {
      function hideNavbar() {
        const navbar = document.querySelector('nav');
        if (navbar) {
          console.log('Found navbar, hiding it');
          navbar.style.display = 'none';
          const mainContent = document.querySelector('main');
          if (mainContent) {
            console.log('Adjusting main content to reclaim navbar space');
            mainContent.style.marginTop = '0';
            mainContent.style.paddingTop = '0';
          }
          document.querySelectorAll('[class*="mt-16"]').forEach(element => {
            element.classList.remove('mt-16');
            element.classList.add('mt-0');
          });
          document.querySelectorAll('[class*="top-"]').forEach(element => {
            if (element.classList.contains('top-14') || 
                element.classList.contains('top-16') || 
                element.classList.contains('top-20')) {
              element.style.top = '0';
            }
          });
        }
      }
      
      hideNavbar();
      const observer = new MutationObserver(hideNavbar);
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(hideNavbar, 500);
      setTimeout(hideNavbar, 1500);
      
      console.log('Navbar hiding script installed');
      return true;
    })();
  `;

  const forceTokenInjection = `
    (function() {
      try {
        localStorage.setItem('token', '${tokens.accessToken || ""}');
        localStorage.setItem('refreshToken', '${tokens.refreshToken || ""}');
        const userDataString = '${JSON.stringify(user || {})}';
        localStorage.setItem('user', userDataString);
        window.userData = JSON.parse(userDataString);
        const isAuthPage = window.location.pathname.includes('/auth/') || 
                           window.location.pathname.includes('/signin') || 
                           window.location.pathname.includes('/login');
        if (isAuthPage) {
          console.log('Detected auth page, redirecting to profile');
          window.location.replace('/profile');
          return true;
        }
        window.isNativeAuthenticated = true;
        console.log('Tokens forcefully injected');
        return true;
      } catch(e) {
        console.error('Error in force token injection:', e);
        return false;
      }
    })();
  `;

  const profilePageScript = `
    (function() {
      if (window.location.pathname === '/profile' || window.location.pathname.startsWith('/profile/')) {
        console.log('Profile page detected, applying fixes');
        
        if (!localStorage.getItem('token') || !localStorage.getItem('user')) {
          console.log('Missing auth tokens on profile page, applying tokens');
          localStorage.setItem('token', '${tokens.accessToken || ""}');
          localStorage.setItem('refreshToken', '${tokens.refreshToken || ""}');
          localStorage.setItem('user', '${JSON.stringify(user || {})}');
          setTimeout(() => window.location.reload(), 100);
          return true;
        }
        
        const checkInterval = setInterval(() => {
          if (window.location.pathname.includes('/auth/') || 
              window.location.pathname.includes('/signin') || 
              window.location.pathname.includes('/login')) {
            console.log('Detected redirect to auth page, forcing back to profile');
            clearInterval(checkInterval);
            localStorage.setItem('token', '${tokens.accessToken || ""}');
            localStorage.setItem('refreshToken', '${tokens.refreshToken || ""}');
            localStorage.setItem('user', '${JSON.stringify(user || {})}');
            window.location.replace('/profile');
          }
        }, 200);
        
        setTimeout(() => clearInterval(checkInterval), 10000);
      }
      return true;
    })();
  `;

  const injectInitialScripts = `
    ${preventAuthRedirectScript}
    ${hideNavbarScript}
    ${forceTokenInjection}
    ${profilePageScript}
    true;
  `;

  const profileAuthOverrideScript = `
    (function() {
      console.log("Installing auth override for profile page");
      const installHookOverrides = () => {
        if (window.React) {
          console.log("Found React, installing hook overrides");
          const originalUseState = window.React.useState;
          window.React.useState = function(initialState) {
            if (
              (initialState && 
               typeof initialState === 'object' && 
               (initialState.hasOwnProperty('isAuthenticated') || 
                initialState.hasOwnProperty('user') || 
                initialState.hasOwnProperty('token'))) ||
              (initialState === true && 
               (new Error().stack || "").includes("AuthContext") || 
               (new Error().stack || "").includes("useAuth"))
            ) {
              console.log("Intercepted likely auth state:", initialState);
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
              } else if (initialState === true) {
                console.log("Intercepted auth loading state");
                return originalUseState(false);
              }
            }
            return originalUseState(initialState);
          };
          const originalUseEffect = window.React.useEffect;
          window.React.useEffect = function(effect, deps) {
            const stack = new Error().stack || "";
            if (stack.includes("AuthContext") || stack.includes("useAuth")) {
              console.log("Intercepted likely auth effect");
              const wrappedEffect = () => {
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
                return effect();
              };
              return originalUseEffect(wrappedEffect, deps);
            }
            return originalUseEffect(effect, deps);
          };
        }
      };
      const overrideAuthAPI = () => {
        window.authAPI = {
          isAuthenticated: () => true,
          getUser: () => JSON.parse(localStorage.getItem('user') || '{}'),
          getToken: () => localStorage.getItem('token'),
          login: () => Promise.resolve(true),
          logout: () => {},
          checkAuth: () => Promise.resolve(true)
        };
        window.isAuthenticated = true;
        window.userData = JSON.parse(localStorage.getItem('user') || '{}');
      };
      const checkForReact = setInterval(() => {
        if (window.React) {
          clearInterval(checkForReact);
          installHookOverrides();
        }
      }, 100);
      overrideAuthAPI();
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

  const handleMakeOfferScript = `
    (function() {
      try {
        console.log('Setting up Make Offer button handler');
        if (window.location.pathname.match(/\\/listings\\/[^\\/]+\\/[^\\/]+/)) {
          console.log('On listing detail page, looking for Make Offer button');
          const setupMakeOfferButton = () => {
            document.querySelectorAll('button').forEach(btn => {
              if (btn.innerText && btn.innerText.includes('Make Offer') && !btn.dataset.handlerAdded) {
                console.log('Found Make Offer button, adding handler');
                btn.dataset.handlerAdded = 'true';
                btn.addEventListener('click', async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Make Offer clicked, handling with custom script');
                  const matches = window.location.pathname.match(/\\/listings\\/[^\\/]+\\/([^\\/]+)/);
                  const productId = matches ? matches[1] : null;
                  if (!productId) {
                    console.error('Could not extract product ID from URL');
                    return;
                  }
                  const originalText = btn.innerText;
                  btn.innerText = 'Processing...';
                  btn.disabled = true;
                  try {
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
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'NAVIGATE_CHAT',
                      chatId: data.id
                    }));
                  } catch (error) {
                    console.error('Error creating conversation:', error);
                    alert('Failed to start chat. Please try again.');
                  } finally {
                    btn.innerText = originalText;
                    btn.disabled = false;
                  }
                });
              }
            });
          };
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
            onMessage={onMessage}
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
                ${currentUrl.includes('/profile') ? profileAuthOverrideScript : ''}
              ` : ''}
              ${injectedJavaScript}
              true;
            `}
            onShouldStartLoadWithRequest={(request) => {
              if (isAuthenticated && tokens.accessToken && 
                  (request.url.includes('/auth/signin') || 
                   request.url.includes('/login'))) {
                console.log('Blocking redirect to auth page:', request.url);
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
              if (isAuthenticated && tokens.accessToken && tokens.refreshToken) {
                injectTokensToWebView();
                setTimeout(() => {
                  if (webViewRef.current) {
                    webViewRef.current.injectJavaScript(injectInitialScripts);
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
            onHttpError={onHttpError}
            onNavigationStateChange={onNavigationStateChange}
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