import PersistentWebView from '@/components/PersistentWebView';
import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MainScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <PersistentWebView route="listings" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});