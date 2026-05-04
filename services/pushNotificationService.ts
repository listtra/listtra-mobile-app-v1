import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { notificationsAPI } from './notificationsAPI';

type NotificationsModule = typeof import('expo-notifications');

let Notifications: NotificationsModule | null = null;
let tokenRefreshUnsubscribe: (() => void) | null = null;

const teardownTokenRefresh = () => {
  if (tokenRefreshUnsubscribe) {
    try {
      tokenRefreshUnsubscribe();
    } catch (err) {
      console.error('[push] Token refresh teardown failed:', err);
    }
    tokenRefreshUnsubscribe = null;
  }
};

const subscribeToTokenRefresh = async (authToken: string, platform: 'ios' | 'android') => {
  teardownTokenRefresh();
  try {
    const messaging = (await import('@react-native-firebase/messaging')).default;
    tokenRefreshUnsubscribe = messaging().onTokenRefresh(async (newToken: string) => {
      if (!newToken) return;
      try {
        await notificationsAPI.registerDevice(authToken, newToken, platform);
        console.log('[push] Re-registered after FCM token refresh');
      } catch (err) {
        console.error('[push] Re-register on token refresh failed:', err);
      }
    });
  } catch (err) {
    console.error('[push] Failed to subscribe to onTokenRefresh:', err);
  }
};

const initializeNotifications = async (): Promise<NotificationsModule | null> => {
  if (Notifications) return Notifications;

  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return null;
  }

  try {
    Notifications = await import('expo-notifications');
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
};

const getDevicePushToken = async (
  NotificationsModule: NotificationsModule,
): Promise<string | null> => {
  // Backend uses firebase-admin, which requires an FCM registration token.
  // Android: expo-notifications' getDevicePushTokenAsync returns the FCM token directly.
  // iOS: getDevicePushTokenAsync returns a raw APNs token, which firebase-admin
  // cannot use; we go through @react-native-firebase/messaging to exchange the
  // APNs token for an FCM registration token (Firebase Console must have the
  // APNs .p8 key uploaded for this exchange to work).
  try {
    if (Platform.OS === 'ios') {
      const messagingModule = await import('@react-native-firebase/messaging');
      const messaging = messagingModule.default;
      // registerDeviceForRemoteMessages must complete before getToken on iOS.
      if (!messaging().isDeviceRegisteredForRemoteMessages) {
        await messaging().registerDeviceForRemoteMessages();
      }
      const fcmToken = await messaging().getToken();
      return fcmToken || null;
    }
    const result = await NotificationsModule.getDevicePushTokenAsync();
    return result?.data || null;
  } catch (err: any) {
    if (err?.message?.includes('aps-environment') || err?.message?.includes('entitlement')) {
      console.log('[push] APNs entitlement missing — expected in Expo Go / simulator');
      return null;
    }
    console.error('[push] getDevicePushToken failed:', err);
    return null;
  }
};

export const pushNotificationService = {
  /**
   * Request permission, get raw FCM/APNs token, register with backend.
   * Returns the device token on success.
   */
  registerForPushNotificationsAsync: async (authToken: string): Promise<string | null> => {
    const NotificationsModule = await initializeNotifications();
    if (!NotificationsModule) {
      return null;
    }

    if (!Device.isDevice) {
      console.log('[push] Not a physical device, skipping push registration');
      return null;
    }

    const isExpoGo = Constants.executionEnvironment === 'storeClient';
    if (isExpoGo) {
      console.log('[push] Expo Go: real push notifications not supported. Use a dev build.');
      return null;
    }

    const { status: existingStatus } = await NotificationsModule.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await NotificationsModule.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('[push] Permission denied');
      return null;
    }

    if (Platform.OS === 'android') {
      await NotificationsModule.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: NotificationsModule.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'default',
      });
    }

    const deviceToken = await getDevicePushToken(NotificationsModule);
    if (!deviceToken) return null;

    const platform: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android';

    try {
      await notificationsAPI.registerDevice(authToken, deviceToken, platform);
      console.log('[push] Device registered with backend');
      await subscribeToTokenRefresh(authToken, platform);
    } catch (err) {
      console.error('[push] Backend registration failed:', err);
    }

    return deviceToken;
  },

  unregisterPushToken: async (authToken: string, deviceToken: string): Promise<boolean> => {
    teardownTokenRefresh();
    if (!deviceToken) return false;
    try {
      await notificationsAPI.unregisterDevice(authToken, deviceToken);
      return true;
    } catch (err) {
      console.error('[push] Unregister failed:', err);
      return false;
    }
  },

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

  /**
   * If app launched from a notification tap (killed state), returns last response.
   */
  getLastNotificationResponse: async () => {
    const NotificationsModule = await initializeNotifications();
    if (!NotificationsModule) return null;
    try {
      return await NotificationsModule.getLastNotificationResponseAsync();
    } catch {
      return null;
    }
  },

  /**
   * Build deep-link URL path from notification data payload.
   * Backend payload contract:
   *   { type, sub_type, object_id, deep_link, conversation_id, listing_slug, product_id }
   * `deep_link` (preferred, when present) is already the full path.
   */
  resolveDeepLink: (data: Record<string, any> | null | undefined): string | null => {
    if (!data) return null;

    if (typeof data.deep_link === 'string' && data.deep_link.startsWith('/')) {
      return data.deep_link;
    }

    const subType = data.sub_type;
    const conversationId = data.conversation_id;
    const slug = data.listing_slug;
    const productId = data.product_id;
    const objectId: string = data.object_id || '';

    // Seller-facing offer events → chat
    if (
      subType === 'offer_received' ||
      subType === 'offer_modified' ||
      subType === 'offer_cancelled'
    ) {
      if (conversationId) return `/chat/${conversationId}`;
      if (objectId.startsWith('conversation:')) return `/chat/${objectId.split(':')[1]}`;
    }

    // Buyer-facing offer events + price drop → listing page
    if (
      subType === 'offer_accepted' ||
      subType === 'offer_declined' ||
      subType === 'price_drop' ||
      subType === 'item_sold'
    ) {
      if (slug && productId) return `/listings/${slug}/${productId}`;
    }

    // Generic fallback for object_id "slug:product_id"
    if (objectId.includes(':') && !objectId.startsWith('conversation:')) {
      const [s, pid] = objectId.split(':');
      return `/listings/${s}/${pid}`;
    }
    if (objectId.startsWith('conversation:')) {
      return `/chat/${objectId.split(':')[1]}`;
    }

    return null;
  },
};
