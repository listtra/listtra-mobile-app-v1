import { AuthGuard } from '@/components/AuthGuard';
import { useColorScheme } from '@/hooks/useColorScheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { View, Platform } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthProvider } from '../context/AuthContext';
import { NotificationProvider } from '../context/NotificationContext';
import { PushNotificationProvider } from '../context/PushNotificationContext';

function RootLayoutContent() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: '#f8f8f8' }}>
      <StatusBar
        style="dark"
        backgroundColor="#f8f8f8"
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
            backgroundColor: '#f8f8f8',
            zIndex: 1000
          }}
        />
      )}

      <View style={{
        flex: 1,
        backgroundColor: 'white',
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
              <Stack.Screen
                name="web"
                options={{
                  headerShown: false,
                  title: "",
                  headerTitle: "",
                  headerBackTitle: "",
                  headerBackVisible: false,
                  headerTransparent: true,
                  presentation: 'card'
                }}
              />
              <Stack.Screen
                name="listings/[slug]/[product_id]/page"
                options={{
                  headerShown: false,
                  title: "",
                  headerTitle: "",
                  headerBackTitle: "",
                  headerBackVisible: false,
                  headerTransparent: true,
                  presentation: 'card'
                }}
              />
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