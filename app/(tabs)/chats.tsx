// app/(tabs)/chats.tsx
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PersistentWebView, { PersistentWebViewRef } from '../../components/PersistentWebView';
import { useNativeBg } from '../../context/WebThemeContext';

export default function ChatsScreen() {
  const webViewRef = useRef<PersistentWebViewRef>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [key, setKey] = useState(0);
  const [route, setRoute] = useState('chats');
  const nativeBg = useNativeBg();
  
  // Get URL parameters
  const params = useLocalSearchParams();
  
  // Update route when parameters change
  useEffect(() => {
    let newRoute = 'chats';
    const urlParams = new URLSearchParams();
    
    // Add tab parameter if present
    if (params.tab && typeof params.tab === 'string') {
      urlParams.append('tab', params.tab);
    }
    
    // Add listing parameter if present
    if (params.listing && typeof params.listing === 'string') {
      urlParams.append('listing', params.listing);
    }
    
    // Construct the final route with parameters
    if (urlParams.toString()) {
      newRoute = `chats?${urlParams.toString()}`;
    }
    
    console.log('ChatsScreen route updated:', newRoute);
    setRoute(newRoute);
  }, [params]);

  // Handle pull-to-refresh
  const handleRefresh = useCallback(async () => {
    if (webViewRef.current) {
      setIsRefreshing(true);
      console.log('Pull-to-refresh triggered for chats');
      webViewRef.current.refresh();
      setLastRefreshTime(Date.now());
      // Add a small delay to show the refresh indicator
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  }, []);

  // Force WebView refresh every time the screen is focused
  useFocusEffect(
    React.useCallback(() => {
      console.log('ChatScreen focused, forcing WebView refresh');
      setKey(prev => prev + 1);
    }, [])
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: nativeBg }} edges={['top']}>
      <View style={{ flex: 1, backgroundColor: nativeBg }}>
        <PersistentWebView
          route={route}
          ref={webViewRef}
          key={key}
        />
      </View>
    </SafeAreaView>
  );
}