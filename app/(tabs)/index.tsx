import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PersistentWebView, { PersistentWebViewRef } from '../../components/PersistentWebView';

// Global variable to store the refresh function
let globalIndexRefresh: (() => void) | null = null;

export const triggerIndexRefresh = () => {
  if (globalIndexRefresh) {
    globalIndexRefresh();
  } else {
    console.log('No index refresh function available');
  }
};

export default function ListingsScreen() {
  const webViewRef = useRef<PersistentWebViewRef>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Handle refresh functionality
  const handleRefresh = useCallback(async () => {
    if (webViewRef.current) {
      setIsRefreshing(true);
      webViewRef.current.refresh();
      // Add a small delay to show the refresh indicator
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  }, []);

  // Set the global refresh function when component mounts
  useEffect(() => {
    globalIndexRefresh = handleRefresh;

    return () => {
      globalIndexRefresh = null;
    };
  }, [handleRefresh]);

  // Add a silent refresh function
  const handleSilentRefresh = useCallback(() => {
    if (webViewRef.current) {
      webViewRef.current.refresh();
      // Don't set isRefreshing to true
    }
  }, []);

  // Update the useFocusEffect to use silent refresh
  useFocusEffect(
    useCallback(() => {
      handleSilentRefresh(); // Use silent refresh instead
    }, [handleSilentRefresh])
  );
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
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webViewContainer: {
    flex: 1,
  },
});