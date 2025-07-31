// app/(tabs)/liked.tsx
import React, { useRef, useState, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PersistentWebView, { PersistentWebViewRef } from '../../components/PersistentWebView';
import { useFocusEffect } from '@react-navigation/native';

export default function LikedScreen() {
  const webViewRef = useRef<PersistentWebViewRef>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Handle pull-to-refresh
  const handleRefresh = useCallback(async () => {
    if (webViewRef.current) {
      setIsRefreshing(true);
      console.log('Pull-to-refresh triggered for liked items');
      webViewRef.current.refresh();
      setLastRefreshTime(Date.now());
      // Add a small delay to show the refresh indicator
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  }, []);

  // Handle focus-based refresh with throttling
  // useFocusEffect(
  //   React.useCallback(() => {
  //     const now = Date.now();
  //     const REFRESH_THRESHOLD = 20 * 1000; // 20 seconds for liked items
      
  //     if (now - lastRefreshTime > REFRESH_THRESHOLD && webViewRef.current) {
  //       console.log('Refreshing liked items data...');
  //       webViewRef.current.refresh();
  //       setLastRefreshTime(now);
  //     } else {
  //       console.log('Skipping liked refresh - too soon since last refresh');
  //     }
  //   }, [lastRefreshTime])
  // );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.webViewContainer}>
        <PersistentWebView 
          route="liked" 
          ref={webViewRef}
          onRefresh={handleRefresh}
          refreshing={isRefreshing}
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