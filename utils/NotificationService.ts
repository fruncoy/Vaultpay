import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { Transaction } from './storage';
import { supabase } from './supabase';
import * as Device from 'expo-device';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Set up notification listeners
let notificationListener: Notifications.Subscription | null = null;
let responseListener: Notifications.Subscription | null = null;

// Queue to manage notifications
class NotificationQueue {
  private queue: Notifications.NotificationRequestInput[] = [];
  private isProcessing = false;

  // Add notification to queue
  enqueue(notification: Notifications.NotificationRequestInput) {
    this.queue.push(notification);
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  // Process notifications one at a time
  private async processQueue() {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const notification = this.queue.shift();
    
    if (notification) {
      try {
        await Notifications.scheduleNotificationAsync(notification);
        // Wait a bit before showing next notification to avoid overwhelming the user
        setTimeout(() => this.processQueue(), 2000);
      } catch (error) {
        console.error('Error scheduling notification:', error);
        this.processQueue();
      }
    } else {
      this.processQueue();
    }
  }
}

const notificationQueue = new NotificationQueue();

export interface NotificationData {
  type: 'transaction_pending' | 'transaction_accepted' | 'transaction_completed' | 'transaction_cancelled' | 'condition_updated';
  transactionId: string;
  [key: string]: any;
}

// Interface for push notification payload
export interface PushNotificationPayload {
  to: string;
  title: string;
  body: string;
  data?: NotificationData;
  sound?: boolean;
  badge?: number;
  channelId?: string;
}

export const NotificationService = {
  // Register for push notifications and save token to database
  registerForPushNotifications: async (userId: string) => {
    if (Platform.OS === 'web') {
      return null;
    }

    try {
      // Request permission
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return null;
      }

      // Get push token
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });

