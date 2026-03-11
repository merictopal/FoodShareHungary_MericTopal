import axios from 'axios';
// Import environment variables securely
import { API_URL } from '@env';

// Use the API_URL from the .env file
const BASE_URL = API_URL; 

export const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, 
});

// Intercept responses to handle errors globally
client.interceptors.response.use(
  response => response,
  error => {
    const errorMsg = error.response?.data?.message || error.message;
    console.log("🔥 API Error:", errorMsg);
    return Promise.reject(error);
  }
);