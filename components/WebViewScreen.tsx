// /Users/prejithp/Documents/jibin/listtra-mobile-app-v1/components/WebViewScreen.tsx

import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useAuth } from '../context/AuthContext';
import Constants from 'expo-constants';

type WebViewScreenProps = {
  uri: string;
  showLoader?: boolean;
  requiresAuth?: boolean;
  injectedJavaScript?: string;
  onMessage?: (event: WebViewMessageEvent) => void;
  onHttpError?: (syntheticEvent: any) => void;
  onNavigationStateChange?: (navState: any) => void;
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
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

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

  // Construct proper URL with tokens as query parameters
  const getAuthenticatedUrl = (baseUrl: string) => {
    if (!tokens.accessToken || !tokens.refreshToken) {
      return baseUrl;
    }

    try {
      const url = new URL(baseUrl);
      url.searchParams.append('access_token', tokens.accessToken);
      url.searchParams.append('refresh_token', tokens.refreshToken);
      url.searchParams.append('isNativeAuth', 'true');
      
      // Add user ID as a query parameter to ensure ownership check works
      if (user?.id) {
        url.searchParams.append('user_id', user.id.toString());
      }

      console.log('Constructed URL with tokens (redacted):', url.toString().replace(/(access_token|refresh_token)=([^&]+)/g, '$1=REDACTED'));
      return url.toString();
    } catch (e) {
      console.error('Error constructing URL:', e);
      return baseUrl;
    }
  };

  // Handle message from WebView
  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type !== 'AUTH_STATUS') {
        console.log('WebView message received:', data.type);
      }

      if (data.type === 'AUTH_VALIDATION_FAILED') {
        console.error('Token validation failed:', data.message);
        
        // Special handling for Expo Go
        if (Constants.executionEnvironment === 'storeClient') {
          console.log('Expo Go detected, attempting to continue without validation');
          setInitialLoadComplete(true);
          return;
        }
        
        logout();
        return;
      }

      if (data.type === 'AUTH_VALIDATION_SUCCESS') {
        console.log('Token validation successful');
        setInitialLoadComplete(true);
      }

      // Pass any messages to the parent component if handler provided
      if (onMessage) {
        onMessage(event);
      }
    } catch (err) {
      console.error('Error handling WebView message:', err);
      if (onMessage) {
        onMessage(event);
      }
    }
  };

  // Create a script to hide headers and inject user data
  const hideHeaderScript = `
  (function() {
    function applyStyles() {
      // Create a style element if it doesn't exist
      let style = document.getElementById('mobile-app-styles');
      if (!style) {
        style = document.createElement('style');
        style.id = 'mobile-app-styles';
        document.head.appendChild(style);
      }

      // Comprehensive styling to remove headers and their spacing
      style.textContent = \`
        /* Hide all potential header elements */
        nav, 
        header,
        .navbar,
        .nav-container, 
        .header-container,
        .search-container,
        .menu-container,
        [role="navigation"],
        .top-bar,
        .site-header,
        .app-header,
        .main-header,
        .navigation,
        .search-bar,
        div[class*="header"],
        div[class*="navbar"],
        div[class*="nav-container"],
        div[class*="navigation"] {
          display: none !important;
          height: 0 !important;
          min-height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          visibility: hidden !important;
          opacity: 0 !important;
        }
        
        /* Fix spacing for main content */
        body, 
        #__next,
        main, 
        .main-content, 
        .container,
        div[class*="content"],
        div[class*="main"],
        div[class*="container"] {
          padding-top: 0 !important;
          margin-top: 0 !important;
        }
      \`;

      // Find any fixed/absolute positioned elements at the top that might be headers
      document.querySelectorAll('*').forEach(el => {
        const style = window.getComputedStyle(el);
        if ((style.position === 'fixed' || style.position === 'absolute') && 
            parseInt(style.top) === 0) {
          el.style.display = 'none';
        }
      });
    }

    // Apply styles immediately
    applyStyles();
    setTimeout(applyStyles, 300);
    setTimeout(applyStyles, 1000);
    
    // Set up observer for any DOM changes
    const observer = new MutationObserver(() => {
      applyStyles();
    });
    
    if (document.readyState === 'complete') {
      observer.observe(document.body, { 
        childList: true, 
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class'] 
      });
    } else {
      window.addEventListener('load', () => {
        observer.observe(document.body, { 
          childList: true, 
          subtree: true,
          attributes: true,
          attributeFilter: ['style', 'class']
        });
      });
    }
    
    true;
  })();
`;

