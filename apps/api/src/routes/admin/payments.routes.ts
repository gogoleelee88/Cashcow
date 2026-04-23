import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma';
import { createAuditLog } from '../../lib/audit';

export const paymentsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /admin/payments/transactions
  fastify.get<{
    Querystring: { page?: string; limit?: string; status?: string; type?: string; search?: string };
  }>('/transactions', async (request) => {
    const { page = '1', limit = '25', status, type, search } = request.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { username: { contains: search, mode: 'insensitive' } } },
        { providerOrderId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        select: {
          id: true, type: true, amount: true, credits: true, status: true,
          provider: true, providerOrderId: true, providerPaymentId: true,
          description: true, refundedAt: true, createdAt: true,
          user: { select: { id: true, email: true, username: true, displayName: true, avatarUrl: true } },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    const [totalRevenue, todayRevenue] = await Promise.all([
      prisma.transaction.aggregate({
        where: { type: 'PURCHASE', status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          type: 'PURCHASE', status: 'COMPLETED',
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      success: true,
      data: {
        transactions,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
        summary: {
          totalRevenue: totalRevenue._sum.amount ?? 0,
          todayRevenue: todayRevenue._sum.amount ?? 0,
        },
      },
    };
  });

  // GET /admin/payments/transactions/:id
  fastify.get<{ Params: { id: string } }>('/transactions/:id', async (request, reply) => {
    const tx = await prisma.transaction.findUnique({
      where: { id: request.params.id },
      select: {
        id: true, type: true, amount: true, credits: true, status: true,
        provider: true, providerOrderId: true, providerPaymentId: true,
        webhookVerified: true, description: true, metadata: true,
        refundedAt: true, createdAt: true, updatedAt: true,
        user: { select: { id: true, email: true, username: true, displayName: true, avatarUrl: true } },
      },
    });
    if (!tx) return reply.status(404).send({ success: false, error: 'Not found' });
    return { success: true, data: tx };
  });

  // POST /admin/payments/transactions/:id/refund
  fastify.post<{ Params: { id: string }; Body: { reason?: string } }>(
    '/transactions/:id/refund',
    async (request, reply) => {
      const { id } = request.params;
      const { reason } = request.body ?? {};

      const tx = await prisma.transaction.findUnique({
        where: { id },
        select: { status: true, type: true, userId: true, credits: true, amount: true },
      });
      if (!tx) return reply.status(404).send({ success: false, error: 'Not found' });
      if (tx.status !== 'COMPLETED') {
        return reply.status(400).send({ success: false, error: '완료된 결제만 환불 가능합니다' });
      }

      await prisma.$transaction([
        prisma.transaction.update({
          where: { id },
          data: { status: 'REFUNDED', refundedAt: new Date() },
        }),
        ...(tx.credits > 0 ? [
          prisma.user.update({
            where: { id: tx.userId },
            data: { creditBalance: { decrement: tx.credits } },
          }),
          prisma.transaction.create({
            data: {
              userId: tx.userId,
              type: 'REFUND',
              amount: -tx.amount,
              credits: -tx.credits,
              status: 'COMPLETED',
              description: `환불 처리: ${reason ?? '관리자 환불'}`,
            },
          }),
        ] : []),
      ]);

      await createAuditLog(request, {
        action: 'UPDATE',
        entityType: 'Transaction',
        entityId: id,
        newData: { refunded: true, reason },
      });

      return { success: true };
    }
  );

  // GET /admin/payments/settlements
  fastify.get<{
    Querystring: { page?: string; limit?: string; status?: string; search?: string };
  }>('/settlements', async (request) => {
    const { page = '1', limit = '25', status, search } = request.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (search) {
      where.creator = { OR: [
        { email: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
      ]};
    }

    const [settlements, total] = await Promise.all([
      prisma.settlement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        select: {
          id: true, periodStart: true, periodEnd: true,
          totalChats: true, grossAmount: true, platformFeeRate: true,
          platformFee: true, netAmount: true, status: true,
          paidAt: true, notes: true, createdAt: true,
          creator: { select: { id: true, email: true, username: true, displayName: true, avatarUrl: true } },
          items: { select: { id: true, characterName: true, chatCount: true, creditsEarned: true, amount: true } },
        },
      }),
      prisma.settlement.count({ where }),
    ]);

    const totals = await prisma.settlement.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { netAmount: true, grossAmount: true },
    });

    return {
      success: true,
      data: {
        settlements,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
        summary: {
          totalPaid: totals._sum.netAmount ?? 0,
          totalGross: totals._sum.grossAmount ?? 0,
        },
      },
    };
  });

  // PATCH /admin/payments/settlements/:id/status
  fastify.patch<{
    Params: { id: string };
    Body: { status: string; notes?: string };
  }>('/settlements/:id/status', async (request, reply) => {
    const { id } = request.params;
    const { status, notes } = request.body;

    const validStatuses = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'];
    if (!validStatuses.includes(status)) {
      return reply.status(400).send({ success: false, error: '유효하지 않은 상태입니다' });
    }

    const updated = await prisma.settlement.update({
      where: { id },
      data: {
        status: status as 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED',
        notes,
        ...(status === 'COMPLETED' ? { paidAt: new Date() } : {}),
      },
      select: { id: true, status: true, paidAt: true },
    });

    await createAuditLog(request, {
      action: 'UPDATE',
      entityType: 'Settlement',
      entityId: id,
      newData: { status, notes },
    });

    return { success: true, data: updated };
  });

  // GET /admin/payments/subscriptions
  fastify.get<{
    Querystring: { page?: string; limit?: string; status?: string; tier?: string };
  }>('/subscriptions', async (request) => {
    const { page = '1', limit = '25', status, tier } = request.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (tier) where.tier = tier;

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        select: {
          id: true, tier: true, provider: true, status: true,
          currentPeriodStart: true, currentPeriodEnd: true,
          cancelAtPeriodEnd: true, cancelledAt: true, createdAt: true,
          user: { select: { id: true, email: true, username: true, displayName: true, avatarUrl: true } },
        },
      }),
      prisma.subscription.count({ where }),
    ]);

    return {
      success: true,
      data: {
        subscriptions,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  });
};
