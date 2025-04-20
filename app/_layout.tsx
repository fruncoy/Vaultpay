import { useEffect, useRef } from 'react';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { SplashScreen } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import 'react-native-get-random-values';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NotificationProvider } from '@/contexts/NotificationContext';
import PushNotificationManager from '@/components/PushNotificationManager';

export default function RootLayout() {
  useFrameworkReady();
  const { initialize, loading, setRouterReady, user } = useAuth();

  const [fontsLoaded, fontError] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      // Only initialize auth after fonts are loaded
      initialize().then(() => {
        SplashScreen.hideAsync();
        setRouterReady(true); // Set router readiness to true after initialization
      });
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

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

  return (
    <NotificationProvider>
      <PushNotificationManager>
        <Slot />
        <StatusBar style="dark" />
      </PushNotificationManager>
    </NotificationProvider>
  );
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