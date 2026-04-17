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

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      
      // If the refresh request itself failed, game over.
      if (originalRequest.url === '/auth/refresh') {
        await AsyncStorage.multiRemove(['@FoodShare_Token', '@FoodShare_RefreshToken', '@FoodShare_User']);
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
          
          client.defaults.headers.common['Authorization'] = 'Bearer ' + newToken;
          originalRequest.headers['Authorization'] = 'Bearer ' + newToken;
          
          processQueue(null, newToken);
          return client(originalRequest);
        }
      } catch (err) {
        // Refresh failed, nuke the session
        processQueue(err, null);
        await AsyncStorage.multiRemove(['@FoodShare_Token', '@FoodShare_RefreshToken', '@FoodShare_User']);
        // Note: The app will naturally kick them out next time it checks user state
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);