const fixImagesScript = `
(function() {
  // Keep track of fixed images to avoid infinite loops
  const fixedImages = new Set();
  
  // Fix image loading issues
  function fixImages() {
    console.log('Running fixImages');
    const images = document.querySelectorAll('img');
    
    images.forEach(img => {
      const imgSrc = img.getAttribute('src');
      
      // Skip already processed images
      if (fixedImages.has(imgSrc)) return;
      fixedImages.add(imgSrc);
      
      // Log for debugging
      console.log('Processing image:', imgSrc);
      
      // Add error handler
      img.onerror = function() {
        console.log('Image failed to load:', this.src);
        
        // Try to fix backend URLs
        if (this.src.includes('backend.listtra.com')) {
          const originalSrc = this.src;
          // Extract the path from the backend URL
          const path = new URL(this.src).pathname;
          
          // Try direct Cloudinary URL if it contains 'cloudinary'
          if (path.includes('cloudinary')) {
            // Extract the Cloudinary ID from the URL
            const matches = path.match(/upload\\/([^\\/]+)\\/(.+)/);
            if (matches && matches.length >= 3) {
              const transformations = matches[1];
              const imageId = matches[2];
              this.src = \`https://res.cloudinary.com/dn1fp5v93/image/upload/\${transformations}/\${imageId}\`;
              console.log('Fixed Cloudinary URL:', this.src);
              return;
            }
          }
          
          // If not a Cloudinary URL or couldn't extract ID, try with CORS proxy
          this.src = \`https://api.allorigins.win/raw?url=\${encodeURIComponent(originalSrc)}\`;
          console.log('Using CORS proxy for image:', this.src);
        } 
        // If still failing, use placeholder
        else if (!this.src.includes('placeholder')) {
          this.src = "https://res.cloudinary.com/dn1fp5v93/image/upload/w_300,q_80,f_auto/v1/placeholder-image";
          console.log('Using placeholder image');
        }
      };
      
      // Fix relative URLs
      if (imgSrc && imgSrc.startsWith('/')) {
        const newSrc = window.location.origin + imgSrc;
        console.log('Fixed relative URL:', imgSrc, '->', newSrc);
        img.src = newSrc;
      }
      
      // Fix Cloudinary URLs directly
      if (imgSrc && imgSrc.includes('backend.listtra.com') && imgSrc.includes('cloudinary')) {
        // Try to extract the Cloudinary path
        const url = new URL(imgSrc);
        const path = url.pathname;
        const matches = path.match(/upload\\/([^\\/]+)\\/(.+)/);
        
        if (matches && matches.length >= 3) {
          const transformations = matches[1];
          const imageId = matches[2];
          const newSrc = \`https://res.cloudinary.com/dn1fp5v93/image/upload/\${transformations}/\${imageId}\`;
          console.log('Pre-emptively fixed Cloudinary URL:', imgSrc, '->', newSrc);
          img.src = newSrc;
        }
      }
    });
    
    // Also fix background images in CSS
    document.querySelectorAll('[style*="background-image"]').forEach(el => {
      const style = window.getComputedStyle(el);
      const bgImage = style.backgroundImage;
      
      if (bgImage && bgImage.includes('url(')) {
        // Extract the URL
        const urlMatch = bgImage.match(/url\\(['"]?([^'"\\)]+)['"]?\\)/);
        if (urlMatch && urlMatch[1]) {
          const imgUrl = urlMatch[1];
          
          // Skip already processed
          if (fixedImages.has(imgUrl)) return;
          fixedImages.add(imgUrl);
          
          console.log('Processing background image:', imgUrl);
          
          // Fix relative URLs
          if (imgUrl.startsWith('/')) {
            const newUrl = window.location.origin + imgUrl;
            el.style.backgroundImage = \`url("\${newUrl}")\`;
            console.log('Fixed relative background URL:', imgUrl, '->', newUrl);
          }
          
          // Fix backend URLs
          if (imgUrl.includes('backend.listtra.com') && imgUrl.includes('cloudinary')) {
            // Try to extract the Cloudinary path
            try {
              const url = new URL(imgUrl);
              const path = url.pathname;
              const matches = path.match(/upload\\/([^\\/]+)\\/(.+)/);
              
              if (matches && matches.length >= 3) {
                const transformations = matches[1];
                const imageId = matches[2];
                const newUrl = \`https://res.cloudinary.com/dn1fp5v93/image/upload/\${transformations}/\${imageId}\`;
                el.style.backgroundImage = \`url("\${newUrl}")\`;
                console.log('Fixed Cloudinary background URL:', imgUrl, '->', newUrl);
              }
            } catch (e) {
              console.error('Error fixing background URL:', e);
            }
          }
        }
      }
    });
  }
  
  // Add global error handler for images
  window.addEventListener('error', function(e) {
    if (e.target.tagName === 'IMG') {
      console.log('Global image error handler:', e.target.src);
      e.preventDefault(); // Prevent default error
    }
  }, true);
  
  // Run immediately and periodically
  fixImages();
  setInterval(fixImages, 2000);
  
  // Also run when DOM changes
  const observer = new MutationObserver((mutations) => {
    let shouldFix = false;
    mutations.forEach(mutation => {
      if (mutation.type === 'childList' || 
          (mutation.type === 'attributes' && mutation.attributeName === 'src')) {
        shouldFix = true;
      }
    });
    
    if (shouldFix) {
      setTimeout(fixImages, 100);
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'style']
  });
  
  // Also inject a function to fix the ListingCard component's image handling
  window.fixListingCardImages = function() {
    console.log('Fixing ListingCard images');
    // Find all image error placeholders
    document.querySelectorAll('.w-full.h-full.flex.items-center.justify-center').forEach(placeholder => {
      // Check if it's a "No Image Available" placeholder
      if (placeholder.textContent.includes('No Image Available')) {
        // Find the parent link to get the listing ID
        const parentLink = placeholder.closest('a[href^="/listings/"]');
        if (parentLink) {
          const href = parentLink.getAttribute('href');
          console.log('Found No Image placeholder for listing:', href);
          
          // Try to inject a direct Cloudinary placeholder
          const img = document.createElement('img');
          img.src = "https://res.cloudinary.com/dn1fp5v93/image/upload/w_300,q_80,f_auto/v1/placeholder-image";
          img.className = "w-full h-full object-cover";
          img.alt = "Listing Image";
          
          // Replace the placeholder with the image
          placeholder.innerHTML = '';
          placeholder.appendChild(img);
          console.log('Replaced No Image placeholder with Cloudinary image');
        }
      }
    });
  };
  
  // Run the ListingCard fix periodically
  setInterval(window.fixListingCardImages, 1000);
  
  // Run once on load
  if (document.readyState === 'complete') {
    window.fixListingCardImages();
  } else {
    window.addEventListener('load', window.fixListingCardImages);
  }
})();
`;



  // Handle navigation state changes with improved logic
  const handleNavigationStateChange = (navState: any) => {
    if (navState.url !== currentUrl) {
      console.log('Navigation state change:', navState.url);
      setCurrentUrl(navState.url);
      
      if (onNavigationStateChange) {
        onNavigationStateChange(navState);
      }
    }
  };

  // Create final URL with tokens if authenticated
  const finalUrl = isAuthenticated && tokens.accessToken && tokens.refreshToken
    ? getAuthenticatedUrl(uri)
    : uri;

  // Combine any existing injectedJavaScript with our header-hiding script
  const combinedScript = injectedJavaScript
  ? `${injectedJavaScript}\n${hideHeaderScript}\n${fixImagesScript}`
  : `${hideHeaderScript}\n${fixImagesScript}`;

  return (
    <View style={{ flex: 1 }}>
      <WebView
        ref={webViewRef}
        source={{ uri: finalUrl }}
        style={{ flex: 1 }}
        onLoad={() => {
          setIsLoading(false);
          setInitialLoadComplete(true);
        }}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          setError(`WebView error: ${nativeEvent.description}`);
          if (onHttpError) onHttpError(syntheticEvent);
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          setError(`HTTP error: ${nativeEvent.statusCode}`);
          if (onHttpError) onHttpError(syntheticEvent);
        }}
        onNavigationStateChange={handleNavigationStateChange}
        onMessage={handleMessage}
        injectedJavaScript={combinedScript}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        cacheEnabled={true}
        thirdPartyCookiesEnabled={true}
        sharedCookiesEnabled={true}
        originWhitelist={['*']}
        mixedContentMode="always"
        allowsInlineMediaPlayback={true}
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
      />
      {isLoading && showLoader && (
        <View style={StyleSheet.absoluteFill}>
          <ActivityIndicator size="large" color="#0000ff" style={{ flex: 1 }} />
        </View>
      )}
      {error && <Text style={{ padding: 10, color: 'red' }}>{error}</Text>}
    </View>
  );
});

export default WebViewScreen;