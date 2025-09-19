// app/(tabs)/profile.tsx
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import PersistentWebView, { PersistentWebViewRef } from '../../components/PersistentWebView';
import { useAuth } from '../../context/AuthContext';

export default function ProfileScreen() {
  const { logout: authLogout } = useAuth();
  const webViewRef = useRef<PersistentWebViewRef>(null);
  const { refresh } = useLocalSearchParams();

  // Handle refresh parameter
  useEffect(() => {
    if (refresh === 'true') {
      // Small delay to ensure WebView is loaded
      setTimeout(() => {
        webViewRef.current?.refresh();
      }, 500);
    }
  }, [refresh]);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('Profile WebView message:', data);

      if (data.type === 'OPEN_SETTINGS') {
        console.log('Opening settings screen');
        router.push('/settings');
        return;
      }
    } catch (error) {
      console.error('Error handling WebView message:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.webViewContainer}>
        <PersistentWebView
          ref={webViewRef}
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
  },
});