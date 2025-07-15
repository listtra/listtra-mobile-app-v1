// app/chat/index.tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PersistentWebView from '../../components/PersistentWebView';

export default function ChatListScreen() {
  const router = useRouter();
  const { listingId } = useLocalSearchParams();
  const [isReady, setIsReady] = useState(false);
  
  console.log('listingId', listingId);
  
  // Handle back button press
  const handleBackPress = () => {
    router.back();
  };

  // Wait for params to be available
  useEffect(() => {
    // Give a short delay to ensure params are loaded
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // Only construct route if listingId exists
  const route = listingId ? `chat?listing=${listingId}` : 'chat';
  console.log('route', route);

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
            <Ionicons name="chatbubbles-outline" size={24} color="black" />
          </View>
        </View>
      </View>
      <View style={styles.webViewContainer}>
        {!isReady ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2528be" />
          </View>
        ) : (
          <PersistentWebView route={route} />
        )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
});