import { client } from './client';

export const authApi = {
  // Authenticate user and get tokens (Access & Refresh)
  login: async (email: string, pass: string) => {
    const response = await client.post('/auth/login', { email, password: pass });
    return response.data;
  },

  // Register a new user
  register: async (data: any) => {
    const response = await client.post('/auth/register', data);
    return response.data;
  },

  // Update user profile details
  updateProfile: async (data: any) => {
    const response = await client.put('/user/update', data);
    return response.data;
  },

  // Send the Firebase Cloud Messaging (FCM) token to the backend
  updateFcmToken: async (token: string, userId?: number) => {
    const response = await client.post('/auth/fcm-token', { 
        fcm_token: token, 
        token: token, 
    });
    return response.data;
  },

  // 🚀 NEW: Silent Refresh Route
  refreshToken: async (refreshToken: string) => {
    const response = await client.post('/auth/refresh', { refresh_token: refreshToken });
    return response.data;
  }
};