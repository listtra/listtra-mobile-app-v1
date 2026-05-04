// app/(tabs)/profile.tsx
import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PersistentWebView, { PersistentWebViewRef } from '../../components/PersistentWebView';
import { useAuth } from '../../context/AuthContext';

export default function ProfileScreen() {
  const { logout: authLogout } = useAuth();
  const webViewRef = useRef<PersistentWebViewRef>(null);
  const [key, setKey] = useState(0);
  const params = useLocalSearchParams<{ tab?: string; subTab?: string }>();

  // Build route with query params when tab/subTab are provided
  const webViewRoute = useMemo(() => {
    const queryParts: string[] = [];
    if (params.tab) queryParts.push(`tab=${encodeURIComponent(params.tab)}`);
    if (params.subTab) queryParts.push(`subTab=${encodeURIComponent(params.subTab)}`);
    return queryParts.length > 0 ? `profile?${queryParts.join('&')}` : 'profile';
  }, [params.tab, params.subTab]);

  // Handle refresh parameter
  useFocusEffect(
    React.useCallback(() => {
      console.log('ProfileScreen focused, forcing WebView refresh');
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
          route={webViewRoute}
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