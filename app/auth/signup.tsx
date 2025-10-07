// app/auth/signup.tsx
import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PersistentWebView from '../../components/PersistentWebView';
import { useAuth } from '../../context/AuthContext';
import { router } from 'expo-router';

export default function SignUpScreen() {
  const { setTokensDirectly } = useAuth();

// app/auth/signup.tsx - Update the handleMessage function
const handleMessage = (event: any) => {
  try {
    const data = JSON.parse(event.nativeEvent.data);
    console.log('SignUp WebView message:', data);
    
    if (data.type === 'AUTH_LOGIN_SUCCESS' && data.tokens) {
      // Handle successful signup and login
      setTokensDirectly(data.tokens.accessToken, data.tokens.refreshToken, data.user);
    } else if (data.type === 'NAVIGATE_TO_VERIFY_EMAIL' && data.email) {
      // Navigate to verify email screen
      router.push({
        pathname: '/auth/verify-email',
        params: { email: data.email }
      });
    } else if (data.type === 'OPEN_EXTERNAL_LINK') {
      Linking.openURL(data.url);
    }
  } catch (error) {
    console.error('Error handling WebView message:', error);
  }
};

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.webViewContainer}>
        <PersistentWebView 
          route="auth/signup" 
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