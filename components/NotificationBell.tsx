import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { usePushNotification } from '../context/PushNotificationContext';

// Helper function to format timestamp relative to now
const formatTimestamp = (dateString: string): string => {
  if (!dateString) return '';
  
  try {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHrs < 1) return "Just now";
    if (diffHrs < 24) return `${diffHrs}hrs`;
    return `${Math.floor(diffHrs / 24)}d`;
  } catch (e) {
    return '2hrs'; // Fallback to match the design
  }
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

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, loading, fetchNotifications } = useNotifications();
  const { notification: liveNotification } = usePushNotification();
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  // Refresh notifications when a new push notification arrives
  useEffect(() => {
    if (liveNotification) {
      fetchNotifications();
    }
  }, [liveNotification]);

  // Auto-refresh notifications periodically
  useEffect(() => {
    if (isAuthenticated) {
      const interval = setInterval(() => {
        fetchNotifications();
      }, 30000); // Every 30 seconds

      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // Handle notification click with improved navigation
  const handleNotificationClick = async (notification: any) => {
    await markAsRead(notification.id);
    setIsOpen(false);

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
      }
    }
  };

  // View all notifications
  const viewAllNotifications = () => {
    setIsOpen(false);
    router.push('/notifications');
  };

  // Sort notifications by created_at in descending order
  const sortedNotifications = [...notifications].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  ).slice(0, 5); // Show only recent 5 notifications in dropdown

  const renderNotificationItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.notificationItem}
      onPress={() => handleNotificationClick(item)}
    >
      <View style={styles.notificationContent}>
        {/* Product Image or Icon */}
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

  if (!isAuthenticated) return null;

  return (
    <>
      <TouchableOpacity 
        style={styles.bellContainer} 
        onPress={() => setIsOpen(true)}
      >
        <Ionicons name="notifications-outline" size={24} color="#333" />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsOpen(false)}
        >
          <View style={styles.dropdown}>
            <TouchableOpacity activeOpacity={1}>
              <View style={styles.dropdownHeader}>
                <Text style={styles.dropdownTitle}>Notifications</Text>
                {unreadCount > 0 && (
                  <Text style={styles.unreadCountText}>
                    {unreadCount} unread
                  </Text>
                )}
              </View>

              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color="#007AFF" />
                  <Text style={styles.loadingText}>Loading...</Text>
                </View>
              ) : sortedNotifications.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="notifications-off-outline" size={32} color="#999" />
                  <Text style={styles.emptyText}>No notifications yet</Text>
                </View>
              ) : (
                <FlatList
                  data={sortedNotifications}
                  renderItem={renderNotificationItem}
                  keyExtractor={(item) => item.id.toString()}
                  showsVerticalScrollIndicator={false}
                  style={styles.notificationsList}
                />
              )}

              <View style={styles.dropdownFooter}>
                <TouchableOpacity 
                  style={styles.viewAllButton}
                  onPress={viewAllNotifications}
                >
                  <Text style={styles.viewAllText}>View All</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellContainer: {
    position: 'relative',
    padding: 8,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 100,
    paddingRight: 16,
  },
  dropdown: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: 320,
    maxWidth: '90%',
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  unreadCountText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  notificationsList: {
    maxHeight: 300,
  },
  notificationItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationTextContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  notificationText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 18,
  },
  notificationTime: {
    fontSize: 12,
    color: '#999',
    marginRight: 8,
  },
  productImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: '#999',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 8,
    color: '#999',
    textAlign: 'center',
  },
  dropdownFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  viewAllButton: {
    alignItems: 'center',
    padding: 8,
  },
  viewAllText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  placeholderImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 14,
    color: '#999',
  },
  rightContainer: {
    alignItems: 'center',
  },
}); 