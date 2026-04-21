import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma';
import { createAuditLog } from '../../lib/audit';

export const moderationRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /admin/reports
  fastify.get<{
    Querystring: { page?: string; limit?: string; status?: string; sort?: string };
  }>('/reports', async (request) => {
    const { page = '1', limit = '25', status, sort = 'createdAt' } = request.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (status && status !== 'ALL') where.status = status;

    const validSorts = ['createdAt', 'status'];
    const sortField = validSorts.includes(sort) ? sort : 'createdAt';

    const [reports, total, counts] = await Promise.all([
      prisma.report.findMany({
        where,
        orderBy: { [sortField]: 'desc' },
        skip,
        take: limitNum,
        select: {
          id: true, reason: true, description: true, status: true,
          createdAt: true, resolvedAt: true, resolveNote: true,
          reporter: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          reported: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          character: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
      prisma.report.count({ where }),
      prisma.report.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);

    const statusCounts = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));

    return {
      success: true,
      data: {
        reports,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
        statusCounts,
      },
    };
  });

  // GET /admin/reports/:id
  fastify.get<{ Params: { id: string } }>('/reports/:id', async (request, reply) => {
    const report = await prisma.report.findUnique({
      where: { id: request.params.id },
      select: {
        id: true, reason: true, description: true, status: true,
        createdAt: true, resolvedAt: true, reviewedAt: true, resolveNote: true,
        resolvedBy: true, reviewedBy: true,
        reporter: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        reported: { select: { id: true, username: true, displayName: true, avatarUrl: true, isBanned: true } },
        character: { select: { id: true, name: true, avatarUrl: true, isActive: true } },
      },
    });
    if (!report) return reply.status(404).send({ success: false, error: 'Not found' });

    // 같은 피신고자의 이전 처리 이력
    const history = await prisma.report.findMany({
      where: { reportedId: report.reported.id, id: { not: report.id } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, reason: true, status: true, createdAt: true },
    });

    return { success: true, data: { report, history } };
  });

  // PATCH /admin/reports/:id/review
  fastify.patch<{ Params: { id: string } }>('/reports/:id/review', async (request, reply) => {
    const { id } = request.params;
    const existing = await prisma.report.findUnique({ where: { id }, select: { status: true } });
    if (!existing) return reply.status(404).send({ success: false, error: 'Not found' });
    if (existing.status !== 'PENDING') {
      return reply.status(400).send({ success: false, error: '이미 처리된 신고입니다' });
    }

    const updated = await prisma.report.update({
      where: { id },
      data: { status: 'REVIEWING', reviewedBy: request.userId, reviewedAt: new Date() },
      select: { id: true, status: true },
    });
    return { success: true, data: updated };
  });

  // POST /admin/reports/:id/resolve
  fastify.post<{
    Params: { id: string };
    Body: { action: string; note?: string; banReason?: string; banDuration?: number | null };
  }>('/reports/:id/resolve', async (request, reply) => {
    const { id } = request.params;
    const { action, note, banReason, banDuration } = request.body;

    const report = await prisma.report.findUnique({
      where: { id },
      select: { status: true, reportedId: true, characterId: true },
    });
    if (!report) return reply.status(404).send({ success: false, error: 'Not found' });
    if (report.status === 'RESOLVED' || report.status === 'DISMISSED') {
      return reply.status(400).send({ success: false, error: '이미 처리된 신고입니다' });
    }

    // action에 따른 부가 처리
    if (action === 'HIDE_CONTENT' && report.characterId) {
      await prisma.character.update({ where: { id: report.characterId }, data: { isActive: false } });
    }
    if (action === 'BAN_USER') {
      const bannedUntil = banDuration ? new Date(Date.now() + banDuration * 24 * 60 * 60 * 1000) : null;
      await prisma.user.update({
        where: { id: report.reportedId },
        data: { isBanned: true, banReason: banReason ?? note ?? '신고 처리로 인한 정지', bannedUntil },
      });
      await createAuditLog(request, { action: 'SUSPENSION', entityType: 'User', entityId: report.reportedId, newData: { reason: 'report', banDuration } });
    }

    const updated = await prisma.report.update({
      where: { id },
      data: { status: 'RESOLVED', resolvedBy: request.userId, resolvedAt: new Date(), resolveNote: note },
      select: { id: true, status: true },
    });

    await createAuditLog(request, { action: 'UPDATE', entityType: 'Report', entityId: id, newData: { action, note } });
    return { success: true, data: updated };
  });

  // POST /admin/reports/:id/dismiss
  fastify.post<{ Params: { id: string }; Body: { reason: string } }>(
    '/reports/:id/dismiss',
    async (request, reply) => {
      const { id } = request.params;
      const { reason } = request.body;

      const updated = await prisma.report.update({
        where: { id },
        data: { status: 'DISMISSED', resolvedBy: request.userId, resolvedAt: new Date(), resolveNote: reason },
        select: { id: true, status: true },
      });
      await createAuditLog(request, { action: 'UPDATE', entityType: 'Report', entityId: id, newData: { dismissed: true, reason } });
      return { success: true, data: updated };
    }
  );

  // GET /admin/bans
  fastify.get<{ Querystring: { page?: string; limit?: string; search?: string } }>(
    '/bans',
    async (request) => {
      const { page = '1', limit = '25', search } = request.query;
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, parseInt(limit));
      const skip = (pageNum - 1) * limitNum;

      const where: Record<string, unknown> = { isBanned: true };
      if (search) {
        where.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { username: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          skip,
          take: limitNum,
          select: {
            id: true, email: true, username: true, displayName: true, avatarUrl: true,
            banReason: true, bannedUntil: true, updatedAt: true,
          },
        }),
        prisma.user.count({ where }),
      ]);

      return { success: true, data: { users, total, page: pageNum, totalPages: Math.ceil(total / limitNum) } };
    }
  );

  // POST /admin/bans/:id/unban
  fastify.post<{ Params: { id: string } }>('/bans/:id/unban', async (request) => {
    const updated = await prisma.user.update({
      where: { id: request.params.id },
      data: { isBanned: false, banReason: null, bannedUntil: null },
      select: { id: true, isBanned: true },
    });
    await createAuditLog(request, { action: 'RESTORE', entityType: 'User', entityId: request.params.id });
    return { success: true, data: updated };
  });
};
