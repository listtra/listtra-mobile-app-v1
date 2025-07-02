import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import Constants from "expo-constants";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as MediaLibrary from "expo-media-library";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import { SafeAreaView as SafeAreaViewContext } from "react-native-safe-area-context";

// Constants for form validation and dropdown options
const CATEGORIES = [
  "Electronics",
  "Mobile Phones",
  "Laptops",
  "TV & Home Theater",
  "Furniture",
  "Clothing & Accessories",
  "Books & Stationery",
  "Sports & Fitness",
  "Home & Kitchen",
  "Automotive",
  "Toys & Games",
  "Musical Instruments",
  "Art & Collectibles",
  "Jewelry & Watches",
  "Health & Beauty",
  "Other",
];

const CONDITIONS = [
  "new",
  "like_new",
  "lightly_used",
  "well_used",
  "heavily_used",
];

const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

const googleMapsApiKey = Constants?.expoConfig?.extra?.googleMapsApiKey ?? "";

// Animated Input Component (fixed version)
interface AnimatedInputProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?:
    | "default"
    | "email-address"
    | "numeric"
    | "phone-pad"
    | "decimal-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  hasError?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  maxLength?: number;
}

const AnimatedInput: React.FC<AnimatedInputProps> = ({
  label,
  placeholder,
  value,
  onChangeText,
  keyboardType = "default",
  autoCapitalize = "none",
  hasError = false,
  multiline = false,
  numberOfLines = 1,
  maxLength,
}) => {
  const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: isFocused || value ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused, value]);

  const labelStyle = {
    position: "absolute" as const,
    left: 12,
    top: animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [12, -8],
    }),
    fontSize: animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [16, 12],
    }),
    color: animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: ["#A0A0A0", "#A0A0A0"],
    }),
    backgroundColor: "white",
    paddingHorizontal: 4,
    zIndex: 1,
  };

  const getBorderColor = () => {
    if (hasError) return "#F44336";
    if (isFocused) return "#2528be";
    return "#E8E8E8";
  };

  return (
    <View style={styles.inputFieldContainer}>
      <Animated.Text style={labelStyle}>{label}</Animated.Text>
      <TextInput
                  style={[
            multiline ? styles.textAreaField : styles.inputField,
            {
              borderWidth: 1,
              borderColor: getBorderColor(),
              borderRadius: 12,
              backgroundColor: "#FFFFFF",
              paddingHorizontal: 12,
              paddingVertical: 12,
              fontSize: 16,
              color: "#333",
              minHeight: multiline ? 100 : 48,
              textAlignVertical: multiline ? "top" : "center",
            },
            hasError && { borderColor: "#F44336" },
          ]}
        placeholder=""
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        placeholderTextColor="#A0A0A0"
        multiline={multiline}
        numberOfLines={numberOfLines}
        maxLength={maxLength}
      />
    </View>
  );
};