      // Configure for Android
      if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#0A1D3F',
        });
      }

      // Save token to database
      await saveTokenToDatabase(userId, token.data);

      return token.data;
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  },
  
  // Set up notification listeners
  setupNotificationListeners: (onNotificationReceived: (notification: Notifications.Notification) => void) => {
    // Clean up any existing listeners
    NotificationService.removeNotificationListeners();
    
    // Set up the notification received listener
    notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
      onNotificationReceived(notification);
    });
    
    // Set up the notification response listener
    responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response received:', response);
      const { notification } = response;
      const data = notification.request.content.data as NotificationData;
      
      // Handle notification response based on type
      if (data?.transactionId) {
        // Navigate to transaction details or handle accordingly
        console.log('Transaction notification tapped:', data.transactionId);
        // Navigation would happen here based on app structure
      }
    });
  },
  
  // Remove notification listeners
  removeNotificationListeners: () => {
    if (notificationListener) {
      Notifications.removeNotificationSubscription(notificationListener);
      notificationListener = null;
    }
    
    if (responseListener) {
      Notifications.removeNotificationSubscription(responseListener);
      responseListener = null;
    }
  },

  // Send local notification
  sendLocalNotification: (title: string, body: string, data?: NotificationData) => {
    const notification: Notifications.NotificationRequestInput = {
      content: {
        title,
        body,
        data,
      },
      trigger: null, // Send immediately
    };

    // Add to queue instead of sending directly
    notificationQueue.enqueue(notification);
  },

  // Notification for pending transaction
  notifyTransactionPending: (transaction: Transaction, receiverName: string) => {
    const title = 'New Pending Transaction';
    const body = `${receiverName} sent you KSH ${transaction.amount.toLocaleString()} for escrow`;
    const data = {
      type: 'transaction_pending',
      transactionId: transaction.id,
    };
    
    // Send local notification
    NotificationService.sendLocalNotification(title, body, data);
    
    // Send push notification to receiver
    NotificationService.sendPushNotification(transaction.receiver_id, title, body, data);
  },

  // Notification for accepted transaction
  notifyTransactionAccepted: (transaction: Transaction, receiverName: string) => {
    const title = 'Transaction Accepted';
    const body = `${receiverName} accepted your transaction of KSH ${transaction.amount.toLocaleString()}`;
    const data = {
      type: 'transaction_accepted',
      transactionId: transaction.id,
    };
    
    // Send local notification
    NotificationService.sendLocalNotification(title, body, data);
    
    // Send push notification to sender
    NotificationService.sendPushNotification(transaction.sender_id, title, body, data);
  },

  // Notification for completed transaction
  notifyTransactionCompleted: (transaction: Transaction, otherPartyName: string, userId: string) => {
    const title = 'Transaction Completed';
    const body = `Your transaction with ${otherPartyName} for KSH ${transaction.amount.toLocaleString()} is complete`;
    const data = {
      type: 'transaction_completed',
      transactionId: transaction.id,
    };
    
    // Send local notification
    NotificationService.sendLocalNotification(title, body, data);
    
    // Send push notification to both parties
    // For the current user, we already show a local notification
    // For the other party, we need to determine their ID
    const otherPartyId = userId === transaction.sender_id ? transaction.receiver_id : transaction.sender_id;
    NotificationService.sendPushNotification(otherPartyId, title, body, data);
  },

  // Notification for cancelled transaction
  notifyTransactionCancelled: (transaction: Transaction, reason: string, userId: string) => {
    const title = 'Transaction Cancelled';
    const body = `Transaction for KSH ${transaction.amount.toLocaleString()} was cancelled: ${reason}`;
    const data = {
      type: 'transaction_cancelled',
      transactionId: transaction.id,
    };
    
    // Send local notification
    NotificationService.sendLocalNotification(title, body, data);
    
    // Send push notification to both parties
    // For the current user, we already show a local notification
    // For the other party, we need to determine their ID
    const otherPartyId = userId === transaction.sender_id ? transaction.receiver_id : transaction.sender_id;
    NotificationService.sendPushNotification(otherPartyId, title, body, data);
  },

  // Notification for condition update
  notifyConditionUpdated: (transaction: Transaction, conditionDescription: string, userId: string) => {
    const title = 'Condition Updated';
    const body = `Condition "${conditionDescription}" was marked as completed`;
    const data = {
      type: 'condition_updated',
      transactionId: transaction.id,
    };
    
    // Send local notification
    NotificationService.sendLocalNotification(title, body, data);
    
    // Send push notification to both parties
    // For the current user, we already show a local notification
    // For the other party, we need to determine their ID
    const otherPartyId = userId === transaction.sender_id ? transaction.receiver_id : transaction.sender_id;
    NotificationService.sendPushNotification(otherPartyId, title, body, data);
  },
  
  // Get notification history for a user
  getNotificationHistory: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('device_tokens')
        .select('last_used_at')
        .eq('user_id', userId)
        .order('last_used_at', { ascending: false })
        .limit(1);
      
      if (error) {
        console.error('Error fetching notification history:', error);
        return null;
      }
      
      return data?.[0]?.last_used_at || null;
    } catch (error) {
      console.error('Error in getNotificationHistory:', error);
      return null;
    }
  },
  
  // Send push notification to a specific user
  sendPushNotification: async (userId: string, title: string, body: string, data?: NotificationData) => {
    try {
      // Get user's device tokens
      const { data: tokens, error } = await supabase
        .from('device_tokens')
        .select('token')
        .eq('user_id', userId);
      
      if (error) {
        console.error('Error fetching device tokens:', error);
        return;
      }
      
      if (!tokens || tokens.length === 0) {
        console.log('No device tokens found for user:', userId);
        return;
      }
      
      // Track last notification sent to this user to prevent spam
      const lastNotificationKey = `last_notification_${userId}`;
      const lastNotificationTime = global.notificationTimestamps?.[userId] || 0;
      const now = Date.now();
      
      // Only send if it's been at least 30 seconds since the last notification
      // This prevents notification spam
      if (now - lastNotificationTime < 30000) {
        console.log('Skipping notification to prevent spam, will try again later');
        
        // Queue this notification for later if it's important
        setTimeout(() => {
          NotificationService.sendPushNotification(userId, title, body, data);
        }, 30000);
        
        return;
      }
      
      // Update the last notification timestamp for this user
      if (!global.notificationTimestamps) {
        global.notificationTimestamps = {};
      }
      global.notificationTimestamps[userId] = now;
      
      // Send push notification to each device
      for (const { token } of tokens) {
        const message: PushNotificationPayload = {
          to: token,
          title,
          body,
          data,
          sound: true,
          badge: 1, // Increment the app badge count
          channelId: 'default',
        };
        
        console.log('Sending push notification:', message);
        
        // Send to Expo's push notification service
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(message),
        })
        .then(response => response.json())
        .then(responseJson => {
          console.log('Push notification response:', responseJson);
        })
        .catch(error => {
          console.error('Error sending push notification to Expo service:', error);
        });
      }
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  },
};

// Helper function to save token to database
async function saveTokenToDatabase(userId: string, token: string) {
  try {
    const deviceName = Device.deviceName || 'Unknown Device';
    const platform = Platform.OS;
    
    const { error } = await supabase.rpc('save_device_token', {
      p_user_id: userId,
      p_token: token,
      p_device_name: deviceName,
      p_platform: platform
    });
    
    if (error) {
      console.error('Error saving device token:', error);
      return false;
    }
    
    console.log('Device token saved successfully');
    return true;
  } catch (error) {
    console.error('Error in saveTokenToDatabase:', error);
    return false;
  }
}