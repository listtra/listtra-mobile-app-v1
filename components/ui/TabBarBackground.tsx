import React from 'react';
import { StyleSheet, View } from 'react-native';

// This is a shim for web and Android where the tab bar is generally opaque.
export default function TabBarBackground() {
  return (
    <View style={styles.background} />
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#1F2937', // Dark background matching the tab bar
  },
});

export function useBottomTabOverflow() {
  return 0;
}
