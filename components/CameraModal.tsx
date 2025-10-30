import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ============================================================================
// CONSTANTS
// ============================================================================

const IMAGE_CONFIG = {
  MAX_DIMENSION: 1600,
  QUALITY: {
    HIGH: 0.95,
    MEDIUM: 0.85,
    LOW: 0.75
  },
  CAMERA_QUALITY: 0.95
} as const;

// ============================================================================
// TYPES
// ============================================================================

interface CameraModalProps {
  visible: boolean;
  onClose: () => void;
  onPhotosSelected: (photos: PhotoForWebView[]) => void;
  maxPhotos?: number;
  currentPhotoCount?: number;
}

// Internal photo format (for display only)
interface Photo {
  uri: string; // File URI for display
  width: number;
  height: number;
}

// Export format for WebView - pure base64 only
export interface PhotoForWebView {
  base64: string; // Pure base64 string (no data URI prefix)
  width: number;
  height: number;
}

type ModalState = 'camera' | 'preview';
type PhotoSource = 'camera' | 'gallery';
type CameraFacing = 'front' | 'back';

// ============================================================================
// UTILITIES
// ============================================================================

const logger = {
  info: __DEV__ ? console.log : () => { },
  error: console.error,
  warn: console.warn
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const CameraModal: React.FC<CameraModalProps> = ({
  visible,
  onClose,
  onPhotosSelected,
  maxPhotos = 3,
  currentPhotoCount = 0
}) => {
  // State
  const [state, setState] = useState<ModalState>('camera');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [currentPhoto, setCurrentPhoto] = useState<Photo | null>(null);
  const [currentSource, setCurrentSource] = useState<PhotoSource>('camera');
  const [isLoading, setIsLoading] = useState(false);
  const [facing, setFacing] = useState<CameraFacing>('back');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // Refs
  const cameraRef = useRef<CameraView>(null);
  const isTakingPicture = useRef(false);
  const isProcessing = useRef(false);

  // ✅ CALCULATE REMAINING SLOTS
  const remainingSlots = maxPhotos - currentPhotoCount;

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    if (visible) {
      resetState();
      if (!cameraPermission?.granted) {
        requestCameraPermission();
        return;
      }
    }
  }, [visible, cameraPermission?.granted]);

  useEffect(() => {
    return () => {
      setPhotos([]);
      setCurrentPhoto(null);
    };
  }, []);

  // ============================================================================
  // IMAGE PROCESSING
  // ============================================================================

  const processImage = useCallback(async (uri: string): Promise<Photo> => {
    if (isProcessing.current) {
      throw new Error('Already processing an image');
    }

    try {
      isProcessing.current = true;
      setIsLoading(true);

      const startTime = Date.now();

      // Get original dimensions
      const info = await ImageManipulator.manipulateAsync(
        uri,
        [],
        { compress: 1.0, base64: false }
      );

      const needsResize =
        info.width > IMAGE_CONFIG.MAX_DIMENSION ||
        info.height > IMAGE_CONFIG.MAX_DIMENSION;

      const manipulations = needsResize
        ? [{ resize: { width: IMAGE_CONFIG.MAX_DIMENSION } }]
        : [];

      const quality = needsResize
        ? IMAGE_CONFIG.QUALITY.MEDIUM
        : IMAGE_CONFIG.QUALITY.HIGH;

      // Process image and save to file
      const result = await ImageManipulator.manipulateAsync(
        uri,
        manipulations,
        {
          compress: quality,
          format: ImageManipulator.SaveFormat.JPEG
        }
      );

      const processingTime = Date.now() - startTime;

      logger.info('[CameraModal] Image processed', {
        original: { width: info.width, height: info.height },
        final: { width: result.width, height: result.height },
        needsResize,
        quality,
        processingTimeMs: processingTime
      });

      return {
        uri: result.uri,
        width: result.width,
        height: result.height
      };

    } catch (error) {
      logger.error('[CameraModal] Error processing image:', error);
      throw new Error('Failed to process image. Please try again.');
    } finally {
      isProcessing.current = false;
      setIsLoading(false);
    }
  }, []);

  // ============================================================================
  // BASE64 CONVERSION FOR WEBVIEW
  // ============================================================================

  /**
   * Convert photos to pure base64 format for webview
   * Returns ONLY base64 string without any prefix
   */
  const convertPhotosToBase64 = useCallback(async (
    photosList: Photo[]
  ): Promise<PhotoForWebView[]> => {
    try {
      setIsLoading(true);
      logger.info('[CameraModal] Converting photos to base64 for webview');

      const photosBase64 = await Promise.all(
        photosList.map(async (photo) => {
          // Convert file URI to base64
          const result = await ImageManipulator.manipulateAsync(
            photo.uri,
            [],
            {
              base64: true,
              compress: IMAGE_CONFIG.QUALITY.MEDIUM,
              format: ImageManipulator.SaveFormat.JPEG
            }
          );

          if (!result.base64) {
            throw new Error('Failed to convert image to base64');
          }

          // Return ONLY base64 string (no data URI prefix)
          return {
            base64: result.base64,
            width: result.width,
            height: result.height
          };
        })
      );

      const totalSizeKB = photosBase64.reduce((sum, p) =>
        sum + (p.base64.length * 0.75 / 1024), 0
      );

      logger.info('[CameraModal] Base64 conversion complete', {
        count: photosBase64.length,
        totalSizeKB: totalSizeKB.toFixed(2)
      });

      return photosBase64;
    } catch (error) {
      logger.error('[CameraModal] Error converting to base64:', error);
      throw new Error('Failed to prepare images for upload');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ============================================================================
  // CAMERA ACTIONS
  // ============================================================================

  const takePicture = useCallback(async () => {
    if (!cameraRef.current || !cameraPermission?.granted) return;
    if (isTakingPicture.current || isLoading) return;

    // ✅ CHECK TOTAL COUNT INCLUDING EXISTING PHOTOS
    if (currentPhotoCount + photos.length >= maxPhotos) {
      Alert.alert('Maximum Reached', `You can only add ${maxPhotos} photos total.`);
      return;
    }

    try {
      isTakingPicture.current = true;

      const photo = await cameraRef.current.takePictureAsync({
        quality: IMAGE_CONFIG.CAMERA_QUALITY,
        base64: false,
        exif: false,
      });

      if (photo) {
        const processedPhoto = await processImage(photo.uri);
        setCurrentPhoto(processedPhoto);
        setCurrentSource('camera');
        setState('preview');
      }
    } catch (error) {
      logger.error('[CameraModal] Error taking picture:', error);
      Alert.alert('Camera Error', 'Failed to take picture. Please try again.');
    } finally {
      isTakingPicture.current = false;
    }
  }, [cameraPermission?.granted, photos.length, maxPhotos, currentPhotoCount, isLoading, processImage]);

  const toggleCameraFacing = useCallback(() => {
    setFacing(prev => prev === 'back' ? 'front' : 'back');
  }, []);

  // ============================================================================
  // GALLERY ACTIONS
  // ============================================================================

  const selectFromGallery = useCallback(async () => {
    if (isLoading) return;

    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          'Permission Required',
          'Please grant photo library access to select images.'
        );
        return;
      }

      // ✅ USE REMAINING SLOTS INSTEAD OF CURRENT PHOTOS LENGTH
      const availableSlots = remainingSlots - photos.length;
      if (availableSlots <= 0) {
        Alert.alert('Maximum Reached', `You can only add ${maxPhotos} photos total.`);
        return;
      }

      const allowsMultiple = availableSlots > 1;

      logger.info('[CameraModal] Gallery selection', {
        currentPhotoCount,
        modalPhotos: photos.length,
        availableSlots,
        allowsMultiple
      });

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: !allowsMultiple,
        allowsMultipleSelection: allowsMultiple,
        selectionLimit: availableSlots,
        aspect: allowsMultiple ? undefined : [1, 1],
        quality: IMAGE_CONFIG.QUALITY.MEDIUM,
      });

      if (!result.canceled && result.assets.length > 0) {
        if (result.assets.length === 1) {
          const processedPhoto = await processImage(result.assets[0].uri);
          setCurrentPhoto(processedPhoto);
          setCurrentSource('gallery');
          setState('preview');
        } else {
          // ✅ IMPROVED ERROR HANDLING FOR MULTIPLE PHOTOS
          try {
            setIsLoading(true);
            const processedPhotos: Photo[] = [];
            for (let i = 0; i < result.assets.length; i++) {
              try {
                const processed = await processImage(result.assets[i].uri);
                processedPhotos.push(processed);
              } catch (error) {
                logger.error(`[CameraModal] Failed to process image ${i}:`, error);
                throw error;
              }
            }

            const newPhotos = [...photos, ...processedPhotos].slice(0, availableSlots);
            setPhotos(newPhotos);

            // ✅ CHECK TOTAL COUNT INCLUDING EXISTING PHOTOS
            if (currentPhotoCount + newPhotos.length >= maxPhotos) {
              handleFinish(newPhotos);
            } else {
              setState('camera');
            }
          } catch (error) {
            logger.error('[CameraModal] Error processing multiple images:', error);
            Alert.alert('Processing Error', 'Failed to process some images. Please try selecting fewer images or try again.');
          } finally {
            setIsLoading(false);
          }
        }
      }
    } catch (error) {
      logger.error('[CameraModal] Error selecting from gallery:', error);
      Alert.alert('Gallery Error', 'Failed to select photos. Please try again.');
    }
  }, [photos, maxPhotos, currentPhotoCount, remainingSlots, isLoading, processImage]);

  // ============================================================================
  // PREVIEW ACTIONS
  // ============================================================================

  const handleRetake = useCallback(() => {
    setCurrentPhoto(null);
    setState('camera');
  }, []);

  const handleContinueWithCurrent = useCallback(() => {
    if (!currentPhoto) return;

    const newPhotos = [...photos, currentPhoto];
    setPhotos(newPhotos);
    setCurrentPhoto(null);

    // ✅ CHECK TOTAL COUNT INCLUDING EXISTING PHOTOS
    if (currentPhotoCount + newPhotos.length >= maxPhotos) {
      handleFinish(newPhotos);
    } else {
      setState('camera');
    }
  }, [currentPhoto, photos, maxPhotos, currentPhotoCount]);

  const removePhoto = useCallback((index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  }, []);

  // ============================================================================
  // MODAL ACTIONS
  // ============================================================================

  const resetState = useCallback(() => {
    setState('camera');
    setPhotos([]);
    setCurrentPhoto(null);
    setIsLoading(false);
    setFacing('back');
  }, []);

  const handleFinish = useCallback(async (finalPhotos?: Photo[]) => {
    const photosToSend = finalPhotos || photos;

    if (photosToSend.length > 0) {
      try {
        setIsLoading(true);
        // Convert to base64 only when sending
        const photosBase64 = await convertPhotosToBase64(photosToSend);

        // Send photos with pure base64 to parent
        onPhotosSelected(photosBase64);
      } catch (error) {
        logger.error('[CameraModal] Error in handleFinish:', error);
        Alert.alert('Error', 'Failed to process images. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }

    onClose();
  }, [photos, onPhotosSelected, onClose, convertPhotosToBase64]);

  const handleCloseModal = useCallback(async () => {
    if (photos.length > 0) {
      try {
        const photosBase64 = await convertPhotosToBase64(photos);
        onPhotosSelected(photosBase64);
      } catch (error) {
        logger.error('[CameraModal] Error in handleCloseModal:', error);
        Alert.alert('Error', 'Failed to process images. Please try again.');
        setIsLoading(false);
        return;
      }
    }
    onClose();
  }, [photos, onPhotosSelected, onClose, convertPhotosToBase64]);

  // ============================================================================
  // RENDER FUNCTIONS
  // ============================================================================

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={handleCloseModal}
        style={styles.closeButton}
        disabled={isLoading}
      >
        <Ionicons name="close" size={24} color="white" />
      </TouchableOpacity>

      <Text style={styles.headerTitle}>
        {state === 'camera' && 'Take Photos'}
        {state === 'preview' && 'Preview'}
      </Text>

      {photos.length > 0 ? (
        <TouchableOpacity
          onPress={() => handleFinish()}
          style={styles.doneButton}
          disabled={isLoading}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.placeholder} />
      )}
    </View>
  );

  const renderCameraScreen = () => {
    if (!cameraPermission?.granted) {
      // ... existing permission UI ...
      return (
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color="rgba(255, 255, 255, 0.5)" />
          <Text style={styles.permissionTitle}>Camera Permission Required</Text>
          <Text style={styles.permissionText}>
            Grant camera access to take photos for your listing.
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestCameraPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.galleryOnlyButton}
            onPress={selectFromGallery}
          >
            <Text style={styles.galleryOnlyButtonText}>Select from Gallery</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          autofocus="on"
        />

        <View style={styles.photoCountContainer}>
          <Text style={styles.photoCountText}>
            {currentPhotoCount + photos.length}/{maxPhotos}
          </Text>
        </View>

        <View style={styles.cameraControls}>
          <TouchableOpacity
            style={styles.galleryButton}
            onPress={selectFromGallery}
            disabled={isLoading || currentPhotoCount + photos.length >= maxPhotos}
          >
            <Ionicons name="images" size={28} color="white" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.captureButton,
              (isLoading || currentPhotoCount + photos.length >= maxPhotos) && styles.captureButtonDisabled
            ]}
            onPress={takePicture}
            disabled={isLoading || currentPhotoCount + photos.length >= maxPhotos}
          >
            {isLoading ? (
              <ActivityIndicator color="#2528be" size="small" />
            ) : (
              <View style={styles.captureButtonInner} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.flipButton}
            onPress={toggleCameraFacing}
            disabled={isLoading}
          >
            <Ionicons name="camera-reverse" size={28} color="white" />
          </TouchableOpacity>
        </View>

        {/* ... existing thumbnails and loading overlay ... */}
        {photos.length > 0 && (
          <View style={styles.thumbnailsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {photos.map((photo, index) => (
                <View key={`${photo.uri}-${index}`} style={styles.thumbnailContainer}>
                  <Image source={{ uri: photo.uri }} style={styles.thumbnail} />
                  <TouchableOpacity
                    style={styles.removeThumbnailButton}
                    onPress={() => removePhoto(index)}
                    disabled={isLoading}
                  >
                    <Ionicons name="close-circle" size={20} color="#ff4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#2528be" />
            <Text style={styles.loadingText}>
              {photos.length > 0 ? 'Preparing images...' : 'Processing...'}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderPreviewScreen = () => (
    <View style={styles.previewContainer}>
      {currentPhoto && (
        <Image source={{ uri: currentPhoto.uri }} style={styles.previewImage} />
      )}

      <View style={styles.previewButtons}>
        <TouchableOpacity
          style={styles.retakeButton}
          onPress={handleRetake}
          disabled={isLoading}
        >
          <Text style={styles.retakeButtonText}>
            {currentSource === 'camera' ? 'Retake' : 'Reselect'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinueWithCurrent}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={styles.continueButtonText}>
              {currentPhotoCount + photos.length + 1 >= maxPhotos ? 'Finish' : 'Add Photo'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleCloseModal}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        {renderHeader()}
        <View style={styles.content}>
          {state === 'camera' && renderCameraScreen()}
          {state === 'preview' && renderPreviewScreen()}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  doneButton: {
    backgroundColor: '#2528be',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  doneButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#000',
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  permissionText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: '#2528be',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    marginBottom: 15,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  galleryOnlyButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  galleryOnlyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  photoCountContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  photoCountText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cameraControls: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  galleryButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2528be',
  },
  flipButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  thumbnailsContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
  },
  thumbnailContainer: {
    position: 'relative',
    marginRight: 10,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#2528be',
  },
  removeThumbnailButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: 'white',
    borderRadius: 10,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  previewImage: {
    flex: 1,
    resizeMode: 'contain',
  },
  previewButtons: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 40,
  },
  retakeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    minWidth: 120,
    alignItems: 'center',
  },
  retakeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  continueButton: {
    backgroundColor: '#2528be',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    minWidth: 120,
    alignItems: 'center',
  },
  continueButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
    marginTop: 15,
    fontWeight: '500',
  },
});

export default CameraModal;