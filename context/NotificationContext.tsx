import { usePathname } from 'expo-router';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { notificationsAPI } from '../services/notificationsAPI';
import { useAuth } from './AuthContext';

type Notification = {
  id: number;
  text: string;
  message?: string;
  is_read: boolean;
  created_at: string;
  notification_type: string;
  object_id?: string;
  product_image?: string;
};

type NotificationContextType = {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  fetchNotifications: () => Promise<void>;
  markAsRead: (notificationId: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  loading: true,
  error: null,
  fetchNotifications: async () => {},
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  fetchUnreadCount: async () => {},
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { user, tokens, isAuthenticated } = useAuth();
  const pathname = usePathname();

  // Helper function to check if we're on an auth page
  const isAuthPage = () => {
    return pathname?.includes('/auth/');
  };

  const fetchNotifications = async () => {
    // Don't fetch if on auth page or no user
    if (isAuthPage() || !isAuthenticated || !tokens.accessToken) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await notificationsAPI.getNotifications(tokens.accessToken);
      setNotifications(data);
    } catch (error: any) {
      console.log('Failed to fetch notifications:', error);
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    // Don't fetch if on auth page or no user
    if (isAuthPage() || !isAuthenticated || !tokens.accessToken) {
      setUnreadCount(0);
      return;
    }

    try {
      const count = await notificationsAPI.getUnreadCount(tokens.accessToken);
      setUnreadCount(count);
    } catch (error) {
      console.log('Failed to fetch unread count:', error);
    }
  };

  const markAsRead = async (notificationId: number) => {
    if (isAuthPage() || !isAuthenticated || !tokens.accessToken) return;

    try {
      await notificationsAPI.markAsRead(tokens.accessToken, notificationId);
      setNotifications(
        notifications.map((notification) =>
          notification.id === notificationId
            ? { ...notification, is_read: true }
            : notification
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.log('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (isAuthPage() || !isAuthenticated || !tokens.accessToken) return;

    try {
      await notificationsAPI.markAllAsRead(tokens.accessToken);
      setNotifications(
        notifications.map((notification) => ({
          ...notification,
          is_read: true,
        }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.log('Failed to mark all notifications as read:', error);
    }
  };

  // Set up polling for new notifications
  useEffect(() => {
    if (isAuthenticated && tokens.accessToken && !isAuthPage()) {
      // Initial fetch
      fetchNotifications();
      fetchUnreadCount();

      const interval = setInterval(() => {
        // Fetch both notifications and unread count during polling
        fetchNotifications();
        fetchUnreadCount();
      }, 30000); // Poll every 30 seconds

      return () => clearInterval(interval);
    } else {
      // Reset state when user logs out or on auth pages
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
    }
  }, [isAuthenticated, tokens.accessToken, pathname]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        error,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        fetchUnreadCount,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      'useNotifications must be used within a NotificationProvider'
    );
  }
  return context;
} 