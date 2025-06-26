import { Feather, Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useAuth } from '../../context/AuthContext';

export default function ChatDetailScreen() {
  const { isInitializing, user, tokens } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = params.id as string;
  
  // Basic state
  const [isLoading, setIsLoading] = useState(true);
  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [processedMessages, setProcessedMessages] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Chat functionality state
  const [input, setInput] = useState('');
  const [offerAmount, setOfferAmount] = useState('');
  const [showOfferInput, setShowOfferInput] = useState(false);
  const [pendingOffer, setPendingOffer] = useState<any>(null);
  const [isUpdatingOffer, setIsUpdatingOffer] = useState(false);
  const [isCancellingOffer, setIsCancellingOffer] = useState(false);
  
  // Review state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);
  
  // UI state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  
  // Refs
  const bottomListRef = useRef<any>(null);
  const refreshIntervalRef = useRef<any>(null);
  const inputRef = useRef<TextInput>(null);
  
  // Check if user is buyer
  const isBuyer = user?.id !== conversation?.listing?.seller_id;
  
  // Quick replies for common messages
  const quickReplies = [
    "Yes, I'm interested",
    "No, thank you",
    "Can you send more details?",
    "What's the best price?",
    "Is this still available?",
    "When can I see it?",
    "Can you share the location?",
  ];
  
  // Add common emojis
  const commonEmojis = ["😊", "👍", "👋", "🙏", "😀", "❤️", "👌", "🔥", "👏", "🎉", "👀", "💯", "👁️", "👉", "😂", "🤔", "😍", "🙌", "💪", "✅"];
  
  // Fetch conversation and messages
  useEffect(() => {
    if (isInitializing) return;
    
    const fetchData = async () => {
      if (!tokens?.accessToken) {
        setError("Please sign in to view this conversation");
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        console.log(`Fetching conversation data for ID: ${id}`);
        
        // Set headers for all requests
        const headers = {
            Authorization: `Bearer ${tokens.accessToken}`
        };
        
        // Fetch conversation and messages in parallel
        const [conversationRes, messagesRes] = await Promise.all([
          axios.get(`https://backend.listtra.com/api/chat/conversations/${id}/`, {
            headers
          }),
          axios.get(`https://backend.listtra.com/api/chat/conversations/${id}/messages/`, {
            headers
          })
        ]);
        
        // Set conversation data
        setConversation(conversationRes.data);
        console.log('Conversation fetched:', conversationRes.data.listing?.title);
        
        // Set offer amount default value from listing price
        setOfferAmount(conversationRes.data?.listing?.price?.toString() || '');
        
        // Set messages
        setMessages(messagesRes.data);
        console.log(`Fetched ${messagesRes.data.length} messages`);
        
        // Check for pending offers
        const latestPendingOffer = messagesRes.data
          .filter((msg: any) => msg.is_offer && msg.offer?.status === "Pending")
          .pop()?.offer || null;
          
        setPendingOffer(latestPendingOffer);
        
        // Check if user has already reviewed
        if (conversationRes.data?.listing?.product_id) {
          try {
            const reviewsRes = await axios.get(
              `https://backend.listtra.com/api/reviews/listing/${conversationRes.data.listing.product_id}/`,
              { headers }
            );
            
            // Check if user has already reviewed
            const userReview = reviewsRes.data.find(
              (review: any) => review.reviewer === user?.id
            );
            setHasReviewed(!!userReview);
          } catch (reviewError) {
            console.error('Error fetching reviews:', reviewError);
            // Continue even if reviews fail to load
          }
        }
        
        setError(null);
      } catch (error: any) {
        console.error('Error fetching conversation:', error);
        setError(`Could not load conversation: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
    
    // Set up interval to refresh messages
    refreshIntervalRef.current = setInterval(() => {
      if (!isLoading) refreshMessages();
    }, 10000); // Check for new messages every 10 seconds
    
    return () => {
      // Clean up interval on unmount
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [id, isInitializing, tokens, user]);
  
  // Process messages when they change
  useEffect(() => {
    if (messages.length > 0) {
      // Process messages (deduplicate offers, etc)
      processMessages();
    }
  }, [messages, user]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    if (processedMessages.length > 0 && bottomListRef.current) {
      setTimeout(() => {
        if (bottomListRef.current) {
          bottomListRef.current.scrollToEnd({ animated: true });
        }
      }, 300);
    }
  }, [processedMessages]);
  
  // Function to process messages
  const processMessages = () => {
    // Deduplicate offers: only show the latest message for each offer.id
    const offerMap = new Map();
    // Deduplicate reviews: only show the latest review per reviewer/product
    const reviewMap = new Map();
    const nonOfferMessages: any[] = [];

    messages.forEach((msg) => {
      // Ensure each message has a unique key
      const messageWithKey = {
        ...msg,
        key: msg.id || `temp-${Date.now()}-${Math.random()}`,
        // Mark if this message is from the current user
        isMe: msg.sender.id === user?.id
      };

      if (msg.is_offer && msg.offer) {
        offerMap.set(msg.offer.id, messageWithKey); // Only the latest for each offer.id
      } else if (
        msg.review_data ||
        (typeof msg.content === "string" && msg.content.includes("left a review:"))
      ) {
        // Use reviewer+product as key
        const reviewer = msg.review_data?.reviewer_username || msg.sender.nickname;
        const product = msg.review_data?.reviewed_product || msg.reviewed_product || "";
        reviewMap.set(`${reviewer}_${product}`, messageWithKey);
      } else {
        nonOfferMessages.push(messageWithKey);
      }
    });

    const processed = [
      ...nonOfferMessages,
      ...Array.from(offerMap.values()),
      ...Array.from(reviewMap.values()),
    ];

    // Sort by created_at
    processed.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    setProcessedMessages(processed);
  };
  
  // Refresh messages
  const refreshMessages = async (showRefreshing = false) => {
    if (!tokens?.accessToken || !id) return;
    
    if (showRefreshing) {
      setRefreshing(true);
    }
    
    try {
      const headers = {
        Authorization: `Bearer ${tokens.accessToken}`
      };
      
      const response = await axios.get(
        `https://backend.listtra.com/api/chat/conversations/${id}/messages/`,
        { headers }
      );
      
      // Update messages if there are new ones
      if (response.data.length !== messages.length) {
        setMessages(response.data);
        
        // Update pending offer if needed
        const latestPendingOffer = response.data
          .filter((msg: any) => msg.is_offer && msg.offer?.status === "Pending")
          .pop()?.offer || null;
          
        setPendingOffer(latestPendingOffer);
      }
    } catch (error) {
      console.error('Error refreshing messages:', error);
    } finally {
      setRefreshing(false);
    }
  };
  
  // Format timestamp for display
  const formatTimestamp = (dateString: string): string => {
    if (!dateString) return '';
    
    try {
      const now = new Date();
      const messageDate = new Date(dateString);
      const diffInMinutes = Math.floor((now.getTime() - messageDate.getTime()) / (1000 * 60));
      const diffInHours = Math.floor(diffInMinutes / 60);
      const diffInDays = Math.floor(diffInHours / 24);

      if (diffInMinutes < 1) return "Just now";
      if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
      if (diffInHours < 24) return `${diffInHours}h ago`;
      if (diffInDays < 7) return `${diffInDays}d ago`;
      return messageDate.toLocaleDateString();
    } catch (e) {
      return 'Unknown date';
    }
  };
  
  // Send a message or make an offer
  const sendMessage = async (isOffer = false, amount: string | null = null) => {
    // Use input for regular messages, amount for offers
    const trimmedInput = isOffer ? amount : input.trim();
    if (!trimmedInput) return;
    
    try {
      if (isOffer) {
        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
          Alert.alert("Invalid Amount", "Please enter a valid offer amount greater than 0");
          return;
        }
        
        if (showOfferInput && pendingOffer) {
          // Amending an existing offer
          await amendOffer(amount);
                    return;
                  }
                  
        // Create temporary message for immediate display
        const tempId = `temp-${Date.now()}`;
        const tempMessage = {
          id: tempId,
          content: `Made offer: A$${amount}`,
          created_at: new Date().toISOString(),
          sender: { id: user?.id, nickname: user?.nickname || "You" },
          is_offer: true,
          offer: {
            id: tempId,
            price: parseFloat(amount),
            status: "Pending",
          },
          key: tempId,
          isMe: true,
          isTemp: true,
        };
        
        // Optimistically update UI
        setMessages(prev => [...prev, tempMessage]);
        
        // Create offer via API
        const response = await axios.post(
          "https://backend.listtra.com/api/chat/messages/",
          {
            conversation: parseInt(id),
            content: `Made offer: A$${amount}`,
            message_type: "text",
                      is_offer: true,
                      price: parseFloat(amount),
            sender_id: user?.id,
          },
          {
            headers: {
              Authorization: `Bearer ${tokens.accessToken}`
            }
          }
        );
        
        // Replace temp message with real one from server
        setMessages(prev => {
          const updatedMessages = prev.filter(msg => msg.id !== tempId);
          return [
            ...updatedMessages,
            {
              ...response.data,
              key: response.data.id,
              isMe: true
            }
          ];
        });
        
        // Update pending offer and reset UI
        setPendingOffer(response.data.offer);
        setShowOfferInput(false);
        
      } else {
        // Regular text message
        const tempId = `temp-${Date.now()}`;
        const tempMessage = {
          id: tempId,
          content: trimmedInput,
          created_at: new Date().toISOString(),
          sender: { id: user?.id, nickname: user?.nickname || "You" },
          is_offer: false,
          key: tempId,
          isMe: true,
          isTemp: true,
        };
        
        // Optimistically update UI
        setMessages(prev => [...prev, tempMessage]);
        setInput(''); // Clear input
        
        // Send message via API
        const response = await axios.post(
          "https://backend.listtra.com/api/chat/messages/",
          {
            conversation: parseInt(id),
            content: trimmedInput,
            message_type: "text",
            is_offer: false,
            sender_id: user?.id,
          },
          {
            headers: {
              Authorization: `Bearer ${tokens.accessToken}`
            }
          }
        );
        
        // Replace temp message with real one from server
        setMessages(prev => {
          const updatedMessages = prev.filter(msg => msg.id !== tempId);
          return [
            ...updatedMessages,
            {
              ...response.data,
              key: response.data.id,
              isMe: true
            }
          ];
        });
      }
      
      // Scroll to bottom after sending
      setTimeout(() => {
        if (bottomListRef.current) {
          bottomListRef.current.scrollToEnd({ animated: true });
        }
      }, 300);
      
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Remove temp message on error
      setMessages(prev => prev.filter(msg => !msg.isTemp));
      
      // Show error to user
      Alert.alert(
        "Error",
        "Failed to send message. Please try again."
      );
    }
  };
  
  // Amend (update) an existing offer
  const amendOffer = async (amount: string) => {
    try {
      setIsUpdatingOffer(true);
      
      // First cancel the existing offer
      await axios.post(
        `https://backend.listtra.com/api/offers/${pendingOffer.id}/cancel/`,
        {},
        {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`
          }
        }
      );
      
      // Then create a new offer
      const response = await axios.post(
        "https://backend.listtra.com/api/chat/messages/",
        {
          conversation: parseInt(id),
          content: `Updated offer: A$${amount}`,
          message_type: "text",
          is_offer: true,
          price: parseFloat(amount),
          sender_id: user?.id,
        },
        {
                      headers: {
            Authorization: `Bearer ${tokens.accessToken}`
          }
        }
      );
      
      // Update messages and pending offer
      setMessages(prev => [...prev, response.data]);
      setPendingOffer(response.data.offer);
      setShowOfferInput(false);
      
    } catch (error) {
      console.error('Failed to amend offer:', error);
      Alert.alert("Error", "Failed to update offer. Please try again.");
    } finally {
      setIsUpdatingOffer(false);
    }
  };
  
  // Cancel an offer
  const cancelOffer = async (offerId: string) => {
    try {
      setIsCancellingOffer(true);
      
      // Cancel the offer via API
      await axios.post(
        `https://backend.listtra.com/api/offers/${offerId}/cancel/`,
        {},
        {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`
          }
        }
      );
      
      // Refresh messages to get updated status
      const response = await axios.get(
        `https://backend.listtra.com/api/chat/conversations/${id}/messages/`,
        {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`
          }
        }
      );
      
      setMessages(response.data);
      setPendingOffer(null);
      
    } catch (error) {
      console.error('Failed to cancel offer:', error);
      Alert.alert("Error", "Failed to cancel offer. Please try again.");
    } finally {
      setIsCancellingOffer(false);
    }
  };
  
  // Respond to an offer (accept/reject) as seller
  const respondToOffer = async (offerId: string, action: 'Accept' | 'Reject') => {
    try {
      if (user?.id !== conversation?.listing?.seller_id) {
        throw new Error("Only the seller can respond to offers");
      }
      
      // Optimistically update UI
      const updatedMessages = messages.map(msg => {
        if (msg.is_offer && msg.offer?.id === offerId) {
          return {
            ...msg,
            offer: {
              ...msg.offer,
              status: action
            }
          };
        }
        return msg;
      });
      
      setMessages(updatedMessages);
      
      // Update pending offer if needed
      if (pendingOffer?.id === offerId) {
        setPendingOffer(null);
      }
      
      // Make API request
      await axios.post(
        `https://backend.listtra.com/api/offers/${offerId}/${action.toLowerCase()}/`,
        {},
        {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`
          }
        }
      );
      
      // Refresh messages to ensure consistency
      const response = await axios.get(
        `https://backend.listtra.com/api/chat/conversations/${id}/messages/`,
        {
                      headers: {
            Authorization: `Bearer ${tokens.accessToken}`
          }
        }
      );
      
      setMessages(response.data);
      
    } catch (error) {
      console.error(`Failed to ${action.toLowerCase()} offer:`, error);
      
      // Revert optimistic update on error
      refreshMessages();
      Alert.alert("Error", `Failed to ${action.toLowerCase()} offer. Please try again.`);
    }
  };
  
  // Submit a review
  const submitReview = async () => {
    try {
      if (hasReviewed) {
        Alert.alert("Already Reviewed", "You have already reviewed this seller for this product.");
        setShowReviewModal(false);
        return;
      }
      
      setIsSubmittingReview(true);
      
      // Submit the review via API
      const reviewResponse = await axios.post(
        "https://backend.listtra.com/api/reviews/",
        {
          reviewed_user: conversation.listing.seller_id,
          reviewed_product: conversation.listing.product_id,
          rating: reviewRating,
          review_text: reviewText.trim() || null
        },
        {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`
          }
        }
      );
      
      // Refresh messages to get the new review
      const messagesResponse = await axios.get(
        `https://backend.listtra.com/api/chat/conversations/${id}/messages/`,
        {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`
          }
        }
      );
      
      // Update state
      setMessages(messagesResponse.data);
      setHasReviewed(true);
      setShowReviewModal(false);
      setReviewRating(5);
      setReviewText("");
      
      // Scroll to bottom to show new review
      setTimeout(() => {
        if (bottomListRef.current) {
          bottomListRef.current.scrollToEnd({ animated: true });
        }
      }, 300);
      
      Alert.alert("Success", "Thank you for your review!");
      
    } catch (error) {
      console.error('Failed to submit review:', error);
      Alert.alert("Error", "Failed to submit review. Please try again.");
    } finally {
      setIsSubmittingReview(false);
    }
  };
  
  // Loading view
  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen 
          options={{
            title: 'Chat',
            headerShown: true,
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()}>
                <Feather name="chevron-left" size={24} color="#2528be" />
              </TouchableOpacity>
            ),
          }} 
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2528be" />
          <Text style={styles.loadingText}>Loading conversation...</Text>
        </View>
      </View>
    );
  }
  
  // Error view
  if (error) {
    return (
      <View style={styles.container}>
        <Stack.Screen 
          options={{
            title: 'Chat',
            headerShown: true,
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()}>
                <Feather name="chevron-left" size={24} color="#2528be" />
              </TouchableOpacity>
            ),
          }} 
        />
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={48} color="#ff3b30" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => {
              setError(null);
              setIsLoading(true);
              refreshMessages();
            }}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  
  // Rendering will be implemented in the next phase

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen 
        options={{
          title: conversation?.other_participant?.nickname || 'Chat',
          headerShown: true,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <Feather name="chevron-left" size={24} color="#2528be" />
            </TouchableOpacity>
          ),
        }} 
      />
      
      {/* Product Info Header */}
      <View style={styles.productHeader}>
        <View style={styles.productInfo}>
          {conversation?.listing?.images?.[0]?.image_url ? (
            <Image 
              source={{ uri: conversation.listing.images[0].image_url }} 
              style={styles.productImage} 
            />
          ) : (
            <View style={styles.productImagePlaceholder}>
              <Feather name="image" size={24} color="#ccc" />
            </View>
          )}
          <View style={styles.productDetails}>
            <Text style={styles.productTitle} numberOfLines={1}>
              {conversation?.listing?.title}
            </Text>
            <Text style={styles.productPrice}>
              A${conversation?.listing?.price}
            </Text>
            <Text style={styles.sellerName}>
              {conversation?.other_participant?.nickname}
            </Text>
          </View>
        </View>
        
        {/* Offer Section for Buyer */}
        {isBuyer && (
          <View style={styles.offerContainer}>
            {/* No pending offer or editing offer */}
            {(!pendingOffer || showOfferInput) && (
              <View style={styles.offerInputRow}>
                <View style={styles.offerInputWrapper}>
                  <Text style={styles.currencySymbol}>A$</Text>
                  <TextInput
                    value={offerAmount}
                    onChangeText={setOfferAmount}
                    style={styles.offerInput}
                    keyboardType="decimal-pad"
                    placeholder="Enter amount"
                    placeholderTextColor="#999"
                  />
                </View>
                <TouchableOpacity 
                  style={[
                    styles.offerButton,
                    (!offerAmount || isNaN(parseFloat(offerAmount)) || parseFloat(offerAmount) <= 0) && styles.offerButtonDisabled
                  ]}
                  disabled={!offerAmount || isNaN(parseFloat(offerAmount)) || parseFloat(offerAmount) <= 0 || isUpdatingOffer}
                  onPress={() => sendMessage(true, offerAmount)}
                >
                  {isUpdatingOffer ? (
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                      <ActivityIndicator size="small" color="#fff" style={{marginRight: 5}} />
                      <Text style={styles.offerButtonText}>Updating...</Text>
                    </View>
                  ) : (
                    <Text style={styles.offerButtonText}>
                      {showOfferInput ? 'Update Offer' : 'Make Offer'}
                    </Text>
                  )}
                </TouchableOpacity>
                {showOfferInput && (
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
                      setShowOfferInput(false);
                      setOfferAmount(conversation?.listing?.price?.toString() || '');
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            
            {/* Pending offer, not editing */}
            {pendingOffer && !showOfferInput && (
              <View style={styles.pendingOfferRow}>
                <TouchableOpacity 
                  style={styles.cancelOfferButton}
                  disabled={isCancellingOffer}
                  onPress={() => cancelOffer(pendingOffer.id)}
                >
                  {isCancellingOffer ? (
                    <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}}>
                      <ActivityIndicator size="small" color="#666" style={{marginRight: 5}} />
                      <Text style={styles.cancelOfferText}>Cancelling...</Text>
                    </View>
                  ) : (
                    <Text style={styles.cancelOfferText}>Cancel Offer</Text>
                  )}
                </TouchableOpacity>
                
                <View style={styles.offerAmountBadge}>
                  <Text style={styles.offerAmountText}>A$ {pendingOffer.price}</Text>
                </View>
                
                <TouchableOpacity 
                  style={styles.modifyOfferButton}
                  onPress={() => {
                    setOfferAmount(pendingOffer.price.toString());
                    setShowOfferInput(true);
                  }}
                >
                  <Text style={styles.modifyOfferText}>Modify Offer</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
      
      {/* Messages List */}
      <FlatList
        ref={bottomListRef}
        data={processedMessages}
        keyExtractor={(item) => item.key.toString()}
        contentContainerStyle={styles.messageList}
        onRefresh={() => refreshMessages(true)}
        refreshing={refreshing}
        renderItem={({ item }) => (
          <>
            {item.is_offer && item.offer ? (
              // Offer Bubble
              <View style={styles.messageBubbleContainer}>
                <View style={[
                  styles.offerBubble,
                  item.offer.status === 'Accepted' ? styles.acceptedOfferBubble :
                  item.offer.status === 'Rejected' ? styles.rejectedOfferBubble :
                  item.offer.status === 'Cancelled' ? styles.cancelledOfferBubble :
                  styles.pendingOfferBubble
                ]}>
                  <View style={[
                    styles.offerStatusBadge,
                    item.offer.status === 'Accepted' ? styles.acceptedStatusBadge :
                    item.offer.status === 'Rejected' ? styles.rejectedStatusBadge :
                    item.offer.status === 'Cancelled' ? styles.cancelledStatusBadge :
                    styles.pendingStatusBadge
                  ]}>
                    {item.offer.status === 'Pending' && (
                      <Ionicons name="time-outline" size={16} color="#F57C00" />
                    )}
                    {item.offer.status === 'Accepted' && (
                      <Ionicons name="checkmark" size={16} color="#4CAF50" />
                    )}
                    {item.offer.status === 'Rejected' && (
                      <Ionicons name="close" size={16} color="#F44336" />
                    )}
                    {item.offer.status === 'Cancelled' && (
                      <Ionicons name="close-circle-outline" size={16} color="#9E9E9E" />
                    )}
                    <Text style={[
                      styles.offerStatusText,
                      item.offer.status === 'Accepted' ? styles.acceptedStatusText :
                      item.offer.status === 'Rejected' ? styles.rejectedStatusText :
                      item.offer.status === 'Cancelled' ? styles.cancelledStatusText :
                      styles.pendingStatusText
                    ]}>{item.offer.status}</Text>
                  </View>
                  <Text style={styles.offerTitle}>Made Offer</Text>
                  <Text style={styles.offerPrice}>A$ {item.offer.price}</Text>
                  
                  {/* Offer actions based on status and role */}
                  {item.offer.status === 'Pending' && !isBuyer && (
                    <View style={styles.offerActionRow}>
                      <TouchableOpacity 
                        style={styles.acceptOfferButton}
                        onPress={() => respondToOffer(item.offer.id, 'Accept')}
                      >
                        <Text style={styles.acceptOfferText}>Accept Offer</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.rejectOfferButton}
                        onPress={() => respondToOffer(item.offer.id, 'Reject')}
                      >
                        <Text style={styles.rejectOfferText}>Reject Offer</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  <Text style={styles.messageTimestamp}>{formatTimestamp(item.created_at)}</Text>
                </View>

                {/* Review Seller button for accepted offers */}
                {item.offer.status === 'Accepted' && isBuyer && !hasReviewed && 
                  conversation?.listing?.status === "sold" && (
                  <TouchableOpacity 
                    style={styles.reviewButton}
                    onPress={() => setShowReviewModal(true)}
                  >
                    <Ionicons name="star" size={20} color="#FFD700" />
                    <Text style={styles.reviewButtonText}>Review Seller</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : item.review_data || (typeof item.content === "string" && item.content.includes("left a review:")) ? (
              // Review Bubble
              <View style={styles.messageBubbleContainer}>
                <View style={styles.reviewBubble}>
                  <View style={styles.starRating}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <Text key={star} style={[
                        styles.star,
                        star <= (item.review_data?.rating || parseInt(item.content.match(/(\d+) ★/)?.[1] || "0")) 
                          ? styles.filledStar 
                          : styles.emptyStar
                      ]}>★</Text>
                    ))}
                  </View>
                  <Text style={styles.reviewerName}>
                    {item.isMe 
                      ? "You left a review" 
                      : `${item.review_data?.reviewer_username || item.sender.nickname} left a review`}
                  </Text>
                  {(item.review_data?.review_text || item.content.split(" - ")[1]) && (
                    <Text style={styles.reviewText}>
                      "{item.review_data?.review_text || item.content.split(" - ")[1]}"
                    </Text>
                  )}
                </View>
              </View>
            ) : (
              // Regular Message Bubble
              <View style={[
                styles.messageBubbleContainer,
                item.isMe ? styles.myMessageContainer : styles.theirMessageContainer
              ]}>
                <View style={[
                  styles.messageBubble,
                  item.isMe ? styles.myMessage : styles.theirMessage
                ]}>
                  <Text style={styles.messageText}>{item.content}</Text>
                  <View style={styles.messageFooter}>
                    <Text style={styles.messageTimestamp}>{formatTimestamp(item.created_at)}</Text>
                    {item.isMe && (
                      <Text style={styles.messageStatus}>
                        {item.status === 'read' ? '✓✓' : '✓'}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            )}
          </>
        )}
      />
      
      {/* Quick Replies */}
      {showQuickReplies && (
        <View style={styles.quickRepliesContainer}>
          <FlatList
            horizontal
            data={quickReplies}
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickRepliesList}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.quickReplyButton}
                onPress={() => {
                  // Close emoji picker if open
                  setShowEmojiPicker(false);
                  
                  // Update the input text directly
                  setInput(item);
                  
                  // Force update in case of any race conditions
                  setTimeout(() => {
                    if (inputRef.current) {
                      // Focus the input
                      inputRef.current.focus();
                    }
                  }, 100);
                }}
              >
                <Text style={styles.quickReplyText}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
      
      {/* Emoji Picker */}
      {showEmojiPicker && (
        <View style={styles.emojiPickerContainer}>
          <View style={styles.emojiPickerHeader}>
            <Text style={styles.emojiPickerTitle}>Emojis</Text>
            <TouchableOpacity onPress={() => setShowEmojiPicker(false)}>
              <Feather name="x" size={20} color="#999" />
            </TouchableOpacity>
          </View>
          <View style={styles.emojiGrid}>
            {commonEmojis.map((emoji) => (
              <TouchableOpacity 
                key={emoji}
                style={styles.emojiButton}
                onPress={() => {
                  const newText = input + emoji;
                  setInput(newText);
                  
                  // Focus the input after emoji selection
                  if (inputRef.current) {
                    inputRef.current.focus();
                  }
                }}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      
      {/* Message Input */}
      <View style={styles.inputContainer}>
        <TouchableOpacity 
          style={styles.emojiToggleButton}
          onPress={() => {
            setShowEmojiPicker(!showEmojiPicker);
            setShowQuickReplies(false);
          }}
        >
          <Ionicons name="happy-outline" size={24} color="#2528be" />
        </TouchableOpacity>
        
        <TextInput
          ref={inputRef}
          style={styles.messageInput}
          value={input}
          onChangeText={(text) => {
            // Update the input state
            setInput(text);
          }}
          placeholder="Message"
          placeholderTextColor="#999"
          multiline
          onFocus={() => {
            // Show quick replies when focused
            setShowQuickReplies(true);
            // Hide emoji picker when input is focused
            setShowEmojiPicker(false);
          }}
          // Keep quick replies visible for a little longer
          onBlur={() => setTimeout(() => setShowQuickReplies(false), 500)}
        />
        
        <TouchableOpacity 
          style={[
            styles.sendButton,
            !input.trim() && styles.sendButtonDisabled
          ]}
          disabled={!input.trim()}
          onPress={() => sendMessage()}
        >
          <Feather name="send" size={20} color="white" />
        </TouchableOpacity>
      </View>
      
      {/* Review Modal */}
      {showReviewModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.reviewModal}>
            {/* Close button */}
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setShowReviewModal(false)}
            >
              <Feather name="x" size={24} color="#999" />
            </TouchableOpacity>
            
            {/* Title */}
            <Text style={styles.reviewTitle}>Rate seller</Text>
            
            {/* Seller avatar */}
            <View style={styles.sellerAvatar}>
              <Feather name="user" size={36} color="white" />
            </View>
            
            {/* Seller name */}
            <Text style={styles.reviewSellerName}>
              {conversation?.other_participant?.nickname || "Seller"}
            </Text>
            
            {/* Star rating */}
            <View style={styles.ratingContainer}>
              {[1, 2, 3, 4, 5].map(star => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setReviewRating(star)}
                >
                  <Text style={[
                    styles.ratingStar,
                    star <= reviewRating ? styles.activeRatingStar : styles.inactiveRatingStar
                  ]}>★</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Review text input */}
            <TextInput
              style={styles.reviewInput}
              placeholder="Write your review..."
              value={reviewText}
              onChangeText={setReviewText}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            
            {/* Submit button */}
            <TouchableOpacity 
              style={styles.submitReviewButton}
              onPress={submitReview}
              disabled={isSubmittingReview}
            >
              {isSubmittingReview ? (
                <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}}>
                  <ActivityIndicator size="small" color="#fff" style={{marginRight: 8}} />
                  <Text style={styles.submitReviewText}>Submitting...</Text>
                </View>
              ) : (
                <Text style={styles.submitReviewText}>Submit</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 20,
    color: '#2528be',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginTop: 15,
    marginBottom: 30,
  },
  retryButton: {
    backgroundColor: '#2528be',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  productHeader: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    padding: 15,
  },
  productInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
    marginRight: 15,
  },
  productImagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  productDetails: {
    flex: 1,
  },
  productTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2528be',
    marginBottom: 2,
  },
  sellerName: {
    fontSize: 14,
    color: '#666',
    marginTop: 1,
    fontWeight: '400',
  },
  offerContainer: {
    marginTop: 10,
  },
  offerInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 8,
  },
  offerInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 25,
    paddingHorizontal: 10,
    height: 40,
    backgroundColor: '#f5f5f5',
  },
  currencySymbol: {
    fontSize: 16,
    color: '#666',
    marginRight: 5,
  },
  offerInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
  },
  offerButton: {
    backgroundColor: '#2528be',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 25,
    minWidth: 100,
    alignItems: 'center',
  },
  offerButtonDisabled: {
    backgroundColor: '#a0a0a0',
  },
  offerButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 14,
  },
  pendingOfferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 8,
  },
  cancelOfferButton: {
    flex: 1,
    backgroundColor: 'white',
    paddingVertical: 10,
    borderRadius: 25,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelOfferText: {
    color: '#666',
    fontSize: 14,
  },
  offerAmountBadge: {
    flex: 1,
    backgroundColor: 'white',
    paddingVertical: 10,
    borderRadius: 25,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2528be',
  },
  offerAmountText: {
    color: '#2528be',
    fontWeight: '600',
    fontSize: 14,
  },
  modifyOfferButton: {
    flex: 1,
    backgroundColor: 'white',
    paddingVertical: 10,
    borderRadius: 25,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  modifyOfferText: {
    color: '#666',
    fontSize: 14,
  },
  messageList: {
    padding: 15,
    backgroundColor: '#f5f5f5',
  },
  messageBubbleContainer: {
    marginBottom: 10,
  },
  myMessageContainer: {
    alignItems: 'flex-end',
  },
  theirMessageContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 18,
    maxWidth: '80%',
  },
  myMessage: {
    backgroundColor: '#CBD8FF',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    backgroundColor: '#f1f1f1',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    fontFamily: 'System',
    lineHeight: 20,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 2,
  },
  messageTimestamp: {
    fontSize: 10,
    color: '#999',
  },
  messageStatus: {
    fontSize: 10,
    color: '#999',
    marginLeft: 4,
  },
  offerBubble: {
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: 'white',
    width: '90%',
    alignSelf: 'center',
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  pendingOfferBubble: {
    borderColor: '#FFD700',
    borderWidth: 1,
  },
  acceptedOfferBubble: {
    borderColor: '#4CAF50',
    borderWidth: 1,
  },
  rejectedOfferBubble: {
    borderColor: '#F44336',
    borderWidth: 1,
  },
  cancelledOfferBubble: {
    borderColor: '#9E9E9E',
    borderWidth: 1,
  },
  offerStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pendingStatusBadge: {
    backgroundColor: '#FFF9C4',
    borderWidth: 1,
    borderColor: '#F57C00',
  },
  acceptedStatusBadge: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  rejectedStatusBadge: {
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#F44336',
  },
  cancelledStatusBadge: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#9E9E9E',
  },
  offerStatusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  pendingStatusText: {
    color: '#F57C00',
  },
  acceptedStatusText: {
    color: '#4CAF50',
  },
  rejectedStatusText: {
    color: '#F44336',
  },
  cancelledStatusText: {
    color: '#9E9E9E',
  },
  offerTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    fontWeight: '500',
  },
  offerPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2528be',
    marginBottom: 10,
  },
  offerActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 10,
  },
  acceptOfferButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  acceptOfferText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 13,
  },
  rejectOfferButton: {
    backgroundColor: '#F44336',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  rejectOfferText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 13,
  },
  reviewBubble: {
    padding: 15,
    borderRadius: 15,
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#90CAF9',
    width: '80%',
    alignSelf: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  starRating: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  star: {
    fontSize: 22,
    marginHorizontal: 2,
  },
  filledStar: {
    color: '#FFD700',
  },
  emptyStar: {
    color: '#D3D3D3',
  },
  reviewerName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 5,
    color: '#2528be',
  },
  reviewText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 5,
    color: '#333',
  },
  quickRepliesContainer: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingVertical: 10,
    backgroundColor: 'white',
  },
  quickRepliesList: {
    paddingHorizontal: 15,
    gap: 8,
  },
  quickReplyButton: {
    backgroundColor: 'white',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2528be',
    marginRight: 8,
  },
  quickReplyText: {
    color: '#2528be',
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: 'white',
  },
  emojiToggleButton: {
    padding: 8,
    marginRight: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 100,
    marginHorizontal: 8,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#eee',
    textAlignVertical: 'center',
  },
  sendButton: {
    backgroundColor: '#2528be',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 5,
  },
  sendButtonDisabled: {
    backgroundColor: '#a0a0a0',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  reviewModal: {
    width: '85%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 5,
  },
  reviewTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
    marginTop: 10,
    color: '#333',
  },
  sellerAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#2528be',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  reviewSellerName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    color: '#333',
  },
  ratingContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  ratingStar: {
    fontSize: 32,
    marginHorizontal: 5,
  },
  activeRatingStar: {
    color: '#FFD700',
  },
  inactiveRatingStar: {
    color: '#E5E7EB',
  },
  reviewInput: {
    width: '100%',
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  submitReviewButton: {
    backgroundColor: '#2528be',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    width: '70%',
    alignItems: 'center',
  },
  submitReviewText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  reviewButton: {
    backgroundColor: '#2528be',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginVertical: 10,
    width: '90%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  reviewButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  emojiPickerContainer: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingVertical: 10,
    backgroundColor: 'white',
    paddingBottom: 15,
  },
  emojiPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  emojiPickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    paddingHorizontal: 10,
  },
  emojiButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: '20%', // 5 emojis per row
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiText: {
    fontSize: 24,
  },
}); 