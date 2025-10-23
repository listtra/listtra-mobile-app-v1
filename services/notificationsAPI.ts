import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = Constants?.expoConfig?.extra?.apiUrl;

// Function to get API instance with auth token
const getApiInstance = async (token: string) => {
  return axios.create({
    baseURL: API_URL,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
};

export const notificationsAPI = {
  getNotifications: async (token: string, unreadOnly = false) => {
    const api = await getApiInstance(token);
    const response = await api.get(`/api/notifications_new/?unread=${unreadOnly}`);
    return response.data;
  },

  getUnreadCount: async (token: string) => {
    const api = await getApiInstance(token);
    const response = await api.get('/api/notifications_new/unread-count/');
    return response.data.unread_count;
  },

  markAsRead: async (token: string, notificationId: number) => {
    const api = await getApiInstance(token);
    await api.post(`/api/notifications_new/mark-read/${notificationId}/`);
  },

  markAllAsRead: async (token: string) => {
    const api = await getApiInstance(token);
    await api.post('/api/notifications_new/mark-all-read/');
  },

  registerDevice: async (token: string, deviceToken: string, deviceType = 'mobile') => {
    const api = await getApiInstance(token);
    await api.post('/api/notifications_new/register-device/', {
      token: deviceToken,
      device_type: deviceType,
    });
  },

  unregisterDevice: async (token: string, deviceToken: string) => {
    const api = await getApiInstance(token);
    await api.post('/api/notifications_new/unregister-device/', {
      token: deviceToken,
    });
  },

  sendTestNotification: async (token: string, message?: string, type?: string) => {
    const api = await getApiInstance(token);
    const response = await api.post('/api/notifications_new/send-test/', {
      message: message || 'Test notification from Zirkly backend!',
      type: type || 'test'
    });
    return response.data;
  },
}; 