import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../plugins/auth.plugin';
import { prismaRead, prisma } from '../lib/prisma';
import { z } from 'zod';

export const userRoutes: FastifyPluginAsync = async (fastify) => {
  // ─────────────────────────────────────────────
  // GET PUBLIC USER PROFILE
  // ─────────────────────────────────────────────
  fastify.get('/:username/profile', {
    handler: async (request, reply) => {
      const { username } = request.params as { username: string };
      const viewerUserId = (request as any).userId as string | undefined;

      const user = await prismaRead.user.findUnique({
        where: { username },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          bio: true,
          role: true,
          subscriptionTier: true,
          isVerified: true,
          createdAt: true,
          _count: {
            select: {
              characters: { where: { isActive: true, visibility: 'PUBLIC' } },
              followers: true,
              following: true,
            },
          },
          characters: {
            where: { isActive: true, visibility: 'PUBLIC' },
            orderBy: { chatCount: 'desc' },
            take: 12,
            select: {
              id: true, name: true, description: true, avatarUrl: true,
              chatCount: true, likeCount: true, isFeatured: true, category: true, tags: true,
            },
          },
        },
      });

      if (!user) {
        return reply.code(404).send({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: '사용자를 찾을 수 없습니다.' },
        });
      }

      let isFollowing = false;
      if (viewerUserId && viewerUserId !== user.id) {
        const follow = await prismaRead.follow.findUnique({
          where: { followerId_followingId: { followerId: viewerUserId, followingId: user.id } },
        });
        isFollowing = !!follow;
      }

      const [totalChatAgg, totalLikeAgg] = await Promise.all([
        prismaRead.character.aggregate({
          where: { creatorId: user.id, isActive: true },
          _sum: { chatCount: true },
        }),
        prismaRead.character.aggregate({
          where: { creatorId: user.id, isActive: true },
          _sum: { likeCount: true },
        }),
      ]);

      const { _count, ...safeUser } = user;

      return reply.send({
        success: true,
        data: {
          ...safeUser,
          characterCount: _count.characters,
          followerCount: _count.followers,
          followingCount: _count.following,
          totalChatCount: totalChatAgg._sum.chatCount ?? 0,
          totalLikeCount: totalLikeAgg._sum.likeCount ?? 0,
          isFollowing,
        },
      });
    },
  });

  // ─────────────────────────────────────────────
  // FOLLOW / UNFOLLOW (toggle)
  // ─────────────────────────────────────────────
  fastify.post('/:username/follow', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { username } = request.params as { username: string };
      const followerId = request.userId!;

      const target = await prismaRead.user.findUnique({
        where: { username },
        select: { id: true },
      });
      if (!target) {
        return reply.code(404).send({ success: false, error: { code: 'USER_NOT_FOUND' } });
      }
      if (target.id === followerId) {
        return reply.code(400).send({ success: false, error: { code: 'CANNOT_FOLLOW_SELF' } });
      }

      const existing = await prisma.follow.findUnique({
        where: { followerId_followingId: { followerId, followingId: target.id } },
      });

      if (existing) {
        await prisma.follow.delete({
          where: { followerId_followingId: { followerId, followingId: target.id } },
        });
        return reply.send({ success: true, data: { following: false } });
      } else {
        await prisma.follow.create({ data: { followerId, followingId: target.id } });
        return reply.send({ success: true, data: { following: true } });
      }
    },
  });

  // ─────────────────────────────────────────────
  // UPDATE OWN PROFILE
  // ─────────────────────────────────────────────
  fastify.patch('/me', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;
      const schema = z.object({
        displayName: z.string().min(1).max(30).optional(),
        bio: z.string().max(200).optional(),
        avatarUrl: z.string().url().nullish(),
      });

      const body = schema.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message },
        });
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: body.data,
        select: {
          id: true, username: true, displayName: true, avatarUrl: true,
          email: true, creditBalance: true, role: true, bio: true,
          subscriptionTier: true, isVerified: true, ageVerified: true,
          createdAt: true, updatedAt: true,
        },
      });

      const { creditBalance, ...rest } = updated as any;
      return reply.send({ success: true, data: { ...rest, credits: creditBalance } });
    },
  });

  // ─────────────────────────────────────────────
  // CREATOR EARNINGS SUMMARY
  // ─────────────────────────────────────────────
  fastify.get('/me/earnings', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [creatorProfile, recentSettlements, currentMonthChats] = await Promise.all([
        prismaRead.creatorProfile.findUnique({
          where: { userId },
          select: { totalEarnings: true, pendingEarnings: true },
        }),
        prismaRead.settlement.findMany({
          where: { creatorId: userId },
          orderBy: { createdAt: 'desc' },
          take: 6,
          include: {
            items: {
              select: {
                characterId: true, characterName: true,
                chatCount: true, creditsEarned: true, amount: true,
              },
            },
          },
        }),
        prismaRead.message.count({
          where: {
            conversation: { character: { creatorId: userId } },
            role: 'ASSISTANT',
            createdAt: { gte: monthStart },
          },
        }),
      ]);

      // Per-character stats this month
      const myChars = await prismaRead.character.findMany({
        where: { creatorId: userId, isActive: true },
        select: { id: true, name: true, avatarUrl: true, chatCount: true, likeCount: true },
        orderBy: { chatCount: 'desc' },
        take: 10,
      });

      return reply.send({
        success: true,
        data: {
          totalEarnings: creatorProfile?.totalEarnings ?? 0,
          pendingEarnings: creatorProfile?.pendingEarnings ?? 0,
          currentMonthChats,
          estimatedCurrentMonthEarnings: Math.floor(currentMonthChats * 0.7 * 10), // 70% of 10 KRW per chat
          settlements: recentSettlements,
          topCharacters: myChars,
        },
      });
    },
  });

  // ─────────────────────────────────────────────
  // SETTLEMENT HISTORY
  // ─────────────────────────────────────────────
  fastify.get('/me/settlements', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;
      const { page = 1, limit = 10 } = request.query as { page?: number; limit?: number };
      const skip = (Number(page) - 1) * Number(limit);

      const [settlements, total] = await Promise.all([
        prismaRead.settlement.findMany({
          where: { creatorId: userId },
          orderBy: { createdAt: 'desc' },
          skip,
          take: Number(limit),
          include: {
            items: {
              select: { characterName: true, chatCount: true, amount: true },
            },
          },
        }),
        prismaRead.settlement.count({ where: { creatorId: userId } }),
      ]);

      return reply.send({
        success: true,
        data: settlements,
        meta: { page: Number(page), limit: Number(limit), total },
      });
    },
  });

  // ─────────────────────────────────────────────
  // ENSURE/UPDATE CREATOR PROFILE
  // ─────────────────────────────────────────────
  fastify.post('/me/creator-profile', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;
      const schema = z.object({
        displayName: z.string().min(1).max(50),
        bio: z.string().max(500).optional(),
        website: z.string().url().optional(),
      });

      const body = schema.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message },
        });
      }

      const profile = await prisma.creatorProfile.upsert({
        where: { userId },
        create: { userId, ...body.data },
        update: body.data,
      });

      await prisma.user.update({
        where: { id: userId },
        data: { role: 'CREATOR' },
      });

      return reply.send({ success: true, data: profile });
    },
  });

  // ─────────────────────────────────────────────
  // NOTIFICATIONS
  // ─────────────────────────────────────────────
  fastify.get('/me/notifications', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;
      const { page = 1, limit = 20 } = request.query as { page?: number; limit?: number };
      const skip = (Number(page) - 1) * Number(limit);

      const [notifications, unreadCount] = await Promise.all([
        prismaRead.notification.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          skip,
          take: Number(limit),
        }),
        prismaRead.notification.count({ where: { userId, isRead: false } }),
      ]);

      return reply.send({
        success: true,
        data: notifications,
        meta: { unreadCount },
      });
    },
  });

  fastify.post('/me/notifications/read-all', {
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

  // ─────────────────────────────────────────────
  // ADULT VERIFICATION — PASS 통신사 인증
  // ─────────────────────────────────────────────

  // Step 1: 인증 세션 시작 (통신사 선택 후 호출)
  fastify.post('/me/age-verify/initiate', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { carrier } = request.body as {
        carrier: 'SKT' | 'KT' | 'LGU' | 'SKT_MVNO' | 'KT_MVNO' | 'LGU_MVNO';
      };

      const CARRIERS = ['SKT', 'KT', 'LGU', 'SKT_MVNO', 'KT_MVNO', 'LGU_MVNO'];
      if (!CARRIERS.includes(carrier)) {
        return reply.status(400).send({ error: '올바른 통신사를 선택해주세요.' });
      }

      const userId = request.userId!;
      const user = await prismaRead.user.findUnique({
        where: { id: userId },
        select: { ageVerified: true },
      });

      if (user?.ageVerified) {
        return reply.status(400).send({ error: '이미 성인인증이 완료된 계정입니다.' });
      }

      // 실제 PASS API 연동 시: 드림시큐리티/KCB에 merchantId, serviceId, txId 요청
      // 현재는 verificationToken을 생성하여 반환 (프론트에서 PASS 앱/웹 딥링크 호출)
      const verificationToken = `pass_${userId}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      // Redis에 토큰 저장 (10분 TTL)
      const { cache } = await import('../lib/redis');
      await cache.setex(`age_verify:${verificationToken}`, 600, JSON.stringify({ userId, carrier, status: 'pending' }));

      // PASS 실제 연동 URL (운영 환경에서는 드림시큐리티 API 호출)
      const passDeepLink = `https://pass.ktmobile.com/auth?token=${verificationToken}&returnUrl=${encodeURIComponent(process.env.FRONTEND_URL || 'http://localhost:3006')}/verify-age/callback`;

      return reply.send({
        verificationToken,
        passDeepLink,
        carrier,
        expiresIn: 600,
      });
    },
  });

  // Step 2: 인증 완료 콜백 (PASS 앱에서 리다이렉트 후 호출)
  fastify.post('/me/age-verify/complete', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { verificationToken } = request.body as { verificationToken: string };
      const userId = request.userId!;

      const { cache } = await import('../lib/redis');
      const raw = await cache.get(`age_verify:${verificationToken}`);

      if (!raw) {
        return reply.status(400).send({ error: '인증 토큰이 만료되었거나 올바르지 않습니다.' });
      }

      const session = JSON.parse(raw) as { userId: string; carrier: string; status: string };
      if (session.userId !== userId) {
        return reply.status(403).send({ error: '인증 정보가 일치하지 않습니다.' });
      }

      // 인증 완료 처리
      await prisma.user.update({
        where: { id: userId },
        data: { ageVerified: true, ageVerifiedAt: new Date() },
      });

      await cache.del(`age_verify:${verificationToken}`);

      return reply.send({ success: true, message: '성인인증이 완료되었습니다.' });
    },
  });

  // 인증 상태 확인
  fastify.get('/me/age-verify/status', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;
      const user = await prismaRead.user.findUnique({
        where: { id: userId },
        select: { ageVerified: true, ageVerifiedAt: true },
      });
      return reply.send({
        isVerified: user?.ageVerified ?? false,
        verifiedAt: user?.ageVerifiedAt ?? null,
      });
    },
  });
};
