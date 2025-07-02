import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { extractImageUrlsFromListings, getPlaceholderImage, optimizeCloudinaryUrl, preloadImages } from '../../utils/imageUtils';

// Define the types for our data
type Listing = {
  product_id: string;
  title: string;
  price: string;
  images: Array<{image_url: string; is_primary?: boolean}>;
  main_image?: string;
  condition: string;
  slug: string;
  categories?: string[];
  is_liked?: boolean;
  seller_name?: string;
  likes_count?: number;
};

// Helper function to toggle like status using native fetch API instead of axios
const toggleLikeAPI = async (
  slug: string, 
  listingId: string, 
  isCurrentlyLiked: boolean,
  accessToken: string
) => {
  const baseURL = 'https://backend.listtra.com';
  const endpoint = `/api/listings/${slug}/${listingId}/like/`;
  const url = `${baseURL}${endpoint}`;
  
  try {
    if (isCurrentlyLiked) {
      // Unlike - use DELETE method
      console.log(`Unliking: DELETE ${url}`);
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Unlike response status:', response.status);
      
      // If we get a 400 with "You have not liked this listing", treat it as success
      // since the end result is what the user wants - the item should not be liked
      if (response.status === 400) {
        const errorData = await response.text();
        console.log('Error response data:', errorData);
        
        if (errorData.includes("You have not liked this listing")) {
          console.log('Item was already not liked on the server, treating as success');
          return { status: 'success', alreadyUnliked: true };
        }
        
        throw new Error(`Request failed with status ${response.status}: ${errorData}`);
      }
      
      if (!response.ok) {
        const errorData = await response.text();
        console.log('Error response data:', errorData);
        throw new Error(`Request failed with status ${response.status}: ${errorData}`);
      }
      
      return { status: 'success' };
    } else {
      // Like - use POST method
      console.log(`Liking: POST ${url}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Like response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.text();
        console.log('Error response data:', errorData);
        throw new Error(`Request failed with status ${response.status}: ${errorData}`);
      }
      
      return { status: 'success' };
    }
  } catch (error) {
    // Use console.log instead of console.error to prevent error display
    console.log('API Error in toggleLikeAPI:', error);
    throw error;
  }
};

// Simplified retry function for network operations that doesn't surface network errors if we ultimately succeed
const retryOperation = async (operation: () => Promise<any>, maxRetries = 2, delay = 1000) => {
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`Retry attempt ${attempt}/${maxRetries}...`);
      }
      const result = await operation();
      
      // If we succeed after failures, log that we recovered
      if (attempt > 0) {
        console.log(`Recovered after ${attempt} failed attempts`);
      }
      
      return result;
    } catch (error) {
      // Use console.log instead of console.error
      console.log(`Attempt ${attempt + 1} failed:`, error);
      lastError = error;
      
      // Only log the error, don't display it to the user yet
      // We'll only show errors if all attempts fail
      
      if (attempt < maxRetries) {
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // All attempts failed
  console.log(`All ${maxRetries + 1} attempts failed`);
  throw lastError;
};

// Custom Header Component
const LikedHeader = ({ onRefresh }: { onRefresh: () => void }) => {
  const router = useRouter();
  
  return (
    <View style={styles.headerContainer}>
      <TouchableOpacity 
        style={styles.headerButton} 
        onPress={() => router.push('/(tabs)')}
      >
        <Ionicons name="close" size={24} color="#333" />
      </TouchableOpacity>
      
      <Text style={styles.headerTitle}>Liked Listings</Text>
      
      <TouchableOpacity 
        style={styles.headerButton}
        onPress={onRefresh}
      >
        <Ionicons name="refresh" size={24} color="#333" />
      </TouchableOpacity>
    </View>
  );
};

export default function LikedScreen() {
  const { isInitializing, isAuthenticated, tokens } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [likedItems, setLikedItems] = useState<{[key: string]: boolean}>({});
  
  const router = useRouter();
  const windowWidth = Dimensions.get('window').width;
  
  // Format condition text
  const formatCondition = (condition: string) => {
    if (!condition) return '';
    
    // Convert snake_case or kebab-case to readable format
    return condition
      .replace(/_/g, ' ')
      .replace(/-/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };
  
  // Fetch liked listings
  const fetchLikedListings = async () => {
    // Check if authenticated
    if (!isAuthenticated || !tokens?.accessToken) {
      router.push('/auth/signin' as any);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Create API instance with auth token
      const api = axios.create({
        baseURL: 'https://backend.listtra.com',
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      // Fetch liked listings
      const response = await api.get('/api/listings/liked/');
      
      // Transform data to include is_liked flag
      const transformedListings = response.data.map((listing: Listing) => ({
        ...listing,
        is_liked: true, // Since these are liked listings
      }));
      
      setListings(transformedListings);
      
      // Initialize liked items state
      const initialLikedItems: {[key: string]: boolean} = {};
      transformedListings.forEach((item: Listing) => {
        initialLikedItems[item.product_id] = true;
      });
      setLikedItems(initialLikedItems);
      
      // Preload images for better performance on iOS
      if (transformedListings.length > 0) {
        const imageUrls = extractImageUrlsFromListings(transformedListings);
        preloadImages(imageUrls);
      }
      
    } catch (error) {
      console.error('Error fetching liked listings:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          console.log('Unauthorized, redirecting to signin');
          router.push('/auth/signin' as any);
        } else {
          setError(error.response?.data?.detail || 'Failed to fetch liked listings');
        }
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  // Wait for auth to initialize, then fetch data
  useEffect(() => {
    if (!isInitializing) {
      if (!isAuthenticated || !tokens.accessToken) {
        console.log('Not authenticated, redirecting to signin');
        router.push('/auth/signin' as any);
      } else {
        fetchLikedListings();
      }
    }
  }, [isInitializing, isAuthenticated, tokens]);
  
  // Handle pull-to-refresh - when refreshing, update the listings to reflect current likes state
  const onRefresh = () => {
    setRefreshing(true);
    fetchLikedListings();
  };
  
  // Helper to get image URL
  const getImageUrl = (item: Listing) => {
    // First try to use main_image if available
    if (item.main_image) {
      return optimizeCloudinaryUrl(item.main_image);
    }
    
    // Then try to find primary image
    if (item.images && item.images.length > 0) {
      const primaryImage = item.images.find(img => img.is_primary === true);
      if (primaryImage?.image_url) {
        return optimizeCloudinaryUrl(primaryImage.image_url);
      }
      
      // Fallback to first image
      return optimizeCloudinaryUrl(item.images[0]?.image_url || '');
    }
    
    return getPlaceholderImage();
  };
  
  // Function to toggle like status
  const toggleLike = async (item: Listing) => {
    const productId = item.product_id;
    // Ensure slug is never null by providing a default value
    const slug = item.slug ?? 'item'; // Using nullish coalescing to guarantee string
    const isCurrentlyLiked = likedItems[productId] || false;
    
    // Check if we have a valid access token
    if (!tokens?.accessToken) {
      console.log('No access token available');
      router.push('/auth/signin' as any);
      return;
    }
    
    // Store token in a const to ensure it's not null for TypeScript
    const accessToken = tokens.accessToken;
    
    // Log network state
    console.log('Network info before toggle like operation');
    
    // Optimistically update UI - only change the like status, don't remove from list
    setLikedItems(prev => ({
      ...prev,
      [productId]: !isCurrentlyLiked
    }));
    
    try {
      // Use retry operation with the toggleLikeAPI function
      const result = await retryOperation(() => 
        toggleLikeAPI(slug, productId, isCurrentlyLiked, accessToken)
      );
      
      // We no longer remove unliked items from the list - we just update their like status
      // This allows them to stay in the view until user refreshes
      
      console.log(`Successfully ${isCurrentlyLiked ? 'unliked' : 'liked'} listing ${productId}`, result);
    } catch (error: unknown) {
      // Only reach this point if all retry attempts failed
      console.log('All retry attempts failed when toggling like status:', error);
      
      // Provide more detailed error information
      console.log('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Special case: If error is about "not liked" but we're trying to unlike,
      // this is actually what we want
      if (
        error instanceof Error && 
        error.message.includes("You have not liked this listing") && 
        isCurrentlyLiked
      ) {
        console.log('Item was already unliked on server');
        return; // Don't show error or revert UI
      }
      
      // Revert optimistic update on error (for other types of errors)
      setLikedItems(prev => ({
        ...prev,
        [productId]: isCurrentlyLiked
      }));
      
      // Show error alert ONLY for fatal errors that couldn't be recovered
      Alert.alert(
        'Error',
        'Failed to update favorite status. Please try again.',
        [{ text: 'OK' }]
      );
      
      // Check for auth errors and redirect if needed - safely check properties
      if (
        (typeof error === 'object' && error !== null && 'status' in error && error.status === 401) || 
        (error instanceof Error && error.message.includes('401'))
      ) {
        router.push('/auth/signin' as any);
      }
    }
  };
  
  // Render a listing card
  const renderListingItem = ({ item }: { item: Listing }) => {
    const imageUrl = getImageUrl(item);
    const isItemLiked = likedItems[item.product_id] !== undefined 
      ? likedItems[item.product_id] 
      : item.is_liked || false;
    
    return (
      <TouchableOpacity 
        style={styles.listingCard}
        onPress={() => {
          router.push({
            pathname: "/listings/[slug]/[product_id]/page",
            params: { slug: item.slug || 'item', product_id: item.product_id }
          });
        }}
      >
        <View style={styles.listingImageContainer}>
          {/* Like Button */}
          <TouchableOpacity 
            style={styles.likeButton}
            onPress={() => {
              toggleLike(item);
              return true; // Prevents propagation to parent
            }}
            activeOpacity={0.8}
          >
            <Ionicons 
              name={isItemLiked ? "heart" : "heart-outline"} 
              size={20} 
              color={isItemLiked ? "#ff5252" : "#666"} 
            />
          </TouchableOpacity>
          
          {imageUrl ? (
            <Image 
              source={{ uri: imageUrl }} 
              style={styles.listingImage} 
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
              recyclingKey={imageUrl}
              placeholder={{ uri: getPlaceholderImage() }}
              onError={() => console.log('Failed to load image:', imageUrl)}
            />
          ) : (
            <View style={styles.noImageContainer}>
              <Text style={styles.noImageText}>No Image Available</Text>
            </View>
          )}
        </View>
        <View style={styles.listingContent}>
          <Text style={styles.listingTitle} numberOfLines={2}>{item.title}</Text>
          <View style={styles.priceContainer}>
            <Text style={styles.listingPrice}>${item.price}</Text>
          </View>
          <View style={styles.listingFooter}>
            <Text style={styles.listingCondition}>{formatCondition(item.condition)}</Text>
            <Text style={styles.sellerName}>{item.seller_name || 'Seller'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };
  
  // Show loading spinner while initializing
  if (isInitializing || (loading && !refreshing)) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <LikedHeader onRefresh={onRefresh} />
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#2528be" />
        </View>
      </SafeAreaView>
    );
  }
  
  // Show error if any
  if (error) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <LikedHeader onRefresh={onRefresh} />
        <View style={styles.container}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchLikedListings}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
      </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <LikedHeader onRefresh={onRefresh} />
      <View style={styles.container}>
        <Text style={styles.pageTitle}>Your Liked Listings</Text>
        
        {listings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>You haven't liked any listings yet.</Text>
          </View>
        ) : (
          <FlatList
            data={listings}
            renderItem={renderListingItem}
            keyExtractor={(item) => item.product_id}
            numColumns={2}
            contentContainerStyle={styles.listingsGrid}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
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
    backgroundColor: '#f5f5f5',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#e53935',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#2528be',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 15,
    marginTop: 15,
    marginBottom: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#757575',
    textAlign: 'center',
  },
  listingsGrid: {
    paddingHorizontal: 10,
    paddingBottom: 20,
  },
  // Header styles
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
  // Listing card styles
  listingCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 15,
    marginHorizontal: 5,
    width: Dimensions.get('window').width / 2 - 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  listingImageContainer: {
    aspectRatio: 1,
    width: '100%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingTop: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listingImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  noImageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  noImageText: {
    color: '#757575',
    fontSize: 13,
    textAlign: 'center',
  },
  likeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    backgroundColor: 'rgba(200, 200, 200, 0.8)',
    borderRadius: 20,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    width: 36,
    height: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  listingContent: {
    padding: 14,
  },
  listingTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 8,
    minHeight: 40,
    lineHeight: 18,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  listingPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
  },
  listingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listingCondition: {
    fontSize: 13,
    color: '#757575',
    flex: 1,
  },
  sellerName: {
    fontSize: 13,
    color: '#2528be',
    fontWeight: '500',
  },
}); 