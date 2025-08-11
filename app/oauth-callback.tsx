import { useLocalSearchParams, router } from 'expo-router';
import React, { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function OAuthCallback() {
  const params = useLocalSearchParams();
  console.log('OAuth callback received params:', params);
  
  const { access, refresh, user } = params as { 
    access?: string; 
    refresh?: string; 
    user?: string; 
  };
  const { setTokensDirectly } = useAuth();

  useEffect(() => {
    const processAuth = async () => {
      try {
        console.log('Processing OAuth callback...');
        console.log('Access token:', access ? 'present' : 'missing');
        console.log('Refresh token:', refresh ? 'present' : 'missing');
        console.log('User data:', user ? 'present' : 'missing');
        
        if (access && refresh) {
          console.log('Processing OAuth callback with tokens');
          const parsedUser = user ? JSON.parse(decodeURIComponent(String(user))) : undefined;
          console.log('Parsed user:', parsedUser);
          
          await setTokensDirectly(String(access), String(refresh), parsedUser);
          console.log('Tokens set successfully, redirecting to tabs');
          router.replace('/(tabs)');
        } else {
          console.error('OAuth callback missing tokens');
          console.error('Available params:', Object.keys(params));
          router.replace('/auth/signin');
        }
      } catch (error) {
        console.error('Error processing OAuth callback:', error);
        router.replace('/auth/signin');
      }
    };

    processAuth();
  }, [access, refresh, user, setTokensDirectly, params]);

  return (
    <View style={{ 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center', 
      backgroundColor: 'white' 
    }}>
      <ActivityIndicator size="large" color="#2528be" />
      <Text style={{ marginTop: 16, fontSize: 16, color: '#666' }}>
        Completing authentication...
      </Text>
    </View>
  );
}