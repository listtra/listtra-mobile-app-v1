import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

// Header component for the notifications page
const NotificationsHeader = ({ onMarkAllRead, hasUnread }: { onMarkAllRead: () => void, hasUnread: boolean }) => {
  const router = useRouter();
  
  return (
    <View style={styles.headerContainer}>
      <TouchableOpacity 
        style={styles.headerButton} 
        onPress={() => router.back()}
      >
        <Ionicons name="chevron-back" size={24} color="#333" />
      </TouchableOpacity>
      
      <Text style={styles.headerTitle}>Notifications</Text>
      
      {hasUnread && (
        <TouchableOpacity 
          style={styles.headerButton} 
          onPress={onMarkAllRead}
        >
          <Text style={styles.markAllText}>Mark All Read</Text>
        </TouchableOpacity>
      )}
      {!hasUnread && <View style={styles.headerButton} />}
    </View>
  );
};

// Helper function to get emoji based on notification type
const getNotificationIcon = (type: string): string => {
  switch (type) {
    case 'like':
      return '♥️';
    case 'offer':
      return '💰';
    case 'message':
      return '💬';
    case 'review':
      return '⭐';
    case 'price_update':
      return '💲';
    case 'item_sold':
      return '🛒';
    default:
      return '📌';
  }
};

// Helper function to format timestamp
const formatTimestamp = (dateString: string): string => {
  if (!dateString) return '';
  
  try {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch (e) {
    return 'Just now';
  }
};

// Notification item component
const NotificationItem = ({ item, onPress }: { item: any, onPress: (item: any) => void }) => {
  return (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        !item.is_read && styles.unreadNotification
      ]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.notificationContent}>
        <View style={styles.notificationIcon}>
          <Text style={styles.iconEmoji}>
            {getNotificationIcon(item.notification_type)}
          </Text>
        </View>
        
        <View style={styles.notificationDetails}>
          <Text style={[
            styles.notificationText,
            !item.is_read && styles.unreadText
          ]} numberOfLines={3}>
            {item.message || item.text}
          </Text>
          
          <View style={styles.notificationMeta}>
            <Text style={styles.notificationTime}>
              {formatTimestamp(item.created_at)}
            </Text>
            {item.notification_type && (
              <Text style={styles.notificationType}>
                {item.notification_type.charAt(0).toUpperCase() + item.notification_type.slice(1)}
              </Text>
            )}
          </View>
        </View>
        
        {item.product_image && (
          <Image 
            source={{ uri: item.product_image }} 
            style={styles.productImage}
            resizeMode="cover"
          />
        )}
        
        {!item.is_read && <View style={styles.unreadDot} />}
      </View>
    </TouchableOpacity>
  );
};

export default function NotificationsScreen() {
  const { 
    notifications, 
    unreadCount, 
    loading, 
    error, 
    markAsRead, 
    markAllAsRead,
    fetchNotifications 
  } = useNotifications();
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  // Fetch notifications on screen load
  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
    }
  }, [isAuthenticated]);

  // Handle pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, [fetchNotifications]);

  // Handle notification click with improved navigation
  const handleNotificationClick = async (notification: any) => {
    await markAsRead(notification.id);

    // Enhanced navigation logic
    if (notification.object_id) {
      try {
        const [slug, product_id] = notification.object_id.split(':');
        
        if (notification.notification_type === 'message') {
          // Navigate to chat
          router.push({
            pathname: '/chat/[conversationId]',
            params: { conversationId: `${slug}-${product_id}` }
          });
        } else if (['like', 'offer', 'review', 'item_sold', 'price_update'].includes(notification.notification_type)) {
          // Navigate to listing
          if (slug && product_id) {
            router.push({
              pathname: '/listings/[slug]/[product_id]/page',
              params: { slug, product_id }
            });
          }
        }
      } catch (error) {
        console.log('Navigation error:', error);
        // Fallback: just mark as read
      }
    }
  };

  // Handle "Mark all as read" with confirmation
  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;
    
    Alert.alert(
      'Mark All as Read',
      `Are you sure you want to mark all ${unreadCount} notifications as read?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Mark All Read', 
          style: 'destructive',
          onPress: async () => {
            await markAllAsRead();
          }
        }
      ]
    );
  };

  // Sort notifications by created_at in descending order
  const sortedNotifications = [...notifications].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="notifications-off-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No notifications yet</Text>
      <Text style={styles.emptySubtitle}>
        You'll see notifications here when you receive likes, offers, messages, and more.
      </Text>
    </View>
  );

  // Render error state
  const renderErrorState = () => (
    <View style={styles.errorContainer}>
      <Ionicons name="alert-circle-outline" size={64} color="#ff6b6b" />
      <Text style={styles.errorTitle}>Unable to load notifications</Text>
      <Text style={styles.errorSubtitle}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={fetchNotifications}>
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <NotificationsHeader onMarkAllRead={() => {}} hasUnread={false} />
        <View style={styles.emptyContainer}>
          <Ionicons name="log-in-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>Please log in</Text>
          <Text style={styles.emptySubtitle}>
            You need to be logged in to view notifications.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <NotificationsHeader 
        onMarkAllRead={handleMarkAllAsRead} 
        hasUnread={unreadCount > 0}
      />
      
      {loading && notifications.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      ) : error ? (
        renderErrorState()
      ) : (
        <FlatList
          data={sortedNotifications}
          renderItem={({ item }) => (
            <NotificationItem 
              item={item} 
              onPress={handleNotificationClick}
            />
          )}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={
            sortedNotifications.length === 0 ? styles.emptyListContainer : undefined
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerButton: {
    padding: 8,
    minWidth: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  markAllText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  notificationItem: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  unreadNotification: {
    backgroundColor: '#f0f8ff',
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  notificationContent: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'flex-start',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconEmoji: {
    fontSize: 20,
  },
  notificationDetails: {
    flex: 1,
    marginRight: 8,
  },
  notificationText: {
    fontSize: 15,
    color: '#666',
    lineHeight: 20,
    marginBottom: 6,
  },
  unreadText: {
    color: '#333',
    fontWeight: '500',
  },
  notificationMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notificationTime: {
    fontSize: 13,
    color: '#999',
  },
  notificationType: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  productImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginLeft: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
    position: 'absolute',
    top: 16,
    right: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyListContainer: {
    flex: 1,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 