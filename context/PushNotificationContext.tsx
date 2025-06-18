import * as Notifications from 'expo-notifications';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { pushNotificationService } from '../services/pushNotificationService';
import { useAuth } from './AuthContext';

type PushNotificationContextType = {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
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
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);
  const auth = useAuth();
  const { tokens, isAuthenticated } = auth;
  const authToken = tokens.accessToken;

  // Request permissions and register for push notifications
  const requestPermissions = async (): Promise<boolean> => {
    if (!authToken) return false;
    
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
    if (!isAuthenticated || !authToken) return;

    // Register for push notifications
    pushNotificationService.registerForPushNotificationsAsync(authToken)
      .then((pushToken) => {
        if (pushToken) {
          setExpoPushToken(pushToken);
        }
      })
      .catch(error => {
        console.error('Failed to get push token:', error);
      });

    // Add notification received listener
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        setNotification(notification);
        setUnreadCount((prev) => prev + 1);
      }
    );

    // Add notification response received listener
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('Notification response received', response);
        // Handle deep linking or navigation here
      }
    );

    // Clean up listeners when component unmounts or user logs out
    return () => {
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