import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NotificationSettings } from '../../components/NotificationSettings';
import { NotificationTest } from '../../components/NotificationTest';

export default function TestNotificationsTabScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Test Notifications</Text>
        <NotificationTest />
        
        <Text style={styles.sectionTitle}>Notification Settings</Text>
        <NotificationSettings />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: 16,
  },
}); 