import { AuthGuard } from '@/components/AuthGuard';
import { useColorScheme } from '@/hooks/useColorScheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthProvider } from '../context/AuthContext';
import { NotificationProvider } from '../context/NotificationContext';
import { PushNotificationProvider } from '../context/PushNotificationContext';

function RootLayoutContent() {
  const insets = useSafeAreaInsets();
  const [isProcessingDeepLink, setIsProcessingDeepLink] = useState(false);

  // Handle initial URL and deep links
  useEffect(() => {
    let isMounted = true;

    const handleInitialURL = async () => {
      // Wait a bit for the app to be ready
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (!isMounted) return;

      const initialUrl = await Linking.getInitialURL();
      if (initialUrl && isMounted) {
        setIsProcessingDeepLink(true);
        await handleDeepLink(initialUrl, true);
        // Keep loading screen for a bit longer to ensure smooth transition
        setTimeout(() => {
          if (isMounted) setIsProcessingDeepLink(false);
        }, 300);
      }
    };

    handleInitialURL();

    // Listen for subsequent deep links
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url, false);
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  const handleDeepLink = async (url: string, isInitial: boolean = false) => {
    console.log('=== Deep Link Debug ===');
    console.log('Raw URL:', url);
    console.log('Is initial:', isInitial);

    // Parse the URL
    const parsed = Linking.parse(url);
    console.log('Full parsed object:', JSON.stringify(parsed));

    const { hostname, path, queryParams } = parsed;

    console.log('Parsed path:', path);
    console.log('Hostname:', hostname);
    console.log('Query params:', queryParams);

    // For custom schemes like zirkly://, the hostname contains the first part
    // and path contains the rest. We need to combine them.
    // For https:// URLs, everything is in path
    const fullPath = path?.startsWith('listings/') ? path : (hostname && path) ? `${hostname}/${path}` : (path || hostname || '');
    console.log('Full path to check:', fullPath);

    // Handle listing URLs: zirkly://listings/slug/product_id or https://zirkly.com/listings/slug/product_id
    if (fullPath?.startsWith('listings/')) {
      const parts = fullPath.split('/').filter(Boolean);

      if (parts.length >= 3) {
        const slug = parts[1];
        const product_id = parts[2];
        const targetPath = `/listings/${slug}/${product_id}/page`;

        try {
          if (isInitial) {
            // For initial links: set up home as base, then navigate to listing
            // This ensures back button goes to home instead of closing app
            router.replace('/(tabs)');
            setTimeout(() => {
              router.push(targetPath as any);
              console.log('Initial navigation successful');
            }, 150);
          } else {
            // For subsequent links, just push normally
            router.push(targetPath as any);
            console.log('Navigation successful');
          }
        } catch (error) {
          console.error('Navigation error:', error);
        }
      } else {
        console.log('ERROR: Not enough parts. Expected 3+, got:', parts.length);
      }
    }
    // Handle profile URLs
    else if (fullPath?.startsWith('profiles/')) {
      const parts = fullPath.split('/').filter(Boolean);
      const nickname = parts[1];
      if (nickname) {
        if (isInitial) {
          router.replace('/(tabs)');
          setTimeout(() => router.push(`/profiles/${nickname}` as any), 150);
        } else {
          router.push(`/profiles/${nickname}` as any);
        }
      }
    }
    // Handle category URLs
    else if (fullPath?.startsWith('categories/')) {
      const parts = fullPath.split('/').filter(Boolean);
      const category = parts[1];
      if (category) {
        if (isInitial) {
          router.replace('/(tabs)');
          setTimeout(() => router.push(`/categories/${category}` as any), 150);
        } else {
          router.push(`/categories/${category}` as any);
        }
      }
    }
    // Default to home - but only if not initial (don't redirect on app launch)
    else if (!isInitial) {
      console.log('No matching route, going to home');
      router.push('/(tabs)');
    } else {
      console.log('No matching route on initial load, staying on current screen');
    }
    console.log('=== End Deep Link Debug ===');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f1f1f1' }}>
      <StatusBar
        style="dark"
        backgroundColor="#f1f1f1"
        translucent={true}
      />

      {/* Status bar background for iOS - positioned absolutely */}
      {Platform.OS === 'ios' && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: insets.top,
            backgroundColor: '#f1f1f1',
            zIndex: 1000
          }}
        />
      )}

      {/* Deep Link Loading Overlay */}
      {isProcessingDeepLink && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#f1f1f1',
            zIndex: 9999,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <ActivityIndicator size="large" color="#2528be" />
        </View>
      )}

      <View style={{
        flex: 1,
        backgroundColor: '#f1f1f1',
      }}>
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

  if (!loaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PushNotificationProvider>
          <NotificationProvider>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <RootLayoutContent />
            </ThemeProvider>
          </NotificationProvider>
        </PushNotificationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}