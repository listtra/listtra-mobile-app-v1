import { useColorScheme } from '@/hooks/useColorScheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import 'react-native-reanimated';
import { AuthGuard } from '../components/AuthGuard';
import ReviewNotification from '../components/ReviewNotification';
import { AuthProvider } from '../context/AuthContext';
import { NotificationProvider } from '../context/NotificationContext';
import { PushNotificationProvider } from '../context/PushNotificationContext';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    // Async font loading only occurs in development
    return null;
  }

  return (
    <AuthProvider>
      <PushNotificationProvider>
        <NotificationProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <AuthGuard>
              <>
                <Stack>
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="auth" options={{ headerShown: false }} />
                  <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
                  <Stack.Screen name="notifications" options={{ headerShown: false }} />
                  <Stack.Screen name="search/page" options={{ headerShown: false }} />
                  <Stack.Screen name="profiles/[nickname]" options={{ headerShown: false }} />
                  <Stack.Screen name="listings" options={{headerShown: false}}/>
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
                  <Stack.Screen name="+not-found" />
                </Stack>
                
                <ReviewNotification />
              </>
            </AuthGuard>
            <StatusBar style="auto" />
          </ThemeProvider>
        </NotificationProvider>
      </PushNotificationProvider>
    </AuthProvider>
  );
}
