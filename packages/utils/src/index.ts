// ─────────────────────────────────────────────
// DATE UTILS
// ─────────────────────────────────────────────
export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSecs < 60) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;
  if (diffWeeks < 4) return `${diffWeeks}주 전`;
  if (diffMonths < 12) return `${diffMonths}달 전`;
  return `${Math.floor(diffMonths / 12)}년 전`;
}

export function formatDate(date: string | Date, locale = 'ko-KR'): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date));
}

// ─────────────────────────────────────────────
// NUMBER UTILS
// ─────────────────────────────────────────────
export function formatCount(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
}

export function formatCurrency(amount: number, currency = 'KRW'): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ─────────────────────────────────────────────
// STRING UTILS
// ─────────────────────────────────────────────
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function generateId(length = 12): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function capitalizeFirst(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─────────────────────────────────────────────
// VALIDATION UTILS
// ─────────────────────────────────────────────
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidUsername(username: string): boolean {
  return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}

export function isValidPassword(password: string): boolean {
  return password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);
}

// ─────────────────────────────────────────────
// URL / STORAGE UTILS
// ─────────────────────────────────────────────
export function getAvatarUrl(avatarUrl: string | null, username: string): string {
  if (avatarUrl) return avatarUrl;
  return `https://api.dicebear.com/8.x/avataaars/svg?seed=${encodeURIComponent(username)}`;
}

export function getCharacterAvatarUrl(avatarUrl: string | null, name: string): string {
  if (avatarUrl) return avatarUrl;
  return `https://api.dicebear.com/8.x/personas/svg?seed=${encodeURIComponent(name)}&backgroundColor=1a1a2e`;
}

export function buildImageUrl(key: string, baseUrl: string): string {
  if (!key) return '';
  if (key.startsWith('http')) return key;
  return `${baseUrl}/${key}`;
}

// ─────────────────────────────────────────────
// ARRAY UTILS
// ─────────────────────────────────────────────
export function unique<T>(arr: T[], key?: keyof T): T[] {
  if (!key) return [...new Set(arr)];
  const seen = new Set();
  return arr.filter((item) => {
    const k = item[key];
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function chunk<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );
}

// ─────────────────────────────────────────────
// CATEGORY UTILS
// ─────────────────────────────────────────────
import type { CharacterCategory } from '@characterverse/types';

export const CATEGORY_LABELS: Record<CharacterCategory, string> = {
  ANIME: '애니메이션',
  GAME: '게임',
  MOVIE: '영화/드라마',
  BOOK: '책/소설',
  ORIGINAL: '오리지널',
  CELEBRITY: '셀럽',
  HISTORICAL: '역사',
  VTUBER: 'VTuber',
  OTHER: '기타',
};

export const CATEGORY_ICONS: Record<CharacterCategory, string> = {
  ANIME: '🎌',
  GAME: '🎮',
  MOVIE: '🎬',
  BOOK: '📚',
  ORIGINAL: '✨',
  CELEBRITY: '⭐',
  HISTORICAL: '🏛️',
  VTUBER: '📺',
  OTHER: '🌐',
};

// ─────────────────────────────────────────────
// TOKEN / CREDIT UTILS
// ─────────────────────────────────────────────
export function estimateTokenCount(text: string): number {
  // Rough estimate: ~4 chars per token for English, ~2 chars for Korean
  const koreanChars = (text.match(/[\uAC00-\uD7AF]/g) || []).length;
  const otherChars = text.length - koreanChars;
  return Math.ceil(koreanChars / 2 + otherChars / 4);
}

export const CREDIT_COSTS = {
  'claude-haiku-3': {
    inputPer1k: 0.25,
    outputPer1k: 1.25,
  },
  'claude-sonnet-4': {
    inputPer1k: 3.0,
    outputPer1k: 15.0,
  },
} as const;

export function calculateCreditCost(
  inputTokens: number,
  outputTokens: number,
  model: keyof typeof CREDIT_COSTS
): number {
  const costs = CREDIT_COSTS[model];
  return Math.ceil(
    (inputTokens / 1000) * costs.inputPer1k + (outputTokens / 1000) * costs.outputPer1k
  );
}

// ─────────────────────────────────────────────
// ERROR UTILS
// ─────────────────────────────────────────────
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return '알 수 없는 오류가 발생했습니다.';
}
