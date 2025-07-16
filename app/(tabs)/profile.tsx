// app/(tabs)/profile.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import PersistentWebView from '../../components/PersistentWebView';
import { useAuth } from '../../context/AuthContext';

export default function ProfileScreen() {
  const { logout: authLogout } = useAuth();

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('Profile WebView message:', data);
      
      if (data.type === 'AUTH_LOGOUT') {
        // Handle logout
        authLogout();
        
        // Navigate to signin screen (outside of tabs)
        setTimeout(() => {
          router.replace('/auth/signin');
        }, 100);
      }
    } catch (error) {
      console.error('Error handling WebView message:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.webViewContainer}>
        <PersistentWebView 
          route="profile" 
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