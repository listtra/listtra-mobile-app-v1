// components/AuthGuard.tsx
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../context/AuthContext';

/**
 * AuthGuard is a component that redirects users based on authentication state.
 * With the WebView approach, we only need to handle auth for specific routes.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const segments = useSegments();
  const router = useRouter();
  const { user, isInitializing } = useAuth();

  useEffect(() => {
    if (isInitializing) return;

    const inAuthGroup = segments[0] === 'auth';
    
    // If user is authenticated and tries to access auth routes, redirect to home
    if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, segments, isInitializing]);

  if (isInitializing) {
    // While checking authentication state, show a loading indicator
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2528be" />
      </View>
    );
  }

  return <>{children}</>;
}