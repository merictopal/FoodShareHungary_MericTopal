import { client } from './client';

export const authApi = {
  // Authenticate user and get token
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

  // NEW: Send the Firebase Cloud Messaging (FCM) token to the backend
  updateFcmToken: async (token: string, userId?: number) => {
    // We will send the token so the backend knows where to send push notifications
    const response = await client.post('/user/fcm-token', { token, user_id: userId });
    return response.data;
  }
};