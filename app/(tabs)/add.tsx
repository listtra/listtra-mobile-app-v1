// app/(tabs)/add.tsx
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PersistentWebView from '../../components/PersistentWebView';

export default function AddScreen() {
  const router = useRouter();

  // Automatically navigate to standalone add screen when this tab is accessed
  useEffect(() => {
    router.push('/navbar-add');
  }, []);

  // This content won't be visible since we navigate away immediately,
  // but keeping it as fallback
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <SafeAreaView style={styles.flex} edges={['top','left','right']}>
        <View style={styles.webViewContainer}>
          <PersistentWebView
            route="add"
            disableRefresh={true}
          />
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1,backgroundColor: 'white'},
  webViewContainer: { flex: 1, backgroundColor: 'white' },
});