import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
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
  reviewed_product_id?: string;
  review_type: 'buyer_to_seller' | 'seller_to_buyer';
  replies?: Reply[];
  isGivenReview?: boolean;
  display_review_type?: 'buyer_to_seller' | 'seller_to_buyer';
};

type Reply = {
  id: string;
  review_text: string;
  reviewer_nickname: string;
  created_at: string;
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
  const [replyText, setReplyText] = useState<string>('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [showReplyInput, setShowReplyInput] = useState<{[key: string]: boolean}>({});
  const [reviewsActiveTab, setReviewsActiveTab] = useState<'all' | 'seller' | 'buyer'>('all');
  
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
  
  // Calculate average rating for specific review type (only for received reviews)
  const calculateTypeRating = (reviews: Review[], type: 'buyer_to_seller' | 'seller_to_buyer') => {
    // Only calculate ratings for reviews you received, not reviews you gave
    const receivedReviews = reviews.filter(review => 
      review.review_type === type && !review.isGivenReview
    );
    
    if (!receivedReviews.length) return 0;
    const total = receivedReviews.reduce((acc, review) => acc + review.rating, 0);
    return (total / receivedReviews.length).toFixed(1);
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
      
      // Fetch all reviews received by the user (both as seller and buyer)
      const reviewsResponse = await api.get(`/api/reviews/user/${profileResponse.data.id}/all/`);
      console.log('ProfileScreen: Reviews received data:', reviewsResponse.status, reviewsResponse.data?.length);
      
      // Fetch all reviews given by the user - comprehensive approach
      let reviewsGivenData = [];
      console.log('🔍 ProfileScreen: Fetching reviews given by user...');
      
      try {
        // Method 1: Try direct API endpoint
        const reviewsGivenResponse = await api.get(`/api/reviews/?reviewer=${profileResponse.data.id}`);
        reviewsGivenData = reviewsGivenResponse.data || [];
        console.log('✅ ProfileScreen: Reviews given (direct API):', reviewsGivenData.length);
      } catch (directError) {
        console.log('❌ ProfileScreen: Direct API failed, trying comprehensive approach...');
        
        try {
          // Method 2: Get all conversations and fetch reviews from each listing
          const conversationsResponse = await api.get('/api/chat/conversations/');
          const userConversations = conversationsResponse.data || [];
          console.log('📞 Found conversations:', userConversations.length);
          
          const allGivenReviews = [];
          const processedListings = new Set(); // Avoid duplicates
          
          for (const conversation of userConversations) {
            const listingId = conversation.listing?.product_id;
            if (listingId && !processedListings.has(listingId)) {
              processedListings.add(listingId);
              
              try {
                console.log(`🔍 Checking reviews for listing: ${listingId}`);
                const listingReviewsResponse = await api.get(`/api/reviews/listing/${listingId}/`);
                const listingReviews = listingReviewsResponse.data || [];
                
                // Find reviews where current user is the reviewer
                const userGivenReviews = listingReviews.filter(
                  (review: any) => review.reviewer === profileResponse.data.id
                );
                
                if (userGivenReviews.length > 0) {
                  console.log(`✅ Found ${userGivenReviews.length} reviews given by user for listing ${listingId}`);
                  allGivenReviews.push(...userGivenReviews);
                }
              } catch (listingReviewError: any) {
                console.log(`❌ Could not fetch reviews for listing ${listingId}:`, listingReviewError.message);
              }
            }
          }
          
          reviewsGivenData = allGivenReviews;
          console.log('✅ ProfileScreen: Reviews given (comprehensive method):', reviewsGivenData.length);
          
        } catch (comprehensiveError: any) {
          console.log('❌ ProfileScreen: Comprehensive approach also failed:', comprehensiveError.message);
          
          // Method 3: Fallback - check user's own listings for reviews they gave
          try {
            const userListings = listingsResponse.data.listings || [];
            console.log('🏠 Checking user\'s own listings:', userListings.length);
            
            const fallbackReviews = [];
            for (const listing of userListings) {
              try {
                const listingReviewsResponse = await api.get(`/api/reviews/listing/${listing.product_id}/`);
                const userGivenReviews = listingReviewsResponse.data.filter(
                  (review: any) => review.reviewer === profileResponse.data.id
                );
                fallbackReviews.push(...userGivenReviews);
              } catch (fallbackError) {
                console.log(`❌ Fallback failed for listing ${listing.product_id}`);
              }
            }
            
            reviewsGivenData = fallbackReviews;
            console.log('⚠️ ProfileScreen: Reviews given (fallback method):', reviewsGivenData.length);
          } catch (fallbackError) {
            console.log('❌ ProfileScreen: All methods failed to fetch given reviews');
          }
        }
      }
      
      // Combine both received and given reviews, avoiding duplicates
      const allReviews = [...(reviewsResponse.data || [])];
      
      // Add given reviews, but mark them differently and avoid duplicates
      reviewsGivenData.forEach((givenReview: any) => {
        // Check if this review is already in received reviews (shouldn't happen but just in case)
        const alreadyExists = allReviews.some(review => review.id === givenReview.id);
        if (!alreadyExists) {
          // Mark this as a review the user gave (not received)
          allReviews.push({
            ...givenReview,
            isGivenReview: true, // Flag to indicate this is a review the user gave
            // For display purposes, we want to show these reviews in the appropriate tabs
            // Keep the original review_type but add the flag for filtering
          });
        }
      });
      
      // Enhanced debugging for combined review types
      if (allReviews.length > 0) {
        const receivedReviews = allReviews.filter(r => !r.isGivenReview);
        const givenReviews = allReviews.filter(r => r.isGivenReview);
        
        console.log('📊 Combined Review Analysis:', {
          totalReviews: allReviews.length,
          receivedReviews: receivedReviews.length,
          givenReviews: givenReviews.length,
          receivedTypes: receivedReviews.reduce((acc: any, review: any) => {
            acc[review.review_type] = (acc[review.review_type] || 0) + 1;
            return acc;
          }, {}),
          givenTypes: givenReviews.reduce((acc: any, review: any) => {
            acc[review.review_type] = (acc[review.review_type] || 0) + 1;
            return acc;
          }, {}),
          sampleReceived: receivedReviews[0] ? {
            id: receivedReviews[0].id,
            type: receivedReviews[0].review_type,
            rating: receivedReviews[0].rating,
            reviewer: receivedReviews[0].reviewer_nickname
          } : null,
          sampleGiven: givenReviews[0] ? {
            id: givenReviews[0].id,
            type: givenReviews[0].review_type,
            rating: givenReviews[0].rating,
            isGivenReview: givenReviews[0].isGivenReview
          } : null
        });
      } else {
        console.log('⚠️ No reviews found for user:', profileResponse.data.id);
      }
      
      // 🔧 FIX: Fetch replies for ALL reviews to ensure they appear on both users' profiles
      console.log('🔍 Fetching replies for all reviews...');
      const reviewsWithReplies = await Promise.all(
        allReviews.map(async (review: any) => {
          try {
            // Try different possible endpoints for fetching replies
            let replies = [];
            
            // Method 1: Try standard replies endpoint
            try {
              const repliesResponse = await api.get(`/api/reviews/${review.id}/replies/`);
              replies = repliesResponse.data || [];
              console.log(`✅ Method 1: Found ${replies.length} replies for review ${review.id}`);
            } catch (method1Error) {
              // Method 2: Try alternative endpoint structure
              try {
                const repliesResponse = await api.get(`/api/reviews/${review.id}/reply/`);
                replies = repliesResponse.data || [];
                console.log(`✅ Method 2: Found ${replies.length} replies for review ${review.id}`);
              } catch (method2Error) {
                // Method 3: Try getting the full review object which might include replies
                try {
                  const fullReviewResponse = await api.get(`/api/reviews/${review.id}/`);
                  replies = fullReviewResponse.data?.replies || [];
                  console.log(`✅ Method 3: Found ${replies.length} replies for review ${review.id}`);
                } catch (method3Error) {
                  console.log(`⚠️ All methods failed for review ${review.id}, using existing replies`);
                  replies = review.replies || [];
                }
              }
            }
            
            return {
              ...review,
              replies: replies
            };
          } catch (replyError) {
            console.log(`❌ Error fetching replies for review ${review.id}:`, replyError);
            return {
              ...review,
              replies: review.replies || []
            };
          }
        })
      );
      
      console.log('✅ Finished fetching replies for all reviews');
      setReviews(reviewsWithReplies);
      
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
  
  // Refresh profile when screen comes into focus (to show new reviews)
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated && tokens.accessToken && !isInitializing) {
        console.log('ProfileScreen: Screen focused, refreshing data to show new reviews');
        fetchProfile();
      }
    }, [isAuthenticated, tokens.accessToken, isInitializing])
  );
  
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
  
  // Submit a reply to a review
  const submitReply = async (reviewId: string) => {
    if (!replyText.trim() || !tokens?.accessToken) return;
    
    try {
      const api = axios.create({
        baseURL: 'https://backend.listtra.com',
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      const response = await api.post(`/api/reviews/${reviewId}/reply/`, {
        review_text: replyText.trim()
      });
      
      if (response.status === 201) {
        console.log('✅ Reply submitted successfully:', response.data);
        
        // Reset reply state immediately for better UX
        setReplyText('');
        setReplyingTo(null);
        setShowReplyInput({});
        
        // 🔧 FIX: Instead of just updating local state, refresh all reviews from server
        // This ensures both users see the reply when they refresh their profiles
        console.log('🔄 Refreshing all reviews to show new reply...');
        await fetchProfile();
        
        console.log('✅ Reviews refreshed after reply submission');
      }
    } catch (error) {
      console.error('Error posting reply:', error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        router.push('/auth/signin');
      }
    }
  };
  
  // Toggle reply input visibility
  const toggleReplyInput = (reviewId: string) => {
    setShowReplyInput(prev => ({
      ...prev,
      [reviewId]: !prev[reviewId]
    }));
    
    if (!showReplyInput[reviewId]) {
      setReplyingTo(reviewId);
      setReplyText('');
    } else {
      setReplyingTo(null);
    }
  };
  
  // Filter reviews based on active tab
  const getFilteredReviews = () => {
    if (reviewsActiveTab === 'all') {
      return reviews;
    } else if (reviewsActiveTab === 'seller') {
      // "As Seller" tab: Reviews related to selling activity
      return reviews.filter(review => {
        if (review.isGivenReview) {
          // Reviews you gave as a seller (to buyers) = seller_to_buyer
          return review.review_type === 'seller_to_buyer';
        } else {
          // Reviews you received as a seller (from buyers) = buyer_to_seller
          return review.review_type === 'buyer_to_seller';
        }
      });
    } else {
      // "As Buyer" tab: Reviews related to buying activity
      return reviews.filter(review => {
        if (review.isGivenReview) {
          // Reviews you gave as a buyer (to sellers) = buyer_to_seller
          return review.review_type === 'buyer_to_seller';
        } else {
          // Reviews you received as a buyer (from sellers) = seller_to_buyer
          return review.review_type === 'seller_to_buyer';
        }
      });
    }
  };
  
  // Calculate the count of each review type for tabs
  const getSellerReviewCount = () => {
    return reviews.filter(review => {
      if (review.isGivenReview) {
        return review.review_type === 'seller_to_buyer';
      } else {
        return review.review_type === 'buyer_to_seller';
      }
    }).length;
  };
  
  const getBuyerReviewCount = () => {
    return reviews.filter(review => {
      if (review.isGivenReview) {
        return review.review_type === 'buyer_to_seller';
      } else {
        return review.review_type === 'seller_to_buyer';
      }
    }).length;
  };
  
  // Render a listing card
  const renderListingItem = ({ item }: { item: Listing }) => {
    const imageUrl = getImageUrl(item);
    const isLiked = likedItems[item.product_id] || false;
    
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
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
              recyclingKey={imageUrl}
              placeholderContentFit="cover"
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
  
  // Render a review card - Carousell Style
  const renderReviewItem = ({ item }: { item: Review }) => {
    const isExpanded = expandedReview === item.id;
    const reviewText = item.review_text || 'No comment provided';
    const reviewerInitial = getInitial(item.reviewer_nickname);
    const isShowingReplyInput = showReplyInput[item.id] || false;
    const isGiven = item.isGivenReview || false;
    
    // Check if this review already has a reply
    const hasReply = item.replies && item.replies.length > 0;
    
    // Process the product image URL
    const productImageUrl = item.reviewed_product_image ? 
      optimizeCloudinaryUrl(item.reviewed_product_image) : null;
    
    // Calculate time ago
    const timeAgo = () => {
      const now = new Date();
      const reviewDate = new Date(item.created_at);
      const diffTime = Math.abs(now.getTime() - reviewDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const diffWeeks = Math.floor(diffDays / 7);
      
      if (diffDays === 1) return '1d';
      if (diffDays < 7) return `${diffDays}d`;
      if (diffWeeks === 1) return '1w';
      if (diffWeeks < 52) return `${diffWeeks}w`;
      return `${Math.floor(diffWeeks / 52)}y`;
    };
    
    // Render filled stars
    const renderStars = (rating: number) => {
      const stars = [];
      for (let i = 1; i <= 5; i++) {
        stars.push(
                     <Ionicons
             key={i}
             name="star"
             size={16}
             color={i <= rating ? '#F9A825' : '#e0e0e0'}
           />
        );
      }
      return stars;
    };
    
    return (
      <View style={styles.reviewCard}>
        {/* Review Header - Clean Carousell Style */}
        <View style={styles.reviewHeader}>
          {/* User Avatar */}
          <View style={styles.reviewAvatar}>
            <Text style={styles.reviewAvatarText}>
              {reviewerInitial}
            </Text>
          </View>
          
          {/* User Info and Rating */}
          <View style={styles.reviewUserInfo}>
            <Text style={styles.reviewerName}>
              {item.reviewer_nickname || 'User'}
            </Text>
            
            {/* 5-Star Rating Display */}
            <View style={styles.starsContainer}>
              {renderStars(item.rating)}
              <Text style={styles.reviewTypeLabel}>
                Review from {item.review_type === 'buyer_to_seller' ? 'buyer' : 'seller'} {timeAgo()}
              </Text>
            </View>
          </View>
        </View>
        
        {/* Review Content */}
        <View style={styles.reviewContentContainer}>
          <Text 
            style={[styles.reviewText, isExpanded ? {} : styles.reviewTextCollapsed]}
            numberOfLines={isExpanded ? undefined : 3}
          >
            {reviewText}
          </Text>
          
          {reviewText.length > 120 && (
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
        
        {/* Product Info Below Review - Carousell Style */}
        {productImageUrl && item.reviewed_product_title && (
          <TouchableOpacity 
            style={styles.productInfoContainer}
            onPress={() => {
              if (item.reviewed_product_id) {
                router.push({
                  pathname: "/listings/[slug]/[product_id]/page",
                  params: { slug: 'item', product_id: item.reviewed_product_id }
                });
              }
            }}
          >
            <Image 
              source={{ uri: productImageUrl }} 
              style={styles.productImage}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
              placeholder={{ uri: getPlaceholderImage() }}
            />
            <View style={styles.productDetails}>
              <Text style={styles.productTitle} numberOfLines={2}>
                {item.reviewed_product_title}
              </Text>
              <Text style={styles.productCondition}>USED</Text>
            </View>
          </TouchableOpacity>
        )}
        
                 {/* Action Buttons - Reply Only */}
         {!hasReply && !isGiven && (
           <View style={styles.actionButtonsContainer}>
             <TouchableOpacity 
               style={styles.actionButton}
               onPress={() => toggleReplyInput(item.id)}
             >
               <Ionicons name="arrow-undo-outline" size={18} color="#666" />
               <Text style={styles.actionButtonText}>Reply</Text>
             </TouchableOpacity>
           </View>
         )}
        
        {/* Replies section */}
        {hasReply && (
          <View style={styles.repliesContainer}>
            {item.replies?.map(reply => (
              <View key={reply.id} style={styles.replyItem}>
                <View style={styles.replyHeader}>
                  <View style={styles.replyAuthorContainer}>
                    <View style={styles.replyAvatar}>
                      <Text style={styles.replyAvatarText}>
                        {getInitial(reply.reviewer_nickname)}
                      </Text>
                    </View>
                    <Text style={styles.replyAuthor}>{reply.reviewer_nickname}</Text>
                  </View>
                  <Text style={styles.replyDate}>
                    {new Date(reply.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={styles.replyText}>{reply.review_text}</Text>
              </View>
            ))}
          </View>
        )}
        
        {/* Reply input form */}
        {isShowingReplyInput && (
          <View style={styles.replyForm}>
            <TextInput
              style={styles.replyInput}
              placeholder="Write your reply..."
              value={replyText}
              onChangeText={setReplyText}
              multiline
            />
            <TouchableOpacity 
              style={[
                styles.replySubmitButton,
                !replyText.trim() && styles.replySubmitButtonDisabled
              ]}
              onPress={() => submitReply(item.id)}
              disabled={!replyText.trim()}
            >
              <Text style={styles.replySubmitText}>Submit</Text>
            </TouchableOpacity>
          </View>
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
          {/* Profile Header - Carousell Style */}
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
            
            {/* Profile Info - Carousell Style */}
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{profile.nickname}</Text>
              
              {/* Overall Rating Display */}
              <View style={styles.overallRatingContainer}>
                <Text style={styles.overallRatingNumber}>
                  {calculateAverageRating(reviews) || '0.0'}
                </Text>
                <Ionicons name="star" size={24} color="#F9A825" style={styles.ratingStarIcon} />
              </View>
              
                             {/* Buyer and Seller Ratings */}
               <View style={styles.ratingsContainer}>
                 <View style={styles.ratingItem}>
                   <Text style={styles.ratingValue}>
                     ★ {calculateTypeRating(reviews, 'buyer_to_seller') || '0.0'}
                   </Text>
                   <Text style={styles.ratingLabel}>As Seller</Text>
                 </View>
                 
                 <View style={styles.ratingSeparator} />
                 
                 <View style={styles.ratingItem}>
                   <Text style={styles.ratingValue}>
                     ★ {calculateTypeRating(reviews, 'seller_to_buyer') || '0.0'}
                   </Text>
                   <Text style={styles.ratingLabel}>As Buyer</Text>
                 </View>
               </View>
               
               <Text style={styles.platformTimeText}>
                 {Math.max(1, Math.floor((new Date().getTime() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24 * 365)))} year{Math.floor((new Date().getTime() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24 * 365)) !== 1 ? 's' : ''} on Listtra
               </Text>
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
                {/* Reviews sub-tabs - Carousell Style */}
                <View style={styles.reviewsTabsContainer}>
                  <TouchableOpacity
                    style={[styles.reviewsTab, reviewsActiveTab === 'all' ? styles.reviewsActiveTab : null]}
                    onPress={() => setReviewsActiveTab('all')}
                  >
                    <Text style={[styles.reviewsTabText, reviewsActiveTab === 'all' ? styles.reviewsActiveTabText : null]}>
                      All
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.reviewsTab, reviewsActiveTab === 'seller' ? styles.reviewsActiveTab : null]}
                    onPress={() => setReviewsActiveTab('seller')}
                  >
                    <Text style={[styles.reviewsTabText, reviewsActiveTab === 'seller' ? styles.reviewsActiveTabText : null]}>
                      From Buyers
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.reviewsTab, reviewsActiveTab === 'buyer' ? styles.reviewsActiveTab : null]}
                    onPress={() => setReviewsActiveTab('buyer')}
                  >
                    <Text style={[styles.reviewsTabText, reviewsActiveTab === 'buyer' ? styles.reviewsActiveTabText : null]}>
                      From Sellers
                    </Text>
                  </TouchableOpacity>
                </View>
              
                {getFilteredReviews().length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No reviews yet</Text>
                  </View>
                ) : (
                  <FlatList
                    data={getFilteredReviews()}
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
  reviewsList: {
    marginTop: 10,
    paddingHorizontal: 5,
  },
  reviewCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
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

  reviewText: {
    fontSize: 14,
    color: '#424242',
    lineHeight: 20,
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
  ratingGroup: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 10,
  },
  
  ratingBox: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  
  reviewsTabsContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  
  reviewsTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  
  reviewsActiveTab: {
    borderBottomColor: '#F9A825',
  },
  
  reviewsTabText: {
    fontSize: 15,
    color: '#757575',
    fontWeight: '500',
  },
  
  reviewsActiveTabText: {
    color: '#333',
    fontWeight: '600',
  },
  

  
  reviewContentContainer: {
    marginTop: 10,
  },
  replyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  replySubmitButtonDisabled: {
    opacity: 0.5,
  },

  repliesContainer: {
    marginTop: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#2528be',
  },
  replyItem: {
    marginBottom: 8,
  },
  replyAuthorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  replyAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#f2f2f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  replyAvatarText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2528be',
  },
  replyAuthor: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#424242',
  },
  replyDate: {
    fontSize: 11,
    color: '#9e9e9e',
  },
  replyText: {
    fontSize: 13,
    color: '#424242',
    lineHeight: 18,
    marginTop: 4,
  },

  replyForm: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  replyInput: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    minHeight: 80,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    textAlignVertical: 'top',
  },
  replySubmitButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#2528be',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  replySubmitText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '500',
  },
  overallRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  overallRatingNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  ratingStarIcon: {
    marginLeft: 4,
  },
     ratingsContainer: {
     flexDirection: 'row',
     alignItems: 'center',
     justifyContent: 'center',
     marginTop: 15,
     paddingHorizontal: 20,
   },
   ratingItem: {
     alignItems: 'center',
     flex: 1,
   },
   ratingValue: {
     fontSize: 18,
     color: 'white',
     fontWeight: 'bold',
   },
   ratingLabel: {
     fontSize: 12,
     color: 'white',
     opacity: 0.8,
     marginTop: 2,
   },
   ratingSeparator: {
     width: 1,
     height: 30,
     backgroundColor: 'rgba(255, 255, 255, 0.3)',
     marginHorizontal: 20,
   },
   platformTimeText: {
     fontSize: 14,
     color: 'white',
     opacity: 0.8,
     marginTop: 2,
   },
     reviewUserInfo: {
     flexDirection: 'column',
     alignItems: 'flex-start',
     flex: 1,
     marginLeft: 12,
   },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  reviewTypeLabel: {
    fontSize: 12,
    color: '#757575',
    marginLeft: 4,
  },
  productInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  productDetails: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  productTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#424242',
    flex: 1,
    marginRight: 8,
    lineHeight: 18,
  },
  productCondition: {
    fontSize: 12,
    color: '#757575',
  },
     actionButtonsContainer: {
     flexDirection: 'row',
     justifyContent: 'flex-start',
     marginTop: 16,
     paddingTop: 12,
     borderTopWidth: 1,
     borderTopColor: '#f0f0f0',
   },
   actionButton: {
     flexDirection: 'row',
     alignItems: 'center',
     paddingVertical: 8,
     paddingHorizontal: 16,
     backgroundColor: 'transparent',
     borderRadius: 20,
     marginRight: 20,
   },
     actionButtonText: {
     color: '#666',
     fontSize: 13,
     fontWeight: '500',
     marginLeft: 4,
   },
});