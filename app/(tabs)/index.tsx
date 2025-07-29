// app/(tabs)/index.tsx
import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PersistentWebView, { PersistentWebViewRef } from '../../components/PersistentWebView';
import { useFocusEffect } from '@react-navigation/native';

export default function ListingsScreen() {
  const webViewRef = useRef<PersistentWebViewRef>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState(Date.now());
  
  useFocusEffect(
    React.useCallback(() => {
      const now = Date.now();
      // Only refresh if it's been more than 10 seconds since last refresh
      // Adjust this threshold based on how often your data actually changes
      const REFRESH_THRESHOLD = 10 * 1000; // 10 seconds
      
      if (now - lastRefreshTime > REFRESH_THRESHOLD && webViewRef.current) {
        console.log('Refreshing listings data...');
        webViewRef.current.refresh(); // Uses smart refresh (data-only if possible)
        setLastRefreshTime(now);
      } else {
        console.log('Skipping refresh - too soon since last refresh');
      }
    }, [lastRefreshTime])
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.webViewContainer}>
        <PersistentWebView 
          route="listings" 
          ref={webViewRef}
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