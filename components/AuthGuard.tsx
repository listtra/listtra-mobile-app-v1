import { useRouter, useSegments } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

/**
 * AuthGuard is a component that redirects users based on authentication state.
 * - If a user is not authenticated and tries to access a protected route, they are redirected to the sign-in page.
 * - If a user is authenticated and tries to access auth routes, they are redirected to the home page.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const segments = useSegments();
  const router = useRouter();
  const { user, isInitializing } = useAuth();

  useEffect(() => {
    if (isInitializing) return;

    const inAuthGroup = segments[0] === 'auth';
    
    if (!user && !inAuthGroup) {
      // If the user is not signed in and the initial segment is not part of the auth group, redirect to the sign-in page.
      router.replace('/auth/signin');
    } else if (user && inAuthGroup) {
      // If the user is signed in and the initial segment is part of the auth group, redirect to the home page.
      router.replace('/');
    }
  }, [user, segments, isInitializing]);

  if (isInitializing) {
    // While checking authentication state, show a loading indicator
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6200EA" />
      </View>
    );
  }

  return <>{children}</>;
} 