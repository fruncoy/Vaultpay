import { Redirect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

export default function Index() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0A1D3F" />
          <Text style={styles.loadingText}>Loading VaultPay...</Text>
        </View>
      </View>
    );
  }

  return <Redirect href={isAuthenticated ? '/(tabs)' : '/auth'} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    color: '#8895A7',
  },
});