// app/listings/[slug]/[product_id]/page.tsx
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PersistentWebView from '../../../../components/PersistentWebView';

export default function ListingDetailScreen() {
  const params = useLocalSearchParams();
  const slug = typeof params.slug === 'string' ? params.slug : String(params.slug || '');
  const product_id = typeof params.product_id === 'string' ? params.product_id : String(params.product_id || '');

  // Extract source tracking params
  const source = typeof params.source === 'string' ? params.source : '';
  const q = typeof params.q === 'string' ? params.q : '';

  // Build route with query params for view tracking
  const buildRoute = () => {
    let route = `listings/${slug}/${product_id}`;
    const queryParams = new URLSearchParams();

    if (source) queryParams.append('source', source);
    if (q) queryParams.append('q', q);

    const queryString = queryParams.toString();
    if (queryString) {
      route += `?${queryString}`;
    }

    return route;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.webViewContainer}>
        <PersistentWebView
          route={buildRoute()}
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