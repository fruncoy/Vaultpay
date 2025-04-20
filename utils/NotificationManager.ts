import { NotificationService, NotificationData } from './NotificationService';
import { Transaction } from './storage';

// Notification priority levels
export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

// Notification types with their default priorities
const NOTIFICATION_PRIORITIES: Record<string, NotificationPriority> = {
  transaction_pending: NotificationPriority.HIGH,
  transaction_accepted: NotificationPriority.HIGH,
  transaction_completed: NotificationPriority.HIGH,
  transaction_cancelled: NotificationPriority.MEDIUM,
  condition_updated: NotificationPriority.MEDIUM,
  reminder: NotificationPriority.LOW,
};

// Cooldown periods (in milliseconds) for each priority level
const PRIORITY_COOLDOWNS: Record<NotificationPriority, number> = {
  [NotificationPriority.LOW]: 60 * 60 * 1000, // 1 hour
  [NotificationPriority.MEDIUM]: 15 * 60 * 1000, // 15 minutes
  [NotificationPriority.HIGH]: 30 * 1000, // 30 seconds
};

// Interface for notification queue item
interface NotificationQueueItem {
  userId: string;
  title: string;
  body: string;
  data: NotificationData;
  priority: NotificationPriority;
  timestamp: number;
  attempts: number;
}

/**
 * NotificationManager provides an intelligent layer on top of NotificationService
 * to manage notification delivery, prevent spam, and prioritize important notifications.
 */
export class NotificationManager {
  private static instance: NotificationManager;
  private queue: NotificationQueueItem[] = [];
  private processing = false;
  private userLastNotified: Record<string, Record<string, number>> = {};
  private maxRetries = 3;

  // Singleton pattern
  private constructor() {
    // Initialize the notification manager
    console.log('NotificationManager initialized');
  }

  public static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  /**
   * Queue a notification to be sent
   */
  public queueNotification(
    userId: string,
    title: string,
    body: string,
    data: NotificationData,
    priority?: NotificationPriority
  ): void {
    // Determine priority based on notification type or use provided priority
    const notificationPriority = priority || NOTIFICATION_PRIORITIES[data.type] || NotificationPriority.MEDIUM;

    // Add to queue
    this.queue.push({
      userId,
      title,
      body,
      data,
      priority: notificationPriority,
      timestamp: Date.now(),
      attempts: 0,
    });

    // Start processing if not already processing
    if (!this.processing) {
      this.processQueue();
    }
  }

