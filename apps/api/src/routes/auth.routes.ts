import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import {
  hashPassword,
  verifyPassword,
  createTokenPair,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  generateOAuthState,
  verifyOAuthState,
  AuthError,
  TokenError,
} from '../services/auth.service';
import {
  getGoogleAuthUrl,
  exchangeGoogleCode,
  getGoogleUserInfo,
  getKakaoAuthUrl,
  exchangeKakaoCode,
  getKakaoUserInfo,
  getAppleAuthUrl,
  upsertOAuthUser,
  OAuthError,
} from '../services/oauth.service';
import { authRateLimit } from '../plugins/rate-limit.plugin';
import { requireAuth } from '../plugins/auth.plugin';
import { authEventsTotal } from '../lib/metrics';
import { logger } from '../lib/logger';

const registerSchema = z.object({
  email: z.string().email('유효한 이메일을 입력해주세요'),
  password: z.string().min(8).regex(/[A-Z]/, '대문자 포함').regex(/[0-9]/, '숫자 포함'),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  displayName: z.string().min(1).max(30),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // ─────────────────────────────────────────────
  // REGISTER
  // ─────────────────────────────────────────────
  fastify.post('/register', {
    preHandler: [authRateLimit],
    handler: async (request, reply) => {
      const body = registerSchema.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message },
        });
      }

      const { email, password, username, displayName } = body.data;

      const [emailExists, usernameExists] = await Promise.all([
        prisma.user.findUnique({ where: { email } }),
        prisma.user.findUnique({ where: { username } }),
      ]);

      if (emailExists) {
        return reply.code(409).send({
          success: false,
          error: { code: 'EMAIL_TAKEN', message: '이미 사용 중인 이메일입니다.' },
        });
      }

      if (usernameExists) {
        return reply.code(409).send({
          success: false,
          error: { code: 'USERNAME_TAKEN', message: '이미 사용 중인 사용자명입니다.' },
        });
      }

      const passwordHash = await hashPassword(password);
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          username,
          displayName,
          creditBalance: 100, // Welcome bonus
        },
      });

      const tokens = await createTokenPair(
        user,
        request.ip,
        request.headers['user-agent']
      );

      authEventsTotal.inc({ event: 'register', provider: 'email' });
      logger.info({ userId: user.id }, 'User registered');

      return reply.code(201).send({
        success: true,
        data: {
          user: sanitizeUser(user),
          ...tokens,
        },
      });
    },
  });

  // ─────────────────────────────────────────────
  // LOGIN
  // ─────────────────────────────────────────────
  fastify.post('/login', {
    preHandler: [authRateLimit],
    handler: async (request, reply) => {
      const body = loginSchema.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
        });
      }

      const { email, password } = body.data;
      const user = await prisma.user.findUnique({ where: { email } });

      if (!user || !user.passwordHash) {
        // Timing-safe: still run bcrypt to prevent timing attacks
        await hashPassword('dummy');
        return reply.code(401).send({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        });
      }

      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        authEventsTotal.inc({ event: 'login_fail', provider: 'email' });
        return reply.code(401).send({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        });
      }

      if (!user.isActive || user.isBanned) {
        return reply.code(403).send({
          success: false,
          error: { code: 'ACCOUNT_SUSPENDED', message: '계정이 정지되었습니다.' },
        });
      }

      await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

      const tokens = await createTokenPair(user, request.ip, request.headers['user-agent']);
      authEventsTotal.inc({ event: 'login', provider: 'email' });

      return reply.send({ success: true, data: { user: sanitizeUser(user), ...tokens } });
    },
  });

  // ─────────────────────────────────────────────
  // REFRESH TOKEN ROTATION
  // ─────────────────────────────────────────────
  fastify.post('/refresh', {
    handler: async (request, reply) => {
      const { refreshToken } = request.body as { refreshToken: string };
      if (!refreshToken) {
        return reply.code(400).send({
          success: false,
          error: { code: 'MISSING_TOKEN', message: 'Refresh token required' },
        });
      }

      try {
        const result = await rotateRefreshToken(
          refreshToken,
          request.ip,
          request.headers['user-agent']
        );
        return reply.send({
          success: true,
          data: {
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            expiresIn: result.expiresIn,
          },
        });
      } catch (err) {
        if (err instanceof TokenError) {
          const statusCode = err.code === 'TOKEN_REUSE_DETECTED' ? 401 : 401;
          return reply.code(statusCode).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    },
  });

  // ─────────────────────────────────────────────
  // LOGOUT
  // ─────────────────────────────────────────────
  fastify.post('/logout', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { refreshToken } = request.body as { refreshToken?: string };
      if (refreshToken) {
        await revokeRefreshToken(refreshToken);
      }
      authEventsTotal.inc({ event: 'logout', provider: 'email' });
      return reply.send({ success: true });
    },
  });

  // ─────────────────────────────────────────────
  // LOGOUT ALL DEVICES
  // ─────────────────────────────────────────────
  fastify.post('/logout-all', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      await revokeAllUserTokens(request.userId!);
      return reply.send({ success: true });
    },
  });

  // ─────────────────────────────────────────────
  // ME
  // ─────────────────────────────────────────────
  fastify.get('/me', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: request.userId },
      });
      return reply.send({ success: true, data: sanitizeUser(user) });
    },
  });

  // ─────────────────────────────────────────────
  // GOOGLE OAUTH
  // ─────────────────────────────────────────────
  fastify.get('/oauth/google', {
    preHandler: [authRateLimit],
    handler: async (request, reply) => {
      const redirectUri = `${fastify.config.API_BASE_URL}/api/auth/oauth/google/callback`;
      const state = await generateOAuthState('google', redirectUri);
      const url = getGoogleAuthUrl(state, redirectUri);
      return reply.redirect(url);
    },
  });

  fastify.get('/oauth/google/callback', {
    handler: async (request, reply) => {
      const { code, state, error } = request.query as Record<string, string>;

      if (error || !code || !state) {
        return reply.redirect(`${fastify.config.WEB_BASE_URL}/login?error=oauth_cancelled`);
      }

      try {
        const stateData = await verifyOAuthState(state);
        const tokens = await exchangeGoogleCode(code, stateData.redirectUri);
        const userInfo = await getGoogleUserInfo(tokens.access_token);

        const user = await upsertOAuthUser({
          provider: 'GOOGLE',
          providerId: userInfo.id,
          email: userInfo.email,
          displayName: userInfo.name,
          avatarUrl: userInfo.picture,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
          rawProfile: userInfo,
        });

        const authTokens = await createTokenPair(user, request.ip, request.headers['user-agent']);
        authEventsTotal.inc({ event: 'login', provider: 'google' });

        // Redirect to web with tokens in fragment (never in query string)
        const redirectUrl = new URL(`${fastify.config.WEB_BASE_URL}/auth/callback`);
        redirectUrl.hash = `access_token=${authTokens.accessToken}&refresh_token=${authTokens.refreshToken}`;
        return reply.redirect(redirectUrl.toString());
      } catch (err) {
        logger.error({ err }, 'Google OAuth callback error');
        return reply.redirect(`${fastify.config.WEB_BASE_URL}/login?error=oauth_failed`);
      }
    },
  });

  // ─────────────────────────────────────────────
  // KAKAO OAUTH
  // ─────────────────────────────────────────────
  fastify.get('/oauth/kakao', {
    preHandler: [authRateLimit],
    handler: async (request, reply) => {
      const redirectUri = `${fastify.config.API_BASE_URL}/api/auth/oauth/kakao/callback`;
      const state = await generateOAuthState('kakao', redirectUri);
      const url = getKakaoAuthUrl(state, redirectUri);
      return reply.redirect(url);
    },
  });

  fastify.get('/oauth/kakao/callback', {
    handler: async (request, reply) => {
      const { code, state, error } = request.query as Record<string, string>;

      if (error || !code || !state) {
        return reply.redirect(`${fastify.config.WEB_BASE_URL}/login?error=oauth_cancelled`);
      }

      try {
        const stateData = await verifyOAuthState(state);
        const kakaoTokens = await exchangeKakaoCode(code, stateData.redirectUri);
        const kakaoUser = await getKakaoUserInfo(kakaoTokens.access_token);

        // Kakao: email may be null (optional consent)
        const email = kakaoUser.kakao_account?.email || null;
        const nickname =
          kakaoUser.kakao_account?.profile?.nickname ||
          kakaoUser.properties?.nickname ||
          `카카오사용자${kakaoUser.id}`;
        const avatar =
          kakaoUser.kakao_account?.profile?.profile_image_url ||
          kakaoUser.properties?.profile_image ||
          null;

        const user = await upsertOAuthUser({
          provider: 'KAKAO',
          providerId: String(kakaoUser.id),
          email,
          displayName: nickname,
          avatarUrl: avatar,
          accessToken: kakaoTokens.access_token,
          refreshToken: kakaoTokens.refresh_token,
          rawProfile: kakaoUser,
        });

        const authTokens = await createTokenPair(user, request.ip, request.headers['user-agent']);
        authEventsTotal.inc({ event: 'login', provider: 'kakao' });

        const redirectUrl = new URL(`${fastify.config.WEB_BASE_URL}/auth/callback`);
        redirectUrl.hash = `access_token=${authTokens.accessToken}&refresh_token=${authTokens.refreshToken}`;
        return reply.redirect(redirectUrl.toString());
      } catch (err) {
        logger.error({ err }, 'Kakao OAuth callback error');
        return reply.redirect(`${fastify.config.WEB_BASE_URL}/login?error=oauth_failed`);
      }
    },
  });

  // ─────────────────────────────────────────────
  // MOBILE OAUTH (PKCE)
  // Used by Expo: returns tokens directly instead of redirect
  // ─────────────────────────────────────────────
  fastify.post('/oauth/mobile/kakao', {
    preHandler: [authRateLimit],
    handler: async (request, reply) => {
      const { code, codeVerifier, redirectUri } = request.body as {
        code: string;
        codeVerifier: string;
        redirectUri: string;
      };

      if (!code || !codeVerifier || !redirectUri) {
        return reply.code(400).send({
          success: false,
          error: { code: 'MISSING_PARAMS', message: 'code, codeVerifier, redirectUri required' },
        });
      }

      const kakaoTokens = await exchangeKakaoCode(code, redirectUri, codeVerifier);
      const kakaoUser = await getKakaoUserInfo(kakaoTokens.access_token);

      const email = kakaoUser.kakao_account?.email || null;
      const nickname =
        kakaoUser.kakao_account?.profile?.nickname ||
        kakaoUser.properties?.nickname ||
        `카카오사용자${kakaoUser.id}`;

      const user = await upsertOAuthUser({
        provider: 'KAKAO',
        providerId: String(kakaoUser.id),
        email,
        displayName: nickname,
        avatarUrl: kakaoUser.kakao_account?.profile?.profile_image_url || null,
        accessToken: kakaoTokens.access_token,
        rawProfile: kakaoUser,
      });

      const authTokens = await createTokenPair(user, request.ip, request.headers['user-agent']);
      return reply.send({
        success: true,
        data: { user: sanitizeUser(user), ...authTokens },
      });
    },
  });
};

function sanitizeUser(user: any) {
  const { passwordHash, ...safe } = user;
  return safe;
}
