import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Platform, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Search, X } from 'lucide-react-native';
import { useState, useEffect } from 'react';
import { findUserByVaultId, saveTransaction, updateUser, TransactionCondition, Transaction } from '@/utils/storage';
import { useAuth } from '@/hooks/useAuth';
import TransactionDetails from '@/components/TransactionDetails';

const MIN_CONDITIONS = 1;
const DEFAULT_TIME_LIMIT = 12; // Default 12 hours

export default function TransactionModal() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, updateUser: updateAuthUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [amount, setAmount] = useState('');
  const [receiver, setReceiver] = useState<any>(null);
  const [conditions, setConditions] = useState<TransactionCondition[]>([]);
  const [newCondition, setNewCondition] = useState('');
  const [timeLimit, setTimeLimit] = useState(DEFAULT_TIME_LIMIT.toString());
  const [searchError, setSearchError] = useState('');
  const [transaction, setTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    if (params.transactionId) {
      loadTransaction();
    }
  }, [params.transactionId]);

  const loadTransaction = async () => {
    if (!params.transactionId) return;
    
    try {
      const transactions = await getTransactions();
      const found = transactions.find(t => t.id === params.transactionId);
      if (found) {
        setTransaction(found);
        // Force UI update by creating new object reference
        setTransaction({...found});
      }
    } catch (error) {
      console.error('Error loading transaction:', error);
    }
  };

  const handleSearch = async () => {
    setSearchError('');
    if (!searchQuery.trim()) {
      setSearchError('Please enter a VID');
      return;
    }
    
    try {
      const foundUser = await findUserByVaultId(searchQuery.trim());
      if (foundUser && foundUser.id !== user?.id) {
        setReceiver(foundUser);
        setSearchError('');
      } else if (foundUser?.id === user?.id) {
        setSearchError('You cannot send money to yourself');
      } else {
        setSearchError('User not found');
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchError('An error occurred while searching');
    }
  };

  const addCondition = () => {
    if (!newCondition.trim()) return;
    
    const condition: TransactionCondition = {
      description: newCondition.trim(),
      completed: false
    };
    
    setConditions([...conditions, condition]);
    setNewCondition('');
  };

  const removeCondition = (index: number) => {
    if (conditions.length <= MIN_CONDITIONS) {
      Alert.alert('Cannot remove condition', 'At least one condition is required');
      return;
    }
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const validateTransaction = () => {
    if (conditions.length < MIN_CONDITIONS) {
      Alert.alert('Add Conditions', 'Please add at least one condition');
      return false;
    }

    const timeLimitNum = parseInt(timeLimit);
    if (isNaN(timeLimitNum) || timeLimitNum < 1) {
      Alert.alert('Invalid Time Limit', 'Please enter a valid time limit');
      return false;
    }

    return true;
  };

  const handleSendMoney = async () => {
    if (!user || !receiver || !amount) return;

    if (!validateTransaction()) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    if (numAmount > (user.balance || 0)) {
      Alert.alert('Insufficient Balance', 'You do not have enough balance for this transaction');
      return;
    }

    try {
      const transaction = {
        sender_id: user.id,
        receiver_id: receiver.id,
        amount: numAmount,
        status: 'pending',
        conditions,
        time_limit: parseInt(timeLimit),
        order_received: false
      };

      // Save the transaction - this will automatically update the balance in the database
      const savedTransaction = await saveTransaction(transaction);
      
      // Update local user state with the new balance
      const newSenderBalance = (user.balance || 0) - numAmount;
      updateAuthUser({ balance: newSenderBalance });

      // Send push notification to receiver about the pending transaction
      try {
        const { notificationManager } = await import('@/utils/NotificationManager');
        notificationManager.notifyTransactionPending(savedTransaction, user.name || 'Sender');
        
        // Update the receiver's unread transactions to notify them
        await updateUser(receiver.id, {
          unread_transactions: [savedTransaction.id]
        });
      } catch (notificationError) {
        console.error('Error sending transaction notification:', notificationError);
        // Continue with the flow even if notification fails
      }

      // Navigate to history page
      router.push('/(tabs)/history');
      
    } catch (error) {
      console.error('Transaction error:', error);
      Alert.alert('Transaction Failed', 'Failed to create transaction');
    }
  };

  if (transaction) {
    return (
      <View style={styles.container}>
        <TransactionDetails
          transaction={transaction}
          onClose={() => router.back()}
          onUpdate={() => {
            router.replace('/(tabs)/history');
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Send Money</Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.back()}>
          <X size={24} color="#0A1D3F" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {!receiver ? (
          <View>
            <View style={styles.searchContainer}>
              <Search size={20} color="#8895A7" />
              <TextInput
                style={styles.searchInput}
                placeholder="Enter VID"
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#8895A7"
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
              <Text style={styles.searchButtonText}>Search</Text>
            </TouchableOpacity>

            {searchError ? (
              <Text style={styles.errorText}>{searchError}</Text>
            ) : null}

            {receiver && (
              <View style={styles.receiverCard}>
                <Text style={styles.receiverName}>{receiver.name}</Text>
                <Text style={styles.receiverVaultId}>{receiver.vault_id}</Text>
              </View>
            )}
          </View>
        ) : (
          <>
            <View style={styles.receiverCard}>
              <Text style={styles.receiverName}>{receiver.name}</Text>
              <Text style={styles.receiverVaultId}>{receiver.vault_id}</Text>
              <TouchableOpacity 
                style={styles.changeReceiverButton}
                onPress={() => setReceiver(null)}>
                <Text style={styles.changeReceiverText}>Change Recipient</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.amountContainer}>
              <Text style={styles.currencySymbol}>KSH</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
                placeholderTextColor="#8895A7"
              />
            </View>

            <View style={styles.conditionsContainer}>
              <Text style={styles.conditionsTitle}>Conditions Checklist</Text>
              <Text style={styles.conditionsDescription}>
                Add conditions that need to be met before releasing the funds
              </Text>
              
              <View style={styles.addConditionContainer}>
                <TextInput
                  style={styles.conditionInput}
                  placeholder="Add a condition..."
                  value={newCondition}
                  onChangeText={setNewCondition}
                  placeholderTextColor="#8895A7"
                />
                <TouchableOpacity 
                  style={[styles.addButton, !newCondition.trim() && styles.buttonDisabled]} 
                  onPress={addCondition}
                  disabled={!newCondition.trim()}>
                  <Text style={styles.addButtonText}>Add</Text>
                </TouchableOpacity>
              </View>

              {conditions.map((condition, index) => (
                <View key={index} style={styles.conditionItem}>
                  <Text style={styles.conditionText}>{condition.description}</Text>
                  <TouchableOpacity
                    onPress={() => removeCondition(index)}
                    style={styles.removeButton}>
                    <Text style={styles.removeButtonText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <View style={styles.timeLimit}>
                <Text style={styles.timeLimitTitle}>Time Limit (hours)</Text>
                <TextInput
                  style={styles.timeLimitInput}
                  value={timeLimit}
                  onChangeText={setTimeLimit}
                  keyboardType="number-pad"
                  placeholder="48"
                  placeholderTextColor="#8895A7"
                />
              </View>
            </View>
            
            <TouchableOpacity 
              style={[
                styles.sendButton,
                (!amount || parseFloat(amount) <= 0) && styles.buttonDisabled
              ]}
              onPress={handleSendMoney}
              disabled={!amount || parseFloat(amount) <= 0}>
              <Text style={styles.sendButtonText}>Send Money</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: Platform.OS === 'web' ? 30 : 40,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  title: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: '#0A1D3F',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#0A1D3F',
  },
  searchButton: {
    backgroundColor: '#0A1D3F',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  searchButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  errorText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#FF4B55',
    marginTop: 8,
  },
  receiverCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  receiverName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: '#0A1D3F',
    marginBottom: 4,
  },
  receiverVaultId: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#8895A7',
  },
  changeReceiverButton: {
    marginTop: 12,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  changeReceiverText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#0A1D3F',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 32,
  },
  currencySymbol: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    color: '#0A1D3F',
  },
  amountInput: {
    fontFamily: 'Inter-Bold',
    fontSize: Platform.OS === 'web' ? 48 : 32,
    color: '#0A1D3F',
    minWidth: Platform.OS === 'web' ? 150 : 120,
    textAlign: 'center',
  },
  conditionsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  conditionsTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: '#0A1D3F',
  },
  conditionsDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#8895A7',
    lineHeight: 20,
  },
  addConditionContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  conditionInput: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#0A1D3F',
  },
  addButton: {
    backgroundColor: '#0A1D3F',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  addButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.5,
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
    fontSize: 16,
    color: '#0A1D3F',
    marginRight: 12,
  },
  removeButton: {
    padding: 4,
  },
  removeButtonText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#FF4B55',
  },
  timeLimit: {
    marginTop: 8,
  },
  timeLimitTitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#0A1D3F',
    marginBottom: 8,
  },
  timeLimitInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#0A1D3F',
  },
  sendButton: {
    backgroundColor: '#0A1D3F',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  sendButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
});