import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { getRedis } from '../lib/redis';
import { logger } from '../lib/logger';

interface RateLimitOptions {
  windowSeconds: number;
  maxRequests: number;
  keyPrefix: string;
  skipIfAuth?: boolean;   // Stricter for unauthenticated
  onBlocked?: (req: FastifyRequest) => void;
}

/**
 * Layered rate limiter:
 * Layer 1: Global per-IP
 * Layer 2: Per-user (authenticated)
 * Layer 3: Per-endpoint (e.g., auth endpoints, chat)
 */
export function createRateLimiter(opts: RateLimitOptions) {
  return async function rateLimitHandler(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const redis = getRedis();
    const ip = request.ip;
    const userId = request.userId;

    // Use user ID if authenticated (more permissive), else IP
    const identifier = userId
      ? `user:${userId}`
      : `ip:${ip}`;

    const key = `rl:${opts.keyPrefix}:${identifier}`;

    const multi = redis.multi();
    multi.incr(key);
    multi.ttl(key);
    const results = await multi.exec();

    const count = results?.[0]?.[1] as number;
    const ttl = results?.[1]?.[1] as number;

    // Set expiry on first request
    if (count === 1) {
      await redis.expire(key, opts.windowSeconds);
    }

    // Set rate limit headers
    reply.header('X-RateLimit-Limit', opts.maxRequests);
    reply.header('X-RateLimit-Remaining', Math.max(0, opts.maxRequests - count));
    reply.header('X-RateLimit-Reset', ttl > 0 ? ttl : opts.windowSeconds);

    if (count > opts.maxRequests) {
      opts.onBlocked?.(request);
      logger.warn({ key, count, ip, userId }, 'Rate limit exceeded');
      return reply.code(429).send({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
        },
      });
    }
  };
}

// Pre-defined rate limiters
export const globalRateLimit = createRateLimiter({
  windowSeconds: 60,
  maxRequests: 300,
  keyPrefix: 'global',
});

export const authRateLimit = createRateLimiter({
  windowSeconds: 900, // 15 minutes
  maxRequests: 10,
  keyPrefix: 'auth',
  onBlocked: (req) => logger.warn({ ip: req.ip }, 'Auth rate limit blocked'),
});

export const chatRateLimit = createRateLimiter({
  windowSeconds: 60,
  maxRequests: 30,
  keyPrefix: 'chat',
});

export const searchRateLimit = createRateLimiter({
  windowSeconds: 60,
  maxRequests: 60,
  keyPrefix: 'search',
});

export const uploadRateLimit = createRateLimiter({
  windowSeconds: 3600,
  maxRequests: 20,
  keyPrefix: 'upload',
});

export const adminRateLimit = createRateLimiter({
  windowSeconds: 60,
  maxRequests: 1000,
  keyPrefix: 'admin',
});

const rateLimitPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', globalRateLimit);
};

export default fp(rateLimitPlugin, { name: 'rate-limit' });
