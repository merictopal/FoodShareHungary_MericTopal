import { client } from './client';

export const authApi = {
  login: async (email: string, pass: string) => {
    const response = await client.post('/auth/login', { email, password: pass });
    return response.data;
  },

  register: async (data: any) => {
    const response = await client.post('/auth/register', data);
    return response.data;
  },

  updateProfile: async (data: any) => {
    const response = await client.put('/auth/update', data);
    return response.data;
  }
};