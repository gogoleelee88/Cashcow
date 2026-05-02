import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../plugins/auth.plugin';

const VALID_TYPES = ['MESSAGE_HIDDEN', 'CHARACTER_HIDDEN', 'USER_BANNED'] as const;

export const appealsRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/appeals — 이의신청 제출
  fastify.post<{
    Body: { type: string; targetId: string; reason: string };
  }>('/', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { type, targetId, reason } = request.body;

      if (!VALID_TYPES.includes(type as any)) {
        return reply.code(400).send({ success: false, error: { code: 'INVALID_TYPE', message: '유효하지 않은 이의신청 유형입니다.' } });
      }
      if (!reason?.trim() || reason.length < 10) {
        return reply.code(400).send({ success: false, error: { code: 'INVALID_REASON', message: '소명 내용을 10자 이상 입력해주세요.' } });
      }
      if (reason.length > 1000) {
        return reply.code(400).send({ success: false, error: { code: 'REASON_TOO_LONG', message: '소명 내용은 1000자 이내로 입력해주세요.' } });
      }

      // 동일 대상 중복 신청 방지
      const existing = await prisma.appeal.findFirst({
        where: { userId: request.userId!, targetId, status: 'PENDING' },
      });
      if (existing) {
        return reply.code(409).send({ success: false, error: { code: 'DUPLICATE_APPEAL', message: '이미 처리 중인 이의신청이 있습니다.' } });
      }

      const appeal = await prisma.appeal.create({
        data: { userId: request.userId!, type, targetId, reason },
        select: { id: true, type: true, status: true, createdAt: true },
      });

      return reply.code(201).send({ success: true, data: appeal });
    },
  });

  // GET /api/appeals/my — 내 이의신청 목록
  fastify.get<{
    Querystring: { page?: string; limit?: string };
  }>('/my', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { page = '1', limit = '20' } = request.query;
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      const [appeals, total] = await Promise.all([
        prisma.appeal.findMany({
          where: { userId: request.userId! },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum,
          select: {
            id: true, type: true, targetId: true, reason: true,
            status: true, adminNote: true, createdAt: true, reviewedAt: true,
          },
        }),
        prisma.appeal.count({ where: { userId: request.userId! } }),
      ]);

      return reply.send({
        success: true,
        data: appeals,
        meta: { total, page: pageNum, totalPages: Math.ceil(total / limitNum) },
      });
    },
  });
};
