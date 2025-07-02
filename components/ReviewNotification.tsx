import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Animated,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

interface ReviewNotificationProps {
  // Optional props to control visibility from parent
  autoShow?: boolean;
  autoHideDuration?: number;
}

const ReviewNotification: React.FC<ReviewNotificationProps> = ({
  autoShow = true,
  autoHideDuration = 7000 // Default 7 seconds
}) => {
  const { notifications } = useNotifications();
  const { tokens } = useAuth();
  const router = useRouter();
  
  // Animation value for sliding in/out
  const [slideAnim] = useState(new Animated.Value(-200));
  const [isVisible, setIsVisible] = useState(false);
  const [activeNotification, setActiveNotification] = useState<any>(null);
  
  // Find the most recent unread review reminder notification
  useEffect(() => {
    if (!notifications || !tokens?.accessToken) return;
    
    const reviewReminders = notifications
      .filter(n => n.notification_type === 'review_reminder' && !n.is_read)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    if (reviewReminders.length > 0) {
      setActiveNotification(reviewReminders[0]);
      
      if (autoShow && !isVisible) {
        showNotification();
        
        // Auto-hide after duration
        const hideTimer = setTimeout(() => {
          hideNotification();
        }, autoHideDuration);
        
        return () => clearTimeout(hideTimer);
      }
    }
  }, [notifications, tokens?.accessToken]);
  
  // Show notification with animation
  const showNotification = () => {
    setIsVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8
    }).start();
  };
  
  // Hide notification with animation
  const hideNotification = () => {
    Animated.timing(slideAnim, {
      toValue: -200,
      duration: 300,
      useNativeDriver: true
    }).start(() => {
      setIsVisible(false);
    });
  };
  
  // Handle notification click
  const handlePress = async () => {
    if (!activeNotification) return;
    
    try {
      // Mark notification as read
      await fetch(`https://backend.listtra.com/api/notifications_new/mark-read/${activeNotification.id}/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokens?.accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Navigate to chat
      if (activeNotification.object_id) {
        const [slug, product_id] = activeNotification.object_id.split(':');
        
        console.log('🔍 Looking for conversation for product:', product_id);
        
        // Fetch all conversations and filter by product_id (correct approach)
        const response = await fetch(`https://backend.listtra.com/api/chat/conversations/`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${tokens?.accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch conversations: ${response.status}`);
        }
        
        const conversations = await response.json();
        console.log('📊 Total conversations found:', conversations.length);
        
        // Filter conversations for this specific product
        const productConversations = conversations.filter(
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
      }
      
      // Hide notification
      hideNotification();
      
    } catch (error) {
      console.error('❌ Error handling notification press:', error);
      
      // Fallback: try to navigate to listing page
      if (activeNotification.object_id) {
        const [slug, product_id] = activeNotification.object_id.split(':');
        console.log('🔄 Fallback: navigating to listing page');
        router.push({
          pathname: '/listings/[slug]/[product_id]/page',
          params: { slug, product_id }
        });
      }
      
      hideNotification();
    }
  };
  
  if (!isVisible || !activeNotification) return null;
  
  return (
    <Animated.View 
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Ionicons name="star" size={20} color="#FFD700" />
            <Text style={styles.title}>Review Reminder</Text>
          </View>
          <TouchableOpacity onPress={hideNotification} style={styles.closeButton}>
            <Ionicons name="close" size={20} color="#666" />
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity 
          style={styles.messageContainer} 
          onPress={handlePress}
          activeOpacity={0.7}
        >
          {activeNotification.product_image ? (
            <Image 
              source={{ uri: activeNotification.product_image }} 
              style={styles.image}
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image" size={24} color="#ccc" />
            </View>
          )}
          
          <View style={styles.textContainer}>
            <Text style={styles.message}>{activeNotification.message || activeNotification.text}</Text>
            <Text style={styles.tapPrompt}>Tap to leave your review now</Text>
          </View>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
    zIndex: 1000,
    paddingTop: 50, // For status bar
  },
  content: {
    padding: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  closeButton: {
    padding: 5,
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  image: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  imagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  message: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  tapPrompt: {
    fontSize: 12,
    color: '#2528be',
    marginTop: 4,
  },
});

export default ReviewNotification; 