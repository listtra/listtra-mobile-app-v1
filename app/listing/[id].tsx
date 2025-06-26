import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import WebViewScreen from '../../components/WebViewScreen';
import { useAuth } from '../../context/AuthContext';

export default function ListingDetailScreen() {
  const { isInitializing, user, tokens } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [listingData, setListingData] = useState<any>(null);
  
  useEffect(() => {
    // Fetch listing data to determine if user is the owner
    const fetchListingData = async () => {
      if (!id) return;
      
      try {
        setIsLoading(true);
        const url = `https://backend.listtra.com/api/listings/${id}/`;
        
        // Add auth header if user is logged in
        const headers = tokens.accessToken 
          ? { Authorization: `Bearer ${tokens.accessToken}` } 
          : {};
        
        const response = await axios.get(url, { headers });
        console.log('Fetched listing data:', response.data);
        setListingData(response.data);
      } catch (error) {
        console.error('Error fetching listing:', error);
        Alert.alert('Error', 'Could not load listing data');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchListingData();
  }, [id, tokens.accessToken]);
  
  // Wait for auth initialization before loading WebView
  if (isInitializing) {
    return <View style={styles.container} />;
  }

  // Determine if the current user is the owner of this listing
  const isOwner = user && listingData?.seller_id === user.id;
  
  // Construct the WebView URL
  let listingUrl = `https://listtra.com/listings/`;
  if (listingData?.slug) {
    listingUrl += `${listingData.slug}/${id}`;
  } else {
    listingUrl += id;
  }
  
  // Add isOwner parameter to help WebView script
  listingUrl += `?isOwner=${isOwner ? 'true' : 'false'}`;
  
  console.log('Rendering listing with URL:', listingUrl);
  console.log('User is owner:', isOwner);

  // Create injected JavaScript to handle the Make Offer button correctly
  const injectedJs = `
    (function() {
      console.log('Enhancing listing detail page for mobile');
      
      try {
        // Set owner status in global variable
        window.__isOwner = ${isOwner ? 'true' : 'false'};
        
        // Add classes to body for CSS targeting
        document.body.classList.add(${isOwner ? '"is-owner"' : '"is-buyer"'});
        
        // Handle Make Offer button if user is not the owner
        if (!${isOwner}) {
          // Function to set up Make Offer button
          const setupMakeOfferButton = () => {
            const makeOfferButtons = document.querySelectorAll('button');
            
            makeOfferButtons.forEach(btn => {
              if (btn.innerText && btn.innerText.includes('Make Offer') && !btn.dataset.handlerAdded) {
                console.log('Found Make Offer button, adding custom handler');
                btn.dataset.handlerAdded = 'true';
                
                // Add click handler
                btn.addEventListener('click', async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  console.log('Make Offer clicked, handling with custom script');
                  
                  // Get product ID from URL
                  const matches = window.location.pathname.match(/\\/listings\\/[^\\/]+\\/([^\\/]+)/);
                  const productId = matches ? matches[1] : window.location.pathname.split('/').pop();
                  
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
                }, true);
              }
            });
          };
          
          // Run immediately and then with delays to catch dynamically loaded buttons
          setupMakeOfferButton();
          setTimeout(setupMakeOfferButton, 1000);
          setTimeout(setupMakeOfferButton, 2000);
        }
      } catch(e) {
        console.error('Error in listing enhancement script:', e);
      }
      
      return true;
    })();
  `;

  return (
    <View style={styles.container}>
      <WebViewScreen 
        uri={listingUrl}
        showLoader={true}
        requiresAuth={false}
        injectedJavaScript={injectedJs}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
}); 