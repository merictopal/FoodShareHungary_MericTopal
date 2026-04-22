import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../api/auth';
import { TRANSLATIONS } from '../constants/translations';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { client } from '../api/client';
import messaging from '@react-native-firebase/messaging';
// 🚀 NEW: Import the Google Client ID securely from your .env file
import { GOOGLE_WEB_CLIENT_ID } from '@env'; 

// --- TYPE DEFINITIONS ---
export type User = {
  id: number;
  name: string;
  email: string;
  role: 'student' | 'restaurant' | 'admin';
  status: string;
  verification_status?: 'verified' | 'pending' | 'unverified';
} | null;

type AuthContextType = {
  user: User;
  isLoading: boolean;
  isInitialized: boolean;
  lang: string;
  login: (email: string, pass: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  changeLanguage: (newLang: string) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
  updateUser: (u: User) => void;
  // 🚀 NEW: Added Google Login function type
  loginWithGoogle: (idToken: string) => Promise<void>; 
};

// --- CONSTANT KEYS (For AsyncStorage) ---
const STORAGE_KEYS = {
  USER: '@FoodShare_User',
  TOKEN: '@FoodShare_Token',
  REFRESH_TOKEN: '@FoodShare_RefreshToken', 
  LANG: '@FoodShare_Lang',
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // --- STATE MANAGEMENT ---
  const [user, setUser] = useState<User>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [lang, setLang] = useState('tr');

  // --- 1. APP INITIALIZATION (BOOTSTRAP) ---
  useEffect(() => {
    // 🚀 NEW: Configure Google Sign-In on app startup using the secure .env variable
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      offlineAccess: true,
    });

    const loadAppData = async () => {
      try {
        const storedLang = await AsyncStorage.getItem(STORAGE_KEYS.LANG);
        if (storedLang) {
          setLang(storedLang);
        }

        const storedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);
        const storedRefreshToken = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);

        // Prevents "Zombie Sessions" by ensuring both User and Refresh Token exist
        if (storedUser && storedRefreshToken) {
          setUser(JSON.parse(storedUser));
        } else if (storedUser && !storedRefreshToken) {
          console.log("🧹 [DEBUG] Found old zombie session without Refresh Token. Cleaning up...");
          await AsyncStorage.multiRemove([STORAGE_KEYS.USER, STORAGE_KEYS.TOKEN, STORAGE_KEYS.REFRESH_TOKEN]);
        }
      } catch (error) {
        console.error('Error loading app data during initialization:', error);
      } finally {
        setIsInitialized(true); 
      }
    };

    loadAppData();
  }, []);

  // --- 2. ADVANCED TRANSLATION FUNCTION ---
  const t = (key: string, params?: Record<string, string | number>) => {
    let translation = '';
    if (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) {
      translation = TRANSLATIONS[lang][key];
    } else if (TRANSLATIONS['en'] && TRANSLATIONS['en'][key]) {
      translation = TRANSLATIONS['en'][key];
    } else {
      console.warn(`⚠️ Missing Translation Key: [${lang}] ${key}`);
      return key.toUpperCase(); 
    }

    if (params) {
      Object.keys(params).forEach(paramKey => {
        translation = translation.replace(`{${paramKey}}`, String(params[paramKey]));
      });
    }
    return translation;
  };

  // --- 3. LANGUAGE CHANGE ---
  const changeLanguage = async (newLang: string) => {
    try {
      setLang(newLang);
      await AsyncStorage.setItem(STORAGE_KEYS.LANG, newLang);
    } catch (error) {
      console.error('Failed to save language preference:', error);
    }
  };

  // --- 4. STANDARD LOGIN ---
  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const res = await authApi.login(email, pass);
      if (res.success) {
        setUser(res.user);
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(res.user));
        
        if (res.token) await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, res.token);
        if (res.refresh_token) await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, res.refresh_token);
      } else {
        throw new Error(res.message);
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || t('error');
      Alert.alert(t('error'), errorMsg);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // --- 5. GOOGLE LOGIN (NEW) ---
  const loginWithGoogle = async (idToken: string) => {
    setIsLoading(true);
    try {
      // Send the Google ID Token to our Python backend for verification
      const res = await client.post('/auth/google', { token: idToken });
      
      if (res.data.success) {
        // Save the session exactly like a standard login
        setUser(res.data.user);
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(res.data.user));
        
        if (res.data.token) await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, res.data.token);
        if (res.data.refresh_token) await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, res.data.refresh_token);
      } else {
        throw new Error(res.data.message);
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || "Google Login Verification Failed";
      Alert.alert(t('error'), errorMsg);
      console.error("Google Backend Auth Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // --- 6. REGISTER OPERATION ---
  const register = async (data: any) => {
    setIsLoading(true);
    try {
      const res = await authApi.register(data);
      if (res.success) {
        Alert.alert(t('success'), res.message);
      } else {
        throw new Error(res.message);
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || t('error');
      Alert.alert(t('error'), errorMsg);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // --- 7. LOGOUT OPERATION ---
  const logout = async () => {
    setIsLoading(true);
    try {
      setUser(null);
      await AsyncStorage.removeItem(STORAGE_KEYS.USER);
      await AsyncStorage.removeItem(STORAGE_KEYS.TOKEN);
      await AsyncStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      
      // Optional: Sign out from Google completely so they can choose a different account next time
      try {
        await GoogleSignin.signOut();
      } catch (e) {
        // Ignore errors if they weren't logged in with Google
      }
    } catch (error) {
      console.error("Error occurred during logout:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // --- 8. SYNC FCM TOKEN ---
  useEffect(() => {
    const syncToken = async () => {
      if (!user || !user.id) return;
      try {
        const token = await messaging().getToken();
        await authApi.updateFcmToken(token, user.id);
      } catch (error: any) {
        console.log('⚠️ [MVP] Ignored FCM Token Sync Error:', error?.message);
      }
    };
    syncToken();
  }, [user]);

  if (!isInitialized) return null; 

  return (
    <AuthContext.Provider value={{ 
      user, 
      isLoading, 
      isInitialized,
      lang, 
      login, 
      register, 
      logout, 
      changeLanguage, 
      t, 
      updateUser: setUser,
      loginWithGoogle // 🚀 NEW: Exported Google Login function
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth hook must be used within an AuthProvider.');
  }
  return context;
};