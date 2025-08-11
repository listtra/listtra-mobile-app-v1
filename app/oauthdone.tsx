import { useLocalSearchParams, router } from 'expo-router';
import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function OAuthDone() {
  const { access, refresh, user } = useLocalSearchParams<{ access?: string; refresh?: string; user?: string }>();
  const { setTokensDirectly } = useAuth();

  useEffect(() => {
    const go = async () => {
      try {
        if (access && refresh) {
          const parsedUser = user ? JSON.parse(decodeURIComponent(String(user))) : undefined;
          await setTokensDirectly(String(access), String(refresh), parsedUser);
          router.replace('/(tabs)');
        } else {
          router.replace('/auth/signin');
        }
      } catch {
        router.replace('/auth/signin');
      }
    };
    go();
  }, [access, refresh, user]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' }}>
      <ActivityIndicator size="large" color="#2528be" />
    </View>
  );
}