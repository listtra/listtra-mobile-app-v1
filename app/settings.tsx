import React, { useRef } from 'react';
import { StyleSheet, View, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import PersistentWebView, { PersistentWebViewRef } from '../components/PersistentWebView';
import { useAuth } from '../context/AuthContext';

export default function SettingsScreen() {
  const { logout: authLogout } = useAuth();
  const webViewRef = useRef<PersistentWebViewRef>(null);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('Settings WebView message:', data);

      if (data.type === 'WEB_LOGOUT_SUCCESS') {
        console.log('Logout success message received from web app', data);

        // Then clear mobile app tokens
        authLogout();

        // Navigate back to tabs and then to signin
        setTimeout(() => {
          router.replace('/auth/signin');
        }, 100);
      }

      if (data.type === 'NAVIGATE_BACK' || data.type === 'CLOSE_SETTINGS') {
        router.push('/(tabs)/profile');
      }

      if (data.type === 'NAVIGATE_TO_PROFILE_AND_REFRESH') {
        router.push('/(tabs)/profile?refresh=true');
        return;
      }

      if (data.type === 'WEBVIEW_AUTH_CLEARED') {
        console.log('WebView auth cleared confirmation received');
      }
    } catch (error) {
      console.error('Error handling WebView message:', error);
    }
  };

  return (

      <SafeAreaView style={styles.webViewContainer} edges={['top']}>
        <View style={styles.webViewContainer}>
          <PersistentWebView
            ref={webViewRef}
            route="settings"
            disableRefresh={true}
            onMessage={handleMessage}
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
  },
});