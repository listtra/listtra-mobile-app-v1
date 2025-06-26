import { Feather, Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { getPlaceholderImage, optimizeCloudinaryUrl } from '../../utils/imageUtils';

// Custom Header Component
const ChatsHeader = () => {
  const router = useRouter();
  
  return (
    <View style={styles.headerContainer}>
      <TouchableOpacity 
        style={styles.headerButton} 
        onPress={() => router.push('/(tabs)')}
      >
        <Ionicons name="close" size={24} color="#333" />
      </TouchableOpacity>
      
      <Text style={styles.headerTitle}>Chats</Text>
      
      {/* Empty view to balance the header */}
      <View style={styles.headerButton} />
    </View>
  );
};

export default function ChatsScreen() {
  const { isInitializing, user, tokens, isAuthenticated } = useAuth();
  const router = useRouter();
  const [chats, setChats] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch chats data
  const fetchChats = async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true);
    } else {
      setIsLoading(true);
    }
    
    // Check if user is authenticated
    if (!isAuthenticated || !tokens?.accessToken) {
      setError('Please sign in to view your chats');
      setIsLoading(false);
      setRefreshing(false);
      return;
    }
    
    try {
      const headers = {
        Authorization: `Bearer ${tokens.accessToken}`
      };
      
      const response = await axios.get(
        'https://backend.listtra.com/api/chat/conversations/recent/',
        { headers }
      );
      
      setChats(response.data);
      setError(null);
    } catch (error: any) {
      console.error('Error fetching chats:', error);
      setError(`Failed to load chats: ${error.message}`);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };
  
  // Initial data fetch
  useEffect(() => {
    // Skip if auth is still initializing
    if (isInitializing) return;
    
    fetchChats();
  }, [isInitializing, isAuthenticated, tokens]);
  
  // Format timestamp for display
  const formatTimestamp = (dateString: string): string => {
    if (!dateString) return '';
    
    try {
      const now = new Date();
      const date = new Date(dateString);
      const diffMs = now.getTime() - date.getTime();
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      
      if (diffHrs < 1) return "Just now";
      if (diffHrs < 24) return `${diffHrs}hrs`;
      return `${Math.floor(diffHrs / 24)}d`;
    } catch (e) {
      return '';
    }
  };
  
  // Handle pull-to-refresh
  const handleRefresh = () => {
    fetchChats(true);
  };
  
  // Show loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ChatsHeader />
        <View style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2528be" />
            <Text style={styles.loadingText}>Loading chats...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }
  
  // Show error state
  if (error) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ChatsHeader />
        <View style={styles.container}>
          <View style={styles.errorContainer}>
            <Feather name="alert-circle" size={48} color="#ff3b30" />
            <Text style={styles.errorText}>{error}</Text>
            
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => fetchChats()}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
            
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
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ChatsHeader />
      <View style={styles.container}>
        {chats.length > 0 ? (
          <FlatList
            data={chats}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.chatItem}
                onPress={() => router.push({
                  pathname: '/chat/[id]',
                  params: { id: item.id }
                })}
              >
                <View style={styles.imageContainer}>
                  {item.listing?.images?.[0]?.image_url ? (
                    <Image 
                      source={{ uri: optimizeCloudinaryUrl(item.listing.images[0].image_url, 150, 80) }} 
                      style={styles.listingImage}
                      contentFit="cover"
                      transition={200}
                      cachePolicy="memory-disk"
                      placeholder={{ uri: getPlaceholderImage() }}
                    />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Text style={styles.placeholderText}>?</Text>
                    </View>
                  )}
                </View>
                
                <View style={styles.chatContent}>
                  <Text style={styles.listingTitle} numberOfLines={1}>
                    {item.listing?.title || "Untitled"}
                  </Text>
                  
                  <Text style={styles.listingPrice}>
                    ${item.listing?.price || "-"}
                  </Text>
                  
                  <Text style={styles.participantName} numberOfLines={1}>
                    {item.listing?.seller_nickname || item.other_participant?.nickname || "-"}
                  </Text>
                  
                  <Text style={styles.lastMessage} numberOfLines={1}>
                    {item.last_message?.content || "No messages yet"}
                  </Text>
                </View>
                
                <View style={styles.rightContent}>
                  <Text style={styles.timestamp}>
                    {item.last_message?.created_at
                      ? formatTimestamp(item.last_message.created_at)
                      : ""}
                  </Text>
                  
                  {item.unread_count > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadCount}>{item.unread_count}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={handleRefresh}
                colors={['#2528be']}
                tintColor="#2528be"
              />
            }
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No recent chats</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'white',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    zIndex: 10,
  },
  headerButton: {
    padding: 8,
    borderRadius: 20,
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 20,
    color: '#666',
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
  listContent: {
    padding: 10,
    paddingBottom: 80, // Extra padding at the bottom for better scrolling
    width: '100%',
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 12,
    marginVertical: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  imageContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    marginRight: 12,
  },
  listingImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#888',
  },
  chatContent: {
    flex: 1,
    marginRight: 8,
    justifyContent: 'space-between',
  },
  listingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 3,
  },
  listingPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2528be',
    marginBottom: 3,
  },
  participantName: {
    fontSize: 12,
    color: '#666',
    marginBottom: 3,
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  rightContent: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 50,
    minWidth: 48,
    marginLeft: 2,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  unreadBadge: {
    backgroundColor: '#2528be',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadCount: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  separator: {
    height: 8,
    backgroundColor: 'transparent',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#777',
    textAlign: 'center',
  },
}); 