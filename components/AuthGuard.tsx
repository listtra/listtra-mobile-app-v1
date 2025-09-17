// components/AuthGuard.tsx
import { useRouter, useSegments } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

/**
 * AuthGuard is a component that redirects users based on authentication state.
 * Redirects unauthenticated users to sign-in page when they try to access protected routes.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const segments = useSegments();
  const router = useRouter();
  const { user, isInitializing, isAuthenticated } = useAuth();

  // console.log("user", user);
  // console.log("isInitializing", isInitializing);
  // console.log("isAuthenticated", isAuthenticated);

  useEffect(() => {
    if (isInitializing) return;

    const inAuthGroup = segments[0] === 'auth';
    const inProtectedRoute = 
                            segments[0] === 'chat' || 
                            segments[0] === 'add' ||
                            segments[0] === 'notifications' || 
                            segments[0] === 'profiles' || 
                            segments[0] === 'search';
    
    // If user is authenticated and tries to access auth routes, redirect to home
    if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    } 
    // If user is NOT authenticated and tries to access protected routes, redirect to sign-in
    else if (!isAuthenticated && inProtectedRoute) {
      router.replace('/auth/signin');
    }
  }, [isAuthenticated, segments, isInitializing]);

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