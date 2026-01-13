import { AuthGuard } from '@/components/AuthGuard';
import { useColorScheme } from '@/hooks/useColorScheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Platform, View } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthProvider } from '../context/AuthContext';
import { NotificationProvider } from '../context/NotificationContext';
import { PushNotificationProvider } from '../context/PushNotificationContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SplashScreen from '@/components/SplashScreen';

function RootLayoutContent() {
  const insets = useSafeAreaInsets();

  // Handle initial URL and deep links
  useEffect(() => {
    let isMounted = true;

    const handleInitialURL = async () => {
      if (!isMounted) return;

      const initialUrl = await Linking.getInitialURL();
      if (initialUrl && isMounted) {
        await handleDeepLink(initialUrl);
      }
    };

    handleInitialURL();

    // Listen for subsequent deep links
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  const handleDeepLink = async (url: string) => {
    console.log('Deep Link URL:', url);

    const parsed = Linking.parse(url);
    const { path, queryParams } = parsed;

    // Handle referral codes
    const referralCode = queryParams?.ref || queryParams?.referralCode;
    if (referralCode) {
      try {
        await AsyncStorage.setItem('referral_code', referralCode as any);
        console.log('Referral code stored');
      } catch (error) {
        console.error('Error storing referral code:', error);
      }
    }

    const fullPath = path || '';

    // Root or /listings -> go to home
    if (!fullPath || fullPath === '' || fullPath === '/' || fullPath === 'listings' || fullPath === 'listings/') {
      router.replace('/(tabs)');
      return;
    }

    // Listing detail: /listings/slug/product_id
    if (fullPath.startsWith('listings/')) {
      const parts = fullPath.split('/').filter(Boolean);
      if (parts.length >= 3) {
        // First navigate to tabs (base route), then push listing
        router.replace('/(tabs)');
        setTimeout(() => {
          router.push(`/listings/${parts[1]}/${parts[2]}/page` as any);
        }, 100);
        return;
      }
    }

    // Default: go to home
    router.replace('/(tabs)');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      <StatusBar
        style="dark"
        backgroundColor="#f5f5f5"
        translucent={true}
      />

      {Platform.OS === 'ios' && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: insets.top,
            backgroundColor: '#f5f5f5',
            zIndex: 1000
          }}
        />
      )}

      <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
        <AuthGuard>
          <>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="auth"
                options={{
                  headerShown: false,
                  presentation: 'modal',
                  animation: 'slide_from_bottom'
                }}
              />
              <Stack.Screen name="chat" options={{ headerShown: false }} />
              <Stack.Screen name="navbar-add" options={{ headerShown: false }} />
              <Stack.Screen name="liked" options={{ headerShown: false }} />
              <Stack.Screen name="search/page" options={{ headerShown: false }} />
              <Stack.Screen name="wallet/page" options={{ headerShown: false }} />
              <Stack.Screen
                name="settings"
                options={{
                  headerShown: false,
                  presentation: 'card',
                  animation: 'slide_from_right'
                }}
              />
              <Stack.Screen name="profiles/[nickname]" options={{ headerShown: false }} />
              <Stack.Screen name="listings" options={{ headerShown: false }} />
              <Stack.Screen name="categories" options={{ headerShown: false }} />
              <Stack.Screen name="+not-found" />
              <Stack.Screen name="location" options={{ headerShown: false }} />
            </Stack>
          </>
        </AuthGuard>
      </View>
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });


  const [showSplash, setShowSplash] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }).start(() => setShowSplash(false));
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!loaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PushNotificationProvider>
          <NotificationProvider>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              {showSplash ? (
                <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
                  <SplashScreen />
                </Animated.View>
              ) : (
                <RootLayoutContent />
              )}
            </ThemeProvider>
          </NotificationProvider>
        </PushNotificationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}