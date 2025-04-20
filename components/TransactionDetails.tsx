import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { CircleCheck, Clock } from 'lucide-react-native';
import { Transaction, TransactionCondition, updateTransaction, updateUser, findUserByVaultId } from '@/utils/storage';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect, useRef } from 'react';

interface TransactionDetailsProps {
  transaction: Transaction;
  onClose: () => void;
  onUpdate: () => void;
}

export default function TransactionDetails({ transaction, onClose, onUpdate }: TransactionDetailsProps) {
  const { user, updateUser: updateAuthUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const isReceiver = user?.id === transaction.receiver_id;
  const isSender = user?.id === transaction.sender_id;
  const isExpired = Date.now() >= new Date(transaction.created_at).getTime() + (transaction.time_limit * 60 * 60 * 1000);

  // Check for expired transactions
  useEffect(() => {
    const checkExpiration = async () => {
      if (isExpired && transaction.status === 'pending') {
        try {
          await updateTransaction(transaction.id, { status: 'cancelled' });
          
          // Send notification about transaction cancellation due to expiration
          if (user) {
            try {
              const { notificationManager } = await import('@/utils/NotificationManager');
              notificationManager.notifyTransactionCancelled(
                transaction,
                'Time limit expired',
                user.id
              );
            } catch (notificationError) {
              console.error('Error sending cancellation notification:', notificationError);
            }
          }
          
          onUpdate();
        } catch (error) {
          console.error('Error handling expired transaction:', error);
        }
      }
    };

    checkExpiration();
  }, [isExpired, transaction.status]);

  const formatTimeRemaining = () => {
    if (transaction.status === 'completed' || transaction.status === 'cancelled') {
      return 'Transaction closed';
    }

    const endTime = (transaction.accepted_at ? new Date(transaction.accepted_at).getTime() : new Date(transaction.created_at).getTime()) + (transaction.time_limit * 60 * 60 * 1000);
    const remaining = endTime - Date.now();
    
    if (remaining <= 0) return 'Time expired';
    
    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    
    return `${hours}h ${minutes}m remaining`;
  };

  const handleAcceptTransaction = async () => {
    try {
      if (isMounted.current) setLoading(true);
      await updateTransaction(transaction.id, {
        status: 'accepted',
        accepted_at: new Date().toISOString()
      });
      
      // Ensure the sender gets notified by updating their unread_transactions
      if (user && transaction.sender_id) {
        try {
          // Update the sender's unread transactions to notify them
          await updateUser(transaction.sender_id, {
            unread_transactions: [transaction.id]
          });
          
          // Send push notification to sender using the improved NotificationManager
          const { notificationManager } = await import('@/utils/NotificationManager');
          notificationManager.notifyTransactionAccepted(transaction, user.name || 'Receiver');
        } catch (senderUpdateError) {
          console.error('Error updating sender notifications:', senderUpdateError);
        }
      }
      
      onUpdate();
    } catch (error) {
      Alert.alert('Error', 'Failed to accept transaction');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  const handleMarkCondition = async (index: number, completed: boolean) => {
    try {
      if (isMounted.current) setLoading(true);
      const newConditions = [...transaction.conditions];
      newConditions[index].completed = completed;

      await updateTransaction(transaction.id, { conditions: newConditions });

      // Send notification about condition update if it was marked as completed
      if (completed && user) {
        try {
          const { notificationManager } = await import('@/utils/NotificationManager');
          notificationManager.notifyConditionUpdated(
            transaction, 
            newConditions[index].description,
            user.id
          );
        } catch (notificationError) {
          console.error('Error sending condition update notification:', notificationError);
        }
      }

      // Check if all conditions are met
      const allConditionsMet = newConditions.every(c => c.completed);
      if (allConditionsMet) {
        await updateTransaction(transaction.id, { status: 'completed' });
        
        // Send notification about transaction completion
        if (user) {
          try {
            const otherPartyId = user.id === transaction.sender_id ? transaction.receiver_id : transaction.sender_id;
            const otherParty = await findUserByVaultId(otherPartyId);
            const otherPartyName = otherParty?.name || 'Unknown';
            
            const { notificationManager } = await import('@/utils/NotificationManager');
            notificationManager.notifyTransactionCompleted(
              transaction,
              otherPartyName,
              user.id
            );
          } catch (notificationError) {
            console.error('Error sending transaction completion notification:', notificationError);
          }
        }
      }

      onUpdate();
    } catch (error) {
      Alert.alert('Error', 'Failed to update condition');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.vtid}>VTID: {transaction.vtid}</Text>
      </View>

      <View style={styles.timeInfo}>
        <Clock size={20} color="#8895A7" />
        <Text style={styles.timeText}>{formatTimeRemaining()}</Text>
      </View>

      <View style={styles.amountContainer}>
        <Text style={styles.amountLabel}>Amount</Text>
        <Text style={styles.amount}>
          KSH {transaction.amount.toLocaleString()}
        </Text>
      </View>

      <View style={styles.conditionsContainer}>
        <Text style={styles.sectionTitle}>Conditions</Text>
        {transaction.conditions.map((condition: TransactionCondition, index: number) => (
          <TouchableOpacity
            key={index}
            style={styles.conditionItem}
            onPress={() => {
              if (isSender && transaction.status === 'accepted') {
                handleMarkCondition(index, !condition.completed);
              }
            }}
            disabled={!isSender || transaction.status !== 'accepted' || loading}>
            <Text style={styles.conditionText}>{condition.description}</Text>
            <View style={[styles.checkbox, condition.completed && styles.checkboxChecked]}>
              {condition.completed && <CircleCheck size={16} color="#FFFFFF" />}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.actionsContainer}>
        {isReceiver && transaction.status === 'pending' && !isExpired && (
          <TouchableOpacity
            style={[styles.button, styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleAcceptTransaction}
            disabled={loading}>
            <Text style={styles.buttonText}>Accept Transaction</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={styles.closeButton}
        onPress={onClose}>
        <Text style={styles.closeButtonText}>Close</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    maxWidth: 400,
    width: '100%',
    maxHeight: '90%',
  },
  header: {
    marginBottom: 16,
  },
  vtid: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#0A1D3F',
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  timeText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#8895A7',
  },
  amountContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  amountLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#8895A7',
    marginBottom: 4,
  },
  amount: {
    fontFamily: 'Inter-Bold',
    fontSize: 32,
    color: '#0A1D3F',
  },
  conditionsContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#0A1D3F',
    marginBottom: 12,
  },
  conditionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  conditionText: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#0A1D3F',
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#8895A7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  actionsContainer: {
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 16,
  },
  primaryButton: {
    backgroundColor: '#0A1D3F',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  closeButton: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  closeButtonText: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    color: '#0A1D3F',
  },
});