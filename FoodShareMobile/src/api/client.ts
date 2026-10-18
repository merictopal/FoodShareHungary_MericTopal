import axios from 'axios';
import { API_URL } from '@env';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from './auth';

const BASE_URL = API_URL; 

export const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, 
});

client.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('@FoodShare_Token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.log("Error reading token:", error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// --- SILENT REFRESH MECHANISM FOR MOBILE ---
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// --- SESSION EXPIRY ---
// Registered by AuthContext so this non-React module can return the app to the login screen.
let onSessionExpired: (() => void) | null = null;

export const setSessionExpiredHandler = (handler: (() => void) | null) => {
  onSessionExpired = handler;
};

const expireSession = async () => {
  await AsyncStorage.multiRemove(['@FoodShare_Token', '@FoodShare_RefreshToken', '@FoodShare_User']);
  delete client.defaults.headers.common['Authorization'];
  onSessionExpired?.();
};

// The refresh endpoint answered (400 missing / 401 expired or invalid / 404 user deleted):
// the session cannot be renewed. Network errors and 5xx are not treated as permanent.
const isPermanentRefreshFailure = (err: any) =>
  [400, 401, 403, 404].includes(err?.response?.status);

// Public auth endpoints do not use an access token, so a 401 from them means
// "wrong credentials / invalid token", not "access token expired".
const NO_REFRESH_URLS = ['/auth/login', '/auth/register', '/auth/google', '/auth/forgot-password', '/auth/reset-password',
  '/auth/restaurant/reapply'];

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (originalRequest && NO_REFRESH_URLS.includes(originalRequest.url)) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      
      // A failing refresh request is handled by the caller below (never refresh the refresh).
      if (originalRequest.url === '/auth/refresh') {
        return Promise.reject(error);
      }

      // No session to refresh: end any remaining session and surface the backend's own 401.
      const storedRefreshToken = await AsyncStorage.getItem('@FoodShare_RefreshToken');
      if (!storedRefreshToken) {
        await expireSession();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers['Authorization'] = 'Bearer ' + token;
          return client(originalRequest);
        }).catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await AsyncStorage.getItem('@FoodShare_RefreshToken');
        if (!refreshToken) throw new Error("No refresh token available");

        // Try to get a new VIP ticket
        const res = await authApi.refreshToken(refreshToken);

        if (res.success && res.token) {
          const newToken = res.token;
          await AsyncStorage.setItem('@FoodShare_Token', newToken);

          // No global default header: the request interceptor reads the stored token for every
          // request, and a default header would survive logout.
          originalRequest.headers['Authorization'] = 'Bearer ' + newToken;
          
          processQueue(null, newToken);
          return client(originalRequest);
        }
      } catch (err) {
        processQueue(err, null);
        // Expired/invalid refresh token: clear everything and return to the login screen.
        if (isPermanentRefreshFailure(err)) {
          await expireSession();
        }
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);