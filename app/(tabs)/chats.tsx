// app/(tabs)/chats.tsx
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import PersistentWebView from '../../components/PersistentWebView';

export default function ChatsScreen() {
  const [key, setKey] = useState(0);

  // Force WebView refresh every time the screen is focused
  useFocusEffect(
    React.useCallback(() => {
      console.log('ChatsScreen focused, forcing WebView refresh');
      setKey(prev => prev + 1);
    }, [])
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.webViewContainer}>
        <PersistentWebView 
          key={key} // This forces a complete re-render every time
          route="chats" 
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