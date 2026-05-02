import type { FastifyPluginAsync } from 'fastify';
import { requireAdmin } from '../../plugins/auth.plugin';
import { adminRateLimit } from '../../plugins/rate-limit.plugin';
import { dashboardRoutes } from './dashboard.routes';
import { usersRoutes } from './users.routes';
import { moderationRoutes } from './moderation.routes';
import { paymentsRoutes } from './payments.routes';
import { officialRoutes } from './official.routes';
import { notificationsAdminRoutes } from './notifications.routes';
import { postsAdminRoutes } from './posts.routes';

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', adminRateLimit);
  fastify.addHook('preHandler', requireAdmin);

  fastify.get('/ping', async () => ({ success: true, message: 'admin ok' }));

  fastify.register(dashboardRoutes, { prefix: '/dashboard' });
  fastify.register(usersRoutes, { prefix: '/users' });
  fastify.register(moderationRoutes, { prefix: '/moderation' });
  fastify.register(paymentsRoutes, { prefix: '/payments' });
  fastify.register(officialRoutes, { prefix: '/official' });
  fastify.register(notificationsAdminRoutes, { prefix: '/notifications' });
  fastify.register(postsAdminRoutes, { prefix: '/posts' });
};
