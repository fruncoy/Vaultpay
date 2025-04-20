import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { Clock, CircleCheck, Timer, CircleAlert, ArrowUpRight, ArrowDownRight, Bell } from 'lucide-react-native';
import { useEffect, useState, useCallback } from 'react';
import { getTransactions, findUserByVaultId, Transaction, User, updateTransaction, updateUser, markTransactionAsRead } from '@/utils/storage';
import { useAuth } from '@/hooks/useAuth';
import TransactionDetails from '@/components/TransactionDetails';
import { supabase } from '@/utils/supabase';

export default function HistoryScreen() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [activeTab, setActiveTab] = useState<'sent' | 'received'>('sent');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadTransactions = useCallback(async () => {
    if (!user) return;
    
    try {
      const allTransactions = await getTransactions();
      const userTransactions = allTransactions.filter(
        t => t.sender_id === user.id || t.receiver_id === user.id
      ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const userIds = new Set(userTransactions.flatMap(t => [t.sender_id, t.receiver_id]));
      const userDetails: Record<string, User> = {};
      
      // Fetch all user details in parallel
      const userPromises = Array.from(userIds).map(async id => {
        const userInfo = await findUserByVaultId(id);
        if (userInfo) {
          userDetails[id] = userInfo;
        }
      });
      
      await Promise.all(userPromises);

      setUsers(userDetails);
      setTransactions(userTransactions);
      
      const unreadCount = user.unread_transactions?.length || 0;
      setUnreadCount(unreadCount);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  }, [user]);

  // Debounced refresh function with state tracking
  const refreshTransactions = useCallback(async () => {
    // Prevent multiple simultaneous refreshes
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    setLoading(true);
    
    try {
      await loadTransactions();
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [loadTransactions, isRefreshing]);
  
  // Initial load - only run once when component mounts
  useEffect(() => {
    refreshTransactions();
    // Do not include refreshTransactions in the dependency array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set up real-time subscription for transactions
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('transactions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        (payload) => {
          console.log('Transaction update received:', payload);
          // Only refresh if the transaction is relevant to this user
          const transaction = payload.new as any;
          if (transaction && 
              (transaction.sender_id === user.id || 
               transaction.receiver_id === user.id)) {
            refreshTransactions();
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, refreshTransactions]);

  // This duplicate useEffect was removed to fix the reference issue

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Timer size={24} color="#F59E0B" />;
      case 'completed':
        return <CircleCheck size={24} color="#10B981" />;
      case 'accepted':
        return <CircleCheck size={24} color="#6366F1" />;
      case 'cancelled':
        return <CircleAlert size={24} color="#DC2626" />;
      default:
        return <Clock size={24} color="#8895A7" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#FEF3C7';
      case 'completed':
        return '#D1FAE5';
      case 'accepted':
        return '#E0E7FF';
      case 'cancelled':
        return '#FEE2E2';
      default:
        return '#F3F4F6';
    }
  };

  const formatAmount = (amount: number) => {
    return `KSH ${amount.toLocaleString()}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const getTimeRemaining = (transaction: Transaction) => {
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

  const handleTransactionPress = async (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    if (user && user.unread_transactions?.includes(transaction.id)) {
      await markTransactionAsRead(user.id, transaction.id);
      // Use the cached data and only update the unread count
      if (user.unread_transactions) {
        const newUnreadCount = Math.max(0, unreadCount - 1);
        setUnreadCount(newUnreadCount);
      }
    }
  };

  const filteredTransactions = transactions.filter(transaction => 
    activeTab === 'sent' ? transaction.sender_id === user?.id : transaction.receiver_id === user?.id
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.headerContent}>
          <Text style={styles.pageTitle}>Transaction History</Text>
          <View style={styles.headerLine} />
        </View>
      </View>
      
      <View style={styles.verticalGridContainer}>
        <View style={styles.verticalGridLeft} />
        <View style={styles.mainContent}>
          <View style={styles.tabs}>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'sent' && styles.activeTab]}
              onPress={() => setActiveTab('sent')}
              disabled={loading}>
              <ArrowUpRight size={20} color={activeTab === 'sent' ? '#0A1D3F' : '#8895A7'} />
              <Text style={[styles.tabText, activeTab === 'sent' && styles.activeTabText]}>Sent</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'received' && styles.activeTab]}
              onPress={() => setActiveTab('received')}
              disabled={loading}>
              <ArrowDownRight size={20} color={activeTab === 'received' ? '#0A1D3F' : '#8895A7'} />
              <Text style={[styles.tabText, activeTab === 'received' && styles.activeTabText]}>Received</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#0A1D3F" />
                  <Text style={styles.loadingText}>Loading transactions...</Text>
                </View>
              ) : filteredTransactions.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No {activeTab} transactions yet</Text>
                </View>
              ) : (
                filteredTransactions.map((transaction) => {
                  const otherParty = users[activeTab === 'sent' ? transaction.receiver_id : transaction.sender_id];
                  const isUnread = user?.unread_transactions?.includes(transaction.id);
                  
                  return (
                    <TouchableOpacity
                      key={transaction.id}
                      style={[
                        styles.transactionCard,
                        { backgroundColor: getStatusColor(transaction.status) },
                        isUnread && styles.unreadCard
                      ]}
                      onPress={() => handleTransactionPress(transaction)}>
                      <View style={styles.transactionIcon}>
                        {getStatusIcon(transaction.status)}
                      </View>
                      <View style={styles.transactionInfo}>
                        <Text style={styles.transactionTitle}>
                          {activeTab === 'sent' ? `Sent to ${otherParty?.name || 'Unknown'}` : `Received from ${otherParty?.name || 'Unknown'}`}
                        </Text>
                        <Text style={styles.vtid}>
                          VTID: {transaction.vtid}
                        </Text>
                        <Text style={styles.transactionDate}>
                          {formatDate(new Date(transaction.created_at).getTime())}
                        </Text>
                        <Text style={styles.timeRemaining}>
                          {getTimeRemaining(transaction)}
                        </Text>
                      </View>
                      <View style={styles.transactionAmount}>
                        <Text style={[
                          styles.amount,
                          { color: activeTab === 'sent' ? '#FF4B55' : '#10B981' }
                        ]}>
                          {activeTab === 'sent' ? '- ' : '+ '}{formatAmount(transaction.amount)}
                        </Text>
                        <Text style={styles.status}>{transaction.status}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </ScrollView>
        </View>
        <View style={styles.verticalGridRight} />
      </View>

      {selectedTransaction && (
        <View style={styles.modal}>
          <TransactionDetails
            transaction={selectedTransaction}
            onClose={() => setSelectedTransaction(null)}
            onUpdate={() => {
              loadTransactions();
              setSelectedTransaction(null);
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    paddingTop: Platform.OS === 'web' ? 20 : 40,
  },
  headerContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
    marginTop: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E5E7EB',
  },
  pageTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    color: '#0A1D3F',
  },
  verticalGridContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  verticalGridLeft: {
    width: 2,
    backgroundColor: '#E5E7EB',
  },
  verticalGridRight: {
    width: 2,
    backgroundColor: '#E5E7EB',
  },
  mainContent: {
    flex: 1,
  },
  tabs: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: '#E8F5FF',
  },
  tabText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#8895A7',
  },
  activeTabText: {
    color: '#0A1D3F',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 24,
  },
  loadingContainer: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#8895A7',
    marginTop: 12,
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  emptyStateText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#8895A7',
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  unreadCard: {
    borderWidth: 2,
    borderColor: '#6366F1',
  },
  transactionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  transactionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#0A1D3F',
    marginBottom: 4,
  },
  vtid: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: '#6366F1',
    marginBottom: 4,
  },
  transactionDate: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#8895A7',
  },
  timeRemaining: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: '#8895A7',
    marginTop: 4,
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  amount: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    marginBottom: 4,
  },
  status: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#8895A7',
    textTransform: 'capitalize',
  },
  modal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
});