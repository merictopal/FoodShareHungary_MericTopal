import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../api/auth';
import { TRANSLATIONS } from '../constants/translations';

// --- TYPE DEFINITIONS ---
export type User = {
  id: number;
  name: string;
  email: string;
  role: 'student' | 'restaurant' | 'admin';
  status: string;
} | null;

type AuthContextType = {
  user: User;
  isLoading: boolean;
  isInitialized: boolean; // Indicates if the app has finished loading initial data on startup
  lang: string;
  login: (email: string, pass: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  changeLanguage: (newLang: string) => Promise<void>; // Change language and persist to storage
  t: (key: string, params?: Record<string, string | number>) => string; // Advanced translation function
  updateUser: (u: User) => void;
};

// --- CONSTANT KEYS (For AsyncStorage) ---
const STORAGE_KEYS = {
  USER: '@FoodShare_User',
  TOKEN: '@FoodShare_Token',
  LANG: '@FoodShare_Lang',
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // --- STATE MANAGEMENT ---
  const [user, setUser] = useState<User>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false); // For splash screen control
  const [lang, setLang] = useState('tr'); // Default language

  // --- 1. APP INITIALIZATION (BOOTSTRAP) ---
  useEffect(() => {
    const loadAppData = async () => {
      try {
        // Check for saved language preference
        const storedLang = await AsyncStorage.getItem(STORAGE_KEYS.LANG);
        if (storedLang) {
          setLang(storedLang);
        }

        // Check for saved user session (JWT Token/User)
        const storedUser = await AsyncStorage.getItem(STORAGE_KEYS.USER);
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (error) {
        console.error('Error loading app data during initialization:', error);
      } finally {
        setIsInitialized(true); // Initialization complete, we can now render app screens
      }
    };

    loadAppData();
  }, []);

  // --- 2. ADVANCED TRANSLATION FUNCTION (TRANSLATE) ---
  // Usage: t('welcome', { name: 'Meriç' }) -> "Welcome Meriç"
  const t = (key: string, params?: Record<string, string | number>) => {
    let translation = '';

    // 1. Search in the selected language
    if (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) {
      translation = TRANSLATIONS[lang][key];
    } 
    // 2. Fallback to English if not found
    else if (TRANSLATIONS['en'] && TRANSLATIONS['en'][key]) {
      translation = TRANSLATIONS['en'][key];
    } 
    // 3. Return uppercase key if completely missing (for easy spotting during development)
    else {
      console.warn(`⚠️ Missing Translation Key: [${lang}] ${key}`);
      return key.toUpperCase(); 
    }

    // If parameters are provided (e.g., "Hello {name}"), inject them into the string
    if (params) {
      Object.keys(params).forEach(paramKey => {
        translation = translation.replace(`{${paramKey}}`, String(params[paramKey]));
      });
    }

    return translation;
  };

  // --- 3. LANGUAGE CHANGE OPERATION ---
  const changeLanguage = async (newLang: string) => {
    try {
      setLang(newLang);
      await AsyncStorage.setItem(STORAGE_KEYS.LANG, newLang); // Persist preference to device storage
    } catch (error) {
      console.error('Failed to save language preference:', error);
    }
  };

  // --- 4. LOGIN OPERATION ---
  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const res = await authApi.login(email, pass);
      if (res.success) {
        // Save user and token received from the backend
        setUser(res.user);
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(res.user));
        
        if (res.token) {
          await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, res.token);
        }
      } else {
        throw new Error(res.message);
      }
    } catch (error: any) {
      // Get error message from API response or fallback to generic translation
      const errorMsg = error.response?.data?.message || error.message || t('error');
      Alert.alert(t('error'), errorMsg);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // --- 5. REGISTER OPERATION ---
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

  // --- 6. LOGOUT OPERATION ---
  const logout = async () => {
    setIsLoading(true);
    try {
      setUser(null);
      // Clear session info from device but keep language preference
      await AsyncStorage.removeItem(STORAGE_KEYS.USER);
      await AsyncStorage.removeItem(STORAGE_KEYS.TOKEN);
    } catch (error) {
      console.error("Error occurred during logout:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Return null or show a splash screen until app data is loaded
  if (!isInitialized) {
    return null; // Or a simple <ActivityIndicator />
  }

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
      updateUser: setUser 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// --- CUSTOM HOOK ---
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth hook must be used within an AuthProvider. Please wrap your app with <AuthProvider>.');
  }
  return context;
};