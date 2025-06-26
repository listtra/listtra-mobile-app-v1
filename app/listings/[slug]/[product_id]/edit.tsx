import { Feather } from '@expo/vector-icons';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useAuth } from '../../../../context/AuthContext';

// Primary color constant
const PRIMARY_COLOR = '#2528be';

// Listing conditions
const CONDITIONS = [
  { label: 'New', value: 'new' },
  { label: 'Like New', value: 'like_new' },
  { label: 'Lightly Used', value: 'lightly_used' },
  { label: 'Well Used', value: 'well_used' },
  { label: 'Heavily Used', value: 'heavily_used' }
];

export default function ListingEditScreen() {
  const { slug, product_id } = useLocalSearchParams();
  const { isInitializing, isAuthenticated, tokens, user } = useAuth();
  const router = useRouter();
  
  // State variables
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listingData, setListingData] = useState<any>(null);
  
  // Form data
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    condition: '',
    location: '',
  });
  
  // Image states
  const [existingImages, setExistingImages] = useState<any[]>([]);
  const [newImages, setNewImages] = useState<any[]>([]);
  const [mainImageId, setMainImageId] = useState<string | null>(null);
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);
  const [showConditionPicker, setShowConditionPicker] = useState(false);
  
  // Initialize and fetch data
  useEffect(() => {
    // Don't fetch until auth is ready
    if (isInitializing) return;
      
      // Redirect to login if not authenticated
      if (!isAuthenticated) {
        router.replace('/auth/signin');
      return;
    }
    
    // Fetch listing data
    fetchListingData();
  }, [isInitializing, isAuthenticated, tokens]);
  
  // Fetch listing data from API
  const fetchListingData = async () => {
    try {
      setLoading(true);
      
      const response = await axios.get(
        `https://backend.listtra.com/api/listings/${slug}/${product_id}/`,
        {
          headers: {
            Authorization: `Bearer ${tokens?.accessToken}`
          }
        }
      );
      
      const data = response.data;
      
      // Check if user is the owner
      if (user?.id !== data.seller_id) {
        setError("You don't have permission to edit this listing");
        setLoading(false);
        return;
      }
      
      // Set listing data
      setListingData(data);
      
      // Set form data
      setFormData({
        title: data.title || '',
        description: data.description || '',
        price: data.price?.toString() || '',
        condition: data.condition || '',
        location: data.location || '',
      });
      
      // Set images
      if (data.images && Array.isArray(data.images)) {
        setExistingImages(data.images);
        
        // Find primary image
        const primaryImage = data.images.find((img: {id: string, is_primary: boolean}) => img.is_primary === true);
        if (primaryImage) {
          setMainImageId(primaryImage.id);
        } else if (data.images.length > 0) {
          setMainImageId(data.images[0].id);
        }
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching listing:', error);
      setError('Failed to load listing. Please try again.');
      setLoading(false);
    }
  };
  
  // Handle form input changes
  const handleInputChange = (name: string, value: string) => {
    // Special handling for price to ensure only numbers and decimal
    if (name === 'price') {
      // Allow only valid decimal input
      const priceRegex = /^(\d+)?(\.\d{0,2})?$/;
      if (value === '' || priceRegex.test(value)) {
        setFormData(prev => ({ ...prev, [name]: value }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };
  
  // Handle selecting condition
  const selectCondition = (condition: string) => {
    setFormData(prev => ({ ...prev, condition }));
    setShowConditionPicker(false);
  };
  
  // Pick images from device
  const pickImages = async () => {
    // Check if adding more images would exceed limit
    if (existingImages.length - imagesToDelete.length + newImages.length >= 5) {
      Alert.alert('Limit Reached', 'You can only have a maximum of 5 images');
      return;
    }
    
    // Request permission
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'You need to allow access to your photos to upload images');
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      allowsMultipleSelection: true,
      selectionLimit: 5 - (existingImages.length - imagesToDelete.length + newImages.length),
      quality: 1,
    });
    
    if (!result.canceled && result.assets.length > 0) {
      // Add new images
      setNewImages(prev => [...prev, ...result.assets]);
    }
  };
  
  // Remove an existing image
  const handleRemoveExistingImage = (imageId: string) => {
    // Add to images to delete
    setImagesToDelete(prev => [...prev, imageId]);
    
    // If this was the main image, choose a new one
    if (mainImageId === imageId) {
      // Find first image that's not being deleted
      const remainingImages = existingImages.filter(
        (img: any) => !imagesToDelete.includes(img.id) && img.id !== imageId
      );
      
      if (remainingImages.length > 0) {
        setMainImageId(remainingImages[0].id);
      } else if (newImages.length > 0) {
        // No existing images left, use first new image
        setMainImageId(null);
      } else {
        setMainImageId(null);
      }
    }
  };
  
  // Remove a new image
  const handleRemoveNewImage = (index: number) => {
    setNewImages(prev => {
      const updated = [...prev];
      updated.splice(index, 1);
      return updated;
    });
  };
  
  // Set an existing image as main
  const handleSetMainExistingImage = (imageId: string) => {
    setMainImageId(imageId);
  };
  
  // Set a new image as main
  const handleSetMainNewImage = (index: number) => {
    // Clear mainImageId and remember this is the main new image
    setMainImageId(null);
  };
  
  // Calculate remaining image count
  const getRemainingImageCount = () => {
    const currentCount = existingImages.length - imagesToDelete.length + newImages.length;
    return 5 - currentCount;
  };
  
  // Submit form to update listing
  const handleSubmit = async () => {
    // Validate form
    if (!formData.title || !formData.description || !formData.price || !formData.condition) {
      Alert.alert('Validation Error', 'Please fill in all required fields');
      return;
    }
    
    const priceValue = parseFloat(formData.price);
    if (isNaN(priceValue) || priceValue <= 0) {
      Alert.alert('Invalid Price', 'Price must be greater than 0');
      return;
    }
    
    // Check if we have at least one image
    const remainingImages = existingImages.filter(
      img => !imagesToDelete.includes(img.id)
    );
    if (remainingImages.length + newImages.length === 0) {
      Alert.alert('Image Required', 'At least one image is required');
      return;
    }
    
    setSubmitting(true);
    
    try {
      // Create form data for multipart submission
      const formDataToSubmit = new FormData();
      formDataToSubmit.append('title', formData.title);
      formDataToSubmit.append('description', formData.description);
      formDataToSubmit.append('price', formData.price);
      formDataToSubmit.append('condition', formData.condition);
      formDataToSubmit.append('location', formData.location || '');
      
      // Add user ID for ownership verification
      if (user?.id) {
        formDataToSubmit.append('seller_id', user.id.toString());
      }
      
      // Handle images to delete
      if (imagesToDelete.length > 0) {
        formDataToSubmit.append('images_to_delete', JSON.stringify(imagesToDelete));
      }
      
      // Handle new images
      newImages.forEach((image, index) => {
        const uri = image.uri;
        const uriParts = uri.split('.');
        const fileType = uriParts[uriParts.length - 1];
        
        formDataToSubmit.append('images', {
          uri,
          name: `image_${index}.${fileType}`,
          type: `image/${fileType}`,
        } as any);
      });
      
      // Set main image if specified
      if (mainImageId) {
        formDataToSubmit.append('main_image_id', mainImageId);
      }
      
      // Submit update
      const response = await axios.put(
        `https://backend.listtra.com/api/listings/${slug}/${product_id}/`,
        formDataToSubmit,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${tokens?.accessToken}`
          }
        }
      );
      
      Alert.alert(
        'Success',
        'Listing updated successfully',
        [
          { 
            text: 'OK', 
            onPress: () => {
              // Just navigate back after successful update
              router.back();
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error updating listing:', error);
      Alert.alert('Error', 'Failed to update listing. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Loading screen
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen 
          options={{
            title: 'Edit Listing',
            headerShown: false
          }}
        />
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text style={styles.loadingText}>Loading listing details...</Text>
      </View>
    );
  }
  
  // Error screen
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Stack.Screen 
          options={{
            title: 'Edit Listing',
            headerShown: true,
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()}>
                <Feather name="chevron-left" size={24} color={PRIMARY_COLOR} />
              </TouchableOpacity>
            ),
          }} 
        />
        <Feather name="alert-circle" size={60} color="#ff3b30" style={styles.errorIcon} />
        <Text style={styles.errorTitle}>Access Denied</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.errorSubtext}>You can only edit listings that you own.</Text>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Back to Listings</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      
      
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.contentContainer}>
        {/* Title Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            value={formData.title}
            onChangeText={(text) => handleInputChange('title', text)}
            placeholder="Enter listing title"
          />
        </View>
        
        {/* Description Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.description}
            onChangeText={(text) => handleInputChange('description', text)}
            placeholder="Enter detailed description"
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
        </View>
        
        {/* Price Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Price (A$) *</Text>
          <TextInput
            style={styles.input}
            value={formData.price}
            onChangeText={(text) => handleInputChange('price', text)}
            placeholder="Enter price"
            keyboardType="decimal-pad"
          />
        </View>
        
        {/* Condition Dropdown */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Condition *</Text>
          <TouchableOpacity 
            style={styles.pickerButton}
            onPress={() => setShowConditionPicker(!showConditionPicker)}
          >
            <Text style={styles.pickerButtonText}>
              {formData.condition ? 
                CONDITIONS.find(c => c.value === formData.condition)?.label || 'Select Condition' : 
                'Select Condition'}
            </Text>
            <Feather 
              name={showConditionPicker ? "chevron-up" : "chevron-down"} 
              size={20} 
              color="#666" 
            />
          </TouchableOpacity>
          
          {showConditionPicker && (
            <View style={styles.pickerOptions}>
              {CONDITIONS.map((condition) => (
                <TouchableOpacity
                  key={condition.value}
                  style={[
                    styles.pickerOption,
                    formData.condition === condition.value && styles.pickerOptionSelected
                  ]}
                  onPress={() => selectCondition(condition.value)}
                >
                  <Text 
                    style={[
                      styles.pickerOptionText,
                      formData.condition === condition.value && styles.pickerOptionTextSelected
                    ]}
                  >
                    {condition.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        
        {/* Location Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Location *</Text>
          <TextInput
            style={styles.input}
            value={formData.location}
            onChangeText={(text) => handleInputChange('location', text)}
            placeholder="Enter pickup location"
          />
        </View>
        
        {/* Image Management Section */}
        <View style={styles.imageSection}>
          <Text style={styles.sectionTitle}>Manage Images</Text>
          
          {/* Existing Images */}
          {existingImages.length > 0 && (
            <View style={styles.imagesContainer}>
              <Text style={styles.subsectionTitle}>Current Images</Text>
              <ScrollView horizontal style={styles.imageScrollView}>
                {existingImages.map((image) => {
                  // Skip images marked for deletion
                  if (imagesToDelete.includes(image.id)) return null;
                  
                  // Check if this is the main image
                  const isMain = mainImageId === image.id;
                  
                  return (
                    <View key={image.id} style={styles.imageContainer}>
                      <View style={styles.imageWrapper}>
                        <Image
                          source={{ uri: image.image_url }}
                          style={[
                            styles.image,
                            isMain && styles.mainImage
                          ]}
                        />
                        {isMain && (
                          <View style={styles.mainImageBadge}>
                            <Text style={styles.mainImageText}>Main</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.imageActions}>
                        <TouchableOpacity
                          style={styles.imageActionButton}
                          onPress={() => handleRemoveExistingImage(image.id)}
                        >
                          <Text style={styles.removeText}>Remove</Text>
                        </TouchableOpacity>
                        
                        {!isMain && (
                          <TouchableOpacity
                            style={styles.imageActionButton}
                            onPress={() => handleSetMainExistingImage(image.id)}
                          >
                            <Text style={styles.setMainText}>Set as Main</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}
          
          {/* New Images */}
          {newImages.length > 0 && (
            <View style={styles.imagesContainer}>
              <Text style={styles.subsectionTitle}>New Images to Add</Text>
              <ScrollView horizontal style={styles.imageScrollView}>
                {newImages.map((image, index) => {
                  // Will this be the main image? True if no mainImageId is set and this is the first new image
                  const willBeMain = !mainImageId && index === 0;
                  
                  return (
                    <View key={index} style={styles.imageContainer}>
                      <View style={styles.imageWrapper}>
                        <Image
                          source={{ uri: image.uri }}
                          style={[
                            styles.image,
                            willBeMain && styles.mainImage
                          ]}
                        />
                        {willBeMain && (
                          <View style={styles.mainImageBadge}>
                            <Text style={styles.mainImageText}>Will be Main</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.imageActions}>
                        <TouchableOpacity
                          style={styles.imageActionButton}
                          onPress={() => handleRemoveNewImage(index)}
                        >
                          <Text style={styles.removeText}>Remove</Text>
                        </TouchableOpacity>
                        
                        {mainImageId && index === 0 && (
                          <TouchableOpacity
                            style={styles.imageActionButton}
                            onPress={() => handleSetMainNewImage(index)}
                          >
                            <Text style={styles.setMainText}>Set as Main</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}
          
          {/* Add Images Button */}
          <View style={styles.addImagesContainer}>
            <Text style={styles.addImagesText}>
              {getRemainingImageCount() > 0
                ? `Add Images (${getRemainingImageCount()} remaining)`
                : "Maximum image limit reached (5)"}
            </Text>
            <TouchableOpacity
              style={[
                styles.addImagesButton,
                getRemainingImageCount() <= 0 && styles.disabledButton
              ]}
              onPress={pickImages}
              disabled={getRemainingImageCount() <= 0 || submitting}
            >
              <Feather name="plus" size={20} color="white" />
              <Text style={styles.addImagesButtonText}>Add Images</Text>
            </TouchableOpacity>
            <Text style={styles.addImagesNote}>
              Upload up to {getRemainingImageCount()} more images (max 5MB each).
            </Text>
          </View>
        </View>
        
        {/* Required Fields Note */}
        <Text style={styles.requiredNote}>* Required fields</Text>
        
        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
            disabled={submitting}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.submitButton,
              (submitting || existingImages.length - imagesToDelete.length + newImages.length === 0) && 
              styles.disabledButton
            ]}
            onPress={handleSubmit}
            disabled={submitting || existingImages.length - imagesToDelete.length + newImages.length === 0}
          >
            {submitting ? (
              <View style={styles.submitButtonContent}>
                <ActivityIndicator size="small" color="white" />
                <Text style={styles.submitButtonText}>Updating...</Text>
              </View>
            ) : (
              <Text style={styles.submitButtonText}>Update Listing</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F5F5F5',
  },
  errorIcon: {
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  errorText: {
    fontSize: 16,
    color: '#ff3b30',
    marginBottom: 10,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  pickerButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#333',
  },
  pickerOptions: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginTop: 4,
    overflow: 'hidden',
  },
  pickerOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  pickerOptionSelected: {
    backgroundColor: '#f0f7ff',
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#333',
  },
  pickerOptionTextSelected: {
    fontWeight: '600',
    color: PRIMARY_COLOR,
  },
  imageSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  imagesContainer: {
    marginBottom: 20,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#555',
  },
  imageScrollView: {
    flexDirection: 'row',
  },
  imageContainer: {
    marginRight: 16,
    width: 120,
  },
  imageWrapper: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: 120,
    height: 120,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ddd',
  },
  mainImage: {
    borderColor: PRIMARY_COLOR,
  },
  mainImageBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomLeftRadius: 8,
  },
  mainImageText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  imageActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  imageActionButton: {
    padding: 4,
  },
  removeText: {
    color: '#ff3b30',
    fontSize: 12,
    fontWeight: '500',
  },
  setMainText: {
    color: PRIMARY_COLOR,
    fontSize: 12,
    fontWeight: '500',
  },
  addImagesContainer: {
    marginTop: 16,
  },
  addImagesText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  addImagesButton: {
    backgroundColor: PRIMARY_COLOR,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  addImagesButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  addImagesNote: {
    fontSize: 12,
    color: '#666',
  },
  requiredNote: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: '600',
    fontSize: 16,
  },
  submitButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
    alignItems: 'center',
  },
  submitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
}); 