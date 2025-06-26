import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { usePushNotification } from '../context/PushNotificationContext';
import { pushNotificationService } from '../services/pushNotificationService';

type NotificationPreferences = {
  pushEnabled: boolean;
  likes: boolean;
  offers: boolean;
  messages: boolean;
  reviews: boolean;
  priceUpdates: boolean;
  itemSold: boolean;
  sound: boolean;
  vibration: boolean;
};

export const NotificationSettings = () => {
  const { 
    expoPushToken, 
    requestPermissions,
    unreadCount
  } = usePushNotification();
  
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [systemPermission, setSystemPermission] = useState<string>('undetermined');
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    pushEnabled: !!expoPushToken,
    likes: true,
    offers: true,
    messages: true,
    reviews: true,
    priceUpdates: true,
    itemSold: true,
    sound: true,
    vibration: true,
  });

  // Check if we're in Expo Go
  const isExpoGo = Constants.executionEnvironment === 'storeClient';

  // Check system notification permission on load
  useEffect(() => {
    checkNotificationPermission();
  }, []);

  // Update push enabled state when token changes
  useEffect(() => {
    setPreferences(prev => ({
      ...prev,
      pushEnabled: !!expoPushToken
    }));
  }, [expoPushToken]);

  const checkNotificationPermission = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setSystemPermission(status);
    } catch (error) {
      console.error('Error checking notification permission:', error);
    }
  };

  const handlePushToggle = async () => {
    if (preferences.pushEnabled) {
      // If turning off, explain to user they need to do this in system settings
      Alert.alert(
        'Disable Notifications',
        'To disable notifications, you need to turn them off in your device settings.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Open Settings',
            onPress: () => Linking.openSettings(),
          },
        ]
      );
    } else {
      // If turning on, request permissions
      setLoading(true);
      try {
        const success = await requestPermissions();
        if (success) {
          setPreferences(prev => ({ ...prev, pushEnabled: true }));
          Alert.alert('Success', 'Push notifications enabled!');
        } else {
          Alert.alert(
            'Permission Required',
            'Please enable notifications in your device settings to receive push notifications.',
            [
              {
                text: 'Cancel',
                style: 'cancel',
              },
              {
                text: 'Open Settings',
                onPress: () => Linking.openSettings(),
              },
            ]
          );
        }
      } catch (error) {
        console.error('Error requesting permissions:', error);
        Alert.alert('Error', 'Failed to enable notifications. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handlePreferenceToggle = (key: keyof NotificationPreferences) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
    
    // Here you would typically save to backend
    // await notificationsAPI.updatePreferences(preferences);
  };

  const testNotification = async () => {
    try {
      // Use the new local test notification function
      const success = await pushNotificationService.sendLocalTestNotification(
        'Test Notification',
        'This is a test notification from Listtra! 🎉'
      );
      
      if (success) {
        Alert.alert('Test Sent!', 'Check your notifications to see the test message. This works even in Expo Go and simulators.');
      } else {
        Alert.alert('Error', 'Failed to send test notification.');
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      Alert.alert('Error', 'Failed to send test notification.');
    }
  };

  const testAdvancedNotification = async () => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Advanced Test 🚀",
          body: "This notification has custom data and sound",
          data: { 
            type: 'advanced_test',
            timestamp: new Date().toISOString(),
            customData: 'Hello from Listtra!'
          },
          sound: preferences.sound ? 'default' : false,
          badge: 1,
        },
        trigger: null,
      });
      
      Alert.alert('Advanced Test Sent!', 'This notification includes custom data and respects your sound preferences.');
    } catch (error) {
      console.error('Error sending advanced test notification:', error);
      Alert.alert('Error', 'Failed to send advanced test notification.');
    }
  };

  const getPermissionStatusIcon = () => {
    switch (systemPermission) {
      case 'granted':
        return <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />;
      case 'denied':
        return <Ionicons name="close-circle" size={20} color="#F44336" />;
      default:
        return <Ionicons name="help-circle" size={20} color="#FF9800" />;
    }
  };

  const getPermissionStatusText = () => {
    switch (systemPermission) {
      case 'granted':
        return 'Allowed';
      case 'denied':
        return 'Denied';
      default:
        return 'Not Set';
    }
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="log-in-outline" size={48} color="#999" />
          <Text style={styles.emptyTitle}>Please log in</Text>
          <Text style={styles.emptyText}>
            You need to be logged in to manage notification settings.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {isExpoGo && (
        <View style={styles.expoGoWarning}>
          <Ionicons name="information-circle" size={20} color="#FF9800" />
          <Text style={styles.warningText}>
            You're using Expo Go. Push notifications are limited, but local notifications work for testing.
          </Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Push Notifications</Text>
        
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <View style={styles.settingHeader}>
              <Text style={styles.settingTitle}>Enable Push Notifications</Text>
              {loading && <ActivityIndicator size="small" color="#007AFF" />}
            </View>
            <Text style={styles.settingDescription}>
              {isExpoGo 
                ? 'Limited in Expo Go - use development build for full functionality'
                : 'Receive notifications when you get likes, offers, messages, and more'
              }
            </Text>
          </View>
          <Switch
            value={preferences.pushEnabled}
            onValueChange={handlePushToggle}
            disabled={loading}
            trackColor={{ false: '#767577', true: '#007AFF' }}
            thumbColor={preferences.pushEnabled ? '#fff' : '#f4f3f4'}
          />
        </View>

        <View style={styles.permissionStatus}>
          <View style={styles.permissionRow}>
            {getPermissionStatusIcon()}
            <Text style={styles.permissionText}>
              System Permission: {getPermissionStatusText()}
            </Text>
          </View>
          {systemPermission === 'denied' && (
            <TouchableOpacity style={styles.settingsButton} onPress={() => Linking.openSettings()}>
              <Text style={styles.settingsButtonText}>Open Settings</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {preferences.pushEnabled && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notification Types</Text>
            <Text style={styles.sectionDescription}>
              Choose which types of notifications you want to receive
            </Text>
            
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>💬 Messages</Text>
                <Text style={styles.settingDescription}>New chat messages</Text>
              </View>
              <Switch
                value={preferences.messages}
                onValueChange={() => handlePreferenceToggle('messages')}
                trackColor={{ false: '#767577', true: '#007AFF' }}
                thumbColor={preferences.messages ? '#fff' : '#f4f3f4'}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>💰 Offers</Text>
                <Text style={styles.settingDescription}>New offers on your listings</Text>
              </View>
              <Switch
                value={preferences.offers}
                onValueChange={() => handlePreferenceToggle('offers')}
                trackColor={{ false: '#767577', true: '#007AFF' }}
                thumbColor={preferences.offers ? '#fff' : '#f4f3f4'}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>♥️ Likes</Text>
                <Text style={styles.settingDescription}>When someone likes your listing</Text>
              </View>
              <Switch
                value={preferences.likes}
                onValueChange={() => handlePreferenceToggle('likes')}
                trackColor={{ false: '#767577', true: '#007AFF' }}
                thumbColor={preferences.likes ? '#fff' : '#f4f3f4'}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>⭐ Reviews</Text>
                <Text style={styles.settingDescription}>New reviews from buyers</Text>
              </View>
              <Switch
                value={preferences.reviews}
                onValueChange={() => handlePreferenceToggle('reviews')}
                trackColor={{ false: '#767577', true: '#007AFF' }}
                thumbColor={preferences.reviews ? '#fff' : '#f4f3f4'}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>🛒 Item Sold</Text>
                <Text style={styles.settingDescription}>When your item is sold</Text>
              </View>
              <Switch
                value={preferences.itemSold}
                onValueChange={() => handlePreferenceToggle('itemSold')}
                trackColor={{ false: '#767577', true: '#007AFF' }}
                thumbColor={preferences.itemSold ? '#fff' : '#f4f3f4'}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>💲 Price Updates</Text>
                <Text style={styles.settingDescription}>Price changes on items you like</Text>
              </View>
              <Switch
                value={preferences.priceUpdates}
                onValueChange={() => handlePreferenceToggle('priceUpdates')}
                trackColor={{ false: '#767577', true: '#007AFF' }}
                thumbColor={preferences.priceUpdates ? '#fff' : '#f4f3f4'}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sound & Vibration</Text>
            
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>🔊 Sound</Text>
                <Text style={styles.settingDescription}>Play sound with notifications</Text>
              </View>
              <Switch
                value={preferences.sound}
                onValueChange={() => handlePreferenceToggle('sound')}
                trackColor={{ false: '#767577', true: '#007AFF' }}
                thumbColor={preferences.sound ? '#fff' : '#f4f3f4'}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>📳 Vibration</Text>
                <Text style={styles.settingDescription}>Vibrate when receiving notifications</Text>
              </View>
              <Switch
                value={preferences.vibration}
                onValueChange={() => handlePreferenceToggle('vibration')}
                trackColor={{ false: '#767577', true: '#007AFF' }}
                thumbColor={preferences.vibration ? '#fff' : '#f4f3f4'}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Test & Debug</Text>
            
            <TouchableOpacity style={styles.testButton} onPress={testNotification}>
              <Ionicons name="notifications" size={20} color="#007AFF" />
              <Text style={styles.testButtonText}>Send Test Notification</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.testButtonSecondary} onPress={testAdvancedNotification}>
              <Ionicons name="rocket" size={20} color="#FF6B35" />
              <Text style={styles.testButtonSecondaryText}>Send Advanced Test</Text>
            </TouchableOpacity>
            
            {unreadCount > 0 && (
              <View style={styles.unreadInfo}>
                <Text style={styles.unreadText}>
                  You have {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
                </Text>
              </View>
            )}
          </View>
        </>
      )}

      {expoPushToken && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Device Information</Text>
          <View style={styles.deviceInfo}>
            <Text style={styles.deviceInfoLabel}>Device Token Status:</Text>
            <Text style={styles.deviceInfoValue}>
              {expoPushToken ? 'Registered' : 'Not Registered'}
            </Text>
          </View>
          <View style={styles.deviceInfo}>
            <Text style={styles.deviceInfoLabel}>Platform:</Text>
            <Text style={styles.deviceInfoValue}>{Platform.OS}</Text>
          </View>
          <View style={styles.deviceInfo}>
            <Text style={styles.deviceInfoLabel}>Environment:</Text>
            <Text style={styles.deviceInfoValue}>
              {isExpoGo ? 'Expo Go' : 'Development Build'}
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  section: {
    backgroundColor: '#fff',
    marginBottom: 12,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    paddingHorizontal: 16,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    paddingHorizontal: 16,
    lineHeight: 20,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  permissionStatus: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    margin: 16,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    fontWeight: '500',
  },
  settingsButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  settingsButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f8ff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  testButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  testButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff0e6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FF6B35',
  },
  testButtonSecondaryText: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  unreadInfo: {
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  unreadText: {
    fontSize: 14,
    color: '#856404',
    fontWeight: '500',
  },
  deviceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  deviceInfoLabel: {
    fontSize: 14,
    color: '#666',
  },
  deviceInfoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  expoGoWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    margin: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
}); 