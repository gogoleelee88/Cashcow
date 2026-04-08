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

  stories: {
    list: (params?: Record<string, unknown>) =>
      apiClient.get('/api/stories', { params }).then((r) => r.data),

    trending: (period?: string) =>
      apiClient.get('/api/stories/trending', { params: { period } }).then((r) => r.data),

    get: (id: string) =>
      apiClient.get(`/api/stories/${id}`).then((r) => r.data),

    // 스토리 draft 생성 (폼 진입 즉시)
    create: (data?: { title?: string; description?: string; systemPrompt?: string; greeting?: string }) =>
      apiClient.post('/api/stories', data ?? {}).then((r) => r.data),

    // 프로필 탭 자동저장
    update: (id: string, data: { title?: string; description?: string; greeting?: string; language?: string }) =>
      apiClient.patch(`/api/stories/${id}`, data).then((r) => r.data),

    // 스토리 삭제
    delete: (id: string) =>
      apiClient.delete(`/api/stories/${id}`).then((r) => r.data),

    // 커버 이미지
    getCoverUploadUrl: (id: string, data: { contentType: string; variant: 'square' | 'vertical' }) =>
      apiClient.post(`/api/stories/${id}/cover/upload-url`, data).then((r) => r.data),

    confirmCoverUpload: (id: string, data: { variant: 'square' | 'vertical'; url: string; key: string }) =>
      apiClient.patch(`/api/stories/${id}/cover`, data).then((r) => r.data),

    deleteCover: (id: string, variant: 'square' | 'vertical') =>
      apiClient.delete(`/api/stories/${id}/cover`, { data: { variant } }).then((r) => r.data),

    // 시스템 프롬프트 저장
    updateSystemPrompt: (id: string, systemPrompt: string) =>
      apiClient.patch(`/api/stories/${id}/system-prompt`, { systemPrompt }).then((r) => r.data),

    // 대화 예시
    listExamples: (storyId: string) =>
      apiClient.get(`/api/stories/${storyId}/examples`).then((r) => r.data),

    createExample: (storyId: string, data: { userMessage: string; assistantMessage: string; order?: number }) =>
      apiClient.post(`/api/stories/${storyId}/examples`, data).then((r) => r.data),

    updateExample: (storyId: string, exId: string, data: { userMessage?: string; assistantMessage?: string }) =>
      apiClient.put(`/api/stories/${storyId}/examples/${exId}`, data).then((r) => r.data),

    deleteExample: (storyId: string, exId: string) =>
      apiClient.delete(`/api/stories/${storyId}/examples/${exId}`).then((r) => r.data),

    reorderExamples: (storyId: string, orderedIds: string[]) =>
      apiClient.patch(`/api/stories/${storyId}/examples/reorder`, { orderedIds }).then((r) => r.data),

    like: (id: string) =>
      apiClient.post(`/api/stories/${id}/like`).then((r) => r.data),

    favorite: (id: string) =>
      apiClient.post(`/api/stories/${id}/favorite`).then((r) => r.data),

    startConversation: (storyId: string) =>
      apiClient.post(`/api/stories/${storyId}/conversations`).then((r) => r.data),

    messages: (conversationId: string, params?: Record<string, unknown>) =>
      apiClient.get(`/api/stories/conversations/${conversationId}/messages`, { params }).then((r) => r.data),

    my: (params?: Record<string, unknown>) =>
      apiClient.get('/api/stories/my', { params }).then((r) => r.data),

    generateRandomName: () =>
      apiClient.post('/api/stories/generate/name').then((r) => r.data?.data ?? r.data),

    generatePrologue: (data: { name?: string; description?: string; systemPrompt?: string; settingName?: string }) =>
      apiClient.post('/api/stories/generate/prologue', data).then((r) => r.data?.data ?? r.data),

    generateStorySettings: (data: { name: string; description: string }) =>
      apiClient.post('/api/stories/generate/story-settings', data).then((r) => r.data?.data ?? r.data),

    generateExamples: (data: { name: string; description?: string; systemPrompt: string; settingName?: string }) =>
      apiClient.post('/api/stories/generate/examples', data).then((r) => r.data?.data ?? r.data),

    // Start settings
    listStartSettings: (storyId: string) =>
      apiClient.get(`/api/stories/${storyId}/start-settings`).then((r) => r.data),

    createStartSetting: (storyId: string, data: unknown) =>
      apiClient.post(`/api/stories/${storyId}/start-settings`, data).then((r) => r.data),

    updateStartSetting: (storyId: string, settingId: string, data: unknown) =>
      apiClient.put(`/api/stories/${storyId}/start-settings/${settingId}`, data).then((r) => r.data),

    deleteStartSetting: (storyId: string, settingId: string) =>
      apiClient.delete(`/api/stories/${storyId}/start-settings/${settingId}`).then((r) => r.data),

    // Stats
    listStats: (storyId: string, settingId: string) =>
      apiClient.get(`/api/stories/${storyId}/start-settings/${settingId}/stats`).then((r) => r.data),

    createStat: (storyId: string, settingId: string, data: unknown) =>
      apiClient.post(`/api/stories/${storyId}/start-settings/${settingId}/stats`, data).then((r) => r.data),

    updateStat: (storyId: string, settingId: string, statId: string, data: unknown) =>
      apiClient.put(`/api/stories/${storyId}/start-settings/${settingId}/stats/${statId}`, data).then((r) => r.data),

    deleteStat: (storyId: string, settingId: string, statId: string) =>
      apiClient.delete(`/api/stories/${storyId}/start-settings/${settingId}/stats/${statId}`).then((r) => r.data),

    reorderStats: (storyId: string, settingId: string, orderedIds: string[]) =>
      apiClient.patch(`/api/stories/${storyId}/start-settings/${settingId}/stats/reorder`, { orderedIds }).then((r) => r.data),

    // Media
    getMediaUploadUrl: (storyId: string, settingId: string, contentType: string) =>
      apiClient.post(`/api/stories/${storyId}/start-settings/${settingId}/media/upload-url`, { contentType }).then((r) => r.data),

    confirmMediaUpload: (storyId: string, settingId: string, data: { url: string; key: string; order?: number }) =>
      apiClient.post(`/api/stories/${storyId}/start-settings/${settingId}/media`, data).then((r) => r.data),

    deleteMedia: (storyId: string, settingId: string, mediaId: string) =>
      apiClient.delete(`/api/stories/${storyId}/start-settings/${settingId}/media/${mediaId}`).then((r) => r.data),

    reorderMedia: (storyId: string, settingId: string, orderedIds: string[]) =>
      apiClient.patch(`/api/stories/${storyId}/start-settings/${settingId}/media/reorder`, { orderedIds }).then((r) => r.data),

    // Endings
    listEndings: (storyId: string, startSettingId?: string) =>
      apiClient.get(`/api/stories/${storyId}/endings`, { params: startSettingId ? { startSettingId } : {} }).then((r) => r.data),

    createEnding: (storyId: string, data: unknown) =>
      apiClient.post(`/api/stories/${storyId}/endings`, data).then((r) => r.data),

    updateEnding: (storyId: string, endingId: string, data: unknown) =>
      apiClient.put(`/api/stories/${storyId}/endings/${endingId}`, data).then((r) => r.data),

    deleteEnding: (storyId: string, endingId: string) =>
      apiClient.delete(`/api/stories/${storyId}/endings/${endingId}`).then((r) => r.data),

    generateEpilogue: (data: { storyName: string; prompt: string; endingName: string }) =>
      apiClient.post('/api/stories/generate/epilogue', data).then((r) => r.data),

    // Keyword notes
    listKeywordNotes: (storyId: string, startSettingId?: string) =>
      apiClient.get(`/api/stories/${storyId}/keyword-notes`, { params: startSettingId ? { startSettingId } : {} }).then((r) => r.data),

    createKeywordNote: (storyId: string, data: { startSettingId: string; title: string; keywords: string[]; content: string; order?: number }) =>
      apiClient.post(`/api/stories/${storyId}/keyword-notes`, data).then((r) => r.data),

    updateKeywordNote: (storyId: string, noteId: string, data: Partial<{ startSettingId: string; title: string; keywords: string[]; content: string; order: number }>) =>
      apiClient.put(`/api/stories/${storyId}/keyword-notes/${noteId}`, data).then((r) => r.data),

    deleteKeywordNote: (storyId: string, noteId: string) =>
      apiClient.delete(`/api/stories/${storyId}/keyword-notes/${noteId}`).then((r) => r.data),

    // Media list
    listMedia: (storyId: string, settingId: string) =>
      apiClient.get(`/api/stories/${storyId}/start-settings/${settingId}/media`).then((r) => r.data),

    // Story characters
    listCharacters: (storyId: string) =>
      apiClient.get(`/api/stories/${storyId}/characters`).then((r) => r.data),

    addCharacter: (storyId: string, data: { characterId: string; role?: string }) =>
      apiClient.post(`/api/stories/${storyId}/characters`, data).then((r) => r.data),

    removeCharacter: (storyId: string, characterId: string) =>
      apiClient.delete(`/api/stories/${storyId}/characters/${characterId}`).then((r) => r.data),

    // Status change
    updateStatus: (id: string, status: 'ONGOING' | 'COMPLETED' | 'HIATUS') =>
      apiClient.patch(`/api/stories/${id}/status`, { status }).then((r) => r.data),

    // Delete conversation
    deleteConversation: (conversationId: string) =>
      apiClient.delete(`/api/stories/conversations/${conversationId}`).then((r) => r.data),

    // Publish
    updatePublishSettings: (id: string, data: { category?: string; visibility?: string; ageRating?: string; chatModel?: string; tags?: string[] }) =>
      apiClient.patch(`/api/stories/${id}/publish-settings`, data).then((r) => r.data),

    publish: (id: string) =>
      apiClient.post(`/api/stories/${id}/publish`).then((r) => r.data),
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

    rankings: (params?: {
      period?: 'daily' | 'weekly' | 'monthly';
      audienceTarget?: string;
      isFanCreation?: boolean;
      sort?: 'chats' | 'likes' | 'newest';
      limit?: number;
    }) =>
      apiClient.get('/api/characters/rankings', { params }).then((r) => r.data),

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

    // ── 성인인증 (NICE 체크플러스) ─────────────────────────────
    /** NICE 암호화 요청 데이터 생성. mode:'nice' 또는 mode:'sandbox' 반환 */
    ageVerifyInitiate: (carrier: 'SKT' | 'KT' | 'LGU' | 'SKT_MVNO' | 'KT_MVNO' | 'LGU_MVNO') =>
      apiClient.post('/api/users/me/age-verify/initiate', { carrier }).then((r) => r.data),

    /** [샌드박스 전용] 인증 완료 처리 */
    ageVerifySandboxComplete: (sandboxToken: string) =>
      apiClient.post('/api/users/age-verify/sandbox-complete', { sandboxToken }).then((r) => r.data),

    /** 인증 완료 여부 폴링 */
    ageVerifyStatus: () =>
      apiClient.get('/api/users/me/age-verify/status').then((r) => r.data),
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

// ─────────────────────────────────────────────
// STREAMING STORY MESSAGE (SSE)
// ─────────────────────────────────────────────
export function streamStoryMessage(
  conversationId: string,
  content: string,
  accessToken: string,
  callbacks: {
    onDelta: (text: string) => void;
    onDone: (data: { creditCost: number; remainingCredits: number }) => void;
    onError: (message: string) => void;
    signal?: AbortSignal;
  }
): void {
  async function doStream(): Promise<void> {
    if (callbacks.signal?.aborted) return;

    let response: Response;
    try {
      response = await fetch(`${BASE_URL}/api/stories/conversations/${conversationId}/messages`, {
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
      callbacks.onError('네트워크 연결이 끊어졌습니다.');
      return;
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: { message: '오류가 발생했습니다.' } }));
      if (response.status === 402) {
        callbacks.onError('크레딧이 부족합니다. 충전 후 다시 시도해주세요.');
      } else {
        callbacks.onError(err.error?.message || '오류가 발생했습니다.');
      }
      return;
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) { callbacks.onError('스트리밍을 지원하지 않는 환경입니다.'); return; }

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
          if (line.startsWith('event: ')) { lastEvent = line.slice(7).trim(); continue; }
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              const eventType = lastEvent || 'delta';
              lastEvent = '';
              if (eventType === 'delta' && data.text) { callbacks.onDelta(data.text); }
              else if (eventType === 'done') { callbacks.onDone(data); }
              else if (eventType === 'error') { callbacks.onError(data.message || '오류가 발생했습니다.'); }
            } catch {}
          }
        }
      }
    } catch (readErr: any) {
      if (readErr.name === 'AbortError') return;
      callbacks.onError('스트리밍 연결이 끊어졌습니다.');
    }
  }

  doStream();
}
