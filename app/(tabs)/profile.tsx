import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { getPlaceholderImage, optimizeCloudinaryUrl } from '../../utils/imageUtils';

// Define the types for our data
type Listing = {
  product_id: string;
  title: string;
  price: string;
  images: Array<{image_url: string; is_primary?: boolean}>;
  main_image?: string;
  condition: string;
  slug: string;
};

type Review = {
  id: string;
  rating: number;
  review_text: string;
  reviewer_nickname: string;
  created_at: string;
  reviewed_product_image?: string;
  reviewed_product_title?: string;
};

type Profile = {
  id: string;
  nickname: string;
  email: string;
  avatar?: string;
  created_at: string;
};

// Custom Header Component
const ProfileHeader = () => {
  const router = useRouter();
  const { logout } = useAuth();
  
  const handleLogout = () => {
    logout();
    router.push('/auth/signin');
  };
  
  return (
    <View style={styles.headerContainer}>
      <TouchableOpacity 
        style={styles.headerButton} 
        onPress={() => router.push('/(tabs)')}
      >
        <Ionicons name="close" size={24} color="#333" />
      </TouchableOpacity>
      
      <Text style={styles.headerTitle}>Profile</Text>
      
      <TouchableOpacity 
        style={styles.headerButton}
        onPress={handleLogout}
      >
        <Ionicons name="log-out-outline" size={24} color="#333" />
      </TouchableOpacity>
    </View>
  );
};

