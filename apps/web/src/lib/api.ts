import axios, { type AxiosInstance, type AxiosError } from 'axios';
import { useAuthStore } from '../stores/auth.store';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ─────────────────────────────────────────────
// AXIOS INSTANCE
// ─────────────────────────────────────────────
export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
  withCredentials: false,
});

let isRefreshing = false;
let refreshQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

// Request interceptor: attach access token
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401 → auto-refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;

    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = useAuthStore.getState().refreshToken;

      if (!refreshToken) {
        useAuthStore.getState().logout();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({
            resolve: (token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(apiClient(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post(`${BASE_URL}/api/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = response.data.data;

        useAuthStore.getState().setTokens(accessToken, newRefreshToken);

        refreshQueue.forEach((q) => q.resolve(accessToken));
        refreshQueue = [];

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        refreshQueue.forEach((q) => q.reject(refreshError));
        refreshQueue = [];
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ─────────────────────────────────────────────
// API FUNCTIONS
// ─────────────────────────────────────────────
export const api = {
  auth: {
    register: (data: { email: string; password: string; username: string; displayName: string }) =>
      apiClient.post('/api/auth/register', data).then((r) => r.data),

    login: (data: { email: string; password: string }) =>
      apiClient.post('/api/auth/login', data).then((r) => r.data),

    logout: (refreshToken: string) =>
      apiClient.post('/api/auth/logout', { refreshToken }).then((r) => r.data),

    me: () => apiClient.get('/api/auth/me').then((r) => r.data),

    refresh: (refreshToken: string) =>
      apiClient.post('/api/auth/refresh', { refreshToken }).then((r) => r.data),

    oauthUrl: (provider: string) => `${BASE_URL}/api/auth/oauth/${provider}`,

    mobileOAuth: (provider: string, data: { code: string; codeVerifier: string; redirectUri: string }) =>
      apiClient.post(`/api/auth/oauth/mobile/${provider}`, data).then((r) => r.data),
  },

  characters: {
    list: (params?: Record<string, unknown>) =>
      apiClient.get('/api/characters', { params }).then((r) => r.data),

    trending: (period?: string) =>
      apiClient.get('/api/characters/trending', { params: { period } }).then((r) => r.data),

    get: (id: string) =>
      apiClient.get(`/api/characters/${id}`).then((r) => r.data),

    create: (data: unknown) =>
      apiClient.post('/api/characters', data).then((r) => r.data),

    update: (id: string, data: unknown) =>
      apiClient.patch(`/api/characters/${id}`, data).then((r) => r.data),

    delete: (id: string) =>
      apiClient.delete(`/api/characters/${id}`).then((r) => r.data),

    like: (id: string) =>
      apiClient.post(`/api/characters/${id}/like`).then((r) => r.data),

    favorite: (id: string) =>
      apiClient.post(`/api/characters/${id}/favorite`).then((r) => r.data),

    getUploadUrl: (contentType: string, type: 'avatar' | 'background') =>
      apiClient.post('/api/characters/upload-url', { contentType, type }).then((r) => r.data),

    my: (params?: Record<string, unknown>) =>
      apiClient.get('/api/characters/my', { params }).then((r) => r.data),
  },

  chat: {
    conversations: (params?: Record<string, unknown>) =>
      apiClient.get('/api/chat/conversations', { params }).then((r) => r.data),

    createConversation: (characterId: string) =>
      apiClient.post('/api/chat/conversations', { characterId }).then((r) => r.data),

    messages: (conversationId: string, params?: Record<string, unknown>) =>
      apiClient.get(`/api/chat/conversations/${conversationId}/messages`, { params }).then((r) => r.data),

    deleteConversation: (conversationId: string) =>
      apiClient.delete(`/api/chat/conversations/${conversationId}`).then((r) => r.data),

    pinConversation: (conversationId: string) =>
      apiClient.post(`/api/chat/conversations/${conversationId}/pin`).then((r) => r.data),
  },

  payments: {
    packages: () => apiClient.get('/api/payments/packages').then((r) => r.data),
    plans: () => apiClient.get('/api/payments/plans').then((r) => r.data),
    initiateTosse: (packageId: string) =>
      apiClient.post('/api/payments/toss/initiate', { packageId }).then((r) => r.data),
    confirmToss: (data: { paymentKey: string; orderId: string; amount: number }) =>
      apiClient.post('/api/payments/toss/confirm', data).then((r) => r.data),
    transactions: (params?: Record<string, unknown>) =>
      apiClient.get('/api/payments/transactions', { params }).then((r) => r.data),
  },
};

// ─────────────────────────────────────────────
// STREAMING CHAT (SSE)
// ─────────────────────────────────────────────
export function streamChatMessage(
  conversationId: string,
  content: string,
  accessToken: string,
  callbacks: {
    onDelta: (text: string) => void;
    onDone: (data: { messageId: string; creditCost: number; remainingCredits: number }) => void;
    onError: (message: string) => void;
    signal?: AbortSignal;
  }
): void {
  // Use fetch for SSE with POST body
  fetch(`${BASE_URL}/api/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ content }),
    signal: callbacks.signal,
  }).then(async (response) => {
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: { message: '오류가 발생했습니다.' } }));
      callbacks.onError(err.error?.message || '오류가 발생했습니다.');
      return;
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      callbacks.onError('스트리밍을 지원하지 않는 환경입니다.');
      return;
    }

    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          // Next line will be data
          continue;
        }
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            const eventLine = lines[lines.indexOf(line) - 1];
            const eventType = eventLine?.startsWith('event: ')
              ? eventLine.slice(7).trim()
              : 'delta';

            if (eventType === 'delta' && data.text) {
              callbacks.onDelta(data.text);
            } else if (eventType === 'done') {
              callbacks.onDone(data);
            } else if (eventType === 'error') {
              callbacks.onError(data.message || '오류가 발생했습니다.');
            }
          } catch {
            // Ignore malformed SSE
          }
        }
      }
    }
  }).catch((err) => {
    if (err.name !== 'AbortError') {
      callbacks.onError('연결이 끊어졌습니다.');
    }
  });
}
