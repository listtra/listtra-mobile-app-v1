import { AntDesign, Ionicons, MaterialIcons } from '@expo/vector-icons';
import axios from 'axios';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Platform,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Carousel from 'react-native-snap-carousel';
import { useAuth } from '../context/AuthContext';

// Constants
const PRIMARY_COLOR = '#2528be';
const SCREEN_WIDTH = Dimensions.get('window').width;

// Define listing data type
interface ListingData {
  product_id: string;
  slug: string;
  title: string;
  description: string;
  price: string | number;
  condition: string;
  location: string;
  status: 'available' | 'pending' | 'sold';
  created_at: string;
  seller_name: string;
  seller_id: string | number;
  images: {
    id?: string;
    image_url: string;
    is_primary?: boolean;
  }[];
  main_image?: string;
  is_liked?: boolean;
  likes_count?: number;
  conversation_count?: number;
}

// Condition mapping
const formatCondition = (condition: string): string => {
  const conditionMap: Record<string, string> = {
    new_with_tags: 'New with tags',
    new_without_tags: 'New without tags',
    like_new: 'Like new',
    good: 'Good',
    fair: 'Fair',
    poor: 'Poor'
  };
  
  return conditionMap[condition] || condition;
};

// Helper function to toggle like status using native fetch API instead of axios
const toggleLikeAPI = async (
  slug: string,
  productId: string,
  isCurrentlyLiked: boolean,
  accessToken: string
) => {
  const baseURL = 'https://backend.listtra.com';
  const endpoint = `/api/listings/${slug}/${productId}/like/`;
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
    console.log('API Error in toggleLikeAPI:', error);
    throw error;
  }
};

// Simplified retry function for network operations
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
      console.log(`Attempt ${attempt + 1} failed:`, error);
      lastError = error;
      
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

