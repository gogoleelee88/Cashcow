import type { FastifyPluginAsync } from 'fastify';
import { requireAdmin } from '../../plugins/auth.plugin';
import { adminRateLimit } from '../../plugins/rate-limit.plugin';

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // 모든 어드민 라우트에 인증 + rate limit 적용
  fastify.addHook('preHandler', adminRateLimit);
  fastify.addHook('preHandler', requireAdmin);

  // Health check (어드민 접근 가능 여부 확인용)
  fastify.get('/ping', async () => ({ success: true, message: 'admin ok' }));
};
