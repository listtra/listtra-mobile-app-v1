// app/(tabs)/add.tsx
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PersistentWebView from '../../components/PersistentWebView';

export default function AddScreen() {
  const router = useRouter();
  const [key, setKey] = useState(0);

  // Force WebView refresh every time the screen is focused
  useFocusEffect(
    React.useCallback(() => {
      setKey(prev => prev + 1);
    }, [])
  );

  return (
      <SafeAreaView style={styles.flex} edges={['top']}>
        <View style={styles.webViewContainer}>
          <PersistentWebView
            key={key}
            route="add"
            disableRefresh={true}
            maxPhotos={5} // Set to max possible (for Plus users), web will control actual limit
          />
        </View>
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  webViewContainer: { flex: 1, backgroundColor: 'white' },
});