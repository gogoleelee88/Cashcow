import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const BASE_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:4000';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

const TOKEN_KEYS = { access: 'cv_access_token', refresh: 'cv_refresh_token' };

export async function getStoredTokens() {
  const [access, refresh] = await Promise.all([
    SecureStore.getItemAsync(TOKEN_KEYS.access),
    SecureStore.getItemAsync(TOKEN_KEYS.refresh),
  ]);
  return { accessToken: access, refreshToken: refresh };
}

export async function storeTokens(accessToken: string, refreshToken: string) {
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEYS.access, accessToken),
    SecureStore.setItemAsync(TOKEN_KEYS.refresh, refreshToken),
  ]);
}

export async function clearTokens() {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEYS.access),
    SecureStore.deleteItemAsync(TOKEN_KEYS.refresh),
  ]);
}

// Request interceptor
apiClient.interceptors.request.use(async (config) => {
  const { accessToken } = await getStoredTokens();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Response interceptor: auto-refresh
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const { refreshToken } = await getStoredTokens();
      if (!refreshToken) throw error;
      try {
        const res = await axios.post(`${BASE_URL}/api/auth/refresh`, { refreshToken });
        const { accessToken: newAccess, refreshToken: newRefresh } = res.data.data;
        await storeTokens(newAccess, newRefresh);
        original.headers.Authorization = `Bearer ${newAccess}`;
        return apiClient(original);
      } catch {
        await clearTokens();
        throw error;
      }
    }
    throw error;
  }
);

export const mobileApi = {
  auth: {
    login: (data: any) => apiClient.post('/api/auth/login', data).then((r) => r.data),
    register: (data: any) => apiClient.post('/api/auth/register', data).then((r) => r.data),
    me: () => apiClient.get('/api/auth/me').then((r) => r.data),
    logout: (refreshToken: string) => apiClient.post('/api/auth/logout', { refreshToken }).then((r) => r.data),
    kakaoOAuth: (data: any) => apiClient.post('/api/auth/oauth/mobile/kakao', data).then((r) => r.data),
  },
  characters: {
    list: (params?: any) => apiClient.get('/api/characters', { params }).then((r) => r.data),
    trending: () => apiClient.get('/api/characters/trending').then((r) => r.data),
    get: (id: string) => apiClient.get(`/api/characters/${id}`).then((r) => r.data),
    like: (id: string) => apiClient.post(`/api/characters/${id}/like`).then((r) => r.data),
    favorite: (id: string) => apiClient.post(`/api/characters/${id}/favorite`).then((r) => r.data),
    my: () => apiClient.get('/api/characters/my').then((r) => r.data),
  },
  chat: {
    conversations: () => apiClient.get('/api/chat/conversations').then((r) => r.data),
    createConversation: (characterId: string) =>
      apiClient.post('/api/chat/conversations', { characterId }).then((r) => r.data),
    messages: (conversationId: string, params?: any) =>
      apiClient.get(`/api/chat/conversations/${conversationId}/messages`, { params }).then((r) => r.data),
  },
};
