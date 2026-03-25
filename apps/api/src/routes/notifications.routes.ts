import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../plugins/auth.plugin';
import { prismaRead, prisma } from '../lib/prisma';

export const notificationRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /notifications
  fastify.get('/', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;

      const notifications = await prismaRead.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      return reply.send({
        notifications,
        unreadCount: notifications.filter((n) => !n.isRead).length,
      });
    },
  });

  // PATCH /notifications/:id/read
  fastify.patch('/:id/read', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId = request.userId!;

      await prisma.notification.updateMany({
        where: { id, userId },
        data: { isRead: true },
      });

      return reply.send({ success: true });
    },
  });

  // POST /notifications/read-all
  fastify.post('/read-all', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;

      await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });

      return reply.send({ success: true });
    },
  });
};
