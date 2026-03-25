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
    initiateStripe: (packageId: string) =>
      apiClient.post('/api/payments/stripe/create-intent', { packageId }).then((r) => r.data),
  },

  users: {
    profile: (username: string) =>
      apiClient.get(`/api/users/${username}/profile`).then((r) => r.data),

    follow: (username: string) =>
      apiClient.post(`/api/users/${username}/follow`).then((r) => r.data),

    updateMe: (data: { displayName?: string; bio?: string; avatarUrl?: string }) =>
      apiClient.patch('/api/users/me', data).then((r) => r.data),

    earnings: () =>
      apiClient.get('/api/users/me/earnings').then((r) => r.data),

    settlements: (params?: Record<string, unknown>) =>
      apiClient.get('/api/users/me/settlements', { params }).then((r) => r.data),

    ensureCreatorProfile: (data: { displayName: string; bio?: string }) =>
      apiClient.post('/api/users/me/creator-profile', data).then((r) => r.data),

    notifications: (params?: Record<string, unknown>) =>
      apiClient.get('/api/users/me/notifications', { params }).then((r) => r.data),

    markAllNotificationsRead: () =>
      apiClient.post('/api/users/me/notifications/read-all').then((r) => r.data),

    markNotificationRead: (id: string) =>
      apiClient.patch(`/api/notifications/${id}/read`).then((r) => r.data),
  },
};

// ─────────────────────────────────────────────
// STREAMING CHAT (SSE) — with reconnection recovery
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
  let attempt = 0;
  const MAX_RETRIES = 2;
  const RETRY_DELAYS = [1000, 2000]; // ms

  async function doStream(): Promise<void> {
    if (callbacks.signal?.aborted) return;

    let response: Response;
    try {
      response = await fetch(`${BASE_URL}/api/chat/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ content }),
        signal: callbacks.signal,
      });
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      // Network error — retry if attempts left
      if (attempt < MAX_RETRIES) {
        attempt++;
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt - 1]));
        return doStream();
      }
      callbacks.onError('네트워크 연결이 끊어졌습니다. 다시 시도해주세요.');
      return;
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: { message: '오류가 발생했습니다.' } }));
      const code = err.error?.code;
      // Don't retry on client errors (4xx)
      if (response.status === 402) {
        callbacks.onError('크레딧이 부족합니다. 충전 후 다시 시도해주세요.');
      } else if (response.status === 429) {
        callbacks.onError('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
      } else {
        callbacks.onError(err.error?.message || '오류가 발생했습니다.');
      }
      return;
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      callbacks.onError('스트리밍을 지원하지 않는 환경입니다.');
      return;
    }

    let buffer = '';
    let lastEvent = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            lastEvent = line.slice(7).trim();
            continue;
          }
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              const eventType = lastEvent || 'delta';
              lastEvent = '';

              if (eventType === 'delta' && data.text) {
                callbacks.onDelta(data.text);
              } else if (eventType === 'done') {
                callbacks.onDone(data);
              } else if (eventType === 'error') {
                callbacks.onError(data.message || '오류가 발생했습니다.');
              }
            } catch {
              // Ignore malformed SSE line
            }
          }
        }
      }
    } catch (readErr: any) {
      if (readErr.name === 'AbortError') return;
      // Stream interrupted — retry if possible (no content yet)
      if (attempt < MAX_RETRIES) {
        attempt++;
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt - 1]));
        return doStream();
      }
      callbacks.onError('스트리밍 연결이 끊어졌습니다.');
    }
  }

  doStream();
}
