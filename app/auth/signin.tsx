// app/auth/signin.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import PersistentWebView from '../../components/PersistentWebView';
import { useAuth } from '../../context/AuthContext';

export default function SignInScreen() {
  const { setTokensDirectly } = useAuth();
  console.log('SignInScreen Mounted');

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('data', data);
      
      if (data.type === 'AUTH_LOGIN_SUCCESS' && data.tokens) {
        // Handle successful login
        setTokensDirectly(data.tokens.accessToken, data.tokens.refreshToken, data.user);
        
        // Explicitly navigate to tabs after authentication
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 300); // Small delay to ensure tokens are set
      }
    } catch (error) {
      console.error('Error handling WebView message:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.webViewContainer}>
        <PersistentWebView 
          route="auth/signin" 
          onMessage={handleMessage} 
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
});