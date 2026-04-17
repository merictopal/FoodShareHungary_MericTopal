import axios from 'axios';

export const client = axios.create({
  baseURL: 'http://127.0.0.1:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- REQUEST INTERCEPTOR ---
client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// --- RESPONSE INTERCEPTOR (The Silent Refresher) ---
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

    // If error is 401 and we haven't already tried to refresh this specific request
    if (error.response?.status === 401 && !originalRequest._retry) {
      
      // If the request that failed WAS the refresh request, then the refresh token is also dead.
      // Time to actually log the user out.
      if (originalRequest.url === '/auth/refresh') {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_refresh_token');
        if (window.location.pathname !== '/') window.location.href = '/';
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // If a refresh is already in progress, queue this request to run after it finishes
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers['Authorization'] = 'Bearer ' + token;
          return client(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('admin_refresh_token');
      
      if (!refreshToken) {
         // No backup key? Kick them out.
         localStorage.removeItem('admin_token');
         if (window.location.pathname !== '/') window.location.href = '/';
         return Promise.reject(error);
      }

      try {
        // Attempt to get a new access ticket
        const res = await axios.post('http://127.0.0.1:5000/api/auth/refresh', {
          refresh_token: refreshToken
        });

        if (res.data.success && res.data.token) {
          const newToken = res.data.token;
          // Save the new key
          localStorage.setItem('admin_token', newToken);
          // Update the default headers
          client.defaults.headers.common['Authorization'] = 'Bearer ' + newToken;
          originalRequest.headers['Authorization'] = 'Bearer ' + newToken;
          
          processQueue(null, newToken);
          
          // Retry the original request with the new key!
          return client(originalRequest);
        }
      } catch (err) {
        // Refresh token failed or expired. Nuke everything.
        processQueue(err, null);
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_refresh_token');
        if (window.location.pathname !== '/') window.location.href = '/';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);