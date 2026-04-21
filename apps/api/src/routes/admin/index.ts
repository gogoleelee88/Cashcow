import type { FastifyPluginAsync } from 'fastify';
import { requireAdmin } from '../../plugins/auth.plugin';
import { adminRateLimit } from '../../plugins/rate-limit.plugin';
import { dashboardRoutes } from './dashboard.routes';
import { usersRoutes } from './users.routes';
import { moderationRoutes } from './moderation.routes';

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', adminRateLimit);
  fastify.addHook('preHandler', requireAdmin);

  fastify.get('/ping', async () => ({ success: true, message: 'admin ok' }));

  fastify.register(dashboardRoutes, { prefix: '/dashboard' });
  fastify.register(usersRoutes, { prefix: '/users' });
  fastify.register(moderationRoutes, { prefix: '/moderation' });
};
