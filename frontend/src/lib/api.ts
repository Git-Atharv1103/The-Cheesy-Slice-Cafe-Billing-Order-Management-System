import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
});

// Mobile network status listeners
if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => {
    toast.error('Network connection lost. Operating in offline mode.', { id: 'network-status', duration: 4000 });
  });

  window.addEventListener('online', () => {
    toast.success('Internet restored! Connected to live billing.', { id: 'network-status', duration: 3000 });
  });
}

// Attach JWT token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor for auth and network failure handling
api.interceptors.response.use(
  (res) => res,
  (err) => {
    // 1. Session expired (401)
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return Promise.reject(err);
    }

    // 2. Offline / Network error on mobile
    if (err.code === 'ECONNABORTED' || err.message === 'Network Error' || !window.navigator.onLine) {
      toast.error('Weak or lost connection. Please check your mobile data/Wi-Fi.', { id: 'network-error' });
    }

    return Promise.reject(err);
  }
);

export default api;
