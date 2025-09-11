// app/(tabs)/add.tsx
import { useRouter } from 'expo-router';
import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PersistentWebView from '../components/PersistentWebView';

export default function NavbarAddScreen() {
  const router = useRouter();

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