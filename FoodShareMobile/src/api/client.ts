import axios from 'axios';

const BASE_URL = 'http://10.0.2.2:5000/api'; 

export const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, 
});

client.interceptors.response.use(
  response => response,
  error => {
    const errorMsg = error.response?.data?.message || error.message;
    console.log("🔥 API Error:", errorMsg);
    return Promise.reject(error);
  }
);