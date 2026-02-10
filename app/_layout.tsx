import SplashScreen from '@/components/SplashScreen';
import { useColorScheme } from '@/hooks/useColorScheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, View } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthProvider } from '../context/AuthContext';

function RootLayoutContent() {
  const insets = useSafeAreaInsets();

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
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="+not-found" />
        </Stack>
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
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          {showSplash ? (
            <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
              <SplashScreen />
            </Animated.View>
          ) : (
            <RootLayoutContent />
          )}
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}