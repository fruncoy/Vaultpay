import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Image, Platform, RefreshControl } from 'react-native';
import { Plus, ArrowDownLeft, ArrowUpRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState, useCallback } from 'react';
import { getTransactions, Transaction, getUsers, User } from '@/utils/storage';

export default function HomeScreen() {
  const router = useRouter();
  const { user, refreshUserData } = useAuth();
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingEscrow, setPendingEscrow] = useState(0);

  const loadRecentTransactions = useCallback(async () => {
    if (!user) return;
    
    try {
      console.log('Loading transactions for user:', user.id);
      console.log('Current user balance:', user.balance);
      
      const allTransactions = await getTransactions();
      const userTransactions = allTransactions
        .filter(t => t.sender_id === user.id || t.receiver_id === user.id)
        .slice(0, 10);
      
      setRecentTransactions(userTransactions);

      // Calculate pending escrow amount
      const pendingAmount = userTransactions
        .filter(t => t.status === 'pending')
        .reduce((total, t) => {
          if (t.sender_id === user.id) {
            return total + t.amount;
          }
          return total;
        }, 0);

      setPendingEscrow(pendingAmount);
      
      // Refresh user data to ensure we have the latest balance
      await refreshUserData();
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setRefreshing(false);
    }
  }, [user, refreshUserData]);

  useEffect(() => {
    loadRecentTransactions();
  }, [loadRecentTransactions]);

  const handleActionButton = (action: 'add' | 'withdraw') => {
    Alert.alert(
      'Coming Soon',
      `${action === 'add' ? 'Add Money' : 'Withdraw'} feature will be available soon!`,
      [{ text: 'OK' }]
    );
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadRecentTransactions();
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#0A1D3F']}
            tintColor="#0A1D3F"
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>
            Welcome to VaultPay, {user?.name?.split(' ')[0]}
          </Text>
        </View>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceAmount}>
            KSH {(user?.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          {pendingEscrow > 0 && (
            <Text style={styles.escrowText}>
              KSH {pendingEscrow.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} in escrow
            </Text>
          )}
          <Text style={styles.balanceSubtext}>Available for transactions</Text>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleActionButton('add')}>
              <View style={[styles.actionIcon, { backgroundColor: '#E8F5FF' }]}>
                <ArrowDownLeft size={24} color="#0A1D3F" />
              </View>
              <Text style={styles.actionText}>Add Money</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleActionButton('withdraw')}>
              <View style={[styles.actionIcon, { backgroundColor: '#FEF3C7' }]}>
                <ArrowUpRight size={24} color="#0A1D3F" />
              </View>
              <Text style={styles.actionText}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.transactionsSection}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          {recentTransactions?.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No transactions yet</Text>
            </View>
          ) : (
            <View style={styles.transactionsList}>
              {recentTransactions.map((transaction, index) => (
                <View
                  key={transaction.id}
                  style={[
                    styles.transactionItem,
                    index === recentTransactions.length - 1 && Platform.OS !== 'web' && styles.lastTransactionItem
                  ]}>
                  <View>
                    <Text style={styles.transactionVTID}>{transaction.vtid}</Text>
                    <Text style={styles.transactionStatus}>
                      {transaction.status}
                    </Text>
                  </View>
                  <Text style={[
                    styles.transactionAmount,
                    { color: transaction.sender_id === user?.id ? '#FF4B55' : '#10B981' }
                  ]}>
                    {transaction.sender_id === user?.id ? '- ' : '+ '}
                    KSH {transaction.amount.toLocaleString()}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <TouchableOpacity
        style={styles.fabButton}
        onPress={() => router.push('/modal')}>
        <Plus size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 30,
    marginTop: Platform.OS === 'ios' ? 40 : Platform.OS === 'android' ? 30 : 30,
  },
  greeting: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: '#0A1D3F',
  },
  balanceCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 24,
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
  balanceLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#8895A7',
  },
  balanceAmount: {
    fontFamily: 'Inter-Bold',
    fontSize: 32,
    color: '#0A1D3F',
    marginVertical: 8,
  },
  escrowText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#6366F1',
    marginBottom: 4,
  },
  balanceSubtext: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#8895A7',
    marginBottom: 24,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#0A1D3F',
  },
  transactionsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: '#0A1D3F',
    marginBottom: 16,
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
  transactionsList: {
    gap: 12,
  },
  transactionItem: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 12, // Add bottom margin for all devices
    ...(Platform.OS === 'web' && {
      marginBottom: 80, // Extra padding for desktop view
    }),
  },
  lastTransactionItem: {
    marginBottom: 100,
  },
  transactionVTID: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    color: '#0A1D3F',
    marginBottom: 4,
  },
  transactionStatus: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#8895A7',
    textTransform: 'capitalize',
  },
  transactionAmount: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
  },
  fabButton: {
    position: 'absolute',
    bottom: 84,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0A1D3F',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
});