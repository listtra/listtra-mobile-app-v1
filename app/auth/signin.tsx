// app/auth/signin.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import PersistentWebView from '../../components/PersistentWebView';
import { useAuth } from '../../context/AuthContext';

export default function SignInScreen() {
  const { setTokensDirectly, logout } = useAuth();
  console.log('SignInScreen Mounted');

  // app/auth/signin.tsx - Update the handleMessage function
  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('SignIn WebView message:', data);

      if (data.type === 'AUTH_LOGIN_SUCCESS' && data.tokens) {
        // Handle successful login
        setTokensDirectly(data.tokens.accessToken, data.tokens.refreshToken, data.user);

        setTimeout(() => {
          router.replace('/(tabs)');
        }, 300);
      } else if (data.type === 'EMAIL_NOT_VERIFIED' && data.email) {
        // Navigate to verify email for unverified users
        router.push({
          pathname: '/auth/verify-email',
          params: { email: data.email }
        });
      } else if (data.type === 'GO_BACK') {
        console.log('SignInScreen Go_BACK message received');
        // Clear tokens first, then navigate to main tabs (index)
        logout().then(() => {
          // Add a small delay to ensure tokens are cleared
          setTimeout(() => {
            router.replace('/(tabs)');
          }, 100);
        });
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