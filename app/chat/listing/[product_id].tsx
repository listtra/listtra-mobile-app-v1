import { Feather, Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Linking,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useAuth } from '../../../context/AuthContext';

export default function ProductChatsScreen() {
  const { isInitializing, user, tokens, isAuthenticated } = useAuth();
  const params = useLocalSearchParams();
  const product_id = params.product_id as string;
  const router = useRouter();
  const [conversations, setConversations] = useState<any[]>([]);
  const [listing, setListing] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('Loading product chats...');
  const [error, setError] = useState<string | null>(null);
  
  // Log key information
  useEffect(() => {
    console.log('ProductChatsScreen mounted for product:', product_id);
    console.log('Auth state:', { 
      isAuthenticated, 
      userId: user?.id,
      hasTokens: !!tokens?.accessToken
    });
  }, []);
  
  // Fetch conversations for this specific product
  useEffect(() => {
    if (isInitializing) {
      console.log('Auth still initializing, waiting...');
      return;
    }
    
    if (!isAuthenticated || !tokens?.accessToken) {
      setError('Please sign in to view conversations');
      setIsLoading(false);
      return;
    }
    
    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;
    
    const fetchData = async () => {
      try {
        // Set timeout to prevent indefinite loading
        timeoutId = setTimeout(() => {
          if (isMounted && isLoading) {
            setError('Request timed out. Please try again.');
            setIsLoading(false);
          }
        }, 15000);
        
        const headers = {
          Authorization: `Bearer ${tokens.accessToken}`
        };
        
        // First fetch the listing details
        console.log('Fetching listing details for:', product_id);
        setLoadingText('Loading product details...');
        
        const listingResponse = await axios.get(
          `https://backend.listtra.com/api/listings/${product_id}/`,
          { headers }
        );
        
        if (isMounted) {
          setListing(listingResponse.data);
          console.log('Listing fetched:', listingResponse.data.title);
        }
        
        // Fetch all conversations
        console.log('Fetching conversations...');
        setLoadingText('Loading conversations...');
        
        const conversationsResponse = await axios.get(
          'https://backend.listtra.com/api/chat/conversations/',
          { headers }
        );
        
        // Filter for this specific product
        const productConversations = conversationsResponse.data.filter(
          (conv: any) => conv.listing?.product_id === product_id
        );
        
        console.log(`Found ${productConversations.length} conversations for this product`);
        
        if (isMounted) {
          setConversations(productConversations);
          setIsLoading(false);
          clearTimeout(timeoutId);
        }
      } catch (error: any) {
        console.error('Error fetching product chats:', error);
        
        if (isMounted) {
          setError(`Failed to load conversations: ${error.message}`);
          setIsLoading(false);
          clearTimeout(timeoutId);
        }
      }
    };
    
    fetchData();
    
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [isInitializing, isAuthenticated, product_id, tokens]);
  
  // Format timestamp
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
  
  // Retry loading
  const handleRetry = () => {
    setIsLoading(true);
    setError(null);
    router.setParams({ timestamp: Date.now().toString() });
  };
  
  // Open web version as fallback
  const openInBrowser = () => {
    const url = `https://listtra.com/chat?listing=${product_id}`;
    Linking.openURL(url).catch(err => 
      console.error('Could not open URL:', err)
    );
  };
  
  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen 
          options={{
            title: 'Product Chats',
            headerShown: true,
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()}>
                <Feather name="chevron-left" size={24} color="#2528be" />
              </TouchableOpacity>
            ),
          }} 
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2528be" />
          <Text style={styles.loadingText}>{loadingText}</Text>
          <Text style={styles.loadingSubtext}>Please wait while we load the conversations</Text>
        </View>
      </View>
    );
  }
  
  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <Stack.Screen 
          options={{
            title: 'Product Chats',
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
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={handleRetry}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.browserButton}
              onPress={openInBrowser}
            >
              <Text style={styles.browserButtonText}>Open in Browser</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          title: listing?.title || 'Product Chats',
          headerShown: true,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <Feather name="chevron-left" size={24} color="#2528be" />
            </TouchableOpacity>
          ),
        }} 
      />
      
      {/* Product info header */}
      {listing && (
        <View style={styles.productHeader}>
          <View style={styles.productImageContainer}>
            {listing.images && listing.images[0] ? (
              <Image 
                source={{ uri: listing.images[0].image_url }} 
                style={styles.productImage} 
                resizeMode="cover"
              />
            ) : (
              <View style={styles.noImagePlaceholder}>
                <Feather name="image" size={24} color="#ccc" />
              </View>
            )}
          </View>
          
          <View style={styles.productInfo}>
            <Text style={styles.productTitle} numberOfLines={1}>{listing.title}</Text>
            <Text style={styles.productPrice}>${listing.price}</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>
                {listing.status === 'sold' ? 'Sold' : 
                  listing.status === 'pending' ? 'Pending' : 'Available'}
              </Text>
            </View>
          </View>
        </View>
      )}
      
      {/* Conversations list */}
      {conversations.length > 0 ? (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id.toString()}
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
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubble-outline" size={48} color="#ccc" />
          <Text style={styles.emptyText}>No conversations yet</Text>
          <Text style={styles.emptySubtext}>
            No one has messaged about this listing yet
          </Text>
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
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#777',
    marginTop: 8,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  retryButton: {
    backgroundColor: '#2528be',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
  browserButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#2528be',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  browserButtonText: {
    color: '#2528be',
    fontWeight: '500',
    fontSize: 15,
  },
  productHeader: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#f9f9f9',
  },
  productImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 6,
    overflow: 'hidden',
    marginRight: 12,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  noImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
  },
  productTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2528be',
    marginBottom: 4,
  },
  statusBadge: {
    backgroundColor: '#2528be',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: 16,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  defaultAvatar: {
    width: '100%',
    height: '100%',
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#777',
  },
  conversationContent: {
    flex: 1,
    marginRight: 8,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    color: '#888',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
  },
  separator: {
    height: 1,
    backgroundColor: '#eee',
    marginLeft: 76,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#555',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
  },
}); 