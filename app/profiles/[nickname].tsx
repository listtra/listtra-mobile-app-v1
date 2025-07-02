import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    RefreshControl,
    ScrollView,
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
  reviewed_product_id?: string;
  review_type: 'buyer_to_seller' | 'seller_to_buyer';
  replies?: Reply[];
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
const ProfileHeader = ({ nickname }: { nickname: string }) => {
  const router = useRouter();
  
  return (
    <View style={styles.headerContainer}>
      <TouchableOpacity 
        style={styles.headerButton} 
        onPress={() => router.back()}
      >
        <Ionicons name="chevron-back" size={24} color="#333" />
      </TouchableOpacity>
      
      <Text style={styles.headerTitle}>{nickname}</Text>
      
      <View style={styles.headerButton} />
    </View>
  );
};

export default function SellerProfileScreen() {
  const { nickname } = useLocalSearchParams<{ nickname: string }>();
  const { tokens } = useAuth();
  const [activeTab, setActiveTab] = useState('Listings');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedReview, setExpandedReview] = useState<string | null>(null);
  const [reviewsActiveTab, setReviewsActiveTab] = useState<'all' | 'seller' | 'buyer'>('all');
  
  const router = useRouter();
  const windowWidth = Dimensions.get('window').width;
  
  // Format condition text
  const formatCondition = (condition: string) => {
    if (!condition) return '';
    
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
  
  // Calculate average rating for specific review type
  const calculateTypeRating = (reviews: Review[], type: 'buyer_to_seller' | 'seller_to_buyer') => {
    const filteredReviews = reviews.filter(review => review.review_type === type);
    if (!filteredReviews.length) return 0;
    const total = filteredReviews.reduce((acc, review) => acc + review.rating, 0);
    return (total / filteredReviews.length).toFixed(1);
  };
  
  // Get initial from name
  const getInitial = (name: string) => {
    return name ? name.charAt(0).toUpperCase() : '?';
  };
  
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
      
      console.log('SellerProfile: Fetching profile for:', nickname);
      
      // Fetch seller profile
      const profileResponse = await api.get(`/api/profiles/${nickname}/`);
      console.log('SellerProfile: Profile data received:', profileResponse.status);
      setProfile(profileResponse.data);
      
      // Fetch seller's listings
      const listingsResponse = await api.get(`/api/listings/?seller=${profileResponse.data.id}&include_likes=true`);
      console.log('SellerProfile: Listings data received:', listingsResponse.status, listingsResponse.data.listings?.length);
      setListings(listingsResponse.data.listings || []);
      
      // Fetch seller's reviews
      const reviewsResponse = await api.get(`/api/reviews/seller/${profileResponse.data.id}/`);
      console.log('SellerProfile: Reviews data received:', reviewsResponse.status, reviewsResponse.data?.length);
      
      // Fetch replies for all reviews
      const reviewsWithReplies = await Promise.all(
        (reviewsResponse.data || []).map(async (review: any) => {
          try {
            let replies = [];
            try {
              const repliesResponse = await api.get(`/api/reviews/${review.id}/replies/`);
              replies = repliesResponse.data || [];
            } catch (replyError) {
              replies = review.replies || [];
            }
            
            return {
              ...review,
              replies: replies
            };
          } catch (error) {
            return {
              ...review,
              replies: review.replies || []
            };
          }
        })
      );
      
      setReviews(reviewsWithReplies);
      
    } catch (error) {
      console.error('SellerProfile: Error fetching data:', error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        console.log('SellerProfile: Authentication error, redirecting to signin');
        router.push('/auth/signin');
      } else if (axios.isAxiosError(error) && error.response?.status === 404) {
        setError('User not found');
      } else {
        setError('Failed to load profile data. Please try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  // Initial data fetch
  useEffect(() => {
    if (nickname && tokens?.accessToken) {
      fetchProfile();
    }
  }, [nickname, tokens?.accessToken]);
  
  // Handle pull-to-refresh
  const onRefresh = () => {
    setRefreshing(true);
    fetchProfile();
  };
  
  // Get image URL for listing
  const getImageUrl = (item: Listing) => {
    if (item.main_image) {
      return optimizeCloudinaryUrl(item.main_image);
    }
    
    if (item.images && item.images.length > 0) {
      const primaryImage = item.images.find(img => img.is_primary === true);
      if (primaryImage) {
        return optimizeCloudinaryUrl(primaryImage.image_url);
      }
      return optimizeCloudinaryUrl(item.images[0].image_url);
    }
    
    return null;
  };
  
  // Filter reviews based on active tab
  const getFilteredReviews = () => {
    if (reviewsActiveTab === 'all') {
      return reviews;
    } else if (reviewsActiveTab === 'seller') {
      // Reviews received as seller (from buyers)
      return reviews.filter(review => review.review_type === 'buyer_to_seller');
    } else {
      // Reviews received as buyer (from sellers)
      return reviews.filter(review => review.review_type === 'seller_to_buyer');
    }
  };
  
  // Render a listing card
  const renderListingItem = ({ item }: { item: Listing }) => {
    const imageUrl = getImageUrl(item);
    
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
                {timeAgo()}
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
        
        {/* Replies section */}
        {item.replies && item.replies.length > 0 && (
          <View style={styles.repliesContainer}>
            {item.replies.map(reply => (
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
      </View>
    );
  };
  
  // Show loading spinner while initializing
  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.headerContainer}>
          <TouchableOpacity 
            style={styles.headerButton} 
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color="#333" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>{nickname || 'Profile'}</Text>
          
          <View style={styles.headerButton} />
        </View>
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
        <View style={styles.headerContainer}>
          <TouchableOpacity 
            style={styles.headerButton} 
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color="#333" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>{nickname || 'Profile'}</Text>
          
          <View style={styles.headerButton} />
        </View>
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
        <View style={styles.headerContainer}>
          <TouchableOpacity 
            style={styles.headerButton} 
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color="#333" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Profile</Text>
          
          <View style={styles.headerButton} />
        </View>
        <View style={styles.container}>
          <Text style={styles.emptyText}>Profile not found</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.headerContainer}>
        <TouchableOpacity 
          style={styles.headerButton} 
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>{profile.nickname}</Text>
        
        <View style={styles.headerButton} />
      </View>
      
      <View style={styles.container}>
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
                Listings
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
    borderBottomColor: '#F9A825',
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
  reviewUserInfo: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 4,
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  reviewTypeLabel: {
    fontSize: 12,
    color: '#757575',
    marginLeft: 4,
  },
  reviewContentContainer: {
    marginTop: 8,
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
  replyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    zIndex: 10,
  },
  headerButton: {
    padding: 8,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
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
  reviewsTabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: 'white',
  },
  reviewsTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  reviewsActiveTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#F9A825',
  },
  reviewsTabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#757575',
  },
  reviewsActiveTabText: {
    color: '#000',
    fontWeight: 'bold',
  },
});

 