  /**
   * Process the notification queue
   */
  private async processQueue(): Promise<void> {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;

    // Sort queue by priority (high to low) and then by timestamp (oldest first)
    this.queue.sort((a, b) => {
      const priorityOrder = {
        [NotificationPriority.HIGH]: 0,
        [NotificationPriority.MEDIUM]: 1,
        [NotificationPriority.LOW]: 2,
      };

      // First sort by priority
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Then sort by timestamp (oldest first)
      return a.timestamp - b.timestamp;
    });

    // Get the next notification to process
    const notification = this.queue.shift();
    if (!notification) {
      this.processQueue();
      return;
    }

    try {
      // Check if we should send this notification based on cooldown
      const canSend = this.canSendNotification(
        notification.userId,
        notification.data.type,
        notification.priority
      );

      if (canSend) {
        // Send the notification
        await NotificationService.sendPushNotification(
          notification.userId,
          notification.title,
          notification.body,
          notification.data
        );

        // Update last notified timestamp for this user and notification type
        if (!this.userLastNotified[notification.userId]) {
          this.userLastNotified[notification.userId] = {};
        }
        this.userLastNotified[notification.userId][notification.data.type] = Date.now();

        // Wait a bit before processing the next notification
        setTimeout(() => this.processQueue(), 1000);
      } else {
        // If we can't send now due to cooldown, check if we should retry later
        if (notification.attempts < this.maxRetries) {
          // Requeue with increased attempt count
          this.queue.push({
            ...notification,
            attempts: notification.attempts + 1,
            // Push it back in time based on priority
            timestamp: Date.now() + (notification.attempts * 5000), // Add 5 seconds per attempt
          });
        }

        // Process next notification immediately
        this.processQueue();
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      // Process next notification
      this.processQueue();
    }
  }

  /**
   * Check if a notification can be sent based on cooldown periods
   */
  private canSendNotification(
    userId: string,
    notificationType: string,
    priority: NotificationPriority
  ): boolean {
    // Get the cooldown period for this priority
    const cooldownPeriod = PRIORITY_COOLDOWNS[priority];

    // Check when this user was last notified for this type
    const lastNotified = this.userLastNotified[userId]?.[notificationType] || 0;
    const timeSinceLastNotification = Date.now() - lastNotified;

    // Allow sending if enough time has passed
    return timeSinceLastNotification >= cooldownPeriod;
  }

  /**
   * Notify about a pending transaction
   */
  public notifyTransactionPending(transaction: Transaction, receiverName: string): void {
    const title = 'New Pending Transaction';
    const body = `${receiverName} sent you KSH ${transaction.amount.toLocaleString()} for escrow`;
    const data = {
      type: 'transaction_pending',
      transactionId: transaction.id,
    };

    // Send to receiver
    this.queueNotification(
      transaction.receiver_id,
      title,
      body,
      data,
      NotificationPriority.HIGH
    );
  }

  /**
   * Notify about an accepted transaction
   */
  public notifyTransactionAccepted(transaction: Transaction, receiverName: string): void {
    const title = 'Transaction Accepted';
    const body = `${receiverName} accepted your transaction of KSH ${transaction.amount.toLocaleString()}`;
    const data = {
      type: 'transaction_accepted',
      transactionId: transaction.id,
    };

    // Send to sender
    this.queueNotification(
      transaction.sender_id,
      title,
      body,
      data,
      NotificationPriority.HIGH
    );
  }

  /**
   * Notify about a completed transaction
   */
  public notifyTransactionCompleted(transaction: Transaction, otherPartyName: string, userId: string): void {
    const title = 'Transaction Completed';
    const body = `Your transaction with ${otherPartyName} for KSH ${transaction.amount.toLocaleString()} is complete`;
    const data = {
      type: 'transaction_completed',
      transactionId: transaction.id,
    };

    // Determine the other party's ID
    const otherPartyId = userId === transaction.sender_id ? transaction.receiver_id : transaction.sender_id;

    // Send to other party
    this.queueNotification(
      otherPartyId,
      title,
      body,
      data,
      NotificationPriority.HIGH
    );
  }

  /**
   * Notify about a cancelled transaction
   */
  public notifyTransactionCancelled(transaction: Transaction, reason: string, userId: string): void {
    const title = 'Transaction Cancelled';
    const body = `Transaction for KSH ${transaction.amount.toLocaleString()} was cancelled: ${reason}`;
    const data = {
      type: 'transaction_cancelled',
      transactionId: transaction.id,
    };

    // Determine the other party's ID
    const otherPartyId = userId === transaction.sender_id ? transaction.receiver_id : transaction.sender_id;

    // Send to other party
    this.queueNotification(
      otherPartyId,
      title,
      body,
      data,
      NotificationPriority.MEDIUM
    );
  }

  /**
   * Notify about an updated condition
   */
  public notifyConditionUpdated(transaction: Transaction, conditionDescription: string, userId: string): void {
    const title = 'Condition Updated';
    const body = `Condition "${conditionDescription}" was marked as completed`;
    const data = {
      type: 'condition_updated',
      transactionId: transaction.id,
    };

    // Determine the other party's ID
    const otherPartyId = userId === transaction.sender_id ? transaction.receiver_id : transaction.sender_id;

    // Send to other party
    this.queueNotification(
      otherPartyId,
      title,
      body,
      data,
      NotificationPriority.MEDIUM
    );
  }
}

// Export a singleton instance
export const notificationManager = NotificationManager.getInstance();