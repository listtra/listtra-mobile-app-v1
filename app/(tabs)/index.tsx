// app/(tabs)/index.tsx
import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PersistentWebView, { PersistentWebViewRef } from '../../components/PersistentWebView';
import { useAuth } from '../../context/AuthContext';

export default function ListingsScreen() {
  const webViewRef = useRef<PersistentWebViewRef>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { isAuthenticated } = useAuth();
  
  // Handle pull-to-refresh
  const handleRefresh = useCallback(async () => {
    if (webViewRef.current) {
      setIsRefreshing(true);
      console.log('Pull-to-refresh triggered for listings');
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
  //     const REFRESH_THRESHOLD = 10 * 1000; // 10 seconds
      
  //     if (now - lastRefreshTime > REFRESH_THRESHOLD && webViewRef.current) {
  //       console.log('Refreshing listings data...');
  //       webViewRef.current.refresh();
  //       setLastRefreshTime(now);
  //     } else {
  //       console.log('Skipping refresh - too soon since last refresh');
  //     }
  //   }, [lastRefreshTime])
  // );

  // Handle WebView messages
  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('Listings WebView message:', data);
      
      if (data.type === 'AUTH_REQUIRED') {
        console.log('AUTH_REQUIRED message received in listings');
        // This shouldn't happen on listings page, but handle it gracefully
      }
      
      if (data.type === 'WEBVIEW_AUTH_CLEARED') {
        console.log('WebView auth cleared confirmation received in listings');
      }
    } catch (error) {
      console.error('Error handling WebView message in listings:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.webViewContainer}>
        <PersistentWebView 
          route="listings" 
          ref={webViewRef}
          onMessage={handleMessage}
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