/**
 * Utility functions for handling images
 */
import { Image } from 'expo-image';

/**
 * Optimizes a Cloudinary URL for mobile display by adding transformation parameters
 * 
 * @param url Original Cloudinary URL
 * @param width Desired width (default: 300)
 * @param quality Image quality (default: 80)
 * @returns Optimized Cloudinary URL
 */
export const optimizeCloudinaryUrl = (url: string, width: number = 300, quality: number = 80): string => {
  if (!url) {
    return getPlaceholderImage();
  }
  
  // Ensure URL is using HTTPS (iOS requires this)
  let secureUrl = url;
  if (url.startsWith('http:')) {
    secureUrl = url.replace('http:', 'https:');
  }
  
  if (!secureUrl.includes('cloudinary.com')) {
    return secureUrl;
  }

  try {
    // Parse the URL to extract relevant parts
    // Format: https://res.cloudinary.com/[cloud_name]/image/upload/[version]/[folder]/[filename]
    const urlParts = secureUrl.split('/upload/');
    if (urlParts.length !== 2) return secureUrl;

    // Create transformation string
    const transformation = `w_${width},q_${quality},f_auto,c_limit`;
    
    // Return the new URL with transformations
    return `${urlParts[0]}/upload/${transformation}/${urlParts[1]}`;
  } catch (error) {
    console.log('Error optimizing image URL:', error);
    return secureUrl;
  }
};

/**
 * Get a placeholder URL for when images fail to load
 */
export const getPlaceholderImage = (): string => {
  return 'https://res.cloudinary.com/dn1fp5v93/image/upload/w_300,q_80,f_auto/v1/placeholder-image';
};

/**
 * Preload images to improve loading performance, especially on iOS
 * 
 * @param urls Array of image URLs to preload
 */
export const preloadImages = async (urls: string[]): Promise<void> => {
  if (!urls || urls.length === 0) return;
  
  try {
    // Filter out any null/undefined URLs
    const validUrls = urls.filter(url => !!url).map(url => {
      // Ensure all URLs use HTTPS
      return url.startsWith('http:') ? url.replace('http:', 'https:') : url;
    });
    
    // Use Expo Image preloading
    await Image.prefetch(validUrls);
    console.log(`Preloaded ${validUrls.length} images successfully`);
  } catch (error) {
    console.log('Error preloading images:', error);
  }
};

/**
 * Extract image URLs from listing objects for preloading
 * 
 * @param listings Array of listing objects
 * @returns Array of image URLs
 */
export const extractImageUrlsFromListings = (listings: any[]): string[] => {
  if (!listings || listings.length === 0) return [];
  
  const urls: string[] = [];
  
  listings.forEach(listing => {
    // Check for main_image
    if (listing.main_image) {
      urls.push(optimizeCloudinaryUrl(listing.main_image));
    }
    
    // Check for images array
    if (listing.images && listing.images.length > 0) {
      listing.images.forEach((img: any) => {
        if (img.image_url) {
          urls.push(optimizeCloudinaryUrl(img.image_url));
        }
      });
    }
  });
  
  return urls;
}; 