import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { debounce } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Image,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PREDEFINED_CATEGORIES } from '../../constants/categories';
import { useAuth } from '../../context/AuthContext';

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
  description?: string;
  status?: string;
  created_at?: string;
  location?: string;
};

// Category Chip Component
const CategoryChip = ({ 
  category, 
  selected, 
  onPress 
}: { 
  category: string; 
  selected: boolean; 
  onPress: () => void 
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.categoryChip,
        selected && styles.selectedCategoryChip
      ]}
      onPress={onPress}
    >
      <Text 
        style={[
          styles.categoryChipText,
          selected && styles.selectedCategoryChipText
        ]}
      >
        {category}
      </Text>
    </TouchableOpacity>
  );
};

// All Categories Chip
const AllCategoriesChip = ({ 
  selected, 
  onPress 
}: { 
  selected: boolean; 
  onPress: () => void 
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.categoryChip,
        selected && styles.selectedCategoryChip
      ]}
      onPress={onPress}
    >
      <Text 
        style={[
          styles.categoryChipText,
          selected && styles.selectedCategoryChipText
        ]}
      >
        All
      </Text>
    </TouchableOpacity>
  );
};

// Recent Search Chip Component
const RecentSearchChip = ({ 
  search, 
  onPress 
}: { 
  search: string; 
  onPress: () => void 
}) => {
  return (
    <TouchableOpacity
      style={styles.recentSearchChip}
      onPress={onPress}
    >
      <Text style={styles.recentSearchChipText}>{search}</Text>
    </TouchableOpacity>
  );
};

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Listing[]>([]);
  const [recentListings, setRecentListings] = useState<Listing[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [likedItems, setLikedItems] = useState<{[key: string]: boolean}>({});
  
  const router = useRouter();
  const { isAuthenticated, tokens } = useAuth();
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
  
  useEffect(() => {
    // Fetch recent listings regardless of authentication
    fetchRecentListings();
    
    // Load recent searches from AsyncStorage
    loadRecentSearches();
  }, []);
  
  const loadRecentSearches = async () => {
    try {
      const savedSearches = await AsyncStorage.getItem('recentSearches');
      if (savedSearches) {
        setRecentSearches(JSON.parse(savedSearches));
      }
    } catch (error) {
      console.error('Error loading recent searches:', error);
    }
  };
  
  const updateRecentSearches = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    try {
      // Get current searches from AsyncStorage
      const savedSearches = await AsyncStorage.getItem('recentSearches');
      let searches = savedSearches ? JSON.parse(savedSearches) : [];
      
      // Remove the new search if it already exists
      searches = searches.filter((s: string) => s !== searchQuery);
      
      // Add the new search at the beginning
      searches.unshift(searchQuery);
      
      // Keep only the last 3 searches
      searches = searches.slice(0, 3);
      
      // Save back to AsyncStorage
      await AsyncStorage.setItem('recentSearches', JSON.stringify(searches));
      setRecentSearches(searches);
    } catch (error) {
      console.error('Error updating recent searches:', error);
    }
  };
  
  const fetchRecentListings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Create API instance with auth token if available
      const api = axios.create({
        baseURL: 'https://backend.listtra.com',
        headers: {
          ...(tokens?.accessToken ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
          'Content-Type': 'application/json',
        },
      });
      
      const response = await api.get('/api/listings/recent/');
      setRecentListings(response.data);
    } catch (error) {
      console.error('Error fetching recent listings:', error);
      setError('Failed to fetch recent listings');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Create API instance with auth token if available
      const api = axios.create({
        baseURL: 'https://backend.listtra.com',
        headers: {
          ...(tokens?.accessToken ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
          'Content-Type': 'application/json',
        },
      });
      
      const response = await api.get(`/api/listings/search/?query=${encodeURIComponent(searchQuery)}`);
      setResults(response.data);
    } catch (error) {
      console.error('Search error:', error);
      setError('Failed to perform search');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Create a debounced version of handleSearch
  const debouncedSearch = useCallback(
    debounce((searchQuery: string) => {
      handleSearch(searchQuery);
    }, 500),
    []
  );
  
  const handleSubmitSearch = (searchQuery: string) => {
    // Cancel any pending debounced search
    debouncedSearch.cancel();
    // Update recent searches
    updateRecentSearches(searchQuery);
    handleSearch(searchQuery);
  };
  
  // Toggle category selection
  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category);
      } else {
        return [...prev, category];
      }
    });
  };
  
  // Set all categories (clear selection)
  const selectAllCategories = () => {
    setSelectedCategories([]);
  };
  
  // Check if category is selected
  const isCategorySelected = (category: string) => {
    return selectedCategories.includes(category);
  };
  
  // Filter function for both search results and recent listings
  const filterByCategories = (items: Listing[]) => {
    if (!items) return [];
    if (selectedCategories.length === 0) return items;
    
    return items.filter((item) => {
      if (!item.categories) return false;
      return selectedCategories.some((cat) => item.categories?.includes(cat));
    });
  };
  
  // Apply category filter to both search results and recent listings
  const filteredResults = filterByCategories(results);
  const filteredRecentListings = filterByCategories(recentListings);
  
  // Initialize liked items state from API data
  useEffect(() => {
    const initialLikedItems: {[key: string]: boolean} = {};
    
    // Initialize from results
    results.forEach(item => {
      if (item.is_liked) {
        initialLikedItems[item.product_id] = true;
      }
    });
    
    // Initialize from recent listings
    recentListings.forEach(item => {
      if (item.is_liked) {
        initialLikedItems[item.product_id] = true;
      }
    });
    
    setLikedItems(initialLikedItems);
  }, [results, recentListings]);
  
  // Helper to get image URL
  const getImageUrl = (item: Listing) => {
    // First try to use main_image if available
    if (item.main_image) {
      return item.main_image;
    }
    
    // Then try to find primary image
    if (item.images && item.images.length > 0) {
      const primaryImage = item.images.find(img => img.is_primary === true);
      if (primaryImage?.image_url) {
        return primaryImage.image_url;
      }
      
      // Fallback to first image
      return item.images[0]?.image_url || '';
    }
    
    return '';
  };
  
  // Toggle like status with API call
  const toggleLike = async (item: Listing) => {
    // Check authentication
    if (!isAuthenticated || !tokens?.accessToken) {
      // Redirect to login if not authenticated
      router.push('/auth/signin' as any);
      return;
    }
    
    const productId = item.product_id;
    const isCurrentlyLiked = likedItems[productId] || item.is_liked || false;
    
    // Optimistically update UI
    setLikedItems(prev => ({
      ...prev,
      [productId]: !isCurrentlyLiked
    }));
    
    // Update the item in the relevant list for immediate UI feedback
    const updateListingLikeStatus = (list: Listing[]) => {
      return list.map(listingItem => 
        listingItem.product_id === productId 
          ? {...listingItem, is_liked: !isCurrentlyLiked} 
          : listingItem
      );
    };
    
    setResults(prev => updateListingLikeStatus(prev));
    setRecentListings(prev => updateListingLikeStatus(prev));
    
    try {
      // Create API instance with auth token
      const api = axios.create({
        baseURL: 'https://backend.listtra.com',
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      // Based on web implementation, use the right endpoint format
      if (isCurrentlyLiked) {
        // If currently liked, unlike it
        await api.post(`/api/listings/${item.slug || 'item'}/${productId}/unlike/`);
      } else {
        // If not liked, like it
        await api.post(`/api/listings/${item.slug || 'item'}/${productId}/like/`);
      }
      
      // Success case handled by optimistic update
      console.log(`Successfully ${isCurrentlyLiked ? 'unliked' : 'liked'} listing ${productId}`);
    } catch (error) {
      console.error('Error toggling like status:', error);
      
      // Revert optimistic update on error
      setLikedItems(prev => ({
        ...prev,
        [productId]: isCurrentlyLiked
      }));
      
      // Revert the item update in the lists
      setResults(prev => prev.map(listingItem => 
        listingItem.product_id === productId 
          ? {...listingItem, is_liked: isCurrentlyLiked} 
          : listingItem
      ));
      
      setRecentListings(prev => prev.map(listingItem => 
        listingItem.product_id === productId 
          ? {...listingItem, is_liked: isCurrentlyLiked} 
          : listingItem
      ));
      
      // Check for auth errors and redirect if needed
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        router.push('/auth/signin' as any);
      }
    }
  };
  
  // Render a listing card
  const renderListingItem = ({ item }: { item: Listing }) => {
    const imageUrl = getImageUrl(item);
    // Check if the item is liked using both the item's is_liked property and our likedItems state
    const isItemLiked = likedItems[item.product_id] !== undefined 
      ? likedItems[item.product_id] 
      : item.is_liked || false;
    
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
              resizeMode="contain"
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
  
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        
        {/* Search Input */}
        <View style={styles.searchInputContainer}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color="#333" />
          </TouchableOpacity>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                debouncedSearch(text);
              }}
              onSubmitEditing={() => handleSubmitSearch(query)}
              placeholder="Search listings..."
              placeholderTextColor="#999"
              returnKeyType="search"
              autoFocus={true}
            />
            <TouchableOpacity 
              style={styles.searchButton}
              onPress={() => handleSubmitSearch(query)}
            >
              <Ionicons name="search" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Recent Searches */}
        {recentSearches.length > 0 && !query && (
          <View style={styles.recentSearchesContainer}>
            <Text style={styles.recentSearchesTitle}>Recent Searches</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentSearchesScrollContent}
            >
              {recentSearches.map((search, index) => (
                <RecentSearchChip
                  key={index}
                  search={search}
                  onPress={() => {
                    setQuery(search);
                    handleSubmitSearch(search);
                  }}
                />
              ))}
            </ScrollView>
          </View>
        )}
        
        {/* Category Filter */}
        <View style={styles.categoriesContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesScrollContent}
          >
            <AllCategoriesChip 
              selected={selectedCategories.length === 0}
              onPress={selectAllCategories}
            />
            {PREDEFINED_CATEGORIES.map((category) => (
              <CategoryChip
                key={category}
                category={category}
                selected={isCategorySelected(category)}
                onPress={() => toggleCategory(category)}
              />
            ))}
          </ScrollView>
        </View>
        
        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        
        {/* Content */}
        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#2528be" />
          </View>
        ) : (
          <View style={styles.resultsContainer}>
            {query ? (
              // Search Results
              <View>
                <Text style={styles.resultsTitle}>Search Results for "{query}"</Text>
                {filteredResults.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyTitle}>No results found</Text>
                    <Text style={styles.emptySubtitle}>
                      {selectedCategories.length > 0
                        ? "Try adjusting your filters or search query"
                        : "Try adjusting your search query"}
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={filteredResults}
                    renderItem={renderListingItem}
                    keyExtractor={(item) => item.product_id}
                    numColumns={2}
                    contentContainerStyle={styles.listingsGrid}
                  />
                )}
              </View>
            ) : (
              // Recent Listings
              <View>
                {filteredRecentListings.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyTitle}>No listings found</Text>
                    <Text style={styles.emptySubtitle}>
                      {selectedCategories.length > 0
                        ? "Try adjusting your filters"
                        : "Be the first to create a listing!"}
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={filteredRecentListings}
                    renderItem={renderListingItem}
                    keyExtractor={(item) => item.product_id}
                    numColumns={2}
                    contentContainerStyle={styles.listingsGrid}
                  />
                )}
              </View>
            )}
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
    backgroundColor: '#f5f5f5',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
    marginRight: 5,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  searchInput: {
    flex: 1,
    height: 45,
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#333',
  },
  searchButton: {
    padding: 10,
    marginRight: 5,
  },
  recentSearchesContainer: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: 'white',
  },
  recentSearchesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  recentSearchesScrollContent: {
    paddingBottom: 5,
    flexDirection: 'row',
  },
  recentSearchChip: {
    backgroundColor: '#2528be',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
  },
  recentSearchChipText: {
    color: 'white',
    fontSize: 14,
  },
  categoriesContainer: {
    paddingVertical: 10,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  categoriesScrollContent: {
    paddingHorizontal: 10,
    flexDirection: 'row',
  },
  categoryChip: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedCategoryChip: {
    backgroundColor: '#2528be',
    borderColor: '#2528be',
  },
  categoryChipText: {
    color: '#2528be',
    fontSize: 14,
    fontWeight: '500',
  },
  selectedCategoryChipText: {
    color: 'white',
  },
  errorContainer: {
    padding: 15,
    backgroundColor: '#ffebee',
    marginHorizontal: 10,
    marginTop: 10,
    borderRadius: 8,
  },
  errorText: {
    color: '#c62828',
    textAlign: 'center',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultsContainer: {
    flex: 1,
    padding: 10,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  emptyContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  listingsGrid: {
    paddingVertical: 10,
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
  likeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0)',
    borderRadius: 20,
    padding: 6,
  },
});