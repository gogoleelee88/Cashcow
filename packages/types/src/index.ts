// ─────────────────────────────────────────────
// USER TYPES
// ─────────────────────────────────────────────
export type UserRole = 'USER' | 'CREATOR' | 'ADMIN';
export type SubscriptionTier = 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE';

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  role: UserRole;
  subscriptionTier: SubscriptionTier;
  creditBalance: number;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile extends User {
  followersCount: number;
  followingCount: number;
  charactersCount: number;
  isFollowing?: boolean;
}

// ─────────────────────────────────────────────
// PROFILE TYPES
// ─────────────────────────────────────────────
export interface Profile {
  id: string;
  name: string;
  isKids: boolean;
  avatarEmoji: string;
  avatarColor: string;
  createdAt: string;
}

// ─────────────────────────────────────────────
// CHARACTER TYPES
// ─────────────────────────────────────────────
export type CharacterVisibility = 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
export type CharacterCategory =
  | 'ANIME'
  | 'GAME'
  | 'MOVIE'
  | 'BOOK'
  | 'ORIGINAL'
  | 'CELEBRITY'
  | 'HISTORICAL'
  | 'VTUBER'
  | 'OTHER';
export type AgeRating = 'ALL' | 'TEEN' | 'MATURE';
export type CharacterGender = 'MALE' | 'FEMALE' | 'MIXED' | 'NEUTRAL';
export type AudienceTarget = 'ALL' | 'MALE_ORIENTED' | 'FEMALE_ORIENTED';

export interface Character {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  avatarUrl: string | null;
  backgroundUrl: string | null;
  category: CharacterCategory;
  tags: string[];
  visibility: CharacterVisibility;
  ageRating: AgeRating;
  language: string;
  greeting: string;
  creatorId: string;
  creator?: Pick<User, 'id' | 'username' | 'displayName' | 'avatarUrl'>;
  chatCount: number;
  likeCount: number;
  weeklyChats?: number;
  monthlyChats?: number;
  isLiked?: boolean;
  isFavorited?: boolean;
  isFeatured?: boolean;
  isOfficial?: boolean;
  isFanCreation?: boolean;
  gender?: CharacterGender;
  audienceTarget?: AudienceTarget;
  model: 'claude-haiku-3' | 'claude-sonnet-4';
  createdAt: string;
  updatedAt: string;
}

export interface CharacterListItem
  extends Omit<Character, 'systemPrompt' | 'backgroundUrl'> {}

// ─────────────────────────────────────────────
// CHAT TYPES
// ─────────────────────────────────────────────
export type MessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM';
export type MessageStatus = 'SENDING' | 'SENT' | 'ERROR' | 'STREAMING';

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  tokenCount?: number;
  createdAt: string;
}

export interface Conversation {
  id: string;
  characterId: string;
  userId: string;
  character?: CharacterListItem;
  lastMessage?: ChatMessage | null;
  lastMessageAt?: string | null;
  generatedGreeting?: string | null;
  messageCount: number;
  title: string | null;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StreamChunk {
  type: 'delta' | 'done' | 'error';
  content?: string;
  messageId?: string;
  error?: string;
}

// ─────────────────────────────────────────────
// AUTH TYPES
// ─────────────────────────────────────────────
export type OAuthProvider = 'GOOGLE' | 'KAKAO' | 'APPLE';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthSession {
  user: User;
  tokens: AuthTokens;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  username: string;
  displayName: string;
}

// ─────────────────────────────────────────────
// PAYMENT / CREDIT TYPES
// ─────────────────────────────────────────────
export type TransactionType = 'PURCHASE' | 'USAGE' | 'REFUND' | 'BONUS';
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
export type PaymentProvider = 'TOSS' | 'STRIPE';

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  currency: string;
  bonusCredits: number;
  isPopular: boolean;
}

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  credits: number;
  status: PaymentStatus;
  provider?: PaymentProvider;
  description: string;
  createdAt: string;
}

export interface SubscriptionPlan {
  id: string;
  tier: SubscriptionTier;
  name: string;
  price: number;
  currency: string;
  billingPeriod: 'MONTHLY' | 'YEARLY';
  features: string[];
  monthlyCredits: number;
  maxCharacters: number;
  prioritySupport: boolean;
  customModel: boolean;
}

// ─────────────────────────────────────────────
// API TYPES
// ─────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface SearchQuery extends PaginationQuery {
  q?: string;
  category?: CharacterCategory;
  tags?: string[];
  sort?: 'popular' | 'newest' | 'trending';
  ageRating?: AgeRating;
  language?: string;
}

// ─────────────────────────────────────────────
// NOTIFICATION TYPES
// ─────────────────────────────────────────────
export type NotificationType =
  | 'NEW_FOLLOWER'
  | 'CHARACTER_LIKE'
  | 'CHARACTER_COMMENT'
  | 'SYSTEM'
  | 'CREDIT_LOW';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  data?: Record<string, unknown>;
  createdAt: string;
}

// ─────────────────────────────────────────────
// SOCKET EVENTS
// ─────────────────────────────────────────────
export interface SocketEvents {
  'chat:stream': (chunk: StreamChunk) => void;
  'chat:start': (data: { conversationId: string; messageId: string }) => void;
  'chat:end': (data: { conversationId: string; messageId: string; tokenCount: number }) => void;
  'chat:error': (data: { conversationId: string; error: string }) => void;
  'notification:new': (notification: Notification) => void;
}