export default function AddItem() {
  const router = useRouter();
  const placesRef = useRef<any>(null);
  const {
    user,
    tokens: { accessToken },
  } = useAuth();

  // Step management - simplified to just form and success
  const [currentStep, setCurrentStep] = useState(1);

  // Add state for WebView reference
  const [webViewRef, setWebViewRef] = useState(null);

  // Form state
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    price: string;
    category: string;
    condition: string;
    location: string;
    categories: string[];
  }>({
    title: "",
    description: "",
    price: "",
    category: CATEGORIES[0],
    condition: CONDITIONS[0],
    location: "",
    categories: [],
  });

  // Image handling state
  const [images, setImages] = useState<string[]>([]);
  const [mainImageIndex, setMainImageIndex] = useState(0);
  const [isPickingImage, setIsPickingImage] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Loading state
  const [isLoading, setIsLoading] = useState(false);

  // Add state for dropdown visibility
  const [categoryDropdownVisible, setCategoryDropdownVisible] = useState(false);
  const [conditionDropdownVisible, setConditionDropdownVisible] =
    useState(false);

  // Add state for category search and selection
  const [categorySearchVisible, setCategorySearchVisible] = useState(false);
  const [categorySearchText, setCategorySearchText] = useState("");
  const [filteredCategories, setFilteredCategories] = useState(CATEGORIES);

  // Add state for location modal
  const [locationModalVisible, setLocationModalVisible] = useState(false);

  // Add state for new listing data
  const [newListing, setNewListing] = useState<{
    slug: string;
    product_id: string;
  } | null>(null);

  // Input animation states
  const titleFocusAnim = useRef(new Animated.Value(0)).current;
  const descriptionFocusAnim = useRef(new Animated.Value(0)).current;
  const priceFocusAnim = useRef(new Animated.Value(0)).current;
  const locationFocusAnim = useRef(new Animated.Value(0)).current;
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  // Animation functions
  const animateInput = (value: Animated.Value, toValue: number) => {
    Animated.timing(value, {
      toValue,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  // Handle input focus and blur
  const handleInputFocus = (inputName: string, animValue: Animated.Value) => {
    setFocusedInput(inputName);
    animateInput(animValue, 1);
  };

  const handleInputBlur = (animValue: Animated.Value) => {
    setFocusedInput(null);
    animateInput(animValue, 0);
  };

  // Reset form when the component is focused again
  useFocusEffect(
    useCallback(() => {
      // This function will run when the screen comes into focus
      const resetForm = () => {
        // Reset to first page
        setCurrentStep(1);

        // Reset form data
        setFormData({
          title: "",
          description: "",
          price: "",
          category: CATEGORIES[0],
          condition: CONDITIONS[0],
          location: "",
          categories: [], // Reset categories array
        });

        // Reset images
        setImages([]);
        setMainImageIndex(0);

        // Clear errors
        setFormErrors({});
      };

      // Reset the form when component is focused
      resetForm();

      // After resetting, fetch location if empty
      setTimeout(() => {
        // Use setTimeout to ensure state is updated before checking
        if (!formData.location) {
          fetchAndSetCurrentLocation();
        }
      }, 0);

      // No cleanup function needed
      return () => {};
    }, [])
  );

  useEffect(() => {
    // Only request media permissions
    requestMediaLibraryPermissions();
  }, []);

  // Request permissions for photo library access
  const requestMediaLibraryPermissions = async () => {
    if (Platform.OS !== "web") {
      setIsLoading(true);
      try {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission Needed",
            "We need permission to access your photo library so you can select images for your listings.",
            [{ text: "OK" }]
          );
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Handle input changes
  const handleInputChange = (field: string, value: string) => {
    // Special handling for price field - only allow numbers and decimal
    if (field === "price") {
      // Validate price input (numbers and one decimal point only)
      if (value === "" || /^\d+(\.\d{0,2})?$/.test(value)) {
        setFormData({ ...formData, [field]: value });
      }
      return;
    }

    setFormData({ ...formData, [field]: value });

    // Clear error when field is being edited
    if (formErrors[field]) {
      const newErrors = { ...formErrors };
      delete newErrors[field];
      setFormErrors(newErrors);
    }
  };

  // Add handler for category selection
  const handleCategoryToggle = (category: string) => {
    setFormData((prevData) => {
      const currentCategories = [...prevData.categories];

      // Check if category is already selected
      const index = currentCategories.indexOf(category);

      // Toggle selection
      if (index > -1) {
        // Remove category if already selected
        currentCategories.splice(index, 1);
      } else {
        // Add category if not selected
        currentCategories.push(category);
      }

      return {
        ...prevData,
        categories: currentCategories,
      };
    });
  };

  // Handle category search
  const handleCategorySearch = (text: string) => {
    setCategorySearchText(text);
    if (text.trim() === "") {
      setFilteredCategories(CATEGORIES);
    } else {
      const filtered = CATEGORIES.filter((category) =>
        category.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredCategories(filtered);
    }
  };

  // Clear category search
  const clearCategorySearch = () => {
    setCategorySearchText("");
    setFilteredCategories(CATEGORIES);
  };

  // Request permissions for camera access
  const requestCameraPermissions = async () => {
    if (Platform.OS !== "web") {
      try {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Camera Permission Needed",
            "We need permission to access your camera so you can take photos for your listings.",
            [{ text: "OK" }]
          );
          return false;
        }
        return true;
      } catch (error) {
        console.error("Error requesting camera permission:", error);
        return false;
      }
    }
    return false;
  };

  // Request all required permissions
  const requestPermissions = async () => {
    setIsLoading(true);
    try {
      // Request media library permissions
      const libraryStatus =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log("Image picker library status:", libraryStatus.status);

      // Request camera permissions
      const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
      console.log("Image picker camera status:", cameraStatus.status);

      // Request MediaLibrary permissions for recent photos
      const mediaLibraryStatus = await MediaLibrary.requestPermissionsAsync();
      console.log("MediaLibrary status:", mediaLibraryStatus.status);

      if (
        libraryStatus.status !== "granted" ||
        cameraStatus.status !== "granted"
      ) {
        Alert.alert(
          "Permissions Needed",
          "We need permission to access your photo library and camera to select or take photos for your listings.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error("Error requesting permissions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAndSetCurrentLocation = async () => {
    try {
      // Request location permission
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Location permission is required to fetch your current location."
        );
        return;
      }
      // Get current position
      let location = await Location.getCurrentPositionAsync({});
      // Reverse geocode to get address
      let addresses = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      if (addresses.length > 0) {
        const addr = addresses[0];
        console.log("Address components:", addr);
        // Format: "Suburb, State, Country, Postal Code"
        const locationString = [
          addr.subregion || addr.city || addr.district || "",
          addr.region || "",
          addr.country || "",
          addr.postalCode || "",
        ]
          .filter(Boolean)
          .join(", ");
        handleInputChange("location", locationString);
      }
    } catch (error) {
      console.error("Error fetching location:", error);
      Alert.alert("Error", "Failed to fetch your current location.");
    }
  };

  useEffect(() => {
    // Request both permissions on component mount
    requestPermissions();
    if (!formData.location) {
      fetchAndSetCurrentLocation();
    }
  }, []);

  // Launch camera to take a photo
  const takePicture = async () => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert(
        "Maximum Images",
        `You can only upload up to ${MAX_IMAGES} images`
      );
      return;
    }

    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) return;

    setIsPickingImage(true);

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // Disable cropping
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];

        // Check file size
        if (selectedAsset.fileSize && selectedAsset.fileSize > MAX_IMAGE_SIZE) {
          Alert.alert(
            "Image Too Large",
            "The photo you took exceeds the 5MB size limit. Please try again with a lower resolution."
          );
          return;
        }

        // Add the new image
        const newImages = [...images, selectedAsset.uri];
        setImages(newImages);

        // If this is the first image, make it the main image
        if (images.length === 0) {
          setMainImageIndex(0);
        }
      }
    } catch (error) {
      console.error("Error taking picture:", error);
      Alert.alert("Error", "Failed to take photo. Please try again.");
    } finally {
      setIsPickingImage(false);
    }
  };

  // Show image source selection modal and add photos modal
  const [imageSourceModalVisible, setImageSourceModalVisible] = useState(false);
  const [addPhotosModalVisible, setAddPhotosModalVisible] = useState(false);
  const [recentPhotos, setRecentPhotos] = useState<MediaLibrary.Asset[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);

  // 1. Add state for multi-select
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);

  // Open image picker with source selection
  const openImagePicker = () => {
    setAddPhotosModalVisible(true);
    loadRecentPhotos();
  };

  // Load recent photos from gallery
  const loadRecentPhotos = async () => {
    setIsLoadingPhotos(true);
    try {
      // Request media library permissions first
      const { status } = await MediaLibrary.requestPermissionsAsync();
      console.log("MediaLibrary permission status:", status);

      if (status !== "granted") {
        console.log("Media library permission not granted, requesting...");
        const requestResult = await MediaLibrary.requestPermissionsAsync();
        console.log("Permission request result:", requestResult.status);

        if (requestResult.status !== "granted") {
          console.log("Permission denied, showing fallback");
          setIsLoadingPhotos(false);
          return;
        }
      }

      console.log("Loading recent photos...");
      // Try different approaches to get photos
      let assets;

      // First attempt: Get all media types and filter
      try {
        assets = await MediaLibrary.getAssetsAsync({
          first: 50,
          sortBy: MediaLibrary.SortBy.modificationTime,
        });
        console.log("Method 1 - All assets loaded:", assets.assets.length);
      } catch (error) {
        console.log("Method 1 failed:", error);
      }

      // Second attempt: Specify photo media type
      if (!assets || assets.assets.length === 0) {
        try {
          assets = await MediaLibrary.getAssetsAsync({
            mediaType: [MediaLibrary.MediaType.photo],
            first: 50,
            sortBy: MediaLibrary.SortBy.modificationTime,
          });
          console.log("Method 2 - Photo assets loaded:", assets.assets.length);
        } catch (error) {
          console.log("Method 2 failed:", error);
        }
      }

      // Third attempt: Basic query
      if (!assets || assets.assets.length === 0) {
        try {
          assets = await MediaLibrary.getAssetsAsync({
            first: 50,
          });
          console.log("Method 3 - Basic assets loaded:", assets.assets.length);
        } catch (error) {
          console.log("Method 3 failed:", error);
        }
      }

      if (assets && assets.assets.length > 0) {
        console.log("Successfully loaded photos:", assets.assets.length);
        console.log("First photo URI sample:", assets.assets[0]?.uri);
        setRecentPhotos(assets.assets);
      } else {
        console.log("No photos found with any method");
        setRecentPhotos([]);
      }
    } catch (error) {
      console.error("Error loading recent photos:", error);
      setRecentPhotos([]);
    } finally {
      setIsLoadingPhotos(false);
    }
  };

  // Select photo from recent photos
  const selectRecentPhoto = async (asset: MediaLibrary.Asset) => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert(
        "Maximum Images",
        `You can only upload up to ${MAX_IMAGES} images`
      );
      return;
    }

    try {
      // Get asset info to get the URI
      const assetInfo = await MediaLibrary.getAssetInfoAsync(asset);

      // Add the image to our list
      const newImages = [...images, assetInfo.localUri || assetInfo.uri];
      setImages(newImages);

      // If this is the first image, make it the main image
      if (images.length === 0) {
        setMainImageIndex(0);
      }

      // Close the modal
      setAddPhotosModalVisible(false);
    } catch (error) {
      console.error("Error selecting photo:", error);
      Alert.alert("Error", "Failed to select photo. Please try again.");
    }
  };

  // Modify the pickImage function to handle gallery selection
  const pickImage = async () => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert(
        "Maximum Images",
        `You can only upload up to ${MAX_IMAGES} images`
      );
      return;
    }

    setIsPickingImage(true);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // Disable cropping
        quality: 0.8,
        base64: false,
        allowsMultipleSelection: true,
        selectionLimit: MAX_IMAGES - images.length,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        // Handle multiple selections
        const newImages = [...images];
        let sizeExceeded = false;
        let imagesAdded = 0;

        // Process each selected asset
        for (const selectedAsset of result.assets) {
          // Check file size if available
          if (
            selectedAsset.fileSize &&
            selectedAsset.fileSize > MAX_IMAGE_SIZE
          ) {
            sizeExceeded = true;
            continue;
          }

          // Add the image if we haven't hit the limit
          if (newImages.length < MAX_IMAGES) {
            newImages.push(selectedAsset.uri);
            imagesAdded++;
          }
        }

        // Update images state
        setImages(newImages);

        // If this is the first image, make it the main image
        if (images.length === 0 && newImages.length > 0) {
          setMainImageIndex(0);
        }

        // Show appropriate feedback
        if (imagesAdded > 0) {
          if (sizeExceeded) {
            Alert.alert(
              "Some Images Added",
              `Added ${imagesAdded} photo${
                imagesAdded > 1 ? "s" : ""
              }. Some images were skipped because they exceeded the 5MB size limit.`
            );
          } else if (newImages.length === MAX_IMAGES) {
            Alert.alert(
              "Maximum Images",
              `You've reached the maximum of ${MAX_IMAGES} images.`
            );
          }
        } else if (sizeExceeded) {
          Alert.alert(
            "Images Too Large",
            "All selected images exceeded the 5MB size limit. Please select smaller images."
          );
        }
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to select images. Please try again.");
    } finally {
      setIsPickingImage(false);
    }
  };

  // Remove an image
  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    setImages(newImages);

    // Update main image index if needed
    if (mainImageIndex === index) {
      // If we removed the main image, set the first available image as main
      setMainImageIndex(newImages.length > 0 ? 0 : -1);
    } else if (mainImageIndex > index) {
      // If we removed an image before the main image, adjust the index
      setMainImageIndex(mainImageIndex - 1);
    }
  };

  // Set main image
  const setMainImage = (index: number) => {
    setMainImageIndex(index);
  };

  // Validate form
  const validateForm = () => {
    const errors: { [key: string]: string } = {};

    if (!formData.title.trim()) {
      errors.title = "Title is required";
    }

    if (!formData.description.trim()) {
      errors.description = "Description is required";
    }

    if (!formData.price) {
      errors.price = "Price is required";
    } else if (
      isNaN(parseFloat(formData.price)) ||
      parseFloat(formData.price) <= 0
    ) {
      errors.price = "Price must be a positive number";
    }

    if (!formData.location.trim()) {
      errors.location = "Location is required";
    }

    if (formData.categories.length === 0) {
      errors.categories = "At least one category is required";
    }

    if (images.length === 0) {
      errors.images = "At least one image is required";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Token validation
  const validateToken = async () => {
    if (!accessToken) {
      Alert.alert(
        "Authentication Error",
        "You need to be logged in to create a listing. Please log in and try again.",
        [
          {
            text: "OK",
            onPress: () => {
              router.push("/(auth)/login" as any);
            },
          },
        ]
      );
      return false;
    }
    return true;
  };

  // Submit form
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Validate token before proceeding
      if (!(await validateToken())) {
        setIsSubmitting(false);
        return;
      }

      // Create FormData for multipart/form-data submission
      const formDataToSend = new FormData();
      formDataToSend.append("title", formData.title);
      formDataToSend.append("description", formData.description);
      formDataToSend.append("price", formData.price);
      formDataToSend.append("condition", formData.condition);
      formDataToSend.append("location", formData.location);

      // Add categories (multiple)
      formData.categories.forEach((category) => {
        formDataToSend.append("categories", category);
      });

      // Generate a slug from the title
      const slug = formData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric chars with hyphens
        .replace(/(^-|-$)/g, "") // Remove leading/trailing hyphens
        .slice(0, 25); // Limit to 25 characters
      formDataToSend.append("slug", slug);

      // Append all images
      images.forEach((imageUri, index) => {
        const filename = imageUri.split("/").pop() || `image-${index}.jpg`;
        // In React Native, we need to use a special format for FormData
        // @ts-ignore - React Native specific FormData format
        formDataToSend.append("images", {
          uri: imageUri,
          name: filename,
          type: "image/jpeg",
        });
      });

      // Debug: Log what we're sending
      console.log("Sending data:");
      console.log("- Title:", formData.title);
      console.log(
        "- Description:",
        formData.description.substring(0, 50) + "..."
      );
      console.log("- Price:", formData.price);
      console.log("- Condition:", formData.condition);
      console.log("- Location:", formData.location);
      console.log("- Categories:", formData.categories);
      console.log("- Slug:", slug);
      console.log("- Images count:", images.length);

      // Make the API request with timeout and retry logic
      const response = await axios.post(
        "https://backend.listtra.com/api/listings/create/",
        formDataToSend,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${accessToken}`,
          },
          timeout: 30000, // 30 seconds timeout
          validateStatus: (status) => status < 500, // Don't throw for client errors
        }
      );

      if (response.status === 201) {
        // Set new listing data for success screen
        setNewListing({
          slug: response.data.slug,
          product_id: response.data.product_id || response.data.id,
        });
        // Show success screen
        setCurrentStep(2);
      }
    } catch (error: any) {
      console.error("Error creating listing:", error);
      console.error("Error details:", {
        message: error.message,
        code: error.code,
        request: error.request ? "Request made" : "No request",
        response: error.response ? "Response received" : "No response",
      });

      // Log detailed error information
      if (error.response) {
        console.error("Error status:", error.response.status);
        console.error("Error data:", error.response.data);
        console.error("Error headers:", error.response.headers);

        // Show more detailed error message
        let errorMessage = "Failed to create listing. ";
        if (error.response.status >= 400 && error.response.status < 500) {
          // Client error
          if (error.response.data) {
            if (typeof error.response.data === "string") {
              errorMessage += error.response.data;
            } else if (typeof error.response.data === "object") {
              // Handle field-specific errors
              const errors = [];
              for (const [field, messages] of Object.entries(
                error.response.data
              )) {
                if (Array.isArray(messages)) {
                  errors.push(`${field}: ${messages.join(", ")}`);
                } else {
                  errors.push(`${field}: ${messages}`);
                }
              }
              errorMessage += errors.join("\n");
            }
          } else {
            errorMessage += `Client error (${error.response.status})`;
          }
        } else if (error.response.status >= 500) {
          // Server error
          errorMessage += "Server error. Please try again later.";
        }

        Alert.alert("Error", errorMessage);
      } else if (error.request) {
        // Network error
        console.error("Network request failed:", error.request);
        Alert.alert(
          "Network Error", 
          "Unable to connect to server. Please check your internet connection and try again.\n\nIf the problem persists, the server might be temporarily unavailable.",
          [
            { text: "OK" }
          ]
        );
      } else {
        // Something else went wrong
        console.error("Request setup error:", error.message);
        Alert.alert(
          "Error",
          "An unexpected error occurred. Please try again."
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add handler for "View Item" button in success screen
  const handleViewItem = () => {
    // Just navigate to the main listings page for now
    router.push("/(tabs)/" as any);
  };

  // Add handler for "Go to Home" button in success screen
  const handleGoToHome = () => {
    router.push("/(tabs)/" as any);
  };

  // Custom Dropdown component
  interface CustomDropdownProps {
    label: string;
    options: string[];
    selectedValue: string;
    onValueChange: (value: string) => void;
    isVisible: boolean;
    setIsVisible: (isVisible: boolean) => void;
  }

  const formatConditionDisplay = (condition: string) => {
    // Handle specific condition mappings for better display
    const conditionMap: { [key: string]: string } = {
      new: "New",
      like_new: "Like New",
      lightly_used: "Lightly Used",
      well_used: "Well Used",
      heavily_used: "Heavily Used",
    };

    return (
      conditionMap[condition] ||
      condition
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    );
  };

  const CustomDropdown = ({
    label,
    options,
    selectedValue,
    onValueChange,
    isVisible,
    setIsVisible,
  }: CustomDropdownProps) => {
    return (
      <Modal
        transparent={true}
        visible={isVisible}
        animationType="fade"
        onRequestClose={() => setIsVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsVisible(false)}
        >
          <View style={styles.dropdownModal}>
            <Text style={styles.dropdownModalTitle}>{`Select ${label}`}</Text>

            <ScrollView>
              {options.map((option: string) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.dropdownItem,
                    selectedValue === option && styles.selectedDropdownItem,
                  ]}
                  onPress={() => {
                    onValueChange(option);
                    setIsVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      selectedValue === option &&
                        styles.selectedDropdownItemText,
                    ]}
                  >
                    {label === "Condition"
                      ? formatConditionDisplay(option)
                      : option}
                  </Text>
                  {selectedValue === option && (
                    <Ionicons name="checkmark" size={20} color="#2528BE" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  // If loading permissions
  if (isLoading) {
    return (
      <SafeAreaViewContext style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2528BE" />
        <Text style={styles.loadingText}>Preparing...</Text>
      </SafeAreaViewContext>
    );
  }

  return (
    <SafeAreaViewContext style={styles.container} edges={["top", "bottom"]}>
      <StatusBar style="dark" />

      {/* Add Photos Modal - Shows camera and recent photos */}
      <Modal
        transparent={false}
        visible={addPhotosModalVisible}
        animationType="slide"
        onRequestClose={() => {
          setAddPhotosModalVisible(false);
          setSelectedPhotoIds([]);
        }}
        statusBarTranslucent={true}
      >
        <View
          style={[
            styles.addPhotosModalContainer,
            { paddingTop: Platform.OS === "ios" ? 50 : 30 },
          ]}
        >
          <View style={styles.addPhotosHeader}>
            <TouchableOpacity
              onPress={() => setAddPhotosModalVisible(false)}
              style={styles.backButton}
            >
              <Ionicons name="chevron-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.addPhotosTitle}>Add Photos</Text>
            <TouchableOpacity
              onPress={async () => {
                // Find selected assets
                const selectedAssets = recentPhotos.filter(asset => selectedPhotoIds.includes(asset.id));
                // Get their URIs and add to images
                let newImages = [...images];
                for (const asset of selectedAssets) {
                  if (newImages.length >= MAX_IMAGES) break;
                  const assetInfo = await MediaLibrary.getAssetInfoAsync(asset);
                  newImages.push(assetInfo.localUri || assetInfo.uri);
                }
                setImages(newImages);
                setAddPhotosModalVisible(false);
                setSelectedPhotoIds([]);
              }}
              style={{ padding: 8, opacity: selectedPhotoIds.length === 0 ? 0.5 : 1 }}
              disabled={selectedPhotoIds.length === 0}
            >
              <Text style={{ color: '#2528BE', fontWeight: 'bold', fontSize: 16 }}>
                <Ionicons name="cloud-upload-outline" size={20} color="#333"/>
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.addPhotosContent}>
            <View style={styles.recentsHeader}>
              <Text style={styles.recentsTitle}>Recents</Text>
              <Ionicons name="chevron-down" size={20} color="#333" />
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' }}
              showsVerticalScrollIndicator={true}
            >
              {/* Camera option */}
              <TouchableOpacity
                style={styles.cameraGridItem}
                onPress={() => {
                  setAddPhotosModalVisible(false);
                  setTimeout(() => takePicture(), 300);
                }}
              >
                <Ionicons name="camera" size={40} color="#666" />
                <Text style={styles.cameraText}>Camera</Text>
              </TouchableOpacity>

              {/* Recent photos from gallery */}
              {isLoadingPhotos ? (
                <View style={styles.loadingPhotosContainer}>
                  <ActivityIndicator size="small" color="#666" />
                  <Text style={styles.loadingPhotosText}>
                    Loading photos...
                  </Text>
                </View>
              ) : (
                recentPhotos.map((asset, index) => {
                  const isSelected = selectedPhotoIds.includes(asset.id);
                  const disabled =
                    !isSelected && selectedPhotoIds.length >= MAX_IMAGES - images.length; // limit selection to remaining slots
                  return (
                    <TouchableOpacity
                      key={asset.id}
                      style={[
                        styles.photoGridItem,
                        isSelected && { borderWidth: 2, borderColor: '#2528BE' },
                        disabled && { opacity: 0.5 },
                      ]}
                      onPress={() => {
                        setSelectedPhotoIds((prev) =>
                          isSelected
                            ? prev.filter((id) => id !== asset.id)
                            : prev.length < MAX_IMAGES - images.length
                            ? [...prev, asset.id]
                            : prev
                        );
                      }}
                      disabled={disabled}
                    >
                      <Image
                        source={{ uri: asset.uri }}
                        style={styles.recentPhotoImage}
                        resizeMode="cover"
                      />
                      {isSelected && (
                        <View
                          style={{
                            position: 'absolute',
                            top: 6,
                            right: 6,
                            backgroundColor: '#2528BE',
                            borderRadius: 10,
                            padding: 2,
                          }}
                        >
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
              )}

              {/* Browse More Photos option */}
              {!isLoadingPhotos && (
                <TouchableOpacity
                  style={styles.browseMoreGridItem}
                  onPress={() => {
                    setAddPhotosModalVisible(false);
                    setTimeout(() => pickImage(), 300);
                  }}
                >
                  <Ionicons
                    name="add-circle-outline"
                    size={30}
                    color="#2528BE"
                  />
                  <Text style={styles.browseMoreText}>Browse More</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Category Search Modal */}
      <Modal
        transparent={false}
        visible={categorySearchVisible}
        animationType="slide"
        onRequestClose={() => setCategorySearchVisible(false)}
        statusBarTranslucent={true}
      >
        <View
          style={[
            styles.categoryModalContainer,
            { paddingTop: Platform.OS === "ios" ? 50 : 30 },
          ]}
        >
          <View style={styles.categoryModalHeader}>
            <TouchableOpacity
              onPress={() => {
                setCategorySearchVisible(false);
                clearCategorySearch();
              }}
              style={styles.backButton}
            >
              <Ionicons name="chevron-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.categoryModalTitle}>Select Categories</Text>
            <TouchableOpacity
              onPress={() => {
                setCategorySearchVisible(false);
                clearCategorySearch();
              }}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.categorySearchContainer}>
            <View style={styles.searchInputContainer}>
              <Ionicons
                name="search"
                size={20}
                color="#666"
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Search categories..."
                placeholderTextColor="#A0A0A0"
                value={categorySearchText}
                onChangeText={handleCategorySearch}
              />
              {categorySearchText.length > 0 && (
                <TouchableOpacity onPress={clearCategorySearch}>
                  <Ionicons name="close-circle" size={20} color="#666" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <ScrollView style={styles.categoryListContainer}>
            {filteredCategories.map((category) => (
              <TouchableOpacity
                key={category}
                style={styles.categoryCheckboxItem}
                onPress={() => handleCategoryToggle(category)}
              >
                <View style={styles.categoryCheckboxRow}>
                  <View
                    style={[
                      styles.checkbox,
                      formData.categories.includes(category) &&
                        styles.checkboxSelected,
                    ]}
                  >
                    {formData.categories.includes(category) && (
                      <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    )}
                  </View>
                  <Text style={styles.categoryCheckboxText}>{category}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Location Search Modal */}
      <Modal
        transparent={false}
        visible={locationModalVisible}
        animationType="slide"
        onRequestClose={() => setLocationModalVisible(false)}
        statusBarTranslucent={true}
      >
        <View
          style={[
            styles.locationModalContainer,
            { paddingTop: Platform.OS === "ios" ? 50 : 30 },
          ]}
        >
          <View style={styles.locationModalHeader}>
            <TouchableOpacity
              onPress={() => setLocationModalVisible(false)}
              style={styles.backButton}
            >
              <Ionicons name="chevron-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.locationModalTitle}>Select Location</Text>
            <TouchableOpacity
              onPress={() => fetchAndSetCurrentLocation()}
              style={styles.currentLocationButton}
            >
              <Ionicons name="location" size={20} color="#2528BE" />
            </TouchableOpacity>
          </View>

          <View style={styles.locationSearchContainer}>
            {/* Current Location Option */}
            <TouchableOpacity
              style={styles.currentLocationOption}
              onPress={async () => {
                setIsLoading(true);
                await fetchAndSetCurrentLocation();
                setIsLoading(false);
                setLocationModalVisible(false);
              }}
            >
              <View style={styles.currentLocationIcon}>
                <Ionicons name="location" size={24} color="#2528BE" />
              </View>
              <View style={styles.currentLocationText}>
                <Text style={styles.currentLocationTitle}>Use Current Location</Text>
                <Text style={styles.currentLocationSubtitle}>Auto-detect your pickup location</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#777" />
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.locationDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <GooglePlacesAutocomplete
              ref={placesRef}
              placeholder="Search for a location"
              minLength={2}
              fetchDetails={true}
              onPress={(data, details = null) => {
                if (details) {
                  console.log(details);
                  // Helper to get a component by type
                  const getComponent = (type: any) =>
                    details.address_components.find((c) =>
                      c.types.includes(type)
                    )?.long_name || "";
                  // Try to get suburb (sublocality or locality)
                  const suburb =
                    getComponent("sublocality") ||
                    getComponent("locality") ||
                    getComponent("administrative_area_level_2") ||
                    "";

                  const state =
                    getComponent("administrative_area_level_1") || "";
                  const country = getComponent("country") || "";
                  const postalCode = getComponent("postal_code") || "";

                  // Format: "Suburb, Country, PostalCode"
                  const locationString = [
                    suburb,
                    state,
                    country,
                    postalCode,
                  ]
                    .filter(Boolean)
                    .join(", ");
                  console.log(locationString);
                  handleInputChange("location", locationString);
                  setLocationModalVisible(false);
                } else {
                  // fallback to description if details is missing
                  handleInputChange("location", data.description);
                  setLocationModalVisible(false);
                }
              }}
              query={{
                key: googleMapsApiKey,
                language: "en",
              }}
              styles={{
                container: {
                  flex: 0,
                },
                textInputContainer: {
                  backgroundColor: "transparent",
                  borderTopWidth: 0,
                  borderBottomWidth: 0,
                  paddingHorizontal: 16,
                  marginTop: 0,
                  marginBottom: 0,
                },
                textInput: {
                  marginLeft: 0,
                  marginRight: 0,
                  height: 56,
                  color: "#333333",
                  fontSize: 16,
                  backgroundColor: "#FFFFFF",
                  borderWidth: 1,
                  borderColor: "#E8E8E8",
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 16,
                },
                predefinedPlacesDescription: {
                  color: "#1faadb",
                },
                listView: {
                  backgroundColor: "#FFFFFF",
                  borderWidth: 1,
                  borderColor: "#E8E8E8",
                  borderRadius: 12,
                  borderTopWidth: 0,
                  borderTopLeftRadius: 0,
                  borderTopRightRadius: 0,
                  marginTop: -1,
                  marginHorizontal: 16,
                  elevation: 3,
                  shadowColor: "#000",
                  shadowOffset: {
                    width: 0,
                    height: 2,
                  },
                  shadowOpacity: 0.1,
                  shadowRadius: 3.84,
                  maxHeight: 400,
                },
                row: {
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                },
                separator: {
                  height: 1,
                  backgroundColor: "#E8E8E8",
                },
                description: {
                  fontSize: 14,
                  color: "#333",
                },
              }}
              textInputProps={{
                placeholderTextColor: "#A0A0A0",
                autoCorrect: false,
                autoCapitalize: "none",
              }}
              enablePoweredByContainer={false}
              debounce={300}
              suppressDefaultStyles={false}
            />
          </View>
        </View>
      </Modal>

      {currentStep === 1 && (
        // Single Page Form
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.headerSection}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backButton}
              >
                <Ionicons name="chevron-back" size={24} color="#333" />
              </TouchableOpacity>
              <Text style={styles.pageTitle}>Add Item</Text>
            </View>

            {/* Upload Section */}
            <View style={styles.uploadContainer}>
              <TouchableOpacity
                style={styles.uploadArea}
                onPress={openImagePicker}
              >
                <Ionicons name="cloud-upload-outline" size={24} color="#666" />
                <Text style={styles.uploadText}>
                  {images.length > 0
                    ? `Uploaded (${images.length}/${MAX_IMAGES})`
                    : "Upload Images"}
                </Text>
              </TouchableOpacity>

              {images.length > 0 && (
                <ScrollView
                  horizontal
                  style={styles.uploadedImagesContainer}
                  showsHorizontalScrollIndicator={false}
                >
                  {images.map((uri, index) => (
                    <View key={index} style={styles.uploadedImageWrapper}>
                      <Image
                        source={{ uri }}
                        style={styles.uploadedImageThumb}
                      />
                      <TouchableOpacity
                        style={styles.removeImageIcon}
                        onPress={() => removeImage(index)}
                      >
                        <Ionicons
                          name="close-circle"
                          size={20}
                          color="#FF3B30"
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Form Fields */}
            <View style={styles.formContainer}>
              <View style={styles.fieldContainer}>
                <AnimatedInput
                  label="Name"
                  placeholder="Enter item name"
                  value={formData.title}
                  onChangeText={(value) => handleInputChange("title", value)}
                  keyboardType="default"
                  autoCapitalize="sentences"
                  hasError={!!formErrors.title}
                  multiline={false}
                  numberOfLines={1}
                  maxLength={100}
                />
                {formErrors.title && (
                  <Text style={styles.errorText}>{formErrors.title}</Text>
                )}
              </View>

              <View style={styles.fieldContainer}>
                <View style={styles.inputFieldContainer}>
                  <Text style={styles.floatingLabel}>Category</Text>
                  <TouchableOpacity
                    style={[
                      styles.dropdownInput,
                      formErrors.categories && styles.inputError,
                    ]}
                    onPress={() => setCategorySearchVisible(true)}
                  >
                    <View style={styles.categoryDisplayContainer}>
                      {formData.categories.length === 0 ? (
                        <Text style={styles.placeholderText}>
                          Select categories
                        </Text>
                      ) : (
                        <View style={styles.categoriesDisplay}>
                          {formData.categories
                            .slice(0, 2)
                            .map((category, index) => (
                              <View key={category} style={styles.categoryTag}>
                                <Text style={styles.categoryTagText}>
                                  {category}
                                </Text>
                              </View>
                            ))}
                          {formData.categories.length > 2 && (
                            <Text style={styles.moreText}>
                              +{formData.categories.length - 2} more
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                    <Ionicons name="chevron-down" size={20} color="#777" />
                  </TouchableOpacity>
                </View>
                {formErrors.categories && (
                  <Text style={styles.errorText}>{formErrors.categories}</Text>
                )}
              </View>

              <View style={styles.fieldContainer}>
                <AnimatedInput
                  label="Price"
                  placeholder=""
                  value={formData.price}
                  onChangeText={(value) => handleInputChange("price", value)}
                  keyboardType="decimal-pad"
                  hasError={!!formErrors.price}
                />
                {formErrors.price && (
                  <Text style={styles.errorText}>{formErrors.price}</Text>
                )}
              </View>

              <View style={styles.fieldContainer}>
                <View style={styles.inputFieldContainer}>
                  <Text style={styles.floatingLabel}>Condition</Text>
                  <TouchableOpacity
                    style={styles.dropdownInput}
                    onPress={() => setConditionDropdownVisible(true)}
                  >
                    <Text style={styles.dropdownText}>
                      {formatConditionDisplay(formData.condition)}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#777" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.fieldContainer}>
                <AnimatedInput
                  label="Description"
                  placeholder=""
                  value={formData.description}
                  onChangeText={(value) =>
                    handleInputChange("description", value)
                  }
                  multiline
                  numberOfLines={4}
                  hasError={!!formErrors.description}
                />
                {formErrors.description && (
                  <Text style={styles.errorText}>{formErrors.description}</Text>
                )}
              </View>

              <View style={styles.fieldContainer}>
                <View style={styles.inputFieldContainer}>
                  <Text style={styles.floatingLabel}>Location</Text>
                  <TouchableOpacity
                    style={[
                      styles.dropdownInput,
                      formErrors.location && styles.inputError,
                    ]}
                    onPress={() => setLocationModalVisible(true)}
                  >
                    <Text
                      style={[
                        formData.location ? styles.dropdownText : styles.placeholderText,
                      ]}
                    >
                      {formData.location || "Enter pickup location"}
                    </Text>
                    <Ionicons name="location-outline" size={20} color="#777" />
                  </TouchableOpacity>
                </View>
                {formErrors.location && (
                  <Text style={styles.errorText}>{formErrors.location}</Text>
                )}
              </View>
            </View>

            {/* Bottom Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => router.back()}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  isSubmitting && styles.saveBtnDisabled
                ]}
                onPress={handleSubmit}
                disabled={isSubmitting}
                activeOpacity={isSubmitting ? 1 : 0.8}
              >
                {isSubmitting ? (
                  <View style={styles.submittingContainer}>
                    <ActivityIndicator size="small" color="#FFF" />
                    <Text style={styles.submittingText}>Submitting...</Text>
                  </View>
                ) : (
                  <Text style={styles.saveBtnText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Custom Dropdown for Condition */}
            <CustomDropdown
              label="Condition"
              options={CONDITIONS}
              selectedValue={formData.condition}
              onValueChange={(value: string) =>
                handleInputChange("condition", value)
              }
              isVisible={conditionDropdownVisible}
              setIsVisible={setConditionDropdownVisible}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {currentStep === 2 && (
        // Success Screen
        <View style={styles.successContainer}>
          <View style={styles.successContent}>
            <View style={styles.successIconContainer}>
              <View style={styles.thumbsUpIcon}>
                <Text style={styles.thumbsUpEmoji}>👍</Text>
              </View>
            </View>
            <Text style={styles.successTitle}>Awesome!</Text>
            <Text style={styles.successMessage}>
              Your item is added to the list
            </Text>

            <TouchableOpacity
              style={styles.viewItemButton}
              onPress={handleViewItem}
            >
              <Text style={styles.viewItemButtonText}>View item</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.homeButton}
              onPress={handleGoToHome}
            >
              <Text style={styles.homeButtonText}>Home</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaViewContext>
  );
}

const windowWidth = Dimensions.get("window").width;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  contentContainer: {
    paddingBottom: 120, // Add padding for bottom buttons
  },
  headerSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    backgroundColor: "#FFFFFF",
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000000",
    marginLeft: 10,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
  },

  // Upload section styles
  uploadContainer: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  uploadArea: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    borderWidth: 1,
    borderColor: "#CCCCCC",
    borderStyle: "dashed",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    marginBottom: 8,
  },
  uploadText: {
    fontSize: 16,
    color: "#666666",
    marginLeft: 8,
  },
  uploadedImagesContainer: {
    flexDirection: "row",
    marginTop: 16,
  },
  uploadedImageWrapper: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
    position: "relative",
    overflow: "hidden",
  },
  uploadedImageThumb: {
    width: "100%",
    height: "100%",
  },
  removeImageIcon: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },

  // Form section styles
  formContainer: {
    paddingHorizontal: 16
  },
  fieldContainer: {
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 14,
    color: "#A0A0A0",
    marginBottom: 8,
    marginLeft: 4,
  },

  // AnimatedInput styles
  inputFieldContainer: {
    marginBottom: 12,
    position: "relative",
  },
  inputWrapper: {
    borderWidth: 1,
    borderColor: "#E8E8E8",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  textAreaWrapper: {
    borderWidth: 1,
    borderColor: "#E8E8E8",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  inputField: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: "#333",
    fontWeight: "400",
    minHeight: 48,
  },
  textAreaField: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: "#333",
    minHeight: 100,
    fontWeight: "400",
  },
  focusedBorder: {
    borderColor: "#2528be",
    shadowColor: "#2528be",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  errorBorder: {
    borderColor: "#FF3B30",
  },
  errorText: {
    color: "#FF3B30",
    fontSize: 14,
    marginTop: 4,
  },

  // Bottom buttons
  actionButtons: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 16,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
  },
  cancelBtnText: {
    fontSize: 16,
    color: "#666666",
    fontWeight: "500",
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 16,
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: "#2528BE",
    alignItems: "center",
  },
  saveBtnText: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  saveBtnDisabled: {
    backgroundColor: "#A0A0A0",
  },
  submittingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  submittingText: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "600",
    marginLeft: 8,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  dropdownModal: {
    width: "80%",
    maxHeight: "60%",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  dropdownModalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#333",
    textAlign: "center",
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  selectedDropdownItem: {
    backgroundColor: "#F0F7FF",
  },
  dropdownItemText: {
    fontSize: 16,
    color: "#333",
  },
  selectedDropdownItemText: {
    color: "#2528BE",
    fontWeight: "500",
  },

  // Compatibility styles for old components
  pickerContainer: {
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    borderRadius: 12,
    backgroundColor: "#FAFAFA",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 20,
  },
  dropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  dropdownButtonText: {
    fontSize: 16,
    color: "#333",
  },

  // Loading styles
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#2528BE",
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 16,
  },

  // Success screen styles
  successContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 20,
  },
  successContent: {
    width: "100%",
    alignItems: "center",
    padding: 20,
  },
  successIconContainer: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333333",
    marginBottom: 16,
    textAlign: "center",
  },
  successMessage: {
    fontSize: 16,
    color: "#666666",
    textAlign: "center",
    marginBottom: 30,
    lineHeight: 24,
  },
  thumbsUpIcon: {
    backgroundColor: "#E3F2FD",
    borderRadius: 40,
    width: 80,
    height: 80,
    justifyContent: "center",
    alignItems: "center",
  },
  thumbsUpEmoji: {
    fontSize: 40,
  },
  viewItemButton: {
    backgroundColor: "#2528BE",
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: "100%",
    alignItems: "center",
    marginBottom: 12,
  },
  viewItemButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  homeButton: {
    backgroundColor: "transparent",
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: "100%",
    alignItems: "center",
  },
  homeButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "500",
  },

  // Photo modal styles
  addPhotosModalContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  addPhotosHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  addPhotosTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  addPhotosContent: {
    flex: 1,
    padding: 16,
  },
  recentsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  recentsTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  photosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  cameraGridItem: {
    width: (windowWidth - 48) / 3,
    height: (windowWidth - 48) / 3,
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    marginRight:4
  },
  cameraText: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  photoGridItem: {
    width: (windowWidth - 48) / 3,
    height: (windowWidth - 48) / 3,
    borderRadius: 8,
    marginBottom: 8,
    overflow: "hidden",
    marginRight:4
  },
  photoPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingPhotosContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingPhotosText: {
    color: "#666",
    fontSize: 14,
    marginTop: 8,
  },
  noPhotosText: {
    color: "#999",
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
  },
  recentPhotoImage: {
    width: "100%",
    height: "100%",
  },
  browseMoreGridItem: {
    width: (windowWidth - 48) / 3,
    height: (windowWidth - 48) / 3,
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  browseMoreText: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },

  // Category modal styles
  categoryModalContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  categoryModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  categoryModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  doneButtonText: {
    fontSize: 16,
    color: "#2528BE",
    fontWeight: "bold",
  },
  categorySearchContainer: {
    padding: 16,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E8E8E8",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#000000",
    paddingVertical: 0, // Remove default padding to center text properly
  },
  categoryListContainer: {
    padding: 16,
  },
  categoryCheckboxItem: {
    padding: 8,
  },
  categoryCheckboxRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 4,
    marginRight: 8,
  },
  checkboxSelected: {
    backgroundColor: "#2528BE",
  },
  categoryCheckboxText: {
    fontSize: 16,
    color: "#333",
  },
  categorySelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E8E8E8",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 56,
  },

  // Clean modern form styles matching target UI
  floatingLabel: {
    position: "absolute",
    left: 12,
    top: -8,
    fontSize: 12,
    color: "#A0A0A0",
    backgroundColor: "white",
    paddingHorizontal: 4,
    zIndex: 1,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#E8E8E8",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: "#000000",
    backgroundColor: "#FFFFFF",
  },
  textAreaInput: {
    borderWidth: 1,
    borderColor: "#E8E8E8",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: "#000000",
    backgroundColor: "#FFFFFF",
    minHeight: 100,
    textAlignVertical: "top",
  },
  dropdownInput: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E8E8E8",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    minHeight: 48,
  },
  dropdownText: {
    fontSize: 16,
    color: "#000000",
  },
  placeholderText: {
    fontSize: 16,
    color: "#A0A0A0",
  },
  categoryDisplayContainer: {
    flex: 1,
  },
  categoriesDisplay: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
  categoryTag: {
    backgroundColor: "#E3F2FD",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
  },
  categoryTagText: {
    fontSize: 12,
    color: "#2528BE",
    fontWeight: "500",
  },
  moreText: {
    fontSize: 14,
    color: "#666666",
    fontStyle: "italic",
  },
  inputError: {
    borderColor: "#FF3B30",
  },

  // Location modal styles
  locationModalContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  locationModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  locationModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  currentLocationButton: {
    padding: 8,
    borderRadius: 20,
  },
  locationSearchContainer: {
    flex: 1,
    padding: 16,
  },
  currentLocationOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderColor: "#E8E8E8",
    borderRadius: 8,
  },
  currentLocationIcon: {
    marginRight: 16,
  },
  currentLocationText: {
    flex: 1,
  },
  currentLocationTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  currentLocationSubtitle: {
    fontSize: 14,
    color: "#666",
  },
  locationDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E8E8E8",
  },
  dividerText: {
    marginHorizontal: 16,
    color: "#666",
  },
});