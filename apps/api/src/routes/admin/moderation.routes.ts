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

  // ─────────────────────────────────────────────
  // MESSAGE MODERATION
  // ─────────────────────────────────────────────

  // GET /admin/moderation/messages — 최근 AI 응답 목록
  fastify.get<{
    Querystring: { page?: string; limit?: string; characterId?: string; flagged?: string; hidden?: string };
  }>('/messages', async (request) => {
    const { page = '1', limit = '25', characterId, flagged, hidden } = request.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where: any = { role: 'ASSISTANT' };
    if (characterId) where.conversation = { characterId };
    if (flagged === 'true') where.flags = { some: { status: 'PENDING' } };
    if (hidden === 'true') where.isHidden = true;
    if (hidden === 'false') where.isHidden = false;

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        select: {
          id: true, content: true, isHidden: true, hiddenReason: true, hiddenAt: true,
          isFiltered: true, createdAt: true,
          flags: { select: { id: true, category: true, confidence: true, status: true } },
          conversation: {
            select: {
              id: true,
              character: { select: { id: true, name: true, avatarUrl: true } },
              user: { select: { id: true, username: true } },
            },
          },
        },
      }),
      prisma.message.count({ where }),
    ]);

    return { success: true, data: { messages, total, page: pageNum, totalPages: Math.ceil(total / limitNum) } };
  });

  // GET /admin/moderation/conversations/:id — 대화 전체 조회
  fastify.get<{ Params: { id: string } }>('/conversations/:id', async (request, reply) => {
    const { id } = request.params;

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        character: { select: { id: true, name: true, avatarUrl: true } },
        user: { select: { id: true, username: true, displayName: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true, role: true, content: true, isHidden: true,
            hiddenReason: true, hiddenBy: true, hiddenAt: true,
            isFiltered: true, createdAt: true,
            flags: { select: { id: true, category: true, confidence: true, status: true } },
          },
        },
      },
    });

    if (!conversation) return reply.status(404).send({ success: false, error: '대화를 찾을 수 없습니다' });
    return { success: true, data: conversation };
  });

  // PATCH /admin/moderation/messages/:id/hide — 메시지 숨김
  fastify.patch<{ Params: { id: string }; Body: { reason: string } }>(
    '/messages/:id/hide',
    async (request, reply) => {
      const { id } = request.params;
      const { reason } = request.body;

      if (!reason?.trim()) {
        return reply.status(400).send({ success: false, error: '숨김 사유를 입력해주세요' });
      }

      const message = await prisma.message.findUnique({ where: { id }, select: { id: true, isHidden: true } });
      if (!message) return reply.status(404).send({ success: false, error: '메시지를 찾을 수 없습니다' });

      const updated = await prisma.message.update({
        where: { id },
        data: { isHidden: true, hiddenReason: reason, hiddenBy: request.userId, hiddenAt: new Date() },
        select: { id: true, isHidden: true, hiddenReason: true, hiddenAt: true },
      });

      await createAuditLog(request, { action: 'UPDATE', entityType: 'Message', entityId: id, newData: { isHidden: true, reason } });
      return { success: true, data: updated };
    }
  );

  // PATCH /admin/moderation/messages/:id/unhide — 메시지 숨김 해제
  fastify.patch<{ Params: { id: string } }>('/messages/:id/unhide', async (request, reply) => {
    const { id } = request.params;

    const message = await prisma.message.findUnique({ where: { id }, select: { id: true, isHidden: true } });
    if (!message) return reply.status(404).send({ success: false, error: '메시지를 찾을 수 없습니다' });

    const updated = await prisma.message.update({
      where: { id },
      data: { isHidden: false, hiddenReason: null, hiddenBy: null, hiddenAt: null },
      select: { id: true, isHidden: true },
    });

    await createAuditLog(request, { action: 'UPDATE', entityType: 'Message', entityId: id, newData: { isHidden: false } });
    return { success: true, data: updated };
  });

  // GET /admin/moderation/flags — 플래그 큐
  fastify.get<{ Querystring: { page?: string; limit?: string; status?: string } }>(
    '/flags',
    async (request) => {
      const { page = '1', limit = '25', status = 'PENDING' } = request.query;
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      const where: any = {};
      if (status && status !== 'ALL') where.status = status;

      const [flags, total] = await Promise.all([
        prisma.moderationFlag.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum,
          select: {
            id: true, category: true, confidence: true, status: true,
            autoHidden: true, createdAt: true,
            message: {
              select: {
                id: true, content: true, isHidden: true, createdAt: true,
                conversation: {
                  select: {
                    id: true,
                    character: { select: { id: true, name: true } },
                    user: { select: { id: true, username: true } },
                  },
                },
              },
            },
          },
        }),
        prisma.moderationFlag.count({ where }),
      ]);

      return { success: true, data: { flags, total, page: pageNum, totalPages: Math.ceil(total / limitNum) } };
    }
  );

  // POST /admin/moderation/flags/:id/confirm — 유해 확정 → 숨김
  fastify.post<{ Params: { id: string } }>('/flags/:id/confirm', async (request, reply) => {
    const { id } = request.params;

    const flag = await prisma.moderationFlag.findUnique({
      where: { id },
      select: { id: true, messageId: true, status: true },
    });
    if (!flag) return reply.status(404).send({ success: false, error: '플래그를 찾을 수 없습니다' });

    await prisma.$transaction([
      prisma.moderationFlag.update({
        where: { id },
        data: { status: 'REVIEWED', reviewedBy: request.userId, reviewedAt: new Date() },
      }),
      prisma.message.update({
        where: { id: flag.messageId },
        data: { isHidden: true, hiddenReason: '자동 감지 유해 콘텐츠 확정', hiddenBy: request.userId, hiddenAt: new Date() },
      }),
    ]);

    await createAuditLog(request, { action: 'UPDATE', entityType: 'ModerationFlag', entityId: id, newData: { confirmed: true } });
    return { success: true };
  });

  // POST /admin/moderation/flags/:id/dismiss — 무해 판정
  fastify.post<{ Params: { id: string } }>('/flags/:id/dismiss', async (request, reply) => {
    const { id } = request.params;

    const flag = await prisma.moderationFlag.findUnique({ where: { id }, select: { id: true } });
    if (!flag) return reply.status(404).send({ success: false, error: '플래그를 찾을 수 없습니다' });

    await prisma.moderationFlag.update({
      where: { id },
      data: { status: 'DISMISSED', reviewedBy: request.userId, reviewedAt: new Date() },
    });

    await createAuditLog(request, { action: 'UPDATE', entityType: 'ModerationFlag', entityId: id, newData: { dismissed: true } });
    return { success: true };
  });

  // GET /admin/moderation/stats — 모더레이션 통계
  fastify.get('/stats', async () => {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [totalMessages, hiddenMessages, pendingFlags, recentFlags, pendingReports] = await Promise.all([
      prisma.message.count({ where: { createdAt: { gte: since24h } } }),
      prisma.message.count({ where: { isHidden: true, hiddenAt: { gte: since24h } } }),
      prisma.moderationFlag.count({ where: { status: 'PENDING' } }),
      prisma.moderationFlag.count({ where: { createdAt: { gte: since7d } } }),
      prisma.report.count({ where: { status: 'PENDING' } }),
    ]);

    return {
      success: true,
      data: { totalMessages, hiddenMessages, pendingFlags, recentFlags, pendingReports },
    };
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

  // ─────────────────────────────────────────────
  // CHARACTER REVIEW QUEUE
  // ─────────────────────────────────────────────

  // GET /admin/moderation/character-reviews — 검수 대기 캐릭터 목록
  fastify.get<{
    Querystring: { page?: string; limit?: string; status?: string };
  }>('/character-reviews', async (request) => {
    const { page = '1', limit = '25', status = 'NEEDS_REVIEW' } = request.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (status && status !== 'ALL') where.reviewStatus = status;

    const [characters, total] = await Promise.all([
      prisma.character.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        select: {
          id: true, name: true, description: true, avatarUrl: true,
          category: true, ageRating: true, reviewStatus: true, reviewNote: true,
          isActive: true, createdAt: true,
          creator: { select: { id: true, username: true, displayName: true } },
        },
      }),
      prisma.character.count({ where }),
    ]);

    return { success: true, data: { characters, total, page: pageNum, totalPages: Math.ceil(total / limitNum) } };
  });

  // POST /admin/moderation/character-reviews/:id/approve — 검수 승인
  fastify.post<{ Params: { id: string }; Body: { note?: string } }>(
    '/character-reviews/:id/approve',
    async (request, reply) => {
      const { id } = request.params;
      const { note } = request.body ?? {};

      const character = await prisma.character.findUnique({ where: { id }, select: { id: true, reviewStatus: true } });
      if (!character) return reply.code(404).send({ success: false, error: '캐릭터를 찾을 수 없습니다' });

      await prisma.character.update({
        where: { id },
        data: { reviewStatus: 'APPROVED', reviewNote: note ?? null, reviewedBy: request.userId, reviewedAt: new Date() },
      });

      await createAuditLog(request, { action: 'UPDATE', entityType: 'Character', entityId: id, newData: { reviewStatus: 'APPROVED' } });
      return { success: true };
    }
  );

  // POST /admin/moderation/character-reviews/:id/reject — 검수 거절
  fastify.post<{ Params: { id: string }; Body: { note: string } }>(
    '/character-reviews/:id/reject',
    async (request, reply) => {
      const { id } = request.params;
      const { note } = request.body ?? {};

      if (!note?.trim()) return reply.code(400).send({ success: false, error: '거절 사유를 입력해주세요' });

      const character = await prisma.character.findUnique({ where: { id }, select: { id: true } });
      if (!character) return reply.code(404).send({ success: false, error: '캐릭터를 찾을 수 없습니다' });

      await prisma.character.update({
        where: { id },
        data: { reviewStatus: 'REJECTED', reviewNote: note, reviewedBy: request.userId, reviewedAt: new Date(), isActive: false },
      });

      await createAuditLog(request, { action: 'UPDATE', entityType: 'Character', entityId: id, newData: { reviewStatus: 'REJECTED', note } });
      return { success: true };
    }
  );

  // POST /admin/moderation/character-reviews/:id/deactivate — 라이브 캐릭터 비활성화
  fastify.post<{ Params: { id: string }; Body: { note?: string } }>(
    '/character-reviews/:id/deactivate',
    async (request, reply) => {
      const { id } = request.params;
      const { note } = request.body ?? {};

      const character = await prisma.character.findUnique({ where: { id }, select: { id: true } });
      if (!character) return reply.code(404).send({ success: false, error: '캐릭터를 찾을 수 없습니다' });

      await prisma.character.update({
        where: { id },
        data: {
          isActive: false,
          reviewStatus: 'REJECTED',
          reviewNote: note ?? '관리자 모니터링에 의해 비활성화됨',
          reviewedBy: request.userId,
          reviewedAt: new Date(),
        },
      });

      await createAuditLog(request, { action: 'UPDATE', entityType: 'Character', entityId: id, newData: { deactivated: true, note } });
      return { success: true };
    }
  );

  // POST /admin/moderation/character-reviews/:id/reactivate — 비활성화 취소
  fastify.post<{ Params: { id: string } }>(
    '/character-reviews/:id/reactivate',
    async (request, reply) => {
      const { id } = request.params;

      const character = await prisma.character.findUnique({ where: { id }, select: { id: true } });
      if (!character) return reply.code(404).send({ success: false, error: '캐릭터를 찾을 수 없습니다' });

      await prisma.character.update({
        where: { id },
        data: { isActive: true, reviewStatus: 'APPROVED', reviewedBy: request.userId, reviewedAt: new Date() },
      });

      await createAuditLog(request, { action: 'RESTORE', entityType: 'Character', entityId: id });
      return { success: true };
    }
  );

  // POST /admin/moderation/character-reviews/:id/flag — 검수 요청 (재검수)
  fastify.post<{ Params: { id: string } }>(
    '/character-reviews/:id/flag',
    async (request, reply) => {
      const { id } = request.params;

      const character = await prisma.character.findUnique({ where: { id }, select: { id: true } });
      if (!character) return reply.code(404).send({ success: false, error: '캐릭터를 찾을 수 없습니다' });

      await prisma.character.update({
        where: { id },
        data: { reviewStatus: 'NEEDS_REVIEW', reviewNote: '관리자가 재검수 요청', reviewedBy: request.userId, reviewedAt: new Date() },
      });

      await createAuditLog(request, { action: 'UPDATE', entityType: 'Character', entityId: id, newData: { flagged: true } });
      return { success: true };
    }
  );

  // ─────────────────────────────────────────────
  // APPEAL MANAGEMENT
  // ─────────────────────────────────────────────

  // GET /admin/moderation/appeals — 이의신청 목록
  fastify.get<{
    Querystring: { page?: string; limit?: string; status?: string };
  }>('/appeals', async (request) => {
    const { page = '1', limit = '25', status = 'PENDING' } = request.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (status && status !== 'ALL') where.status = status;

    const [appeals, total] = await Promise.all([
      prisma.appeal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        select: {
          id: true, type: true, targetId: true, reason: true,
          status: true, adminNote: true, createdAt: true, reviewedAt: true,
          user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
      }),
      prisma.appeal.count({ where }),
    ]);

    return { success: true, data: { appeals, total, page: pageNum, totalPages: Math.ceil(total / limitNum) } };
  });

  // POST /admin/moderation/appeals/:id/approve — 이의신청 승인
  fastify.post<{
    Params: { id: string };
    Body: { note?: string };
  }>('/appeals/:id/approve', async (request, reply) => {
    const { id } = request.params;
    const { note } = request.body ?? {};

    const appeal = await prisma.appeal.findUnique({
      where: { id },
      select: { id: true, status: true, type: true, targetId: true, userId: true },
    });
    if (!appeal) return reply.code(404).send({ success: false, error: '이의신청을 찾을 수 없습니다' });
    if (appeal.status !== 'PENDING') return reply.code(400).send({ success: false, error: '이미 처리된 이의신청입니다' });

    // 승인 시 숨김 해제 처리
    await prisma.$transaction(async (tx) => {
      if (appeal.type === 'MESSAGE_HIDDEN') {
        await tx.message.update({
          where: { id: appeal.targetId },
          data: { isHidden: false, hiddenReason: null, hiddenBy: null, hiddenAt: null },
        });
      } else if (appeal.type === 'CHARACTER_HIDDEN') {
        await tx.character.update({
          where: { id: appeal.targetId },
          data: { isActive: true },
        });
      } else if (appeal.type === 'USER_BANNED') {
        await tx.user.update({
          where: { id: appeal.userId },
          data: { isBanned: false, banReason: null, bannedUntil: null },
        });
      }

      await tx.appeal.update({
        where: { id },
        data: {
          status: 'APPROVED',
          adminNote: note ?? '이의신청이 승인되어 처리가 해제되었습니다.',
          reviewedBy: request.userId,
          reviewedAt: new Date(),
        },
      });
    });

    await createAuditLog(request, { action: 'UPDATE', entityType: 'Appeal', entityId: id, newData: { approved: true, type: appeal.type } });
    return { success: true };
  });

  // POST /admin/moderation/appeals/:id/reject — 이의신청 기각
  fastify.post<{
    Params: { id: string };
    Body: { note: string };
  }>('/appeals/:id/reject', async (request, reply) => {
    const { id } = request.params;
    const { note } = request.body ?? {};

    if (!note?.trim()) {
      return reply.code(400).send({ success: false, error: '기각 사유를 입력해주세요' });
    }

    const appeal = await prisma.appeal.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!appeal) return reply.code(404).send({ success: false, error: '이의신청을 찾을 수 없습니다' });
    if (appeal.status !== 'PENDING') return reply.code(400).send({ success: false, error: '이미 처리된 이의신청입니다' });

    await prisma.appeal.update({
      where: { id },
      data: { status: 'REJECTED', adminNote: note, reviewedBy: request.userId, reviewedAt: new Date() },
    });

    await createAuditLog(request, { action: 'UPDATE', entityType: 'Appeal', entityId: id, newData: { rejected: true, note } });
    return { success: true };
  });
};
