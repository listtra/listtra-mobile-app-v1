// app/listings/[slug]/[product_id]/page.tsx
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PersistentWebView, { PersistentWebViewRef } from '../../../../components/PersistentWebView';

export default function ListingDetailScreen() {
  const params = useLocalSearchParams();
  console.log('params', params);
  const slug = typeof params.slug === 'string' ? params.slug : String(params.slug || '');
  const product_id = typeof params.product_id === 'string' ? params.product_id : String(params.product_id || '');
  const router = useRouter();
  const webViewRef = useRef<PersistentWebViewRef>(null);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);

  // Handle back button press
  const handleBackPress = () => {
    router.back();
  };

  // Refresh when screen comes back into focus (but not on initial load)
  useFocusEffect(
    React.useCallback(() => {
      if (hasInitiallyLoaded) {
        // Only refresh if this is not the initial load
        const timer = setTimeout(() => {
          if (webViewRef.current) {
            webViewRef.current.refresh();
          }
        }, 100);

        return () => clearTimeout(timer);
      } else {
        // Mark as initially loaded after first focus
        setHasInitiallyLoaded(true);
      }
    }, [hasInitiallyLoaded])
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.webViewContainer}>
        <PersistentWebView
          ref={webViewRef}
          route={`listings/${slug}/${product_id}`}
          disableRefresh={true}
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
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    zIndex: 10,
  },
  headerButton: {
    marginRight: 10,
    padding: 5,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});