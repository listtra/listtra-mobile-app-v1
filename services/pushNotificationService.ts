import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { notificationsAPI } from './notificationsAPI';

// Configure notification behavior when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const pushNotificationService = {
  // Register for push notifications and return the token
  registerForPushNotificationsAsync: async (authToken: string): Promise<string | null> => {
    console.log('Starting push notification registration...');
    
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
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    console.log('Current permission status:', existingStatus);
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
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
        const result = await Notifications.getExpoPushTokenAsync({ projectId });
        token = result.data;
      } else {
        // Fallback if projectId isn't available
        const result = await Notifications.getExpoPushTokenAsync();
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
      await Notifications.setNotificationCategoryAsync('message', [
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
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
        
        // Additional channel for messages
        await Notifications.setNotificationChannelAsync('messages', {
          name: 'Messages',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      return token;
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  },

  // Send a local test notification (works in simulator/Expo Go)
  sendLocalTestNotification: async (title: string = 'Test Notification', body: string = 'This is a test notification from Listtra!') => {
    try {
      console.log('Sending local test notification...');
      
      await Notifications.scheduleNotificationAsync({
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

  // Add a notification response listener that opens the app
  setupNotificationListener: (callback: (notification: Notifications.Notification) => void) => {
    const subscription = Notifications.addNotificationReceivedListener(callback);
    
    // Response listener (when user taps on notification)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        // Handle deep linking or navigation logic here
        const data = response.notification.request.content.data;
        // Extract data from notification to navigate to appropriate screen
        console.log('Notification tapped with data:', data);
        
        // Example: if (data.type === 'chat') { navigate to chat screen }
      }
    );

    // Return function to clean up listeners
    return () => {
      subscription.remove();
      responseSubscription.remove();
    };
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