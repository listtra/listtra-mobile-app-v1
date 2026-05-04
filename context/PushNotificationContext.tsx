import { useRouter } from 'expo-router';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { pushNotificationService } from '../services/pushNotificationService';
import { useAuth } from './AuthContext';

type PushNotificationContextType = {
  expoPushToken: string | null;
  notification: any | null;
  unreadCount: number;
  requestPermissions: () => Promise<boolean>;
  resetUnreadCount: () => void;
};

// Create context
const PushNotificationContext = createContext<PushNotificationContextType>({
  expoPushToken: null,
  notification: null,
  unreadCount: 0,
  requestPermissions: async () => false,
  resetUnreadCount: () => {},
});

// Provider component
export const PushNotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<any | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);
  const auth = useAuth();
  const { tokens, isAuthenticated } = auth;
  const authToken = tokens.accessToken;
  const router = useRouter();

  // Request permissions and register for push notifications
  const requestPermissions = async (): Promise<boolean> => {
    if (!authToken) return false;
    
    // Only proceed on mobile platforms
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      return false;
    }
    
    try {
      const pushToken = await pushNotificationService.registerForPushNotificationsAsync(authToken);
      if (pushToken) {
        setExpoPushToken(pushToken);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  };

  // Setup notifications when user is authenticated
  useEffect(() => {
    // Skip if not authenticated, no token, or not on mobile
    if (!isAuthenticated || !authToken) return;
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;

    let mounted = true;

    // Initialize notifications
    const initializeNotifications = async () => {
      try {
        // Register for push notifications
        const pushToken = await pushNotificationService.registerForPushNotificationsAsync(authToken);
        if (pushToken && mounted) {
          setExpoPushToken(pushToken);
        }

        // Add notification received listener
        const receivedListener = await pushNotificationService.addNotificationReceivedListener(
          (notification) => {
            if (mounted) {
              setNotification(notification);
              setUnreadCount((prev) => prev + 1);
            }
          }
        );
        notificationListener.current = receivedListener;

        // Add notification response received listener
        const responseListenerRef = await pushNotificationService.addNotificationResponseReceivedListener(
          (response) => {
            console.log('Notification response received', response);
            
            if (mounted) {
              // Navigate to main listings page when user taps any push notification
              try {
                console.log('Navigating to main listings page...');
                router.push('/(tabs)');
              } catch (error) {
                console.error('Navigation error:', error);
              }
              
              // Reset notification state
              setNotification(null);
            }
          }
        );
        responseListener.current = responseListenerRef;
      } catch (error) {
        console.error('Failed to initialize push notifications:', error);
      }
    };

    initializeNotifications();

    // Clean up listeners when component unmounts or user logs out
    return () => {
      mounted = false;
      
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
      if (expoPushToken && !isAuthenticated) {
        pushNotificationService.unregisterPushToken(authToken, expoPushToken)
          .catch(error => console.error('Failed to unregister push token:', error));
      }
    };
  }, [isAuthenticated, authToken]);

  // Reset unread count
  const resetUnreadCount = () => {
    setUnreadCount(0);
  };

  // Context value
  const value = {
    expoPushToken,
    notification,
    unreadCount,
    requestPermissions,
    resetUnreadCount,
  };

  return (
    <PushNotificationContext.Provider value={value}>
      {children}
    </PushNotificationContext.Provider>
  );
};

// Hook to use push notification context
export const usePushNotification = () => useContext(PushNotificationContext);