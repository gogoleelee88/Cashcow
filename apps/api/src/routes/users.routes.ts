import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../plugins/auth.plugin';
import { prismaRead, prisma } from '../lib/prisma';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { encrypt } from '../lib/encryption';

export const userRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /users/:username/profile
  fastify.get('/:username/profile', {
    handler: async (request, reply) => {
      const { username } = request.params as { username: string };
      const viewerUserId = (request as any).userId;

      const user = await prismaRead.user.findUnique({
        where: { username },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          bio: true,
          createdAt: true,
          subscription: { select: { plan: true, status: true } },
          _count: {
            select: {
              characters: { where: { isDeleted: false, visibility: 'PUBLIC' } },
              followers: true,
              following: true,
            },
          },
          characters: {
            where: { isDeleted: false, visibility: 'PUBLIC' },
            orderBy: { chatCount: 'desc' },
            take: 12,
            select: {
              id: true, name: true, description: true, avatarUrl: true,
              chatCount: true, likeCount: true, isFeatured: true, category: true,
            },
          },
        },
      });

      if (!user) {
        return reply.code(404).send({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
      }

      let isFollowing = false;
      if (viewerUserId && viewerUserId !== user.id) {
        const follow = await prismaRead.follow.findUnique({
          where: { followerId_followingId: { followerId: viewerUserId, followingId: user.id } },
        });
        isFollowing = !!follow;
      }

      const totalChatCount = await prismaRead.character.aggregate({
        where: { creatorId: user.id, isDeleted: false },
        _sum: { chatCount: true },
      });
      const totalLikeCount = await prismaRead.character.aggregate({
        where: { creatorId: user.id, isDeleted: false },
        _sum: { likeCount: true },
      });

      return reply.send({
        ...user,
        characterCount: user._count.characters,
        followerCount: user._count.followers,
        followingCount: user._count.following,
        totalChatCount: totalChatCount._sum.chatCount ?? 0,
        totalLikeCount: totalLikeCount._sum.likeCount ?? 0,
        isFollowing,
      });
    },
  });

  // POST /users/:username/follow
  fastify.post('/:username/follow', {
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { username } = request.params as { username: string };
      const followerId = request.userId!;

      const target = await prismaRead.user.findUnique({ where: { username }, select: { id: true } });
      if (!target) return reply.code(404).send({ error: { code: 'USER_NOT_FOUND' } });
      if (target.id === followerId) return reply.code(400).send({ error: { code: 'CANNOT_FOLLOW_SELF' } });

      await prisma.follow.upsert({
        where: { followerId_followingId: { followerId, followingId: target.id } },
        create: { followerId, followingId: target.id },
        update: {},
      });

      return reply.send({ success: true });
    },
  });

  // DELETE /users/:username/follow
  fastify.delete('/:username/follow', {
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { username } = request.params as { username: string };
      const followerId = request.userId!;

      const target = await prismaRead.user.findUnique({ where: { username }, select: { id: true } });
      if (!target) return reply.code(404).send({ error: { code: 'USER_NOT_FOUND' } });

      await prisma.follow.deleteMany({
        where: { followerId, followingId: target.id },
      });

      return reply.send({ success: true });
    },
  });

  // PATCH /users/me
  fastify.patch('/me', {
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const userId = request.userId!;
      const schema = z.object({
        displayName: z.string().min(1).max(30).optional(),
        bio: z.string().max(200).optional(),
        avatarUrl: z.string().url().optional(),
      });

      const body = schema.parse(request.body);

      const updated = await prisma.user.update({
        where: { id: userId },
        data: body,
        select: {
          id: true, username: true, displayName: true, avatarUrl: true,
          email: true, creditBalance: true, role: true, bio: true, createdAt: true, updatedAt: true,
        },
      });

      const { creditBalance, ...rest } = updated as any;
      return reply.send({ ...rest, credits: creditBalance });
    },
  });

  // GET /chat/conversations  (also registered here for convenience)
  fastify.get('/conversations', {
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const userId = request.userId!;

      const conversations = await prismaRead.conversation.findMany({
        where: { userId, isActive: true },
        orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
        take: 50,
        include: {
          character: {
            select: { id: true, name: true, avatarUrl: true },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { content: true, role: true, createdAt: true },
          },
        },
      });

      return reply.send({
        conversations: conversations.map((conv) => ({
          ...conv,
          lastMessage: conv.messages[0] ?? null,
          messages: undefined,
        })),
      });
    },
  });
};
