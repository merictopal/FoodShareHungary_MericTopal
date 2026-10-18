import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback, useMemo, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../api/auth';
import { TRANSLATIONS } from '../constants/translations';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { client, setSessionExpiredHandler } from '../api/client';
import { apiErrorKey } from '../utils/apiErrors';
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
  // Re-reads the logged-in user from the backend; resolves to the fresh user (or null if it couldn't)
  refreshUser: () => Promise<User>;
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

// Upper bound for the logout FCM unlink (getToken + request) so logout never hangs on the network
const FCM_UNLINK_TIMEOUT_MS = 3000;

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

  // --- 1b. SESSION EXPIRY ---
  // The API client calls this when the refresh token is rejected; it has already removed the
  // stored tokens. Clearing the user switches AppNavigator to the login stack, which unmounts
  // all authenticated screens so no further authenticated requests are made.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      GoogleSignin.signOut().catch(() => {});
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  // --- 2. ADVANCED TRANSLATION FUNCTION ---
  // Stable per language so memoized consumers aren't invalidated by unrelated provider renders
  const t = useCallback((key: string, params?: Record<string, string | number>) => {
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
  }, [lang]);

  // --- 3. LANGUAGE CHANGE ---
  const changeLanguage = useCallback(async (newLang: string) => {
    try {
      setLang(newLang);
      await AsyncStorage.setItem(STORAGE_KEYS.LANG, newLang);
    } catch (error) {
      console.error('Failed to save language preference:', error);
    }
  }, []);

  // --- 4. STANDARD LOGIN ---
  const login = useCallback(async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const res = await authApi.login(email, pass);
      if (res.success) {
        // Persist tokens before setUser: setting the user triggers authenticated requests (FCM sync).
        if (res.token) await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, res.token);
        if (res.refresh_token) await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, res.refresh_token);
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(res.user));
        setUser(res.user);
      } else {
        throw new Error(res.message);
      }
    } catch (error: any) {
      // Translated by the backend's error title, never its English message
      const key = apiErrorKey(error, 'generic_error');
      if (key === 'err_application_rejected') {
        // Rejected restaurant: offer a new application (back to pending) with the credentials just entered
        Alert.alert(t('error'), t(key), [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('reapply_btn'),
            onPress: () => {
              authApi.reapplyRestaurant(email, pass)
                .then(() => Alert.alert(t('success'), t('msg_reg_success_rest')))
                .catch(err => Alert.alert(t('error'), t(apiErrorKey(err, 'generic_error'))));
            },
          },
        ]);
      } else {
        Alert.alert(t('error'), t(key));
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  // --- 5. GOOGLE LOGIN (NEW) ---
  const loginWithGoogle = useCallback(async (idToken: string) => {
    setIsLoading(true);
    try {
      // Send the Google ID Token to our Python backend for verification
      const res = await client.post('/auth/google', { token: idToken });
      
      if (res.data.success) {
        // Save the session exactly like a standard login (tokens first, then user state)
        if (res.data.token) await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, res.data.token);
        if (res.data.refresh_token) await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, res.data.refresh_token);
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(res.data.user));
        setUser(res.data.user);
      } else {
        throw new Error(res.data.message);
      }
    } catch (error: any) {
      Alert.alert(t('error'), t(apiErrorKey(error, 'google_login_failed')));
      // Status/message only: the error object carries the request body (the Google ID token)
      console.warn('Google backend auth failed:', error?.response?.status ?? error?.message);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  // --- 6. REGISTER OPERATION ---
  const register = useCallback(async (data: any) => {
    setIsLoading(true);
    try {
      const res = await authApi.register(data);
      if (res.success) {
        Alert.alert(t('success'), t('msg_reg_success_student'));
      } else {
        throw new Error(res.message);
      }
    } catch (error: any) {
      Alert.alert(t('error'), t(apiErrorKey(error, 'generic_error')));
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  // --- 7. LOGOUT OPERATION ---
  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      setUser(null);

      // Best-effort: unlink this device's push token from the account so its notifications don't reach the
      // next user of the device. Must run while the access token is still stored (the client reads it from
      // storage). Bounded and failure-tolerant: local logout always completes. If it fails, the backend
      // unlinks the token anyway when another account links it on this device.
      try {
        await Promise.race([
          messaging().getToken().then(token => authApi.clearFcmToken(token)),
          new Promise<void>(resolve => setTimeout(() => resolve(), FCM_UNLINK_TIMEOUT_MS)),
        ]);
      } catch {
        // Ignored: offline, expired session or Firebase unavailable
      }

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
  }, []);

  // --- 7b. USER STATE PERSISTENCE + SERVER REFRESH ---
  // Local changes (avatar, document upload) are written to storage too, so they survive a restart.
  const updateUser = useCallback((u: User) => {
    setUser(u);
    if (u) {
      AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(u)).catch(() => {});
    }
  }, []);

  // The stored user is a login-time snapshot; server-side changes (e.g. an admin approving the
  // student's document) only reach the app through this re-read of the caller's own record.
  const userRef = useRef<User>(null);
  userRef.current = user;

  const refreshUser = useCallback(async (): Promise<User> => {
    const userId = userRef.current?.id;
    if (!userId) return null;
    try {
      const res = await client.get(`/auth/me/${userId}`);
      const fresh = res.data?.user;
      // Ignore the answer if the session ended or changed while the request was running
      if (!res.data?.success || !fresh || userRef.current?.id !== userId) return null;
      const merged: User = { ...userRef.current, ...fresh };
      userRef.current = merged;
      setUser(merged);
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(merged));
      return merged;
    } catch {
      // Offline/5xx: keep the current state. An expired session is handled by the API client.
      return null;
    }
  }, []);

  // Refresh once per session start (login or restored session) and whenever the app returns to the foreground
  useEffect(() => {
    if (!user?.id) return;
    refreshUser();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refreshUser();
    });
    return () => subscription.remove();
  }, [user?.id, refreshUser]);

  // --- 8. SYNC FCM TOKEN ---
  useEffect(() => {
    // Keyed on the id only: profile updates (avatar, document) replace the user object but need no token re-sync
    const userId = user?.id;
    const syncToken = async () => {
      if (!userId) return;
      try {
        const token = await messaging().getToken();
        await authApi.updateFcmToken(token, userId);
      } catch (error: any) {
        console.log('⚠️ [MVP] Ignored FCM Token Sync Error:', error?.message);
      }
    };
    syncToken();
  }, [user?.id]);

  // Same value shape as before; only re-created when one of its parts actually changes
  const contextValue = useMemo(() => ({
    user,
    isLoading,
    isInitialized,
    lang,
    login,
    register,
    logout,
    changeLanguage,
    t,
    updateUser,
    refreshUser,
    loginWithGoogle // 🚀 NEW: Exported Google Login function
  }), [user, isLoading, isInitialized, lang, login, register, logout, changeLanguage, t, updateUser, refreshUser, loginWithGoogle]);

  if (!isInitialized) return null;

  return (
    <AuthContext.Provider value={contextValue}>
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