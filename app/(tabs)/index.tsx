// app/(tabs)/index.tsx
import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PersistentWebView, { PersistentWebViewRef } from '../../components/PersistentWebView';
import { useAuth } from '../../context/AuthContext';

export default function ListingsScreen() {
  const webViewRef = useRef<PersistentWebViewRef>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  

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