import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { verifyAccessToken, AuthError, type AccessTokenPayload } from '../services/auth.service';
import { prisma } from '../lib/prisma';
import { getRedis } from '../lib/redis';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AccessTokenPayload;
    userId?: string;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('user', null);
  fastify.decorateRequest('userId', null);

  fastify.addHook('preHandler', async (request: FastifyRequest) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return;

    const token = authHeader.slice(7);
    try {
      const payload = verifyAccessToken(token);

      // Check token blacklist (for immediately-revoked tokens)
      const redis = getRedis();
      const isBlacklisted = await redis.get(`blacklist:token:${payload.sub}:${payload.iat}`);
      if (isBlacklisted) return;

      request.user = payload;
      request.userId = payload.sub;
    } catch {
      // Silently fail — routes that require auth will explicitly check
    }
  });
};

// Prehandler hooks for protected routes
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.user) {
    return reply.code(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
    });
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.user) {
    return reply.code(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' } });
  }
  if (request.user.role !== 'ADMIN') {
    return reply.code(403).send({ success: false, error: { code: 'FORBIDDEN', message: '권한이 없습니다.' } });
  }
}

export async function requireAgeVerification(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.user) {
    return reply.code(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' } });
  }
  const user = await prisma.user.findUnique({
    where: { id: request.user.sub },
    select: { ageVerified: true },
  });
  if (!user?.ageVerified) {
    return reply.code(403).send({
      success: false,
      error: { code: 'AGE_VERIFICATION_REQUIRED', message: '성인 인증이 필요합니다.' },
    });
  }
}

export default fp(authPlugin, { name: 'auth' });
