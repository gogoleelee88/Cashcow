import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { sign, verify } from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { getRedis, CacheKeys } from '../lib/redis';
import { hashData } from '../lib/encryption';
import { logger } from '../lib/logger';
import { config } from '../config';
import { authEventsTotal } from '../lib/metrics';
import type { User } from '@prisma/client';

// ─────────────────────────────────────────────
// TOKEN TYPES
// ─────────────────────────────────────────────
export interface AccessTokenPayload {
  sub: string;       // userId
  email: string | null;
  username: string;
  role: string;
  tier: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  family: string;
  type: 'refresh';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// ─────────────────────────────────────────────
// PASSWORD
// ─────────────────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─────────────────────────────────────────────
// TOKEN GENERATION
// ─────────────────────────────────────────────
export function generateAccessToken(user: User): string {
  const payload: AccessTokenPayload = {
    sub: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    tier: user.subscriptionTier,
    type: 'access',
  };
  return sign(payload, config.JWT_ACCESS_SECRET, {
    expiresIn: config.JWT_ACCESS_EXPIRES_IN,
    issuer: 'characterverse',
    audience: 'characterverse-client',
  });
}

export async function generateRefreshToken(
  user: User,
  family: string,
  ipAddress?: string,
  userAgent?: string
): Promise<string> {
  const token = randomBytes(48).toString('base64url');
  const tokenHash = hashData(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      family,
      isUsed: false,
      userAgent,
      ipAddress,
      expiresAt,
    },
  });

  return token;
}

export async function createTokenPair(
  user: User,
  ipAddress?: string,
  userAgent?: string
): Promise<AuthTokens> {
  const family = randomBytes(16).toString('hex');
  const [accessToken, refreshToken] = await Promise.all([
    Promise.resolve(generateAccessToken(user)),
    generateRefreshToken(user, family, ipAddress, userAgent),
  ]);
  return { accessToken, refreshToken, expiresIn: 15 * 60 };
}

// ─────────────────────────────────────────────
// REFRESH TOKEN ROTATION
// Detect token reuse → revoke entire family → possible theft
// ─────────────────────────────────────────────
export async function rotateRefreshToken(
  oldToken: string,
  ipAddress?: string,
  userAgent?: string
): Promise<AuthTokens & { user: User }> {
  const tokenHash = hashData(oldToken);

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!stored) {
    throw new TokenError('INVALID_REFRESH_TOKEN', 'Refresh token not found');
  }

  if (stored.expiresAt < new Date()) {
    await prisma.refreshToken.deleteMany({ where: { userId: stored.userId, family: stored.family } });
    throw new TokenError('EXPIRED_REFRESH_TOKEN', 'Refresh token expired');
  }

  // REUSE DETECTION: if token already used → entire family compromised
  if (stored.isUsed) {
    logger.warn(
      { userId: stored.userId, family: stored.family, ipAddress },
      '🚨 Refresh token reuse detected — revoking entire family'
    );
    await prisma.refreshToken.deleteMany({
      where: { userId: stored.userId, family: stored.family },
    });
    authEventsTotal.inc({ event: 'token_reuse', provider: 'jwt' });
    throw new TokenError('TOKEN_REUSE_DETECTED', 'Token reuse detected. All sessions invalidated.');
  }

  if (!stored.user.isActive || stored.user.isBanned) {
    throw new TokenError('USER_SUSPENDED', 'Account is suspended');
  }

  // Mark old token as used
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { isUsed: true },
  });

  // Issue new token in same family
  const newToken = randomBytes(48).toString('base64url');
  const newTokenHash = hashData(newToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId: stored.userId,
      tokenHash: newTokenHash,
      family: stored.family,
      isUsed: false,
      userAgent,
      ipAddress,
      expiresAt,
    },
  });

  const accessToken = generateAccessToken(stored.user);
  authEventsTotal.inc({ event: 'refresh', provider: 'jwt' });

  return {
    accessToken,
    refreshToken: newToken,
    expiresIn: 15 * 60,
    user: stored.user,
  };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  const tokenHash = hashData(token);
  await prisma.refreshToken.deleteMany({ where: { tokenHash } });
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { userId } });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return verify(token, config.JWT_ACCESS_SECRET, {
    issuer: 'characterverse',
    audience: 'characterverse-client',
  }) as AccessTokenPayload;
}

// ─────────────────────────────────────────────
// OAUTH STATE MANAGEMENT (CSRF Prevention)
// ─────────────────────────────────────────────
export async function generateOAuthState(
  provider: string,
  redirectUri: string,
  codeVerifier?: string // PKCE
): Promise<string> {
  const state = randomBytes(32).toString('base64url');
  const redis = getRedis();
  const data = { provider, redirectUri, codeVerifier, createdAt: Date.now() };
  // 10 minute TTL
  await redis.setex(CacheKeys.oauthState(state), 600, JSON.stringify(data));
  return state;
}

export async function verifyOAuthState(
  state: string
): Promise<{ provider: string; redirectUri: string; codeVerifier?: string }> {
  const redis = getRedis();
  const key = CacheKeys.oauthState(state);
  const data = await redis.get(key);
  if (!data) {
    throw new TokenError('INVALID_OAUTH_STATE', 'OAuth state is invalid or expired');
  }
  await redis.del(key); // One-time use
  return JSON.parse(data);
}

// ─────────────────────────────────────────────
// AGE VERIFICATION TOKEN
// ─────────────────────────────────────────────
export async function generateAgeVerificationToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const redis = getRedis();
  // 24 hour TTL
  await redis.setex(CacheKeys.ageVerification(token), 86400, userId);
  return token;
}

export async function verifyAgeToken(token: string): Promise<string | null> {
  const redis = getRedis();
  return redis.get(CacheKeys.ageVerification(token));
}

// ─────────────────────────────────────────────
// ERROR TYPES
// ─────────────────────────────────────────────
export class TokenError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'TokenError';
  }
}

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
