import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma';
import { cache } from '../../lib/redis';

export const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /admin/dashboard/stats
  fastify.get('/stats', async () => {
    return cache.remember('admin:dashboard:stats', 300, async () => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [
        totalUsers,
        todayNewUsers,
        weeklyActiveUsers,
        totalCharacters,
        totalStories,
        todayChats,
        todayRevenue,
        thisMonthRevenue,
        totalRevenue,
        pendingReports,
        bannedUsers,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
        prisma.user.count({ where: { lastLoginAt: { gte: weekAgo } } }),
        prisma.character.count({ where: { isActive: true } }),
        prisma.story.count(),
        prisma.conversation.count({ where: { createdAt: { gte: todayStart } } }),
        prisma.transaction.aggregate({
          where: { type: 'PURCHASE', status: 'COMPLETED', createdAt: { gte: todayStart } },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: {
            type: 'PURCHASE',
            status: 'COMPLETED',
            createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
          },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: { type: 'PURCHASE', status: 'COMPLETED' },
          _sum: { amount: true },
        }),
        prisma.report.count({ where: { status: 'PENDING' } }),
        prisma.user.count({ where: { isBanned: true } }),
      ]);

      return {
        users: { total: totalUsers, todayNew: todayNewUsers, weeklyActive: weeklyActiveUsers },
        content: { characters: totalCharacters, stories: totalStories, todayChats },
        revenue: {
          today: todayRevenue._sum.amount ?? 0,
          thisMonth: thisMonthRevenue._sum.amount ?? 0,
          total: totalRevenue._sum.amount ?? 0,
        },
        moderation: { pendingReports, bannedUsers },
      };
    });
  });

  // GET /admin/dashboard/chart/users — 최근 30일 신규 가입
  fastify.get('/chart/users', async () => {
    return cache.remember('admin:dashboard:chart:users', 300, async () => {
      const rows = await prisma.$queryRaw<{ date: string; count: bigint }[]>`
        SELECT DATE("createdAt")::text AS date, COUNT(*)::bigint AS count
        FROM users
        WHERE "createdAt" >= NOW() - INTERVAL '30 days'
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `;
      return rows.map((r) => ({ date: r.date, count: Number(r.count) }));
    });
  });

  // GET /admin/dashboard/chart/chats — 최근 30일 채팅 수
  fastify.get('/chart/chats', async () => {
    return cache.remember('admin:dashboard:chart:chats', 300, async () => {
      const rows = await prisma.$queryRaw<{ date: string; count: bigint }[]>`
        SELECT DATE("createdAt")::text AS date, COUNT(*)::bigint AS count
        FROM conversations
        WHERE "createdAt" >= NOW() - INTERVAL '30 days'
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `;
      return rows.map((r) => ({ date: r.date, count: Number(r.count) }));
    });
  });

  // GET /admin/dashboard/chart/revenue — 최근 30일 수익
  fastify.get('/chart/revenue', async () => {
    return cache.remember('admin:dashboard:chart:revenue', 300, async () => {
      const rows = await prisma.$queryRaw<{ date: string; amount: bigint }[]>`
        SELECT DATE("createdAt")::text AS date, COALESCE(SUM(amount), 0)::bigint AS amount
        FROM transactions
        WHERE type = 'PURCHASE' AND status = 'COMPLETED'
          AND "createdAt" >= NOW() - INTERVAL '30 days'
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `;
      return rows.map((r) => ({ date: r.date, amount: Number(r.amount) }));
    });
  });

  // GET /admin/dashboard/top-characters — 이번달 TOP 10
  fastify.get('/top-characters', async () => {
    return cache.remember('admin:dashboard:top-characters', 300, async () => {
      const characters = await prisma.character.findMany({
        where: { isActive: true },
        orderBy: { chatCount: 'desc' },
        take: 10,
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          chatCount: true,
          creator: { select: { displayName: true } },
        },
      });
      return characters.map((c) => ({
        id: c.id,
        name: c.name,
        avatarUrl: c.avatarUrl,
        chatCount: c.chatCount,
        creatorName: c.creator.displayName,
      }));
    });
  });
};
