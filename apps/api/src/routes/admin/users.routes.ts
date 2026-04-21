import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma';
import { createAuditLog } from '../../lib/audit';

export const usersRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /admin/users
  fastify.get<{
    Querystring: {
      page?: string; limit?: string; search?: string;
      role?: string; subscriptionTier?: string;
      isBanned?: string; sort?: string; order?: string;
    };
  }>('/', async (request) => {
    const {
      page = '1', limit = '25', search,
      role, subscriptionTier, isBanned,
      sort = 'createdAt', order = 'desc',
    } = request.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role) where.role = role;
    if (subscriptionTier) where.subscriptionTier = subscriptionTier;
    if (isBanned !== undefined) where.isBanned = isBanned === 'true';

    const validSorts = ['createdAt', 'creditBalance', 'lastLoginAt'];
    const sortField = validSorts.includes(sort) ? sort : 'createdAt';
    const orderDir = order === 'asc' ? 'asc' : 'desc';

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { [sortField]: orderDir },
        skip,
        take: limitNum,
        select: {
          id: true, email: true, username: true, displayName: true,
          avatarUrl: true, role: true, subscriptionTier: true,
          creditBalance: true, isBanned: true, banReason: true,
          bannedUntil: true, isActive: true, isVerified: true,
          ageVerified: true, lastLoginAt: true, createdAt: true,
          _count: { select: { characters: true, conversations: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      success: true,
      data: {
        users,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  });

  // GET /admin/users/:id
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, username: true, displayName: true,
        avatarUrl: true, bio: true, role: true, subscriptionTier: true,
        creditBalance: true, isBanned: true, banReason: true,
        bannedUntil: true, isActive: true, isVerified: true,
        ageVerified: true, ageVerifiedAt: true, lastLoginAt: true,
        createdAt: true, updatedAt: true,
        oauthAccounts: { select: { provider: true, createdAt: true } },
        characters: {
          select: { id: true, name: true, chatCount: true, isActive: true, createdAt: true },
          orderBy: { chatCount: 'desc' },
          take: 10,
        },
        reports: {
          where: {},
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true, reason: true, status: true, createdAt: true,
            reported: { select: { id: true, username: true, avatarUrl: true } },
          },
        },
        reportedContent: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true, reason: true, status: true, createdAt: true,
            reporter: { select: { id: true, username: true, avatarUrl: true } },
          },
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true, type: true, amount: true, credits: true,
            status: true, description: true, createdAt: true,
          },
        },
        refreshTokens: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, createdAt: true, expiresAt: true },
        },
      },
    });

    if (!user) return reply.status(404).send({ success: false, error: 'User not found' });
    return { success: true, data: { user } };
  });

  // PATCH /admin/users/:id/role
  fastify.patch<{ Params: { id: string }; Body: { role: string } }>(
    '/:id/role',
    async (request, reply) => {
      const { id } = request.params;
      const { role } = request.body;

      if (!['USER', 'CREATOR', 'ADMIN'].includes(role)) {
        return reply.status(400).send({ success: false, error: 'Invalid role' });
      }
      if (id === request.userId) {
        return reply.status(400).send({ success: false, error: '본인 권한은 변경할 수 없습니다' });
      }

      const old = await prisma.user.findUnique({ where: { id }, select: { role: true } });
      if (!old) return reply.status(404).send({ success: false, error: 'User not found' });

      const updated = await prisma.user.update({
        where: { id },
        data: { role: role as never },
        select: { id: true, role: true },
      });

      await createAuditLog(request, {
        action: 'UPDATE',
        entityType: 'User',
        entityId: id,
        oldData: { role: old.role },
        newData: { role },
      });

      return { success: true, data: updated };
    }
  );

  // POST /admin/users/:id/ban
  fastify.post<{
    Params: { id: string };
    Body: { reason: string; duration: number | null };
  }>('/:id/ban', async (request, reply) => {
    const { id } = request.params;
    const { reason, duration } = request.body;

    if (!reason || reason.length < 5) {
      return reply.status(400).send({ success: false, error: '정지 사유는 5자 이상 입력하세요' });
    }

    const bannedUntil = duration
      ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000)
      : null;

    const user = await prisma.user.update({
      where: { id },
      data: { isBanned: true, banReason: reason, bannedUntil },
      select: { id: true, isBanned: true, banReason: true, bannedUntil: true },
    });

    await createAuditLog(request, {
      action: 'SUSPENSION',
      entityType: 'User',
      entityId: id,
      newData: { reason, duration },
    });

    return { success: true, data: user };
  });

  // POST /admin/users/:id/unban
  fastify.post<{ Params: { id: string } }>('/:id/unban', async (request, reply) => {
    const { id } = request.params;

    const user = await prisma.user.update({
      where: { id },
      data: { isBanned: false, banReason: null, bannedUntil: null },
      select: { id: true, isBanned: true },
    });

    await createAuditLog(request, {
      action: 'RESTORE',
      entityType: 'User',
      entityId: id,
    });

    return { success: true, data: user };
  });

  // POST /admin/users/:id/credits
  fastify.post<{
    Params: { id: string };
    Body: { amount: number; reason: string };
  }>('/:id/credits', async (request, reply) => {
    const { id } = request.params;
    const { amount, reason } = request.body;

    if (!amount || !reason) {
      return reply.status(400).send({ success: false, error: '금액과 사유는 필수입니다' });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { creditBalance: true },
    });
    if (!user) return reply.status(404).send({ success: false, error: 'User not found' });

    const newBalance = user.creditBalance + amount;
    if (newBalance < 0) {
      return reply.status(400).send({ success: false, error: '크레딧이 부족합니다' });
    }

    const [updated] = await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: { creditBalance: newBalance },
        select: { id: true, creditBalance: true },
      }),
      prisma.transaction.create({
        data: {
          userId: id,
          type: 'BONUS',
          amount: 0,
          credits: amount,
          status: 'COMPLETED',
          description: `[관리자] ${reason}`,
        },
      }),
    ]);

    await createAuditLog(request, {
      action: 'UPDATE',
      entityType: 'User',
      entityId: id,
      oldData: { creditBalance: user.creditBalance },
      newData: { creditBalance: newBalance, reason },
    });

    return { success: true, data: updated };
  });
};
