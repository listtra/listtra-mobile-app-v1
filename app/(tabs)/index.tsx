import PersistentWebView from '@/components/PersistentWebView';
import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNativeBg } from '../../context/WebThemeContext';

export default function MainScreen() {
  const nativeBg = useNativeBg();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: nativeBg }} edges={['top']}>
      <PersistentWebView route="/listings" />
    </SafeAreaView>
  );
}
