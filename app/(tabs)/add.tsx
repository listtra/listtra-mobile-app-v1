// app/(tabs)/add.tsx
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PersistentWebView from '../../components/PersistentWebView';
import { useNativeBg } from '../../context/WebThemeContext';

export default function AddScreen() {
  const router = useRouter();
  const [key, setKey] = useState(0);
  const nativeBg = useNativeBg();

  // Force WebView refresh every time the screen is focused
  useFocusEffect(
    React.useCallback(() => {
      setKey(prev => prev + 1);
    }, [])
  );

  return (
      <SafeAreaView style={{ flex: 1, backgroundColor: nativeBg }} edges={['top']}>
        <View style={{ flex: 1, backgroundColor: nativeBg }}>
          <PersistentWebView
            key={key}
            route="add"
          />
        </View>
      </SafeAreaView>
  );
}