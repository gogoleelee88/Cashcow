import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../plugins/auth.plugin';

const EMOJI_OPTIONS = ['😊','🦁','🐯','🐻','🐼','🦊','🐸','🐧','🦄','🌟','🎮','🎨','🎵','🚀','⚽'];
const COLOR_OPTIONS = ['#E63325','#3B82F6','#10B981','#F59E0B','#8B5CF6','#EC4899','#06B6D4','#F97316'];

export const profileRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/profiles — 내 프로필 목록
  fastify.get('/', {
    preHandler: [requireAuth],
    handler: async (request) => {
      const userId = request.userId!;
      const profiles = await prisma.profile.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, isKids: true, avatarEmoji: true, avatarColor: true, createdAt: true },
      });
      return { success: true, data: profiles };
    },
  });

  // POST /api/profiles — 프로필 생성
  fastify.post('/', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;

      const count = await prisma.profile.count({ where: { userId } });
      if (count >= 5) return reply.status(400).send({ error: '프로필은 최대 5개까지 만들 수 있습니다.' });

      const body = z.object({
        name:        z.string().min(1).max(20),
        isKids:      z.boolean().default(false),
        pin:         z.string().length(4).regex(/^\d{4}$/).optional(),
        avatarEmoji: z.string().default('😊'),
        avatarColor: z.string().default('#E63325'),
      }).parse(request.body);

      const pinHash = body.pin ? await bcrypt.hash(body.pin, 10) : null;

      const profile = await prisma.profile.create({
        data: { userId, name: body.name, isKids: body.isKids, pinHash, avatarEmoji: body.avatarEmoji, avatarColor: body.avatarColor },
        select: { id: true, name: true, isKids: true, avatarEmoji: true, avatarColor: true, createdAt: true },
      });

      return reply.status(201).send({ success: true, data: profile });
    },
  });

  // PUT /api/profiles/:id — 프로필 수정
  fastify.put<{ Params: { id: string } }>('/:id', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;
      const { id } = request.params;

      const profile = await prisma.profile.findFirst({ where: { id, userId } });
      if (!profile) return reply.status(404).send({ error: '프로필을 찾을 수 없습니다.' });

      const body = z.object({
        name:        z.string().min(1).max(20).optional(),
        isKids:      z.boolean().optional(),
        pin:         z.string().length(4).regex(/^\d{4}$/).nullable().optional(),
        avatarEmoji: z.string().optional(),
        avatarColor: z.string().optional(),
      }).parse(request.body);

      let pinHash = profile.pinHash;
      if (body.pin !== undefined) {
        pinHash = body.pin ? await bcrypt.hash(body.pin, 10) : null;
      }

      const updated = await prisma.profile.update({
        where: { id },
        data: {
          ...(body.name        !== undefined && { name:        body.name }),
          ...(body.isKids      !== undefined && { isKids:      body.isKids }),
          ...(body.avatarEmoji !== undefined && { avatarEmoji: body.avatarEmoji }),
          ...(body.avatarColor !== undefined && { avatarColor: body.avatarColor }),
          pinHash,
        },
        select: { id: true, name: true, isKids: true, avatarEmoji: true, avatarColor: true, createdAt: true },
      });

      return reply.send({ success: true, data: updated });
    },
  });

  // DELETE /api/profiles/:id
  fastify.delete<{ Params: { id: string } }>('/:id', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;
      const { id } = request.params;

      const count = await prisma.profile.count({ where: { userId } });
      if (count <= 1) return reply.status(400).send({ error: '마지막 프로필은 삭제할 수 없습니다.' });

      await prisma.profile.deleteMany({ where: { id, userId } });
      return reply.status(204).send();
    },
  });

  // POST /api/profiles/:id/verify-pin — 키즈 모드 탈출 PIN 검증
  fastify.post<{ Params: { id: string } }>('/:id/verify-pin', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;
      const { id } = request.params;
      const { pin } = z.object({ pin: z.string().length(4) }).parse(request.body);

      const profile = await prisma.profile.findFirst({ where: { id, userId } });
      if (!profile) return reply.status(404).send({ error: '프로필을 찾을 수 없습니다.' });
      if (!profile.pinHash) return reply.send({ success: true, valid: true });

      const valid = await bcrypt.compare(pin, profile.pinHash);
      return reply.send({ success: true, valid });
    },
  });
};
