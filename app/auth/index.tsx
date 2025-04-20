import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ScrollView, Animated, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Lock, Mail, Phone, User, MapPin, Eye, EyeOff } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';

const descriptions = [
  "No trust? No problem",
  "Trust is overrated. VaultPay isn't",
  "Because some deals smell fishy",
  "Secure transactions, zero worries",
  "Your money, your rules"
];

export default function AuthScreen() {
  const router = useRouter();
  const { signIn, login, loading, cooldown } = useAuth();
  const [isLogin, setIsLogin] = useState(false);
  const [descriptionIndex, setDescriptionIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        })
      ]).start(() => {
        setDescriptionIndex((prev) => (prev + 1) % descriptions.length);
      });
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const validateFields = () => {
    if (isLogin) {
      if (!email.trim()) {
        setError('Email is required');
        return false;
      }
      if (!password.trim()) {
        setError('Password is required');
        return false;
      }
    } else {
      if (!name.trim()) {
        setError('Name is required');
        return false;
      }
      if (!email.trim()) {
        setError('Email is required');
        return false;
      }
      if (!password.trim()) {
        setError('Password is required');
        return false;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return false;
      }
    }
    return true;
  };

  const handleAuth = async () => {
    setError('');
    
    if (!validateFields()) {
      return;
    }
    
    try {
      if (isLogin) {
        await login(email.trim(), password);
      } else {
        await signIn({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          location: location.trim(),
          password: password.trim(),
        });
      }
    } catch (error: any) {
      setError(error.message);
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setName('');
    setEmail('');
    setPassword('');
    setPhone('');
    setLocation('');
    setShowPassword(false);
  };

  const isButtonDisabled = loading || cooldown > 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800&auto=format&fit=crop&q=80' }}
          style={styles.backgroundImage}
        />
        <View style={styles.overlay} />
        <View style={styles.titleContainer}>
          <Text style={styles.title}>VaultPay</Text>
        </View>
        <Animated.Text style={[styles.subtitle, { opacity: fadeAnim }]}>
          {descriptions[descriptionIndex]}
        </Animated.Text>
      </View>

      <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, !isLogin && styles.activeTab]}
            onPress={() => !loading && switchMode()}
            disabled={loading}>
            <Text style={[styles.tabText, !isLogin && styles.activeTabText]}>Sign Up</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, isLogin && styles.activeTab]}
            onPress={() => !loading && switchMode()}
            disabled={loading}>
            <Text style={[styles.tabText, isLogin && styles.activeTabText]}>Sign In</Text>
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          {!isLogin && (
            <View style={styles.inputContainer}>
              <User size={20} color="#8895A7" />
              <TextInput
                style={[styles.input, loading && styles.inputDisabled]}
                placeholder="Full Name"
                value={name}
                onChangeText={setName}
                placeholderTextColor="#8895A7"
                autoCapitalize="words"
                editable={!loading}
              />
            </View>
          )}
          
          <View style={styles.inputContainer}>
            <Mail size={20} color="#8895A7" />
            <TextInput
              style={[styles.input, loading && styles.inputDisabled]}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#8895A7"
              editable={!loading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Lock size={20} color="#8895A7" />
            <TextInput
              style={[styles.input, loading && styles.inputDisabled]}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholderTextColor="#8895A7"
              editable={!loading}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
              disabled={loading}>
              {showPassword ? (
                <EyeOff size={20} color="#8895A7" />
              ) : (
                <Eye size={20} color="#8895A7" />
              )}
            </TouchableOpacity>
          </View>

          {!isLogin && (
            <>
              <View style={styles.inputContainer}>
                <Phone size={20} color="#8895A7" />
                <TextInput
                  style={[styles.input, loading && styles.inputDisabled]}
                  placeholder="Phone Number"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholderTextColor="#8895A7"
                  editable={!loading}
                />
              </View>

              <View style={styles.inputContainer}>
                <MapPin size={20} color="#8895A7" />
                <TextInput
                  style={[styles.input, loading && styles.inputDisabled]}
                  placeholder="Location"
                  value={location}
                  onChangeText={setLocation}
                  placeholderTextColor="#8895A7"
                  editable={!loading}
                />
              </View>
            </>
          )}

          <TouchableOpacity 
            style={[styles.button, isButtonDisabled && styles.buttonDisabled]}
            onPress={handleAuth}
            disabled={isButtonDisabled}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>
                {cooldown > 0 
                  ? `Wait ${cooldown}s` 
                  : isLogin ? 'Sign In' : 'Create Account'}
              </Text>
            )}
          </TouchableOpacity>

          {isLogin && (
            <TouchableOpacity 
              style={styles.forgotPassword}
              disabled={loading}>
              <Text style={[styles.forgotPasswordText, loading && styles.textDisabled]}>
                Forgot Password?
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  backgroundImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(10, 29, 63, 0.8)',
  },
  titleContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  title: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
    opacity: 0.8,
    marginTop: 16,
    textAlign: 'center',
  },
  formContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    marginTop: -24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  tabs: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#0A1D3F',
  },
  tabText: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    color: '#8895A7',
  },
  activeTabText: {
    color: '#0A1D3F',
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    gap: 12,
  },
  input: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#0A1D3F',
    height: '100%',
  },
  inputDisabled: {
    opacity: 0.5,
  },
  eyeIcon: {
    padding: 8,
  },
  button: {
    backgroundColor: '#0A1D3F',
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  forgotPassword: {
    alignItems: 'center',
    marginTop: 16,
  },
  forgotPasswordText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#0A1D3F',
  },
  textDisabled: {
    opacity: 0.5,
  },
});