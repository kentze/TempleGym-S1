import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://templegym-s1-staging.up.railway.app';

export const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().setSessionExpired(true);
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);
