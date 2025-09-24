// app/(tabs)/profile.tsx
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import PersistentWebView, { PersistentWebViewRef } from '../../components/PersistentWebView';
import { useAuth } from '../../context/AuthContext';
import { useFocusEffect } from '@react-navigation/native';

export default function ProfileScreen() {
  const { logout: authLogout } = useAuth();
  const webViewRef = useRef<PersistentWebViewRef>(null);
  const [key, setKey] = useState(0);

  // Handle refresh parameter
  useFocusEffect(
    React.useCallback(() => {
      console.log('ChatScreen focused, forcing WebView refresh');
      setKey(prev => prev + 1);
    }, [])
  );

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
          key={key}
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