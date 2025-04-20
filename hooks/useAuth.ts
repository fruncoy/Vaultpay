import { create } from 'zustand';
import { saveUser, findUserByEmail, User } from '@/utils/storage';
import { router } from 'expo-router';
import { supabase } from '@/utils/supabase';
import 'react-native-get-random-values';
import { Alert, Platform } from 'react-native';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  cooldown: number;
  isRouterReady: boolean;
  signIn: (userData: Omit<User, 'id' | 'vaultId' | 'balance'> & { password: string }) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  updateUser: (data: Partial<User>) => void;
  refreshUserData: () => Promise<void>;
  setCooldown: (seconds: number) => void;
  initialize: () => Promise<void>;
  setRouterReady: (ready: boolean) => void;
}

const showNotification = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

// Function to safely navigate
const safeNavigate = (path: string) => {
  if (!useAuth.getState().isRouterReady) {
    setTimeout(() => safeNavigate(path), 100);
    return;
  }
  router.replace(path);
};

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  loading: false,
  cooldown: 0,
  isRouterReady: false,
  initialize: async () => {
    try {
      set({ loading: true });

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        await supabase.auth.signOut();
        set({ user: null, isAuthenticated: false, loading: false });
        return;
      }

      supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth state changed:', event);
        
        if (event === 'SIGNED_OUT') {
          set({ user: null, isAuthenticated: false });
          safeNavigate('/auth');
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user?.email) {
            try {
              const user = await findUserByEmail(session.user.email);
              if (user) {
                console.log('Updated user state:', user);
                set({ user, isAuthenticated: true });
                if (event === 'SIGNED_IN') {
                  safeNavigate('/(tabs)');
                }
              }
            } catch (error) {
              console.error('Error updating user state:', error);
            }
          }
        }
      });

      if (session?.user?.email) {
        const user = await findUserByEmail(session.user.email);
        if (user) {
          console.log('Initial user state:', user);
          set({ user, isAuthenticated: true });
        } else {
          await supabase.auth.signOut();
          set({ user: null, isAuthenticated: false });
        }
      }
    } catch (error) {
      console.error('Session initialization error:', error);
      await supabase.auth.signOut();
      set({ user: null, isAuthenticated: false });
    } finally {
      set({ loading: false });
    }
  },
  signIn: async (userData) => {
    if (get().cooldown > 0) {
      showNotification('Please Wait', `Try again in ${get().cooldown} seconds`);
      return;
    }

    try {
      set({ loading: true });

      if (!userData.email || !userData.password || !userData.name) {
        showNotification('Missing Information', 'Please fill in all required fields');
        return;
      }
  
      // Gmail restriction
      if (!userData.email.toLowerCase().endsWith('@gmail.com')) {
        showNotification('Invalid Email', 'Only Gmail addresses are allowed for registration.');
        set({ loading: false });
        return;
      }
  
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            name: userData.name,
            phone: userData.phone,
            location: userData.location
          }
        }
      });

      if (authError) {
        if (authError.message.toLowerCase().includes('rate limit') || 
            authError.message.toLowerCase().includes('security purposes')) {
          get().setCooldown(60);
        }
        showNotification('Sign Up Failed', authError.message);
        return;
      }

      if (!authData.user) {
        showNotification('Sign Up Failed', 'Failed to create account');
        return;
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        showNotification('Sign Up Failed', 'Failed to establish session');
        return;
      }

      const { password, ...userDataWithoutPassword } = userData;
      await saveUser(userDataWithoutPassword);

      const createdUser = await findUserByEmail(userData.email);
      if (!createdUser) {
        showNotification('Sign Up Failed', 'Failed to create user record');
        return;
      }

      console.log('Created user:', createdUser);
      set({ user: createdUser, isAuthenticated: true });
      showNotification('Welcome!', `Your VaultPay ID is: ${createdUser.vault_id}`);
    } catch (error: any) {
      console.error('Sign in error:', error);
      showNotification('Sign Up Failed', error.message);
    } finally {
      set({ loading: false });
    }
  },
  login: async (email: string, password: string) => {
    if (get().cooldown > 0) {
      showNotification('Please Wait', `Try again in ${get().cooldown} seconds`);
      return;
    }

    try {
      set({ loading: true });

      if (!email || !password) {
        showNotification('Missing Information', 'Please enter both email and password');
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        if (authError.message.toLowerCase().includes('rate limit') || 
            authError.message.toLowerCase().includes('security purposes')) {
          get().setCooldown(60);
        }
        showNotification('Login Failed', 'Invalid email or password');
        return;
      }

      if (!authData.user) {
        showNotification('Login Failed', 'Failed to authenticate');
        return;
      }
      if (!authData.session) {
        showNotification('Login Failed', 'No session established');
        return;
      }

      const user = await findUserByEmail(email);
      if (!user) {
        showNotification('Login Failed', 'User account not found');
        return;
      }

      console.log('Logged in user:', user);
      set({ user, isAuthenticated: true });
      showNotification('Welcome Back!', `Logged in as ${user.name}`);
    } catch (error: any) {
      console.error('Login error:', error);
      showNotification('Login Failed', error.message);
    } finally {
      set({ loading: false });
    }
  },
  signOut: async () => {
    try {
      set({ loading: true });
      
      // First sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        throw error;
      }
      
      // Only clear local state after successful Supabase signout
      set({ user: null, isAuthenticated: false });
      
      // Show notification
      showNotification('Goodbye!', 'We hope to see you again soon!');
      
      // Wait for a short moment to ensure state is updated and notification is shown
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Force navigation to auth page
      safeNavigate('/auth');
    } catch (error) {
      console.error('Sign out error:', error);
      showNotification('Sign Out Failed', 'Failed to sign out. Please try again.');
      
      // Don't attempt to restore session on error - this could cause the user to be stuck
      // Instead, try to force sign out again
      try {
        await supabase.auth.signOut();
        set({ user: null, isAuthenticated: false });
        safeNavigate('/auth');
      } catch (secondError) {
        console.error('Second sign out attempt failed:', secondError);
      }
    } finally {
      set({ loading: false });
    }
  },
  updateUser: (data) => {
    console.log('Updating user state with:', data);
    set((state) => ({
      user: state.user ? { ...state.user, ...data } : null,
    }));
  },
  setCooldown: (seconds) => {
    set({ cooldown: seconds });
    const interval = setInterval(() => {
      const current = get().cooldown;
      if (current <= 0) {
        clearInterval(interval);
        return;
      }
      set({ cooldown: current - 1 });
    }, 1000);
  },
  setRouterReady: (ready) => set({ isRouterReady: ready }),
  refreshUserData: async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session || !session.user?.email) {
        console.error('No active session for refresh');
        return;
      }

      const user = await findUserByEmail(session.user.email);
      if (user) {
        console.log('Refreshed user data:', user);
        set({ user });
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  },
}));

// Set up real-time subscription for user updates
supabase
  .channel('user_updates')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'users',
    },
    async (payload) => {
      console.log('Received real-time update:', payload);
      const currentUser = useAuth.getState().user;
      if (currentUser && payload.new && payload.new.id === currentUser.id) {
        console.log('Updating user state from real-time event:', payload.new);
        useAuth.getState().updateUser(payload.new as User);
      }
    }
  )
  .subscribe();