export default function ProfileScreen() {
  const { isInitializing, isAuthenticated, tokens, user } = useAuth();
  const [activeTab, setActiveTab] = useState('Listings');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [likedListings, setLikedListings] = useState<Listing[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedReview, setExpandedReview] = useState<string | null>(null);
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
  
  // Calculate average rating
  const calculateAverageRating = (reviews: Review[]) => {
    if (!reviews.length) return 0;
    const total = reviews.reduce((acc, review) => acc + review.rating, 0);
    return (total / reviews.length).toFixed(1);
  };
  
  // Add debug logging
  useEffect(() => {
    console.log('ProfileScreen: Auth state:', { 
      isInitializing, 
      isAuthenticated, 
      hasAccessToken: !!tokens?.accessToken,
      hasRefreshToken: !!tokens?.refreshToken,
      hasUser: !!user,
      userId: user?.id
    });
  }, [isInitializing, isAuthenticated, tokens, user]);
  
  // Handle fetch data functions
  const fetchProfile = async () => {
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
      
      console.log('ProfileScreen: Fetching user profile data');
      
      // Fetch user profile
      const profileResponse = await api.get('/api/profile/');
      console.log('ProfileScreen: Profile data received:', profileResponse.status);
      setProfile(profileResponse.data);
      
      // Fetch user's listings
      const listingsResponse = await api.get(`/api/listings/?seller=${profileResponse.data.id}`);
      console.log('ProfileScreen: Listings data received:', listingsResponse.status, listingsResponse.data.listings?.length);
      setListings(listingsResponse.data.listings || []);
      
      // Fetch user's liked listings
      const likedResponse = await api.get('/api/listings/liked/');
      console.log('ProfileScreen: Liked data received:', likedResponse.status, likedResponse.data?.length);
      setLikedListings(likedResponse.data || []);
      
      // Fetch reviews received by the user
      const reviewsResponse = await api.get(`/api/reviews/seller/${profileResponse.data.id}/`);
      console.log('ProfileScreen: Reviews data received:', reviewsResponse.status, reviewsResponse.data?.length);
      setReviews(reviewsResponse.data || []);
      
    } catch (error) {
      console.error('ProfileScreen: Error fetching data:', error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        console.log('ProfileScreen: Authentication error, redirecting to signin');
        router.push('/auth/signin');
      } else {
        setError('Failed to load profile data. Please try again.');
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
        console.log('ProfileScreen: Not authenticated, redirecting to signin');
        router.push('/auth/signin');
      } else {
        console.log('ProfileScreen: Authenticated, fetching profile data');
        fetchProfile();
      }
    }
  }, [isInitializing, isAuthenticated, tokens]);
  
  // Handle pull-to-refresh
  const onRefresh = () => {
    setRefreshing(true);
    fetchProfile();
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
  
  // Get initial of name for avatar placeholder
  const getInitial = (name: string) => {
    return name && name.length > 0 ? name.charAt(0).toUpperCase() : 'U';
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
  
  // Function to toggle like status
  const toggleLike = async (itemId: string) => {
    // Find the item in either listings or likedListings
    const item = [...listings, ...likedListings].find(item => item.product_id === itemId);
    if (!item) return;
    
    const slug = item.slug ?? 'item'; // Using nullish coalescing to guarantee string
    const isCurrentlyLiked = likedItems[itemId] || false;
    
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
      [itemId]: !isCurrentlyLiked
    }));
    
    try {
      // Use retry operation with the toggleLikeAPI function
      const result = await retryOperation(() => 
        toggleLikeAPI(slug, itemId, isCurrentlyLiked, accessToken)
      );
      
      // We don't remove items from the list on unlike - we just update the UI status
      
      console.log(`Successfully ${isCurrentlyLiked ? 'unliked' : 'liked'} listing ${itemId}`, result);
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
        [itemId]: isCurrentlyLiked
      }));
      
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
    const isLiked = likedItems[item.product_id] || false;
    
    return (
      <TouchableOpacity 
        style={styles.listingCard}
        onPress={() => {
          const listingUrl = `https://listtra.com/listings/${item.slug || 'item'}/${item.product_id}`;
          router.push(`/web?uri=${encodeURIComponent(listingUrl)}` as any);
        }}
      >
        <View style={styles.listingImageContainer}>
          {/* Like Button */}
          <TouchableOpacity 
            style={styles.likeButton}
            onPress={() => toggleLike(item.product_id)}
          >
            <Ionicons 
              name={isLiked ? "heart" : "heart-outline"} 
              size={20}
              color={isLiked ? "#ff5252" : "#666"} 
            />
          </TouchableOpacity>
          
          {imageUrl ? (
            <Image 
              source={{ uri: imageUrl }} 
              style={styles.listingImage} 
              contentFit="contain"
              transition={200}
              cachePolicy="memory-disk"
              recyclingKey={imageUrl}
              placeholderContentFit="contain"
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
            <Text style={styles.sellerName}>{profile?.nickname || 'User'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };
  
  // Render a review card
  const renderReviewItem = ({ item }: { item: Review }) => {
    const isExpanded = expandedReview === item.id;
    const reviewText = item.review_text || 'No comment provided';
    const reviewerInitial = getInitial(item.reviewer_nickname);
    
    return (
      <View style={styles.reviewCard}>
        <View style={styles.reviewHeader}>
          <View style={styles.reviewUserContainer}>
            <View style={styles.reviewAvatar}>
              <Text style={styles.reviewAvatarText}>
                {reviewerInitial}
              </Text>
            </View>
            <View>
              <Text style={styles.reviewerName}>{item.reviewer_nickname || 'User'}</Text>
              <View style={styles.ratingContainer}>
                <Text style={styles.ratingText}>★ {item.rating.toFixed(1)}</Text>
              </View>
            </View>
          </View>
          <Text style={styles.reviewDate}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
        
        <Text 
          style={[styles.reviewText, isExpanded ? {} : styles.reviewTextCollapsed]}
          numberOfLines={isExpanded ? undefined : 2}
        >
          {reviewText}
        </Text>
        
        {reviewText.length > 80 && (
          <TouchableOpacity 
            onPress={() => setExpandedReview(isExpanded ? null : item.id)}
            style={styles.readMoreButton}
          >
            <Text style={styles.readMoreText}>
              {isExpanded ? 'Show less' : 'Read more'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };
  
  // Initialize liked items based on data from API
  useEffect(() => {
    const initialLikes: {[key: string]: boolean} = {};
    
    // Set initial likes from liked listings
    likedListings.forEach(item => {
      initialLikes[item.product_id] = true;
    });
    
    setLikedItems(initialLikes);
  }, [likedListings]);
  
  // Show loading spinner while initializing
  if (isInitializing || loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ProfileHeader />
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#4046F9" />
        </View>
      </SafeAreaView>
    );
  }
  
  // Show error if any
  if (error) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ProfileHeader />
        <View style={styles.container}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchProfile}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }
  
  // Show empty state if no profile
  if (!profile) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ProfileHeader />
        <View style={styles.container}>
          <Text style={styles.emptyText}>Profile not found</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ProfileHeader />
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#2528be" />
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Profile Header */}
          <View style={styles.profileHeader}>
            {/* Avatar */}
            {profile.avatar ? (
              <Image
                source={{ uri: optimizeCloudinaryUrl(profile.avatar, 200, 90) }}
                style={styles.avatar}
                contentFit="cover"
                transition={300}
                cachePolicy="memory-disk"
                placeholderContentFit="cover"
                placeholder={{ uri: getPlaceholderImage() }}
                recyclingKey={profile.avatar}
                onError={(error) => {
                  console.log('Image loading error:', error);
                }}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{getInitial(profile.nickname)}</Text>
              </View>
            )}
            
            {/* Profile Info */}
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{profile.nickname}</Text>
              <Text style={styles.profileRating}>★ {calculateAverageRating(reviews)}</Text>
              <Text style={styles.profileReviewCount}>{reviews.length} reviews</Text>
            </View>
          </View>
          
          {/* Tabs */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'Listings' ? styles.activeTab : null]}
              onPress={() => setActiveTab('Listings')}
            >
              <Text style={[styles.tabText, activeTab === 'Listings' ? styles.activeTabText : null]}>
                My Listing
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tab, activeTab === 'Liked' ? styles.activeTab : null]}
              onPress={() => setActiveTab('Liked')}
            >
              <Text style={[styles.tabText, activeTab === 'Liked' ? styles.activeTabText : null]}>
                Liked
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tab, activeTab === 'Reviews' ? styles.activeTab : null]}
              onPress={() => setActiveTab('Reviews')}
            >
              <Text style={[styles.tabText, activeTab === 'Reviews' ? styles.activeTabText : null]}>
                Reviews
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Tab Content */}
          <View style={styles.tabContent}>
            {activeTab === 'Listings' && (
              <>
                {listings.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No listings found</Text>
                  </View>
                ) : (
                  <FlatList
                    data={listings}
                    renderItem={renderListingItem}
                    keyExtractor={(item) => item.product_id}
                    numColumns={2}
                    scrollEnabled={false}
                    contentContainerStyle={styles.listingsGrid}
                  />
                )}
              </>
            )}
            
            {activeTab === 'Liked' && (
              <>
                {likedListings.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No liked items found</Text>
                  </View>
                ) : (
                  <FlatList
                    data={likedListings}
                    renderItem={renderListingItem}
                    keyExtractor={(item) => item.product_id}
                    numColumns={2}
                    scrollEnabled={false}
                    contentContainerStyle={styles.listingsGrid}
                  />
                )}
              </>
            )}
            
            {activeTab === 'Reviews' && (
              <>
                {reviews.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No reviews yet</Text>
                  </View>
                ) : (
                  <FlatList
                    data={reviews}
                    renderItem={renderReviewItem}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                    contentContainerStyle={styles.reviewsList}
                  />
                )}
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: '#4046F9',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  profileHeader: {
    backgroundColor: '#2528be',
    paddingTop: 40,
    paddingBottom: 40,
    alignItems: 'center',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f1f2f6',
    borderWidth: 0,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f1f2f6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
  },
  avatarText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#757575',
  },
  profileInfo: {
    alignItems: 'center',
    marginTop: 15,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  profileRating: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  profileReviewCount: {
    fontSize: 14,
    color: 'white',
    opacity: 0.9,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: 'white',
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#2528be',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#757575',
  },
  activeTabText: {
    color: '#000',
    fontWeight: 'bold',
  },
  tabContent: {
    padding: 10,
    paddingBottom: 60,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyText: {
    fontSize: 16,
    color: '#757575',
  },
  listingsGrid: {
    paddingHorizontal: 5,
  },
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
    position: 'relative',
  },
  listingImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
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
    marginBottom: 0,
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
    marginTop: 0,
    textAlign: 'right',
  },
  likeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0)',
    borderRadius: 20,
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
    width: 30,
    height: 30,
  },
  reviewsList: {
    marginTop: 10,
    paddingHorizontal: 5,
  },
  reviewCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewUserContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f2f2f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  reviewAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2528be',
  },
  reviewerName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    color: '#F9A825',
    fontSize: 14,
    fontWeight: 'bold',
  },
  reviewDate: {
    fontSize: 12,
    color: '#9e9e9e',
    fontStyle: 'italic',
  },
  reviewText: {
    fontSize: 14,
    color: '#424242',
    lineHeight: 20,
    marginTop: 5,
  },
  reviewTextCollapsed: {
    height: 40,
    overflow: 'hidden',
  },
  readMoreButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  readMoreText: {
    color: '#2528be',
    fontSize: 13,
    fontWeight: '500',
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
  safeArea: {
    flex: 1,
    backgroundColor: 'white',
  },
});