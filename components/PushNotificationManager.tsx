import React, { useEffect, useRef, useState } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuth } from '@/hooks/useAuth';
import { NotificationService, NotificationData } from '@/utils/NotificationService';
import { notificationManager } from '@/utils/NotificationManager';
import { Transaction } from '@/utils/storage';

interface PushNotificationManagerProps {
  children: React.ReactNode;
}

/**
 * PushNotificationManager handles push notification registration, permissions,
 * and notification handling throughout the app lifecycle.
 * 
 * This component should be placed high in the component tree to ensure
 * notifications are properly managed across the entire app.
 */
export default function PushNotificationManager({ children }: PushNotificationManagerProps) {
  const { user } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const appState = useRef(AppState.currentState);
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  // Register for push notifications when user logs in
  useEffect(() => {
    if (!user) return;

    // Register for push notifications
    const registerForPushNotifications = async () => {
      try {
        const token = await NotificationService.registerForPushNotifications(user.id);
        if (token) {
          console.log('Push token registered:', token);
          setExpoPushToken(token);
        }
      } catch (error) {
        console.error('Failed to register for push notifications:', error);
      }
    };

    registerForPushNotifications();

    // Set up notification listeners
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
      setNotification(notification);
      
      // Process the notification through our intelligent notification manager
      // This allows us to handle foreground notifications in a consistent way
      const data = notification.request.content.data as NotificationData;
      if (data?.transactionId && user) {
        // We could show an in-app notification or update UI state here
        console.log('Processing foreground notification for transaction:', data.transactionId);
      }
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response received:', response);
      const data = response.notification.request.content.data as NotificationData;
      
      // Handle notification tap based on notification type
      if (data?.transactionId) {
        // Navigation would be handled here
        console.log('User tapped on transaction notification:', data.transactionId);
        // Example: navigation.navigate('TransactionDetails', { id: data.transactionId });
        
        // Mark the transaction as read when tapped
        if (user && data.transactionId) {
          try {
            // This would typically be handled by your navigation logic
            // but we're demonstrating the concept here
            console.log('Would mark transaction as read:', data.transactionId);
          } catch (error) {
            console.error('Error handling notification tap:', error);
          }
        }
      }
    });

    // Monitor app state changes to refresh token when app comes to foreground
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      // Clean up listeners when component unmounts
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
      subscription.remove();
    };
  }, [user]);

  // Handle app state changes
  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && nextAppState === 'active' && user) {
      // App has come to the foreground, refresh token
      NotificationService.registerForPushNotifications(user.id);
      
      // When app comes to foreground, we could check for any pending notifications
      // that might have been missed while the app was in the background
      console.log('App returned to foreground, checking for pending notifications');
    }
    appState.current = nextAppState;
  };

  return <>{children}</>;
}