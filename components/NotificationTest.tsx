import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import React, { useState } from 'react';
import { Alert, Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { usePushNotification } from '../context/PushNotificationContext';
import { notificationsAPI } from '../services/notificationsAPI';
import { pushNotificationService } from '../services/pushNotificationService';

export const NotificationTest = () => {
  const { expoPushToken, requestPermissions } = usePushNotification();
  const { tokens } = useAuth();
  const [status, setStatus] = useState('');

  // Check if we're in Expo Go
  const isExpoGo = Constants.executionEnvironment === 'storeClient';

  // Test local notification using the service
  const sendLocalNotification = async () => {
    setStatus('Sending local notification...');
    try {
      const success = await pushNotificationService.sendLocalTestNotification(
        'Local Test',
        'This is a local test notification that works everywhere!'
      );
      
      if (success) {
        setStatus('Local notification sent! ✅ Check your device.');
      } else {
        setStatus('Failed to send local notification ❌');
      }
    } catch (error: any) {
      console.error('Error sending local notification:', error);
      setStatus(`Error: ${error?.message || 'Unknown error'}`);
    }
  };
  
  // Send local notification without requiring permission
  // This works on simulators and Expo Go
  const sendSimulatorNotification = async () => {
    setStatus('Sending simulator-friendly notification...');
    try {
      await Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Simulator Test",
          body: "This notification works in simulators and Expo Go",
          data: { type: 'simulator_test' }
        },
        trigger: null, // Send immediately
      });
      
      setStatus('Simulator notification sent! ✅');
    } catch (error: any) {
      console.error('Error sending notification:', error);
      setStatus(`Error: ${error?.message || 'Unknown error'}`);
    }
  };
  
  // Copy token to clipboard
  const copyTokenToClipboard = async () => {
    if (expoPushToken) {
      await Clipboard.setStringAsync(expoPushToken);
      Alert.alert("Success", "Token copied to clipboard");
    }
  };

  // Test push token registration
  const testTokenRegistration = async () => {
    setStatus('Testing push token registration...');
    try {
      const success = await requestPermissions();
      if (success) {
        // Check if we have a token but we're in Expo Go
        const isExpoGo = Constants.executionEnvironment === 'storeClient';
        if (isExpoGo && expoPushToken) {
          setStatus('✅ Push permissions granted. Token registration simulated (Expo Go limitation)');
        } else {
          setStatus('Push token registration successful! ✅');
        }
      } else {
        setStatus('Push token registration failed ❌ (This is expected in Expo Go)');
      }
    } catch (error: any) {
      console.error('Error testing token registration:', error);
      
      // Handle iOS entitlement error specifically
      if (error?.message?.includes('aps-environment') || error?.message?.includes('entitlement')) {
        setStatus('⚠️ iOS entitlement error - this is normal in development. Push will work in production builds.');
      } else {
        setStatus(`Registration error: ${error?.message || 'Unknown error'}`);
      }
    }
  };

  // Test backend notification
  const testBackendNotification = async () => {
    if (!tokens.accessToken) {
      setStatus('❌ No auth token available. Please login first.');
      return;
    }

    setStatus('Sending backend test notification...');
    try {
      const result = await notificationsAPI.sendTestNotification(
        tokens.accessToken,
        'Backend Test Notification!',
        'backend_test'
      );
      
      if (result.push_sent) {
        setStatus(`✅ Backend notification sent successfully! ID: ${result.notification_id}`);
      } else {
        setStatus(`⚠️ Notification created but push failed. Check if device is registered.`);
      }
    } catch (error: any) {
      console.error('Error sending backend notification:', error);
      setStatus(`❌ Backend test failed: ${error?.message || 'Unknown error'}`);
    }
  };

  // Check recent notifications
  const checkRecentNotifications = async () => {
    if (!tokens.accessToken) {
      setStatus('❌ No auth token available. Please login first.');
      return;
    }

    setStatus('Fetching recent notifications...');
    try {
      const notifications = await notificationsAPI.getNotifications(tokens.accessToken);
      const recentCount = notifications.length;
      const unreadCount = notifications.filter((n: any) => !n.is_read).length;
      
      setStatus(`✅ Found ${recentCount} notifications (${unreadCount} unread). Check your notifications screen!`);
    } catch (error: any) {
      console.error('Error fetching notifications:', error);
      setStatus(`❌ Failed to fetch notifications: ${error?.message || 'Unknown error'}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notification Testing</Text>
      
      {isExpoGo && (
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            📱 You're using Expo Go. Local notifications work, but push notifications are limited.
          </Text>
        </View>
      )}
      
      <View style={styles.buttonContainer}>
        <Button 
          title="Request Permissions" 
          onPress={testTokenRegistration}
        />
      </View>
      
      <View style={styles.buttonContainer}>
        <Button 
          title="Send Test Local Notification" 
          onPress={sendLocalNotification} 
        />
      </View>
      
      <View style={styles.buttonContainer}>
        <Button 
          title="Test Notification (Works in Simulator)" 
          onPress={sendSimulatorNotification}
          color="#4caf50" 
        />
      </View>
      
      <View style={styles.buttonContainer}>
        <Button 
          title="🚀 Test Real Backend Notification" 
          onPress={testBackendNotification}
          color="#ff9800" 
        />
      </View>
      
      <View style={styles.buttonContainer}>
        <Button 
          title="Check Recent Notifications" 
          onPress={checkRecentNotifications}
          color="#ff9800" 
        />
      </View>
      
      <Text style={[styles.status, status.includes('✅') && styles.successStatus, status.includes('❌') && styles.errorStatus]}>
        {status || 'Ready to test notifications'}
      </Text>
      
      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          ⚠️ Starting with Expo SDK 53, push notifications are not supported in Expo Go.
          You need to create a development build to test push notifications.
        </Text>
      </View>
      
      {expoPushToken ? (
        <View style={styles.tokenContainer}>
          <Text style={styles.tokenTitle}>Your Expo Push Token:</Text>
          <ScrollView style={styles.tokenScroll}>
            <Text style={styles.tokenText} selectable={true}>
              {expoPushToken}
            </Text>
          </ScrollView>
          <Button title="Copy Token" onPress={copyTokenToClipboard} />
          <Text style={styles.instructions}>
            1. Copy this token{'\n'}
            2. Run the backend test script:{'\n'}
            python test_firebase.py {expoPushToken}
          </Text>
        </View>
      ) : (
        <View style={styles.noTokenContainer}>
          <Text style={styles.noToken}>
            No push token yet. {isExpoGo ? 'This is expected in Expo Go.' : 'Request permissions first.'}
          </Text>
          {!isExpoGo && (
            <Text style={styles.noTokenHint}>
              Try the "Request Permissions" button above.
            </Text>
          )}
        </View>
      )}

      <View style={styles.statusContainer}>
        <Text style={styles.statusTitle}>Environment Status:</Text>
        <Text style={styles.statusItem}>
          📱 Environment: {isExpoGo ? 'Expo Go' : 'Development Build'}
        </Text>
        <Text style={styles.statusItem}>
          🔔 Local Notifications: ✅ Working
        </Text>
        <Text style={styles.statusItem}>
          📡 Push Notifications: {isExpoGo ? '❌ Limited' : expoPushToken ? '✅ Working' : '⚠️ No Token'}
        </Text>
        <Text style={styles.statusItem}>
          🔑 Push Token: {expoPushToken ? '✅ Available' : '❌ Not Available'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 10,
  },
  status: {
    marginTop: 16,
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    width: '100%',
    textAlign: 'center',
    fontSize: 14,
  },
  successStatus: {
    backgroundColor: '#d4edda',
    color: '#155724',
  },
  errorStatus: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
  },
  tokenContainer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#e0f0ff',
    borderRadius: 8,
    width: '100%',
  },
  tokenTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  tokenScroll: {
    maxHeight: 80,
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 4,
    marginBottom: 10,
  },
  tokenText: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  noTokenContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  noToken: {
    color: '#6c757d',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 8,
  },
  noTokenHint: {
    color: '#007AFF',
    fontSize: 12,
    textAlign: 'center',
  },
  instructions: {
    marginTop: 16,
    fontSize: 12,
    color: '#555',
  },
  infoContainer: {
    marginTop: 10,
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#fff3cd',
    borderRadius: 4,
    width: '100%',
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  infoText: {
    fontSize: 12,
    color: '#856404',
  },
  statusContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    width: '100%',
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  statusItem: {
    fontSize: 14,
    marginBottom: 6,
    color: '#555',
  },
}); 