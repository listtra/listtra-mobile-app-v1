import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

const { width } = Dimensions.get('window');

const slides = [
  {
    id: 1,
    image: require('../assets/images/onboarding1.png'),
    title: 'Buy pre-loved products, right in your neighborhood.',
    subtitle:
      'Skip the wait. Explore thousands of second-hand items from people around you — fast, easy, and location-smart.',
  },
  {
    id: 2,
    image: require('../assets/images/onboarding2.png'),
    title: 'Sell easily with zero hassle.',
    subtitle:
      'List your products in seconds, chat directly with buyers, and sell locally with safety and confidence.',
  },
  {
    id: 3,
    image: require('../assets/images/onboarding3.png'),
    title: 'Find what fits your lifestyle.',
    subtitle:
      'Discover unique finds and essentials that make your day-to-day more sustainable and affordable.',
  },
  {
    id: 4,
    image: require('../assets/images/onboarding4.png'),
    title: 'Join the Zirkly community.',
    subtitle:
      'Connect with your local marketplace — buy, sell, and grow together!',
  },
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageKey, setImageKey] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const imageScaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Animate progress bar smoothly
    Animated.timing(progress, {
      toValue: currentIndex + 1,
      duration: 400,
      useNativeDriver: false,
    }).start();

    // Update image key to force re-render with correct initial scale
    setImageKey(prev => prev + 1);
  }, [currentIndex]);

  // Separate effect for image animation
  useEffect(() => {
    // Reset and animate image scale
    imageScaleAnim.setValue(0.8);

    // Animate to normal size
    Animated.timing(imageScaleAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [imageKey]);

  const handleContinue = async () => {
    if (currentIndex < slides.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      await AsyncStorage.setItem('hasSeenOnboarding', 'true');
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 100); // 👈 small delay prevents loop
    }
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem('hasSeenOnboarding', 'true');
    setTimeout(() => {
      router.replace('/(tabs)');
    }, 100);
  };


  // Interpolate progress bar width smoothly
  const progressWidth = progress.interpolate({
    inputRange: [0, slides.length],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  const currentSlide = slides[currentIndex];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />

      {/* Skip Button - moved above progress bar */}
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBackground} />
        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
      </View>

      {/* Main Content with animated slides */}
      <View style={styles.contentContainer}>
        <Animated.View
          style={[
            styles.slideContainer,
          ]}
        >
          <Animated.Image
            key={`image-${imageKey}`}
            source={currentSlide.image}
            style={[
              styles.onboardingImage,
              {
                transform: [{ scale: imageScaleAnim }],
              },
            ]}
            resizeMode="contain"
          />

          <View style={styles.textContainer}>
            <Text style={styles.title}>{currentSlide.title}</Text>
            <Text style={styles.subtitle}>{currentSlide.subtitle}</Text>
          </View>
        </Animated.View>

        <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueText}>
            {currentIndex === slides.length - 1 ? 'Get Started' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  skipButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 70,
    right: 20,
    zIndex: 10,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2528be',
  },
  progressContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 110,
    left: 20,
    right: 20,
    height: 4,
    backgroundColor: '#D9D9D9',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#D9D9D9',
  },
  progressFill: {
    height: 4,
    backgroundColor: '#2528be',
    borderRadius: 2,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 140,
    paddingBottom: 80,
  },
  slideContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onboardingImage: {
    width: width * 0.8,
    height: 250,
    marginBottom: 40,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 23,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    lineHeight: 22,
  },
  continueButton: {
    backgroundColor: '#2528be',
    width: '100%',
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
