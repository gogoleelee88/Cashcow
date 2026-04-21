'use client';

import axios, { type AxiosInstance } from 'axios';
import { useAuthStore } from '../stores/auth.store';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const adminApiClient: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api/admin`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

adminApiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

adminApiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    if (error.response?.status === 403) {
      window.location.href = '/admin/403';
    }
    return Promise.reject(error);
  }
);
