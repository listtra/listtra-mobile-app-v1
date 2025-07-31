// app/listings/[slug]/[product_id]/edit.tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PersistentWebView from '../../../../components/PersistentWebView';

export default function ListingEditScreen() {
  const params = useLocalSearchParams();
  const slug = typeof params.slug === 'string' ? params.slug : String(params.slug || '');
  const product_id = typeof params.product_id === 'string' ? params.product_id : String(params.product_id || '');
  const router = useRouter();

  // Handle back button press
  const handleBackPress = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerContainer}>
        <TouchableOpacity 
          style={styles.headerButton} 
          onPress={handleBackPress}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        
        <View style={styles.titleContainer}>
          <View style={styles.title}>
            <Ionicons name="create-outline" size={24} color="black" />
          </View>
        </View>
      </View>

      <View style={styles.webViewContainer}>
        <PersistentWebView 
          route={`listings/${slug}/${product_id}/edit`} 
          disableAutoNavigation={true}
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