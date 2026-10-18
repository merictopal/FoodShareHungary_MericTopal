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

  // Send the Firebase Cloud Messaging (FCM) token to the backend
  updateFcmToken: async (token: string, userId?: number) => {
    const response = await client.post('/auth/fcm-token', { 
        fcm_token: token, 
        token: token, 
    });
    return response.data;
  },

  // Unlink this device's FCM token from the logged-in user (logout); short timeout so logout never waits long
  clearFcmToken: async (token: string) => {
    const response = await client.delete('/auth/fcm-token', { data: { fcm_token: token }, timeout: 3000 });
    return response.data;
  },

  // Permanently delete the logged-in student's own account (target comes from the token)
  deleteAccount: async () => {
    const response = await client.delete('/auth/account');
    return response.data;
  },

  // Complete the forgot-password flow with the e-mailed 6-digit code
  resetPassword: async (email: string, code: string, newPassword: string) => {
    const response = await client.post('/auth/reset-password', { email, code, new_password: newPassword });
    return response.data;
  },

  // Rejected restaurant: put the application back to pending (needs the account's e-mail + password)
  reapplyRestaurant: async (email: string, password: string) => {
    const response = await client.post('/auth/restaurant/reapply', { email, password });
    return response.data;
  },

  // 🚀 NEW: Silent Refresh Route
  refreshToken: async (refreshToken: string) => {
    const response = await client.post('/auth/refresh', { refresh_token: refreshToken });
    return response.data;
  }
};