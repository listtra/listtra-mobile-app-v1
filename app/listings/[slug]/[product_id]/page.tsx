import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { AntDesign, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Carousel from 'react-native-snap-carousel';
import { useAuth } from '../../../../context/AuthContext';
import { getPlaceholderImage, optimizeCloudinaryUrl } from '../../../../utils/imageUtils';

// Primary color constant
const PRIMARY_COLOR = '#2528be';
const SCREEN_WIDTH = Dimensions.get('window').width;

// Define image type
interface ListingImage {
  id?: string;
  image_url: string;
  is_primary?: boolean;
}

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
  images: ListingImage[];
  main_image?: string;
  is_liked?: boolean;
  likes_count?: number;
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

export default function ListingDetailScreen() {
  // Load Manrope font
  let [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });
  
  const params = useLocalSearchParams();
  const slug = typeof params.slug === 'string' ? params.slug : String(params.slug || '');
  const product_id = typeof params.product_id === 'string' ? params.product_id : String(params.product_id || '');
  const { isInitializing, user, tokens, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [listingData, setListingData] = useState<ListingData | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [updateStatusLoading, setUpdateStatusLoading] = useState(false);
  const [isImageModalVisible, setIsImageModalVisible] = useState(false);
  const [modalImageIndex, setModalImageIndex] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [conversationCount, setConversationCount] = useState(0);
  const carouselRef = useRef<any>(null);
  const modalCarouselRef = useRef<any>(null);
  const autoplayIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();
  const navigation = useNavigation();
  
  // Dynamically hide header when screen is focused
  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({
        headerShown: false,
        title: '',
        headerTitle: '',
        headerBackTitle: '',
        headerBackVisible: false,
      });
    }, [navigation])
  );
  
  // Fetch listing data and check ownership
  useEffect(() => {
    const fetchListingData = async () => {
      if (isInitializing) return;
      
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
  
  // Manage autoplay lifecycle
  useEffect(() => {
    if (!isLoading && listingData && listingData.images && listingData.images.length > 1) {
      // Start autoplay after a short delay
      const timeoutId = setTimeout(() => {
        startAutoplay();
      }, 2000); // Wait 2 seconds before starting autoplay
      
      return () => {
        clearTimeout(timeoutId);
        stopAutoplay();
      };
    }
    
    return () => {
      stopAutoplay();
    };
  }, [isLoading, listingData]);
  
  // Stop autoplay when user interacts with carousel
  useEffect(() => {
    return () => {
      stopAutoplay();
    };
  }, [activeSlide]);
  
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
      
      // Check for auth errors and redirect if needed - safely check properties
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
  
  // Handle opening image modal
  const openImageModal = (index: number) => {
    setModalImageIndex(index);
    setIsImageModalVisible(true);
  };
  
  // Get arranged images with primary first (like web version)
  const getArrangedImages = (): ListingImage[] => {
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
  
  // Get safe image URL with higher quality for listing details
  const getImageUrl = (image?: ListingImage, useMainImage = false, isModal = false): string => {
    // First check for main image if requested
    if (useMainImage && listingData?.main_image) {
      // Use higher quality for listing details - 800px width, 95% quality
      return optimizeCloudinaryUrl(listingData.main_image, isModal ? 1200 : 800, 95);
    }
    
    // Check for valid image object
    if (image && image.image_url) {
      // Use higher quality for listing details - 800px width, 95% quality
      return optimizeCloudinaryUrl(image.image_url, isModal ? 1200 : 800, 95);
    }
    
    // Fallback to placeholder
    return getPlaceholderImage();
  };
  
  // Carousel render item
  const renderCarouselItem = ({ item }: { item: any; index: number }) => {
    const imageUrl = getImageUrl(item);
    return (
      <TouchableOpacity 
        style={styles.carouselItem}
        onPress={() => {
          const index = arrangedImages.findIndex(img => img.image_url === item.image_url);
          openImageModal(index >= 0 ? index : 0);
        }}
        activeOpacity={0.9}
      >
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: imageUrl }} 
            style={styles.carouselImage}
            contentFit="contain"
            transition={200}
            cachePolicy="memory-disk"
            recyclingKey={imageUrl}
            placeholder={{ uri: getPlaceholderImage() }}
            onError={() => console.log('Failed to load carousel image:', imageUrl)}
          />
        </View>
      </TouchableOpacity>
    );
  };
  
  // Modal carousel render item
  const renderModalCarouselItem = ({ item }: { item: any; index: number }) => {
    const imageUrl = getImageUrl(item, false, true); // Use higher quality for modal
    return (
      <View style={styles.modalCarouselItem}>
        <View style={styles.modalImageContainer}>
          <Image 
            source={{ uri: imageUrl }} 
            style={styles.modalCarouselImage}
            contentFit="contain"
            transition={200}
            cachePolicy="memory-disk"
            recyclingKey={imageUrl}
            placeholder={{ uri: getPlaceholderImage() }}
            onError={() => console.log('Failed to load modal image:', imageUrl)}
          />
        </View>
      </View>
    );
  };
  
  // Render thumbnail item for the modal gallery
  const renderThumbnailItem = (item: ListingImage, index: number) => {
    const imageUrl = getImageUrl(item);
    return (
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
          source={{ uri: imageUrl }} 
          style={styles.thumbnailImage}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          recyclingKey={imageUrl}
          placeholder={{ uri: getPlaceholderImage() }}
          onError={() => console.log('Failed to load thumbnail image:', imageUrl)}
        />
      </TouchableOpacity>
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
  
  // Start autoplay for main carousel
  const startAutoplay = () => {
    if (arrangedImages.length > 1) {
      console.log('Starting autoplay with', arrangedImages.length, 'images');
      autoplayIntervalRef.current = setInterval(() => {
        if (carouselRef.current) {
          setActiveSlide(currentSlide => {
            const nextIndex = (currentSlide + 1) % arrangedImages.length;
            //console.log(`Autoplay: moving from slide ${currentSlide} to ${nextIndex}`);
            carouselRef.current.snapToItem(nextIndex);
            return nextIndex;
          });
        }
      }, 3000); // Change image every 3 seconds
    }
  };
  
  // Stop autoplay
  const stopAutoplay = () => {
    if (autoplayIntervalRef.current) {
      clearInterval(autoplayIntervalRef.current);
      autoplayIntervalRef.current = null;
    }
  };
  
  // Handle share listing
  const handleShareListing = async () => {
    try {
      const shareUrl = `https://listtra.com/listings/${slug}/${product_id}`;
      const shareText = `Check out this listing: ${title}`;
      
      const shareOptions = Platform.OS === 'ios' 
        ? {
            message: shareText,
            url: shareUrl,
            title: `Listtra: ${title}`
          } 
        : {
            message: `${shareText} - ${shareUrl}`,
            title: `Listtra: ${title}`
          };
      
      const result = await Share.share(shareOptions);
      
      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          // shared with activity type of result.activityType
          console.log('Shared with activity type:', result.activityType);
        } else {
          // shared
          console.log('Shared successfully');
        }
      } else if (result.action === Share.dismissedAction) {
        // dismissed
        console.log('Share dismissed');
      }
    } catch (error) {
      console.error('Error sharing listing:', error);
      Alert.alert('Error', 'Failed to share listing');
    }
  };
  
  // Show loading spinner while initializing or loading data
  if (isInitializing || isLoading || !fontsLoaded) {
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
  
  // Get arranged images
  const arrangedImages = getArrangedImages();
  
  // Extract listing data
  const { 
    title, 
    description, 
    price, 
    condition, 
    location, 
    status, 
    created_at, 
    seller_name,
  } = listingData;
  
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
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <Stack.Screen 
        options={{
          headerShown: false,
          title: undefined,
          headerTitle: undefined,
          headerBackTitle: undefined,
          headerBackVisible: false,
          headerLeft: () => null,
          headerRight: () => null,
          headerShadowVisible: false,
          headerTransparent: true,
          animation: 'slide_from_right',
          presentation: 'card',
        }} 
      />
      
      {/* Back button and title */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButtonCircle}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="#000" />
        </TouchableOpacity>
        
        {/* Edit button (only for owner) */}
        {isOwner && (
          <TouchableOpacity 
            style={styles.editButton}
            onPress={handleEditListing}
          >
            <Ionicons name="create-outline" size={18} color="#FFF" />
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Like button (top right) */}
      <TouchableOpacity 
        style={styles.likeButtonTopRight}
        onPress={toggleLike}
      >
        <View style={styles.actionButton}>
          <AntDesign
            name={isLiked ? "heart" : "hearto"}
            size={24}
            color={isLiked ? "red" : "#000"}
          />
        </View>
      </TouchableOpacity>
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
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
                onSnapToItem={(index: number) => {
                  setActiveSlide(index);
                  // Restart autoplay when user manually changes slide
                  if (arrangedImages.length > 1) {
                    stopAutoplay();
                    setTimeout(() => startAutoplay(), 1000);
                  }
                }}
                inactiveSlideScale={1}
                loop={true}
                vertical={false}
                onTouchStart={() => {
                  // Pause autoplay when user touches carousel
                  stopAutoplay();
                }}
                onTouchEnd={() => {
                  // Resume autoplay after user stops touching
                  if (arrangedImages.length > 1) {
                    setTimeout(() => startAutoplay(), 2000);
                  }
                }}
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
              
              {/* Status badge */}
              <View style={[
                styles.statusBadge,
                status === 'pending' ? styles.pendingStatusBadge : 
                status === 'sold' ? styles.soldStatusBadge : 
                styles.availableStatusBadge
              ]}>
                <Text style={styles.statusText}>
                  {getStatusDisplayText(status)}
                </Text>
              </View>
              

            </View>
          ) : (
            <View style={styles.noImageContainer}>
              <Text style={styles.noImageText}>No images available</Text>
            </View>
          )}
        </View>
        
        <View style={styles.detailsContainer}>
          {/* Title */}
          <Text style={styles.title}>{title}</Text>
          
          {/* Price */}
          <Text style={styles.price}>${price}</Text>
          
          {/* Condition */}
          <View style={styles.infoRow}>
            <MaterialIcons name="verified-user" size={18} color="#2528be" />
            <Text style={styles.infoText}>{formatCondition(condition)}</Text>
          </View>
          
          {/* Location */}
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={18} color="#2528be" />
            <Text style={styles.infoText}>{location}</Text>
          </View>
          
          {/* Description section */}
          <View style={styles.descriptionContainer}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{description}</Text>
          </View>
        </View>
      </ScrollView>
      
      {/* Footer with action buttons */}
      <View style={styles.footerContainer}>
        {isOwner ? (
          <View style={styles.ownerActionsContainer}>
            {/* Status specific action buttons */}
            {status === 'pending' ? (
              <View style={styles.ownerStatusActionsRow}>
                <TouchableOpacity
                  style={styles.cancelPendingButton}
                  onPress={() => updateListingStatus('available')}
                >
                  <Text style={styles.cancelPendingButtonText}>Cancel Pending</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.markAsSoldButton}
                  onPress={() => updateListingStatus('sold')}
                >
                  <Text style={styles.markAsSoldButtonText}>Mark as Sold</Text>
                </TouchableOpacity>
              </View>
            ) : status === 'available' ? (
              <View style={styles.ownerStatusActionsRow}>
                <TouchableOpacity
                  style={styles.pendingPickupButton}
                  onPress={() => updateListingStatus('pending')}
                >
                  <Text style={styles.pendingPickupButtonText}>Pending pickup</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.markAsSoldButton}
                  onPress={() => updateListingStatus('sold')}
                >
                  <Text style={styles.markAsSoldButtonText}>Mark as Sold</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.cancelSoldButton}
                onPress={() => updateListingStatus('available')}
              >
                <Text style={styles.cancelPendingButtonText}>Cancel Sold</Text>
              </TouchableOpacity>
            )}
            
            {/* View chats button */}
            <TouchableOpacity
              style={styles.viewChatsButton}
              onPress={handleViewChats}
            >
              <Text style={styles.viewChatsButtonText}>
                View all chats
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
            
            {/* Thumbnail gallery */}
            {arrangedImages.length > 1 && (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.thumbnailContainer}
                contentContainerStyle={styles.thumbnailContentContainer}
              >
                {arrangedImages.map((image, index) => renderThumbnailItem(image, index))}
              </ScrollView>
            )}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 10,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 30 : 30,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  backButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  likeButtonTopRight: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 30 : 30,
    right: 16,
    zIndex: 10,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  scrollView: {
    flex: 1,
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
    fontFamily: 'Manrope_400Regular',
  },
  backButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontFamily: 'Manrope_600SemiBold',
  },
  carouselContainer: {
    position: 'relative',
    backgroundColor: '#f8f8f8',
    marginTop: 0,
    height: 320,
  },
  carouselItem: {
    width: SCREEN_WIDTH,
    height: 320,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  imageContainer: {
    width: SCREEN_WIDTH * 0.85,
    height: 280,
    backgroundColor: 'white',
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  carouselImage: {
    width: '90%',
    height: '90%',
  },
  carouselArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  carouselArrowLeft: {
    left: 10,
  },
  carouselArrowRight: {
    right: 10,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
    backgroundColor: PRIMARY_COLOR,
  },
  noImageContainer: {
    width: SCREEN_WIDTH,
    height: 320,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  noImageText: {
    color: '#999',
    fontSize: 16,
    fontFamily: 'Manrope_400Regular',
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
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 14,
  },
  detailsContainer: {
    padding: 16,
    marginTop: 8,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Manrope_700Bold',
    color: '#000',
    marginBottom: 12,
  },
  price: {
    fontSize: 20,
    fontFamily: 'Manrope_700Bold',
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
    fontFamily: 'Manrope_400Regular',
  },
  descriptionContainer: {
    marginTop: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: 'Manrope_600SemiBold',
    color: '#000',
    marginBottom: 10,
  },
  description: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
    fontFamily: 'Manrope_400Regular',
  },
  footerContainer: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 16 : 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
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
    fontFamily: 'Manrope_600SemiBold',
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
    fontFamily: 'Manrope_600SemiBold',
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
    fontFamily: 'Manrope_600SemiBold',
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
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 16,
  },
  editButton: {
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
  },
  editButtonText: {
    color: 'white',
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 14,
    marginLeft: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'space-between',
    paddingVertical: 40,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalMainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    paddingVertical: 20,
  },
  modalCarouselItem: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImageContainer: {
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_WIDTH * 0.9,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 8,
    overflow: 'hidden',
  },
  modalCarouselImage: {
    width: '95%',
    height: '95%',
  },
  modalArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  modalArrowLeft: {
    left: 15,
  },
  modalArrowRight: {
    right: 15,
  },
  modalFooter: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  imageCounter: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginBottom: 20,
  },
  imageCounterText: {
    color: 'white',
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
  },
  thumbnailContainer: {
    width: '100%',
    height: 80,
    maxWidth: SCREEN_WIDTH * 0.9,
  },
  thumbnailContentContainer: {
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailItem: {
    width: 60,
    height: 60,
    marginHorizontal: 5,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailItemActive: {
    borderColor: PRIMARY_COLOR,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
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
    fontFamily: 'Manrope_600SemiBold',
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
}); 