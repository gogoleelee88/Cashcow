import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma';
import { createAuditLog } from '../../lib/audit';

export const notificationsAdminRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /admin/notifications/broadcast — 전체/티어/유저 공지 발송
  fastify.post<{
    Body: {
      title: string;
      body: string;
      targetType: 'ALL' | 'TIER' | 'USER';
      targetValue?: string;
    };
  }>('/broadcast', async (request, reply) => {
    const { title, body, targetType, targetValue } = request.body;

    if (!title?.trim() || !body?.trim()) {
      return reply.code(400).send({ success: false, error: '제목과 내용을 입력해주세요' });
    }
    if ((targetType === 'TIER' || targetType === 'USER') && !targetValue?.trim()) {
      return reply.code(400).send({ success: false, error: '대상을 지정해주세요' });
    }

    // 대상 유저 조회
    let where: any = {};
    if (targetType === 'TIER' && targetValue) {
      where.subscriptionTier = targetValue;
    } else if (targetType === 'USER' && targetValue) {
      where.id = targetValue;
    }

    const users = await prisma.user.findMany({
      where: { ...where, isBanned: false },
      select: { id: true },
    });

    if (users.length === 0) {
      return reply.code(400).send({ success: false, error: '발송 대상 유저가 없습니다' });
    }

    // 알림 생성 (배치)
    const BATCH = 500;
    let sentCount = 0;
    for (let i = 0; i < users.length; i += BATCH) {
      const batch = users.slice(i, i + BATCH);
      await prisma.notification.createMany({
        data: batch.map((u) => ({
          userId: u.id,
          type: 'SYSTEM',
          title,
          body,
        })),
      });
      sentCount += batch.length;
    }

    // 발송 이력 저장
    const broadcast = await prisma.notificationBroadcast.create({
      data: { title, body, targetType, targetValue: targetValue ?? null, sentCount, sentBy: request.userId },
    });

    await createAuditLog(request, {
      action: 'CREATE',
      entityType: 'NotificationBroadcast',
      entityId: broadcast.id,
      newData: { targetType, sentCount },
    });

    return { success: true, data: { sentCount, broadcastId: broadcast.id } };
  });

  // POST /admin/notifications/send — 특정 유저에게 개별 발송
  fastify.post<{
    Body: { userId: string; title: string; body: string };
  }>('/send', async (request, reply) => {
    const { userId, title, body } = request.body;

    if (!userId?.trim() || !title?.trim() || !body?.trim()) {
      return reply.code(400).send({ success: false, error: '유저 ID, 제목, 내용을 모두 입력해주세요' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return reply.code(404).send({ success: false, error: '유저를 찾을 수 없습니다' });

    await prisma.notification.create({
      data: { userId, type: 'SYSTEM', title, body },
    });

    return { success: true };
  });

  // GET /admin/notifications/history — 발송 이력
  fastify.get<{
    Querystring: { page?: string; limit?: string };
  }>('/history', async (request) => {
    const { page = '1', limit = '25' } = request.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [broadcasts, total] = await Promise.all([
      prisma.notificationBroadcast.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.notificationBroadcast.count(),
    ]);

    return {
      success: true,
      data: { broadcasts, total, page: pageNum, totalPages: Math.ceil(total / limitNum) },
    };
  });
};
