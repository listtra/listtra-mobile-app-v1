import { useColorScheme } from '@/hooks/useColorScheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { View } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../context/AuthContext';
import { NotificationProvider } from '../context/NotificationContext';
import { PushNotificationProvider } from '../context/PushNotificationContext';

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
              <View style={{ flex: 1, backgroundColor: 'white' }}>
                <StatusBar
                  style="dark"
                  backgroundColor="white"
                  translucent={true}
                />
                {/* <AuthGuard> */}
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
                      <Stack.Screen name="notifications" options={{ headerShown: false }} />
                      <Stack.Screen name="search/page" options={{ headerShown: false }} />
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
                      <Stack.Screen name="+not-found" />
                    </Stack>

                  </>
                {/* </AuthGuard> */}
              </View>
            </ThemeProvider>
          </NotificationProvider>
        </PushNotificationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}