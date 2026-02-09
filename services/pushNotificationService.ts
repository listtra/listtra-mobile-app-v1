import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { notificationsAPI } from './notificationsAPI';

// Type definitions for when Notifications is dynamically imported
type NotificationsModule = typeof import('expo-notifications');

// Store the Notifications module reference
let Notifications: NotificationsModule | null = null;

// Initialize notifications module (call this before using any notification functions)
const initializeNotifications = async (): Promise<NotificationsModule | null> => {
  if (Notifications) return Notifications;
  
  // Only import on mobile platforms
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    try {
      Notifications = await import('expo-notifications');
      
      // Configure notification handler after import
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      
      return Notifications;
    } catch (error) {
      console.error('Failed to import expo-notifications:', error);
      return null;
    }
  }
  
  return null;
};

export const pushNotificationService = {
  // Register for push notifications and return the token
  registerForPushNotificationsAsync: async (authToken: string): Promise<string | null> => {
    console.log('Starting push notification registration...');
    
    // Initialize notifications module
    const NotificationsModule = await initializeNotifications();
    if (!NotificationsModule) {
      console.log('Notifications not available on this platform');
      return null;
    }
    
    // Check if we're in Expo Go
    const isExpoGo = Constants.executionEnvironment === 'storeClient';
    console.log('Environment check:', {
      isDevice: Device.isDevice,
      isExpoGo,
      platform: Platform.OS,
      executionEnvironment: Constants.executionEnvironment
    });

    // For Expo Go or simulator, we can still get a token but it won't receive real push notifications
    if (isExpoGo) {
      console.log('Running in Expo Go - push notifications limited');
    }

    // Get permission
    const { status: existingStatus } = await NotificationsModule.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    console.log('Current permission status:', existingStatus);
    
    if (existingStatus !== 'granted') {
      const { status } = await NotificationsModule.requestPermissionsAsync();
      finalStatus = status;
      console.log('Permission request result:', status);
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }

    // Get push token - try even in simulator/Expo Go for testing
    let token;
    try {
      console.log('Attempting to get Expo push token...');
      
      // For Expo projects
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      console.log('Project ID:', projectId);
      
      if (projectId) {
        const result = await NotificationsModule.getExpoPushTokenAsync({ projectId });
        token = result.data;
      } else {
        // Fallback if projectId isn't available
        const result = await NotificationsModule.getExpoPushTokenAsync();
        token = result.data;
      }
      
      console.log('Got push token:', token ? 'Yes' : 'No');
      
      // Register with backend if we got a token
      if (token) {
        console.log('Registering token with backend...');
        try {
          await notificationsAPI.registerDevice(
            authToken,
            token,
            Platform.OS === 'ios' ? 'ios' : 'android'
          );
          console.log('Successfully registered token with backend');
        } catch (backendError) {
          console.error('Backend registration failed:', backendError);
          // Don't fail completely - return the token anyway for local notifications
        }
      }

      // Set up notification categories/actions
      await NotificationsModule.setNotificationCategoryAsync('message', [
        {
          identifier: 'reply',
          buttonTitle: 'Reply',
          options: {
            opensAppToForeground: true,
          },
        },
        {
          identifier: 'view',
          buttonTitle: 'View',
          options: {
            opensAppToForeground: true,
          },
        },
      ]);

      // Configure for Android
      if (Platform.OS === 'android') {
        await NotificationsModule.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: NotificationsModule.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
        
        // Additional channel for messages
        await NotificationsModule.setNotificationChannelAsync('messages', {
          name: 'Messages',
          importance: NotificationsModule.AndroidImportance.HIGH,
          sound: 'default',
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      return token;
    } catch (error: any) {
      // Handle iOS entitlement error more gracefully
      if (error?.message?.includes('aps-environment') || error?.message?.includes('entitlement')) {
        console.log('Push notification entitlement error - this is expected in Expo Go and simulators');
        
        // Return a development token for testing
        return `ExponentPushToken[dev-${Math.random().toString(36).substring(2, 10)}]`;
      } else {
        console.error('Error getting push token:', error);
      }
      return null;
    }
  },

  // Send a local test notification (works in simulator/Expo Go)
  sendLocalTestNotification: async (title: string = 'Test Notification', body: string = 'This is a test notification from Zirkly!') => {
    try {
      const NotificationsModule = await initializeNotifications();
      if (!NotificationsModule) return false;
      
      console.log('Sending local test notification...');
      
      await NotificationsModule.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { type: 'test' },
          sound: 'default',
        },
        trigger: null, // Send immediately
      });
      
      console.log('Local test notification sent successfully');
      return true;
    } catch (error) {
      console.error('Error sending local test notification:', error);
      return false;
    }
  },

  // Add notification listeners
  addNotificationReceivedListener: async (callback: (notification: any) => void) => {
    const NotificationsModule = await initializeNotifications();
    if (!NotificationsModule) return () => {};
    
    return NotificationsModule.addNotificationReceivedListener(callback);
  },

  addNotificationResponseReceivedListener: async (callback: (response: any) => void) => {
    const NotificationsModule = await initializeNotifications();
    if (!NotificationsModule) return () => {};
    
    return NotificationsModule.addNotificationResponseReceivedListener(callback);
  },

  // Unregister device token when user logs out
  unregisterPushToken: async (authToken: string, deviceToken: string) => {
    if (deviceToken) {
      try {
        await notificationsAPI.unregisterDevice(authToken, deviceToken);
        return true;
      } catch (error) {
        console.error('Error unregistering push token:', error);
        return false;
      }
    }
    return false;
  }
};