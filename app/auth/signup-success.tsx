import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import PersistentWebView from '../../components/PersistentWebView';

export default function SignupSuccessScreen() {
  console.log('SignupSuccessScreen Mounted');
  
  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('SignupSuccess WebView message:', data);
      
      if (data.type === 'NAVIGATE_TO_SIGNIN') {
        // Navigate to signin screen
        router.replace('/auth/signin');
      } else if (data.type === 'NAVIGATE_BACK') {
        // Handle back navigation
        router.back();
      }
    } catch (error) {
      console.error('Error handling WebView message:', error);
    }
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.webViewContainer}>
        <PersistentWebView
          route="auth/signup-success"
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