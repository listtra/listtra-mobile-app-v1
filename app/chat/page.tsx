import { Feather, Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Linking,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';

// Debug flag to show detailed logging
const DEBUG_MODE = false;

export default function ChatListScreen() {
  const { isInitializing, user, tokens, isAuthenticated } = useAuth();
  const params = useLocalSearchParams();
  const listingId = params.listing as string;
  const router = useRouter();
  const [conversations, setConversations] = useState<any[]>([]);
  const [listing, setListing] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState('Initializing...');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Log key information at component mount
  useEffect(() => {
    console.log('ChatListScreen mounted');
    console.log('Auth state:', { 
      isInitializing, 
      isAuthenticated, 
      userId: user?.id,
      hasTokens: !!tokens?.accessToken
    });
    console.log('Listing ID from params:', listingId);
    
    // Check app environment
    console.log('Platform:', Platform.OS);
    console.log('Expo environment:', process.env.NODE_ENV);
  }, []);
  
  // Open the web chat page in browser as a fallback
  const openWebChatInBrowser = () => {
    const url = listingId 
      ? `https://listtra.com/chat?listing=${listingId}` 
      : 'https://listtra.com/chat';
    
    Linking.openURL(url)
      .then(() => console.log('Browser opened with URL:', url))
      .catch(err => console.error('Failed to open browser:', err));
  };
  
  // Test the API connection (simplified)
  const testApiConnection = async () => {
    try {
      const response = await axios.get('https://backend.listtra.com/api/health-check');
      Alert.alert('API Connection Test', `Status: ${response.status}\nData: ${JSON.stringify(response.data)}`);
    } catch (error: any) {
      Alert.alert('API Connection Failed', `Error: ${error.message}`);
    }
  };
  
  // Test the auth token
  const testAuthToken = async () => {
    if (!tokens?.accessToken) {
      Alert.alert('No Auth Token', 'You are not logged in');
      return;
    }
    
    try {
      const response = await axios.get('https://backend.listtra.com/api/users/me/', {
        headers: { Authorization: `Bearer ${tokens.accessToken}` }
      });
      
      Alert.alert(
        'Auth Token Test', 
        `Status: ${response.status}\nUser ID: ${response.data.id}\nEmail: ${response.data.email}`
      );
    } catch (error: any) {
      Alert.alert(
        'Auth Token Test Failed', 
        `Error: ${error.message}\nStatus: ${error.response?.status || 'Unknown'}`
      );
    }
  };
  
  // Function to fetch conversation data
  const fetchConversations = async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true);
    } else {
      setIsLoading(true);
    }
    
    // Check if user is authenticated
    if (!isAuthenticated || !tokens?.accessToken) {
      console.log('User not authenticated, showing error');
      setError('Please sign in to view your chats');
      setIsLoading(false);
      setRefreshing(false);
      return;
    }
    
    try {
      setLoadingStep('Setting up request...');
      console.log('Fetching data with token:', tokens.accessToken.substring(0, 15) + '...');
      
      // Simple headers
      const headers = {
        Authorization: `Bearer ${tokens.accessToken}`
      };
      
      // First verify token with a simple request
      setLoadingStep('Verifying authentication...');
      console.log('Verifying user auth...');
      
      try {
        const userCheck = await axios.get('https://backend.listtra.com/api/users/me/', { 
          headers,
          timeout: 5000 // 5 second timeout
        });
        console.log('User verification successful:', userCheck.data.id);
      } catch (error: any) {
        console.error('User verification failed:', error.message);
        throw new Error(`Authentication verification failed: ${error.message}`);
      }
      
      // Fetch listing first if needed
      if (listingId) {
        setLoadingStep('Loading listing details...');
        console.log('Fetching listing:', listingId);
        
        const listingResponse = await axios.get(
          `https://backend.listtra.com/api/listings/${listingId}/`, 
          {
            headers,
            timeout: 5000
          }
        );
        
        setListing(listingResponse.data);
        console.log('Listing fetched successfully:', listingResponse.data.title);
      }
      
      // Fetch conversations
      setLoadingStep('Loading conversations...');
      console.log('Fetching conversations...');
      
      const conversationsResponse = await axios.get(
        'https://backend.listtra.com/api/chat/conversations/', 
        {
          headers,
          timeout: 8000
        }
      );
      
      console.log('Conversations fetched:', conversationsResponse.data.length);
      
      // Filter conversations if needed
      let filteredConversations = conversationsResponse.data;
      
      if (listingId) {
        console.log('Filtering conversations for listing:', listingId);
        filteredConversations = filteredConversations.filter(
          (conv: any) => conv.listing?.product_id === listingId
        );
        console.log('Filtered conversations count:', filteredConversations.length);
      }
      
      setConversations(filteredConversations);
      setError(null);
    } catch (error: any) {
      console.error('Error fetching chat data:', error);
      setError(`Failed to load: ${error.message}`);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };
  
  // Initial data fetch
  useEffect(() => {
    // Skip if auth is still initializing
    if (isInitializing) {
      console.log('Auth still initializing, waiting...');
      return;
    }
    
    console.log('Starting data fetch, auth initialized');
    
    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;
    
    // Set timeout to avoid infinite loading
    timeoutId = setTimeout(() => {
      if (isMounted && isLoading) {
        console.log('Loading timeout reached');
        setError('Loading took too long. Please try again.');
        setIsLoading(false);
      }
    }, 15000);
    
    fetchConversations();
    
    return () => {
      console.log('Cleaning up chat list screen');
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [isInitializing, isAuthenticated, tokens, listingId]);
  
  // Format timestamp for display
  const formatTimestamp = (dateString: string): string => {
    if (!dateString) return '';
    
    try {
      const now = new Date();
      const messageDate = new Date(dateString);
      const diffInMinutes = Math.floor((now.getTime() - messageDate.getTime()) / (1000 * 60));
      const diffInHours = Math.floor(diffInMinutes / 60);
      const diffInDays = Math.floor(diffInHours / 24);

      if (diffInMinutes < 1) return "Just now";
      if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
      if (diffInHours < 24) return `${diffInHours}h ago`;
      if (diffInDays < 7) return `${diffInDays}d ago`;
      return messageDate.toLocaleDateString();
    } catch (e) {
      return 'Unknown date';
    }
  };
  
  // Get text for last message
  const getLastMessageText = (conversation: any): string => {
    if (!conversation.last_message) return "No messages yet";

    try {
      if (conversation.last_message.is_offer) {
        const offer = conversation.last_message.offer;
        if (offer.status === "Pending") {
          return `Offer: $${offer.price}`;
        } else if (offer.status === "Accepted") {
          return `Offer accepted: $${offer.price}`;
        } else if (offer.status === "Rejected") {
          return `Offer rejected: $${offer.price}`;
        }
        return `Offer: $${offer.price}`;
      } else if (conversation.last_message.review_data) {
        const review = conversation.last_message.review_data;
        return `${review.reviewer_username} left a ${review.rating}-star review`;
      } else {
        return conversation.last_message.content;
      }
    } catch (e) {
      return "Message unavailable";
    }
  };
  
  // Handle pull-to-refresh
  const handleRefresh = () => {
    fetchConversations(true);
  };
  
  // Handle reload button press
  const handleReload = () => {
    fetchConversations();
  };
  
  // Show loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen 
          options={{
            title: 'Chats',
            headerShown: true,
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()}>
                <Feather name="chevron-left" size={24} color="#2528be" />
              </TouchableOpacity>
            ),
          }} 
        />
        <ActivityIndicator size="large" color="#2528be" />
        <Text style={styles.loadingText}>{loadingStep}</Text>
        <Text style={styles.loadingSubtext}>Please wait while we prepare everything</Text>
        
        {DEBUG_MODE && (
          <View style={styles.debugButtonsContainer}>
            <TouchableOpacity 
              style={styles.debugButton} 
              onPress={testApiConnection}
            >
              <Text style={styles.debugButtonText}>Test API</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.debugButton} 
              onPress={testAuthToken}
            >
              <Text style={styles.debugButtonText}>Test Auth</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.debugButton}
              onPress={openWebChatInBrowser}
            >
              <Text style={styles.debugButtonText}>Open in Browser</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }
  
  // Show error state
  if (error) {
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
          }} 
        />
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={48} color="#ff3b30" />
          <Text style={styles.errorText}>{error}</Text>
          
          <View style={styles.errorButtonsRow}>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={handleReload}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.browserButton}
              onPress={openWebChatInBrowser}
            >
              <Text style={styles.browserButtonText}>Open in Browser</Text>
            </TouchableOpacity>
          </View>
          
          {!isAuthenticated && (
            <TouchableOpacity 
              style={styles.signInButton}
              onPress={() => router.push('/auth/signin')}
            >
              <Text style={styles.signInButtonText}>Sign In</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          title: listingId ? (listing?.title || 'Product Chats') : 'Chats',
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
      
      {listingId && listing && (
        <View style={styles.productInfoContainer}>
          <View style={styles.productInfo}>
            {listing?.images?.[0]?.image_url ? (
              <Image 
                source={{ uri: listing.images[0].image_url }} 
                style={styles.productImage} 
              />
            ) : (
              <View style={styles.productImagePlaceholder}>
                <Feather name="image" size={24} color="#ccc" />
              </View>
            )}
            <View style={styles.productDetails}>
              <Text style={styles.productTitle} numberOfLines={1}>{listing.title}</Text>
              <Text style={styles.productPrice}>${listing.price}</Text>
              {listing.status && (
                <View style={[
                  styles.statusBadge, 
                  listing.status === 'sold' ? styles.soldBadge : 
                  listing.status === 'pending' ? styles.pendingBadge : styles.activeBadge
                ]}>
                  <Text style={styles.statusText}>{listing.status}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      )}
      
      {conversations.length > 0 ? (
        <FlatList
          data={conversations}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.conversationItem}
              onPress={() => router.push({
                pathname: '/chat/[id]',
                params: { id: item.id }
              })}
            >
              <View style={styles.avatar}>
                {item.other_participant?.avatar ? (
                  <Image 
                    source={{ uri: item.other_participant.avatar }} 
                    style={styles.avatarImage} 
                  />
                ) : (
                  <View style={styles.defaultAvatar}>
                    <Text style={styles.avatarText}>
                      {item.other_participant?.nickname?.charAt(0)?.toUpperCase() || "?"}
                    </Text>
                  </View>
                )}
              </View>
              
              <View style={styles.conversationContent}>
                <View style={styles.conversationHeader}>
                  <Text style={styles.participantName} numberOfLines={1}>
                    {item.other_participant?.nickname || "Unknown User"}
                  </Text>
                  {item.last_message && (
                    <Text style={styles.timestamp}>
                      {formatTimestamp(item.last_message.created_at)}
                    </Text>
                  )}
                </View>
                
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {getLastMessageText(item)}
                </Text>
              </View>
              
              <Feather name="chevron-right" size={18} color="#999" />
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubble-outline" size={48} color="#ccc" />
          <Text style={styles.emptyText}>No conversations found</Text>
          {listingId && (
            <Text style={styles.emptySubtext}>
              No one has messaged about this listing yet
            </Text>
          )}
        </View>
      )}
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 20,
    color: '#2528be',
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
  },
  debugButtonsContainer: {
    flexDirection: 'row',
    marginTop: 30,
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  debugButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  debugButtonText: {
    fontSize: 12,
    color: '#333',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginTop: 15,
    marginBottom: 30,
  },
  errorButtonsRow: {
    flexDirection: 'row',
    gap: 15,
    marginTop: 5,
  },
  retryButton: {
    backgroundColor: '#2528be',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  browserButton: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  browserButtonText: {
    color: '#333',
    fontWeight: '600',
    fontSize: 14,
  },
  signInButton: {
    marginTop: 20,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  signInButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  productInfoContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    padding: 15,
  },
  productInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 15,
  },
  productImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  productDetails: {
    flex: 1,
  },
  productTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2528be',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  activeBadge: {
    backgroundColor: '#e8f5e9',
  },
  pendingBadge: {
    backgroundColor: '#fff8e1',
  },
  soldBadge: {
    backgroundColor: '#ffebee',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 20,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  defaultAvatar: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2528be',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
  },
  conversationContent: {
    flex: 1,
    marginRight: 10,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  participantName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
  },
  separator: {
    height: 1,
    backgroundColor: '#eee',
    marginLeft: 80,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 15,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  reloadButton: {
    padding: 8,
  },
}); 