export default function WebScreen() {
  const { isInitializing, user, tokens, isAuthenticated } = useAuth();
  const params = useLocalSearchParams();
  const router = useRouter();
  
  // Extract product_id and slug from the URL if available
  const uri = params.uri as string;
  const urlParts = uri ? uri.split('/') : [];
  
  // Try to extract product_id and slug from URI
  let extractedProductId = '';
  let extractedSlug = '';
  
  if (urlParts.length >= 2) {
    const lastIndex = urlParts.length - 1;
    extractedProductId = urlParts[lastIndex];
    extractedSlug = urlParts[lastIndex - 1];
  }
  
  // Use params directly if provided, otherwise use extracted values
  const product_id = params.product_id as string || extractedProductId;
  const slug = params.slug as string || extractedSlug;
  
  const [isLoading, setIsLoading] = useState(true);
  const [listingData, setListingData] = useState<ListingData | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [updateStatusLoading, setUpdateStatusLoading] = useState(false);
  const [conversationCount, setConversationCount] = useState(0);
  
  // Carousel state
  const [activeSlide, setActiveSlide] = useState(0);
  const [isImageModalVisible, setIsImageModalVisible] = useState(false);
  const [modalImageIndex, setModalImageIndex] = useState(0);
  const carouselRef = useRef<any>(null);
  const modalCarouselRef = useRef<any>(null);
  
  // Fetch listing data
  useEffect(() => {
    const fetchListingData = async () => {
      if (isInitializing || !product_id) return;
      
      try {
        setIsLoading(true);
        const url = `https://backend.listtra.com/api/listings/${product_id}/`;
        
        const headers = tokens?.accessToken 
          ? { Authorization: `Bearer ${tokens.accessToken}` } 
          : {};
          
        const response = await axios.get(url, { headers });
        setListingData(response.data);
        
        // Set initial like state
        setIsLiked(response.data.is_liked || false);
        setLikesCount(response.data.likes_count || 0);
        setConversationCount(response.data.conversation_count || 0);
        
        // Check if the current user is the owner
        if (isAuthenticated && user) {
          const userIdStr = String(user.id).trim();
          const sellerIdStr = String(response.data.seller_id || '').trim();
          
          console.log('Checking ownership:', { userId: userIdStr, sellerId: sellerIdStr });
          setIsOwner(userIdStr === sellerIdStr);
        } else {
          setIsOwner(false);
        }
      } catch (error) {
        console.error('Error fetching listing details:', error);
        Alert.alert('Error', 'Failed to load listing details');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchListingData();
  }, [isInitializing, isAuthenticated, user, product_id, tokens]);

  // Handle toggling like status
  const toggleLike = async () => {
    if (!isAuthenticated) {
      Alert.alert('Authentication Required', 'Please sign in to like this listing');
      router.push('/auth/signin');
      return;
    }
    
    // Optimistically update UI first
    setIsLiked(!isLiked);
    setLikesCount(prev => isLiked ? prev - 1 : prev + 1);
    
    try {
      // Check if we have a valid access token
      if (!tokens?.accessToken) {
        console.log('No access token available');
        router.push('/auth/signin');
        return;
      }
      
      // Store token in a const to ensure it's not null
      const accessToken = tokens.accessToken;
      
      // Use retry operation with the toggleLikeAPI function
      await retryOperation(() => 
        toggleLikeAPI(slug, product_id, isLiked, accessToken)
      );
      
      console.log(`Successfully ${isLiked ? 'unliked' : 'liked'} listing ${product_id}`);
    } catch (error: unknown) {
      // Only reach this point if all retry attempts failed
      console.log('All retry attempts failed when toggling like status:', error);
      
      // Special case: If error is about "not liked" but we're trying to unlike,
      // this is actually what we want
      if (
        error instanceof Error && 
        error.message.includes("You have not liked this listing") && 
        isLiked
      ) {
        console.log('Item was already unliked on server');
        return; // Don't show error or revert UI
      }
      
      // Revert optimistic update on error (for other types of errors)
      setIsLiked(!isLiked);
      setLikesCount(prev => isLiked ? prev + 1 : prev - 1);
      
      // Show error alert ONLY for fatal errors that couldn't be recovered
      Alert.alert(
        'Error',
        'Failed to update favorite status. Please try again.',
        [{ text: 'OK' }]
      );
      
      // Check for auth errors and redirect if needed
      if (
        (typeof error === 'object' && error !== null && 'status' in error && error.status === 401) || 
        (error instanceof Error && error.message.includes('401'))
      ) {
        router.push('/auth/signin');
      }
    }
  };

  // Handle starting a chat
  const handleStartChat = async () => {
    if (!isAuthenticated) {
      Alert.alert('Authentication Required', 'Please sign in to make an offer');
      router.push('/auth/signin');
      return;
    }
    
    try {
      const url = 'https://backend.listtra.com/api/chat/conversations/';
      const response = await axios.post(
        url,
        { listing: product_id },
        { 
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokens.accessToken}`
          } 
        }
      );
      
      console.log('Conversation created:', response.data);
      router.push({
        pathname: '/chat/[id]',
        params: { id: response.data.id }
      });
    } catch (error) {
      console.error('Error creating conversation:', error);
      Alert.alert('Error', 'Failed to start chat. Please try again.');
    }
  };

  // Handle viewing all chats
  const handleViewChats = () => {
    if (!isAuthenticated) {
      Alert.alert('Authentication Required', 'Please sign in to view chats');
      router.push('/auth/signin');
      return;
    }
    
    // Navigate to the dedicated product chats page
    router.push({
      pathname: '/chat/listing/[product_id]',
      params: { product_id }
    });
  };

  // Handle editing listing
  const handleEditListing = () => {
    if (!isAuthenticated) {
      Alert.alert('Authentication Required', 'Please sign in to edit this listing');
      router.push('/auth/signin');
      return;
    }
    
    router.push({
      pathname: '/listings/[slug]/[product_id]/edit',
      params: { slug, product_id }
    });
  };

  // Handle updating listing status
  const updateListingStatus = async (newStatus: 'available' | 'pending' | 'sold') => {
    if (!isAuthenticated) {
      Alert.alert('Authentication Required', 'Please sign in to update listing status');
      router.push('/auth/signin');
      return;
    }
    
    try {
      setUpdateStatusLoading(true);
      const url = `https://backend.listtra.com/api/listings/${slug}/${product_id}/status/`;
      
      const response = await axios.patch(
        url, 
        { status: newStatus },
        { 
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokens.accessToken}`
          } 
        }
      );
      
      // Update local state with new status
      setListingData(prev => {
        if (prev) {
          return {
            ...prev,
            status: response.data.status
          };
        }
        return prev;
      });
      
      Alert.alert('Success', `Status updated to ${response.data.status}`);
    } catch (error) {
      console.error('Error updating listing status:', error);
      Alert.alert('Error', 'Failed to update listing status');
    } finally {
      setUpdateStatusLoading(false);
    }
  };

  // Handle share listing
  const handleShareListing = async () => {
    if (!listingData) return;
    
    try {
      const shareUrl = `https://listtra.com/listings/${slug}/${product_id}`;
      const shareText = `Check out this listing: ${listingData.title}`;
      
      const shareOptions = Platform.OS === 'ios' 
        ? {
            message: shareText,
            url: shareUrl,
            title: `Listtra: ${listingData.title}`
          } 
        : {
            message: `${shareText} - ${shareUrl}`,
            title: `Listtra: ${listingData.title}`
          };
      
      await Share.share(shareOptions);
    } catch (error) {
      console.error('Error sharing listing:', error);
      Alert.alert('Error', 'Failed to share listing');
    }
  };
  
  // Show loading spinner while initializing or loading data
  if (isInitializing || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
      </View>
    );
  }
  
  // If listing data failed to load
  if (!listingData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load listing details</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  // Get main image URL
  const getMainImageUrl = () => {
    if (listingData?.main_image) {
      return listingData.main_image;
    }
    
    const primaryImage = listingData?.images.find(img => img.is_primary);
    if (primaryImage) {
      return primaryImage.image_url;
    }
    
    return listingData?.images[0]?.image_url || 'https://via.placeholder.com/400x400?text=No+Image';
  };
  
  // Get arranged images with primary first
  const getArrangedImages = () => {
    if (!listingData?.images || listingData.images.length === 0) {
      return [];
    }
    
    const images = listingData.images;
    const primaryIndex = images.findIndex(img => img.is_primary === true);
    
    if (primaryIndex === -1) {
      // No primary image, return as is
      return images;
    }
    
    // Move primary image to front
    const arrangedImages = [...images];
    const primaryImage = arrangedImages.splice(primaryIndex, 1)[0];
    return [primaryImage, ...arrangedImages];
  };
  
  // Get safe image URL (matching web implementation)
  const getImageUrl = (image?: any) => {
    if (!image) return 'https://via.placeholder.com/400x400?text=No+Image';
    
    // Check for valid image object
    if (image && image.image_url) {
      const url = image.image_url;
      if (url.startsWith('http') || url.startsWith('/')) {
        return url;
      } else {
        return `/${url}`;
      }
    }
    
    // Fallback to placeholder
    return 'https://via.placeholder.com/400x400?text=No+Image';
  };
  
  // Open image modal gallery
  const openImageModal = (index: number) => {
    setModalImageIndex(index);
    setIsImageModalVisible(true);
  };
  
  // Carousel render item
  const renderCarouselItem = ({ item }: { item: any; index: number }) => {
    return (
      <TouchableOpacity 
        style={styles.carouselItem}
        onPress={() => {
          const index = arrangedImages.findIndex(img => img.image_url === item.image_url);
          openImageModal(index >= 0 ? index : 0);
        }}
        activeOpacity={0.9}
      >
        <View style={styles.carouselImageContainer}>
          <Image 
            source={{ uri: getImageUrl(item) }} 
            style={styles.carouselImage}
            resizeMode="contain"
          />
        </View>
      </TouchableOpacity>
    );
  };
  
  // Modal carousel render item
  const renderModalCarouselItem = ({ item }: { item: any; index: number }) => {
    return (
      <View style={styles.modalCarouselItem}>
        <View style={styles.modalImageContainer}>
          <Image 
            source={{ uri: getImageUrl(item) }} 
            style={styles.modalCarouselImage}
            resizeMode="contain"
          />
        </View>
      </View>
    );
  };
  
  // Navigate to next image in carousel
  const goToNextImage = () => {
    if (carouselRef.current && activeSlide < arrangedImages.length - 1) {
      carouselRef.current.snapToNext();
    }
  };

  // Navigate to previous image in carousel
  const goToPrevImage = () => {
    if (carouselRef.current && activeSlide > 0) {
      carouselRef.current.snapToPrev();
    }
  };

  // Navigate to next image in modal carousel
  const goToNextModalImage = () => {
    if (modalCarouselRef.current && modalImageIndex < arrangedImages.length - 1) {
      modalCarouselRef.current.snapToNext();
      setModalImageIndex(modalImageIndex + 1);
    }
  };

  // Navigate to previous image in modal carousel
  const goToPrevModalImage = () => {
    if (modalCarouselRef.current && modalImageIndex > 0) {
      modalCarouselRef.current.snapToPrev();
      setModalImageIndex(modalImageIndex - 1);
    }
  };
  
  // Get status display text
  const getStatusDisplayText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pending pickup';
      case 'sold':
        return 'Sold';
      default:
        return 'Available';
    }
  };
  
  // Get the arranged images for carousel
  const arrangedImages = getArrangedImages();
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <Stack.Screen 
        options={{
          headerShown: false,
          title: "",
          headerTitle: "",
          headerBackTitle: "",
          headerBackVisible: false,
          headerShadowVisible: false,
          headerTransparent: true,
          presentation: 'card',
        }} 
      />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity 
            style={styles.backButtonCircle}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>listings</Text>
        </View>
      </View>
      
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Card container */}
        <View style={styles.cardContainer}>
          {/* Image carousel */}
          <View style={styles.carouselContainer}>
            {arrangedImages.length > 0 ? (
              <View>
                <Carousel
                  ref={carouselRef}
                  data={arrangedImages}
                  renderItem={renderCarouselItem}
                  sliderWidth={SCREEN_WIDTH}
                  itemWidth={SCREEN_WIDTH}
                  onSnapToItem={(index: number) => setActiveSlide(index)}
                  inactiveSlideScale={1}
                  loop={false}
                  vertical={false}
                />
                
                {/* Carousel navigation arrows */}
                {arrangedImages.length > 1 && (
                  <>
                    {/* Left arrow */}
                    {activeSlide > 0 && (
                      <TouchableOpacity 
                        style={[styles.carouselArrow, styles.carouselArrowLeft]}
                        onPress={goToPrevImage}
                      >
                        <Ionicons name="chevron-back" size={24} color="#fff" />
                      </TouchableOpacity>
                    )}
                    
                    {/* Right arrow */}
                    {activeSlide < arrangedImages.length - 1 && (
                      <TouchableOpacity 
                        style={[styles.carouselArrow, styles.carouselArrowRight]}
                        onPress={goToNextImage}
                      >
                        <Ionicons name="chevron-forward" size={24} color="#fff" />
                      </TouchableOpacity>
                    )}
                  </>
                )}
                
                {/* Carousel pagination dots */}
                {arrangedImages.length > 1 && (
                  <View style={styles.pagination}>
                    {arrangedImages.map((_, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.paginationDot,
                          { opacity: index === activeSlide ? 1 : 0.4 }
                        ]}
                        onPress={() => {
                          if (carouselRef.current) {
                            carouselRef.current.snapToItem(index);
                          }
                        }}
                      />
                    ))}
                  </View>
                )}
                
                {/* Edit button (only for owner) */}
                {isOwner && (
                  <TouchableOpacity 
                    style={styles.editButtonOverlay}
                    onPress={handleEditListing}
                  >
                    <Ionicons name="create-outline" size={18} color="#FFF" />
                    <Text style={styles.editButtonText}>Edit</Text>
                  </TouchableOpacity>
                )}
                
                {/* Like button */}
                <TouchableOpacity 
                  style={styles.likeButtonOverlay}
                  onPress={toggleLike}
                >
                  <AntDesign
                    name={isLiked ? "heart" : "hearto"}
                    size={24}
                    color={isLiked ? "red" : "#000"}
                  />
                </TouchableOpacity>
                
                {/* Status badge */}
                <View style={[
                  styles.statusBadge,
                  listingData?.status === 'pending' ? styles.pendingStatusBadge : 
                  listingData?.status === 'sold' ? styles.soldStatusBadge : 
                  styles.availableStatusBadge
                ]}>
                  <Text style={styles.statusText}>
                    {getStatusDisplayText(listingData?.status || 'available')}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.imageContainer}>
                <Image 
                  source={{ uri: getMainImageUrl() }} 
                  style={styles.mainImage}
                  resizeMode="contain"
                />
                
                {/* Edit button (only for owner) */}
                {isOwner && (
                  <TouchableOpacity 
                    style={styles.editButtonOverlay}
                    onPress={handleEditListing}
                  >
                    <Ionicons name="create-outline" size={18} color="#FFF" />
                    <Text style={styles.editButtonText}>Edit</Text>
                  </TouchableOpacity>
                )}
                
                {/* Like button */}
                <TouchableOpacity 
                  style={styles.likeButtonOverlay}
                  onPress={toggleLike}
                >
                  <AntDesign
                    name={isLiked ? "heart" : "hearto"}
                    size={24}
                    color={isLiked ? "red" : "#000"}
                  />
                </TouchableOpacity>
                
                {/* Status badge */}
                <View style={[
                  styles.statusBadge,
                  listingData?.status === 'pending' ? styles.pendingStatusBadge : 
                  listingData?.status === 'sold' ? styles.soldStatusBadge : 
                  styles.availableStatusBadge
                ]}>
                  <Text style={styles.statusText}>
                    {getStatusDisplayText(listingData?.status || 'available')}
                  </Text>
                </View>
              </View>
            )}
          </View>
        
          <View style={styles.detailsContainer}>
            {/* Title */}
            <Text style={styles.title}>{listingData?.title}</Text>
            
            {/* Price */}
            <Text style={styles.price}>${listingData?.price}</Text>
            
            {/* Condition */}
            <View style={styles.infoRow}>
              <MaterialIcons name="verified-user" size={18} color="#2528be" />
              <Text style={styles.infoText}>{formatCondition(listingData?.condition || '')}</Text>
            </View>
            
            {/* Location */}
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={18} color="#2528be" />
              <Text style={styles.infoText}>{listingData?.location}</Text>
            </View>
            
            {/* Description section */}
            <View style={styles.descriptionContainer}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{listingData?.description}</Text>
            </View>
          </View>
        </View>
        
        {/* Add bottom padding to ensure content doesn't get hidden behind footer */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
      
      {/* Footer with action buttons */}
      <SafeAreaView style={styles.safeFooterContainer} edges={['bottom']}>
        <View style={styles.footerContainer}>
          {isOwner ? (
            <View style={styles.ownerActionsContainer}>
              {/* Status specific action buttons */}
              {listingData?.status === 'pending' ? (
                <View style={styles.ownerStatusActionsRow}>
                  <TouchableOpacity
                    style={styles.cancelPendingButton}
                    onPress={() => updateListingStatus('available')}
                    disabled={updateStatusLoading}
                  >
                    <Text style={styles.cancelPendingButtonText}>
                      {updateStatusLoading ? 'Updating...' : 'Cancel Pending'}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.markAsSoldButton}
                    onPress={() => updateListingStatus('sold')}
                    disabled={updateStatusLoading}
                  >
                    <Text style={styles.markAsSoldButtonText}>
                      {updateStatusLoading ? 'Updating...' : 'Mark as Sold'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : listingData?.status === 'available' ? (
                <View style={styles.ownerStatusActionsRow}>
                  <TouchableOpacity
                    style={styles.pendingPickupButton}
                    onPress={() => updateListingStatus('pending')}
                    disabled={updateStatusLoading}
                  >
                    <Text style={styles.pendingPickupButtonText}>
                      {updateStatusLoading ? 'Updating...' : 'Pending pickup'}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.markAsSoldButton}
                    onPress={() => updateListingStatus('sold')}
                    disabled={updateStatusLoading}
                  >
                    <Text style={styles.markAsSoldButtonText}>
                      {updateStatusLoading ? 'Updating...' : 'Mark as Sold'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.cancelSoldButton}
                  onPress={() => updateListingStatus('available')}
                  disabled={updateStatusLoading}
                >
                  <Text style={styles.cancelPendingButtonText}>
                    {updateStatusLoading ? 'Updating...' : 'Cancel Sold'}
                  </Text>
                </TouchableOpacity>
              )}
              
              {/* View chats button */}
              <TouchableOpacity
                style={styles.viewChatsButton}
                onPress={handleViewChats}
              >
                <Text style={styles.viewChatsButtonText}>
                  View all chats {conversationCount > 0 ? `(${conversationCount})` : ''}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.buyerActionsContainer}>
              <TouchableOpacity
                style={styles.makeOfferButton}
                onPress={handleStartChat}
              >
                <Text style={styles.makeOfferButtonText}>Make Offer</Text>
              </TouchableOpacity>
              
              <View style={styles.buyerSecondaryActions}>
                <TouchableOpacity
                  style={styles.actionButtonFooter}
                  onPress={handleShareListing}
                >
                  <Ionicons name="share-outline" size={22} color="#000" />
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.actionButtonFooter}
                  onPress={handleStartChat}
                >
                  <Ionicons name="chatbubble-outline" size={22} color="#000" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>
      
      {/* Image modal/gallery */}
      <Modal
        visible={isImageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsImageModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.modalCloseButton}
            onPress={() => setIsImageModalVisible(false)}
          >
            <AntDesign name="close" size={24} color="white" />
          </TouchableOpacity>
          
          <View style={styles.modalMainContent}>
            <Carousel
              ref={modalCarouselRef}
              data={arrangedImages}
              renderItem={renderModalCarouselItem}
              sliderWidth={SCREEN_WIDTH}
              itemWidth={SCREEN_WIDTH}
              firstItem={modalImageIndex}
              inactiveSlideScale={1}
              inactiveSlideOpacity={1}
              vertical={false}
              onSnapToItem={(index: number) => setModalImageIndex(index)}
            />
            
            {/* Modal navigation arrows */}
            {arrangedImages.length > 1 && (
              <>
                {/* Left arrow */}
                {modalImageIndex > 0 && (
                  <TouchableOpacity 
                    style={[styles.modalArrow, styles.modalArrowLeft]}
                    onPress={goToPrevModalImage}
                  >
                    <Ionicons name="chevron-back" size={28} color="#fff" />
                  </TouchableOpacity>
                )}
                
                {/* Right arrow */}
                {modalImageIndex < arrangedImages.length - 1 && (
                  <TouchableOpacity 
                    style={[styles.modalArrow, styles.modalArrowRight]}
                    onPress={goToNextModalImage}
                  >
                    <Ionicons name="chevron-forward" size={28} color="#fff" />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
          
          <View style={styles.modalFooter}>
            {/* Image counter */}
            <View style={styles.imageCounter}>
              <Text style={styles.imageCounterText}>
                {modalImageIndex + 1} / {arrangedImages.length}
              </Text>
            </View>
            
            {/* Thumbnail gallery - uncomment if you want thumbnails */}
            {/* {arrangedImages.length > 1 && (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.thumbnailContainer}
                contentContainerStyle={styles.thumbnailContentContainer}
              >
                {arrangedImages.map((image, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.thumbnailItem,
                      modalImageIndex === index && styles.thumbnailItemActive
                    ]}
                    onPress={() => {
                      if (modalCarouselRef.current) {
                        modalCarouselRef.current.snapToItem(index);
                        setModalImageIndex(index);
                      }
                    }}
                  >
                    <Image 
                      source={{ uri: getImageUrl(image) }} 
                      style={styles.thumbnailImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )} */}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#555',
    marginBottom: 20,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    paddingTop: Platform.OS === 'android' ? 10 : 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: 'white',
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 15,
    color: '#000',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollViewContent: {
    paddingBottom: Platform.OS === 'ios' ? 20 : 20,
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  cardContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  carouselContainer: {
    position: 'relative',
    width: '100%',
    height: 300,
    backgroundColor: '#f8f8f8',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 300,
    backgroundColor: '#f8f8f8',
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  editButtonOverlay: {
    position: 'absolute',
    top: 15,
    left: 15,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    zIndex: 10,
  },
  editButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 4,
  },
  likeButtonOverlay: {
    position: 'absolute',
    top: 15,
    right: 15,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(200, 200, 200, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
    zIndex: 10,
  },
  statusBadge: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  availableStatusBadge: {
    backgroundColor: PRIMARY_COLOR,
  },
  pendingStatusBadge: {
    backgroundColor: '#ff9800',
  },
  soldStatusBadge: {
    backgroundColor: '#f44336',
  },
  statusText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  detailsContainer: {
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
  },
  price: {
    fontSize: 20,
    fontWeight: '700',
    color: PRIMARY_COLOR,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 15,
    color: '#444',
    marginLeft: 10,
  },
  descriptionContainer: {
    marginTop: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    marginBottom: 10,
  },
  description: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
  },
  bottomSpacer: {
    height: 60, // Add space at the bottom to prevent content from being hidden behind footer
  },
  safeFooterContainer: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  footerContainer: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 16 : 16,
    backgroundColor: 'white',
  },
  ownerActionsContainer: {
    borderTopRightRadius: 16,
    borderTopLeftRadius: 16,
    paddingBottom: 10,
    gap: 12,
  },
  ownerStatusActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    paddingBottom: 0,
  },
  cancelPendingButton: {
    flex: 1,
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelPendingButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  markAsSoldButton: {
    flex: 1,
    backgroundColor: 'white',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
  },
  markAsSoldButtonText: {
    color: PRIMARY_COLOR,
    fontWeight: '600',
    fontSize: 16,
  },
  pendingPickupButton: {
    flex: 1,
    backgroundColor: 'white',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
  },
  pendingPickupButtonText: {
    color: PRIMARY_COLOR,
    fontWeight: '600',
    fontSize: 16,
  },
  cancelSoldButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewChatsButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewChatsButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  buyerActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 10,
  },
  makeOfferButton: {
    flex: 1,
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  makeOfferButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  buyerSecondaryActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButtonFooter: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  carouselItem: {
    width: SCREEN_WIDTH,
    height: 300,
    borderRadius: 10,
    overflow: 'hidden',
  },
  carouselImageContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f8f8f8',
  },
  carouselImage: {
    width: '100%',
    height: '100%',
  },
  pagination: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
    marginHorizontal: 4,
  },
  carouselArrow: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -24 }],
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselArrowLeft: {
    left: 10,
  },
  carouselArrowRight: {
    right: 10,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalMainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCarouselItem: {
    width: SCREEN_WIDTH,
    height: 300,
    borderRadius: 10,
    overflow: 'hidden',
  },
  modalImageContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f8f8f8',
  },
  modalCarouselImage: {
    width: '100%',
    height: '100%',
  },
  modalArrow: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -24 }],
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalArrowLeft: {
    left: 10,
  },
  modalArrowRight: {
    right: 10,
  },
  modalFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  imageCounter: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 4,
    borderRadius: 4,
  },
  imageCounterText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
}); 