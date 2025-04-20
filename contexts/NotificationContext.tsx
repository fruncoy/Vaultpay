import React, { createContext, useContext, useState, ReactNode } from 'react';
import InAppNotification from '@/components/InAppNotification';

type NotificationType = 'info' | 'success' | 'warning' | 'error';

interface NotificationContextType {
  showNotification: (title: string, message: string, type?: NotificationType, duration?: number, onPress?: () => void) => void;
  hideNotification: () => void;
}

interface NotificationProviderProps {
  children: ReactNode;
}

interface NotificationState {
  visible: boolean;
  title: string;
  message: string;
  type: NotificationType;
  duration: number;
  onPress?: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

/**
 * NotificationProvider manages in-app notifications and provides a way to show
 * notifications from anywhere in the app.
 * 
 * This context complements the push notification system by providing a consistent
 * way to display notifications to users regardless of whether they come from push
 * or are generated locally.
 */
export function NotificationProvider({ children }: NotificationProviderProps) {
  const [notification, setNotification] = useState<NotificationState>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    duration: 3000,
  });

  const showNotification = (
    title: string,
    message: string,
    type: NotificationType = 'info',
    duration: number = 3000,
    onPress?: () => void
  ) => {
    setNotification({
      visible: true,
      title,
      message,
      type,
      duration,
      onPress,
    });
  };

  const hideNotification = () => {
    setNotification(prev => ({ ...prev, visible: false }));
  };

  return (
    <NotificationContext.Provider value={{ showNotification, hideNotification }}>
      {children}
      {notification.visible && (
        <InAppNotification
          title={notification.title}
          message={notification.message}
          type={notification.type}
          duration={notification.duration}
          onPress={notification.onPress}
          onDismiss={hideNotification}
        />
      )}
    </NotificationContext.Provider>
  );
}

/**
 * Hook to use the notification context
 */
export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}