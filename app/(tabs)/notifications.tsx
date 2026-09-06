// app/notifications.tsx
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PersistentWebView from '../../components/PersistentWebView';
import { useNativeBg } from '../../context/WebThemeContext';

export default function NotificationsScreen() {
  const router = useRouter();
  const nativeBg = useNativeBg();

  // Handle back button press
  const handleBackPress = () => {
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: nativeBg }} edges={['top']}>
      {/* <View style={styles.headerContainer}>
        <TouchableOpacity 
          style={styles.headerButton} 
          onPress={handleBackPress}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        
        <View style={styles.titleContainer}>
          <View style={styles.title}>
            <Ionicons name="notifications-outline" size={24} color="black" />
          </View>
        </View>
      </View> */}

      <View style={{ flex: 1, backgroundColor: nativeBg }}>
        <PersistentWebView route="notifications" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    zIndex: 10,
  },
  headerButton: {
    marginRight: 10,
    padding: 5,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});