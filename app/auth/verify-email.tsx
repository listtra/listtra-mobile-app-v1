import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import PersistentWebView from '../../components/PersistentWebView';

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams();
  const email = params.email as string;
  
  console.log('VerifyEmailScreen Mounted with email:', email);
  
  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('VerifyEmail WebView message:', data);
      
      if (data.type === 'VERIFICATION_SUCCESS') {
        // Navigate to success screen after successful verification
        router.replace('/auth/signup-success');
      } else if (data.type === 'NAVIGATE_BACK') {
        // Handle back navigation
        router.back();
      }
    } catch (error) {
      console.error('Error handling WebView message:', error);
    }
  };
  
  // Build the route with email parameter
  const route = email ? `auth/verify-email?email=${encodeURIComponent(email)}` : 'auth/verify-email';
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.webViewContainer}>
        <PersistentWebView
          route={route}
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