import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
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
  // Special rendering for review reminders
  if (item.notification_type === 'review_reminder') {
    return (
      <TouchableOpacity
        style={styles.reviewReminderItem}
        onPress={() => onPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.reviewReminderHeader}>
          <Text style={styles.reviewReminderTitle}>Review Reminder</Text>
          {!item.is_read && <View style={styles.unreadDot} />}
        </View>
        
        <View style={styles.reviewReminderContent}>
          {/* Product Image */}
          {item.product_image ? (
            <Image 
              source={{ uri: item.product_image }} 
              style={styles.reviewProductImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.reviewPlaceholderImage}>
              <Ionicons name="star" size={24} color="#FFD700" />
            </View>
          )}
          
          {/* Review Message */}
          <View style={styles.reviewMessageContainer}>
            <Text style={styles.reviewMessage}>{item.message || item.text}</Text>
            <Text style={styles.reviewPrompt}>Tap to leave your review now</Text>
          </View>
        </View>
        
        <Text style={styles.reviewReminderTime}>
          {formatTimestamp(item.created_at)}
        </Text>
      </TouchableOpacity>
    );
  }
  
  // Regular notification rendering
  return (
    <TouchableOpacity
      style={styles.notificationItem}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.notificationContent}>
        {/* Product Image */}
        {item.product_image ? (
          <Image 
            source={{ uri: item.product_image }} 
            style={styles.productImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholderImage}>
            <Text style={styles.placeholderText}>
              {getNotificationIcon(item.notification_type)}
            </Text>
          </View>
        )}
        
        {/* Notification Text */}
        <View style={styles.notificationTextContainer}>
          <Text style={styles.notificationText} numberOfLines={2}>
            {item.message || item.text}
          </Text>
        </View>
        
        {/* Right side: Time and unread indicator */}
        <View style={styles.rightContainer}>
          <Text style={styles.notificationTime}>
            {formatTimestamp(item.created_at)}
          </Text>
          {!item.is_read && <View style={styles.unreadDot} />}
        </View>
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
  const { isAuthenticated, tokens } = useAuth();
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
        } else if (notification.notification_type === 'review_reminder') {
          // For review reminders, navigate to the chat page for the relevant listing
          // First we need to find the conversation
          try {
            console.log('🔍 Looking for conversation for product:', product_id);
            
            const api = axios.create({
              baseURL: 'https://backend.listtra.com',
              headers: {
                Authorization: `Bearer ${tokens.accessToken}`,
                'Content-Type': 'application/json',
              },
            });
            
            // Fetch all conversations and filter by product_id (correct approach)
            const response = await api.get(`/api/chat/conversations/`);
            console.log('📊 Total conversations found:', response.data.length);
            
            // Filter conversations for this specific product
            const productConversations = response.data.filter(
              (conv: any) => conv.listing?.product_id === product_id
            );
            
            console.log('🎯 Conversations for this product:', productConversations.length);
            
            if (productConversations.length > 0) {
              // Navigate to the first conversation for this product
              const targetConversation = productConversations[0];
              console.log('✅ Navigating to conversation:', targetConversation.id);
              
              router.push({
                pathname: '/chat/[id]',
                params: { id: targetConversation.id.toString() }
              });
            } else {
              // No conversations found - navigate to listing instead
              console.log('⚠️ No conversations found, navigating to listing');
              router.push({
                pathname: '/listings/[slug]/[product_id]/page',
                params: { slug, product_id }
              });
            }
          } catch (error) {
            console.error('❌ Error navigating to review chat:', error);
            // Fallback to listing view
            console.log('🔄 Fallback: navigating to listing page');
            router.push({
              pathname: '/listings/[slug]/[product_id]/page',
              params: { slug, product_id }
            });
          }
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
    backgroundColor: '#fff',
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  placeholderImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  placeholderText: {
    fontSize: 18,
  },
  notificationTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  notificationText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 20,
  },
  rightContainer: {
    alignItems: 'flex-end',
  },
  notificationTime: {
    fontSize: 13,
    color: '#999',
    marginBottom: 4,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
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
  reviewReminderItem: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  reviewReminderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewReminderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  reviewReminderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewProductImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  reviewPlaceholderImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reviewMessageContainer: {
    flex: 1,
  },
  reviewMessage: {
    fontSize: 15,
    color: '#333',
    lineHeight: 20,
  },
  reviewPrompt: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  reviewReminderTime: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
}); 