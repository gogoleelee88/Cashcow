import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { config } from '../config';
import type { OAuthProvider } from '@prisma/client';

// ─────────────────────────────────────────────
// GOOGLE OAUTH
// ─────────────────────────────────────────────
export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  id_token: string;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture: string;
  verified_email: boolean;
}

export function getGoogleAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: config.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGoogleCode(
  code: string,
  redirectUri: string
): Promise<GoogleTokens> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.GOOGLE_CLIENT_ID!,
      client_secret: config.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new OAuthError('GOOGLE_TOKEN_EXCHANGE_FAILED', err);
  }
  return res.json();
}

export async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new OAuthError('GOOGLE_USERINFO_FAILED', 'Failed to get Google user info');
  const data = await res.json();
  return {
    id: data.sub,
    email: data.email,
    name: data.name,
    picture: data.picture,
    verified_email: data.email_verified,
  };
}

// ─────────────────────────────────────────────
// KAKAO OAUTH
// Full Authorization Code Flow with optional PKCE
// Note: email is optional (user's choice in consent)
// ─────────────────────────────────────────────
export interface KakaoTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface KakaoUserInfo {
  id: number;
  kakao_account?: {
    email?: string;           // Optional – user may deny email consent
    email_needs_agreement?: boolean;
    is_email_verified?: boolean;
    profile?: {
      nickname?: string;
      profile_image_url?: string;
      is_default_image?: boolean;
    };
  };
  properties?: {
    nickname?: string;
    profile_image?: string;
  };
}

export function getKakaoAuthUrl(
  state: string,
  redirectUri: string,
  codeChallenge?: string  // PKCE for mobile
): string {
  const params = new URLSearchParams({
    client_id: config.KAKAO_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
    scope: 'profile_nickname profile_image account_email',
  });
  if (codeChallenge) {
    params.set('code_challenge', codeChallenge);
    params.set('code_challenge_method', 'S256');
  }
  return `https://kauth.kakao.com/oauth/authorize?${params}`;
}

export async function exchangeKakaoCode(
  code: string,
  redirectUri: string,
  codeVerifier?: string  // PKCE
): Promise<KakaoTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.KAKAO_CLIENT_ID!,
    redirect_uri: redirectUri,
    code,
  });
  if (config.KAKAO_CLIENT_SECRET) body.set('client_secret', config.KAKAO_CLIENT_SECRET);
  if (codeVerifier) body.set('code_verifier', codeVerifier);

  const res = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: body.toString(),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new OAuthError('KAKAO_TOKEN_EXCHANGE_FAILED', err.error_description || 'Kakao token exchange failed');
  }
  return res.json();
}

export async function getKakaoUserInfo(accessToken: string): Promise<KakaoUserInfo> {
  const res = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
  });
  if (!res.ok) throw new OAuthError('KAKAO_USERINFO_FAILED', 'Failed to get Kakao user info');
  return res.json();
}

// ─────────────────────────────────────────────
// APPLE OAUTH (Sign in with Apple)
// ─────────────────────────────────────────────
export function getAppleAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: config.APPLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code id_token',
    scope: 'name email',
    response_mode: 'form_post',
    state,
  });
  return `https://appleid.apple.com/auth/authorize?${params}`;
}

// ─────────────────────────────────────────────
// UPSERT OAUTH ACCOUNT
// Handles: new user, existing user linking, email collision
// ─────────────────────────────────────────────
export interface OAuthUserData {
  provider: OAuthProvider;
  providerId: string;
  email?: string | null;
  displayName: string;
  avatarUrl?: string | null;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  rawProfile?: unknown;
}

export async function upsertOAuthUser(data: OAuthUserData) {
  const { provider, providerId, email, displayName, avatarUrl, accessToken, refreshToken, expiresAt, rawProfile } = data;

  // 1. Find existing OAuth account
  const existingAccount = await prisma.oAuthAccount.findUnique({
    where: { provider_providerId: { provider, providerId } },
    include: { user: true },
  });

  if (existingAccount) {
    // Update tokens
    await prisma.oAuthAccount.update({
      where: { id: existingAccount.id },
      data: { accessToken, refreshToken, expiresAt, rawProfile: rawProfile as any },
    });
    return existingAccount.user;
  }

  // 2. If email exists, link to existing account
  if (email) {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      await prisma.oAuthAccount.create({
        data: {
          userId: existingUser.id,
          provider,
          providerId,
          accessToken,
          refreshToken,
          expiresAt,
          rawProfile: rawProfile as any,
        },
      });
      return existingUser;
    }
  }

  // 3. Create new user
  const username = await generateUniqueUsername(displayName, email);
  const newUser = await prisma.user.create({
    data: {
      email: email || null,
      username,
      displayName,
      avatarUrl,
      isVerified: !!email,
      oauthAccounts: {
        create: {
          provider,
          providerId,
          accessToken,
          refreshToken,
          expiresAt,
          rawProfile: rawProfile as any,
        },
      },
      // Give welcome bonus credits
      creditBalance: 100,
    },
  });

  logger.info({ userId: newUser.id, provider }, 'New user registered via OAuth');
  return newUser;
}

async function generateUniqueUsername(displayName: string, email?: string | null): Promise<string> {
  // Start with name-based slug
  const base = (email?.split('@')[0] || displayName)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 15) || 'user';

  let username = base;
  let attempt = 0;

  while (attempt < 10) {
    const suffix = attempt === 0 ? '' : String(Math.floor(Math.random() * 9000) + 1000);
    username = `${base}${suffix}`;
    const exists = await prisma.user.findUnique({ where: { username } });
    if (!exists) return username;
    attempt++;
  }

  // Fallback: timestamp-based
  return `user${Date.now().toString(36)}`;
}

export class OAuthError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'OAuthError';
  }
}
