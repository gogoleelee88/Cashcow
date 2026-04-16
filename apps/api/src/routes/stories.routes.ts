import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma, prismaRead } from '../lib/prisma';
import { cache } from '../lib/redis';
import { encrypt, decrypt } from '../lib/encryption';
import { requireAuth } from '../plugins/auth.plugin';
import { searchRateLimit, uploadRateLimit } from '../plugins/rate-limit.plugin';
import { logger } from '../lib/logger';
import { generatePresignedUploadUrl, deleteS3Object } from '../services/storage.service';
// StoryCategory, CharacterVisibility, AgeRating types used as strings (Prisma client not yet generated)
// import Anthropic from '@anthropic-ai/sdk'; // Anthropic 비활성화 - OpenAI로 전환
import OpenAI from 'openai';

const CACHE_TTL_LIST = 120;
const CACHE_TTL_DETAIL = 300;
const CACHE_TTL_TRENDING = 600;

// ── 공통 상수 ──────────────────────────────────────────────────────────────
const STORY_CATEGORY_VALUES = ['ROMANCE', 'FANTASY', 'MYSTERY', 'THRILLER', 'SF', 'HISTORICAL', 'HORROR', 'COMEDY', 'ADVENTURE', 'SLICE_OF_LIFE', 'OTHER'] as const;
const VISIBILITY_VALUES     = ['PUBLIC', 'PRIVATE', 'UNLISTED'] as const;
const AGE_RATING_VALUES     = ['ALL', 'TEEN', 'MATURE'] as const;
const CHAT_MODEL_VALUES     = ['HYPER_CHAT', 'SUPER_CHAT_25', 'SUPER_CHAT_20', 'SUPER_CHAT_15', 'PRO_CHAT_25', 'PRO_CHAT_10', 'POWER_CHAT', 'NORMAL_CHAT'] as const;

// Draft 생성: 필드 전부 optional (저장 버튼 누르지 않아도 빈 draft 생성 가능)
const createStorySchema = z.object({
  title:        z.string().max(100).default(''),
  description:  z.string().max(1000).default(''),
  systemPrompt: z.string().max(10000).default(''),
  greeting:     z.string().max(2000).default(''),
  language:     z.string().default('ko'),
});

// ── 슬러그 생성 유틸 ────────────────────────────────────────────────────────
function toSlug(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w가-힣ㄱ-ㅎㅏ-ㅣ-]/g, '')
    .slice(0, 80) || 'untitled';
}

async function generateUniqueSlug(title: string, authorId: string, excludeId?: string): Promise<string> {
  const base = toSlug(title);
  let slug = base;
  let suffix = 2;
  while (true) {
    const existing = await prisma.story.findFirst({
      where: { authorId, slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (!existing) return slug;
    slug = `${base}-${suffix++}`;
  }
}

export const storyRoutes: FastifyPluginAsync = async (fastify) => {
  // const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }); // 비활성화
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // ─────────────────────────────────────────────
  // CHECK TITLE — 중복 제목 실시간 체크 (작가 범위)
  // ─────────────────────────────────────────────
  fastify.get('/check-title', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;
      const { title, excludeId } = request.query as { title?: string; excludeId?: string };
      if (!title?.trim()) return reply.send({ available: true, suggestion: null });

      const slug = toSlug(title);
      const existing = await prisma.story.findFirst({
        where: {
          authorId: userId,
          slug,
          status: { not: 'DRAFT' },
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true, title: true },
      });

      if (!existing) return reply.send({ available: true, suggestion: null });

      const suggestion = await generateUniqueSlug(title, userId, excludeId);
      const suggestionTitle = title.trim() + (suggestion.endsWith('-2') ? ' (2)' : ` (${suggestion.split('-').pop()})`);
      return reply.send({ available: false, suggestion: suggestionTitle });
    },
  });

  // ─────────────────────────────────────────────
  // LIST STORIES
  // ─────────────────────────────────────────────
  fastify.get('/', {
    preHandler: [searchRateLimit],
    handler: async (request, reply) => {
      const {
        page = 1,
        limit = 20,
        category,
        sort = 'trending',
        q,
      } = request.query as {
        page?: number;
        limit?: number;
        category?: StoryCategory;
        sort?: string;
        q?: string;
      };

      const pageNum = Math.min(Math.max(Number(page), 1), 100);
      const limitNum = Math.min(Math.max(Number(limit), 1), 50);
      const skip = (pageNum - 1) * limitNum;

      const cacheKey = `stories:list:${pageNum}:${limitNum}:${category ?? 'all'}:${sort}:${q ?? ''}`;
      const cached = await cache.get(cacheKey);
      if (cached) return reply.send(cached);

      const where: any = { visibility: 'PUBLIC', isActive: true };
      if (category) where.category = category;
      if (q) {
        where.OR = [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { tags: { has: q } },
        ];
      }

      const orderBy: any =
        sort === 'newest' ? { createdAt: 'desc' } :
        sort === 'popular' ? { likeCount: 'desc' } :
        sort === 'chat' ? { chatCount: 'desc' } :
        { trendingScore: 'desc' };

      const [total, stories] = await Promise.all([
        prismaRead.story.count({ where }),
        prismaRead.story.findMany({
          where,
          orderBy,
          skip,
          take: limitNum,
          select: {
            id: true,
            title: true,
            description: true,
            coverUrl: true,
            category: true,
            tags: true,
            ageRating: true,
            status: true,
            chatCount: true,
            likeCount: true,
            favoriteCount: true,
            isFeatured: true,
            createdAt: true,
            author: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
        }),
      ]);

      const result = {
        data: stories,
        meta: {
          total,
          page: pageNum,
          limit: limitNum,
          hasMore: skip + limitNum < total,
        },
      };

      await cache.set(cacheKey, result, CACHE_TTL_LIST);
      return reply.send(result);
    },
  });

  // ─────────────────────────────────────────────
  // TRENDING STORIES
  // ─────────────────────────────────────────────
  fastify.get('/trending', {
    handler: async (request, reply) => {
      const { period = '24h' } = request.query as { period?: string };
      const cacheKey = `stories:trending:${period}`;
      const cached = await cache.get(cacheKey);
      if (cached) return reply.send(cached);

      const since = new Date(Date.now() - (period === '7d' ? 7 : period === '30d' ? 30 : 1) * 24 * 3600 * 1000);

      const stories = await prismaRead.story.findMany({
        where: { visibility: 'PUBLIC', isActive: true, updatedAt: { gte: since } },
        orderBy: { trendingScore: 'desc' },
        take: 20,
        select: {
          id: true, title: true, description: true, coverUrl: true,
          category: true, chatCount: true, likeCount: true, isFeatured: true,
          author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
      });

      const result = { data: stories };
      await cache.set(cacheKey, result, CACHE_TTL_TRENDING);
      return reply.send(result);
    },
  });

  // ─────────────────────────────────────────────
  // GET STORY DETAIL
  // ─────────────────────────────────────────────
  fastify.get('/:id', {
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId = (request as any).userId;

      const cacheKey = `story:detail:${id}`;
      const cached = await cache.get(cacheKey);
      if (cached) {
        const story = cached as any;
        if (userId) {
          const [liked, favorited] = await Promise.all([
            prismaRead.storyLike.findUnique({ where: { userId_storyId: { userId, storyId: id } } }),
            prismaRead.storyFavorite.findUnique({ where: { userId_storyId: { userId, storyId: id } } }),
          ]);
          return reply.send({ ...story, isLiked: !!liked, isFavorited: !!favorited });
        }
        return reply.send({ ...story, isLiked: false, isFavorited: false });
      }

      const story = await prismaRead.story.findFirst({
        where: { id, isActive: true },
        include: {
          author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          chapters: { where: { isPublished: true }, orderBy: { order: 'asc' }, select: { id: true, title: true, order: true, createdAt: true } },
          characters: {
            include: {
              character: { select: { id: true, name: true, avatarUrl: true, description: true } },
            },
          },
        },
      });

      if (!story) return reply.status(404).send({ error: { message: '스토리를 찾을 수 없습니다.' } });
      if (story.visibility === 'PRIVATE' && story.authorId !== userId) {
        return reply.status(403).send({ error: { message: '접근 권한이 없습니다.' } });
      }

      const storyData = {
        id: story.id, title: story.title, description: story.description,
        coverUrl: story.coverUrl, category: story.category, tags: story.tags,
        ageRating: story.ageRating, status: story.status, chatCount: story.chatCount,
        likeCount: story.likeCount, favoriteCount: story.favoriteCount,
        isFeatured: story.isFeatured, greeting: story.greeting,
        author: story.author, chapters: story.chapters,
        characters: story.characters.map((sc: any) => sc.character),
        createdAt: story.createdAt,
      };

      await cache.set(cacheKey, storyData, CACHE_TTL_DETAIL);

      let isLiked = false, isFavorited = false;
      if (userId) {
        const [liked, favorited] = await Promise.all([
          prismaRead.storyLike.findUnique({ where: { userId_storyId: { userId, storyId: id } } }),
          prismaRead.storyFavorite.findUnique({ where: { userId_storyId: { userId, storyId: id } } }),
        ]);
        isLiked = !!liked;
        isFavorited = !!favorited;
      }

      return reply.send({ ...storyData, isLiked, isFavorited });
    },
  });

  // ─────────────────────────────────────────────
  // CREATE STORY (DRAFT)
  // 폼 진입 즉시 draft 레코드 생성 → storyId 반환
  // 이후 탭별 PATCH 요청으로 자동저장
  // ─────────────────────────────────────────────
  fastify.post('/', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;
      const body = createStorySchema.parse(request.body);

      const { encrypted: enc, iv } = encrypt(body.systemPrompt || ' ');

      const story = await prisma.story.create({
        data: {
          title:                body.title,
          description:          body.description,
          greeting:             body.greeting,
          language:             body.language,
          systemPromptEncrypted: enc,
          systemPromptIv:       iv,
          authorId:             userId,
          status:               'DRAFT' as any,
          visibility:           'PRIVATE' as any,
          category:             'OTHER' as any,
        },
        select: { id: true, title: true, status: true, createdAt: true },
      });

      // 기본 시작설정 자동 생성
      await prisma.storyStartSetting.create({
        data: { storyId: story.id, name: '기본 설정', order: 0 },
      });

      return reply.status(201).send({ data: story });
    },
  });

  // ─────────────────────────────────────────────
  // GET STORY EDIT DATA — 편집 폼용 전체 데이터 반환 (작성자 전용, 복호화 포함)
  // ─────────────────────────────────────────────
  fastify.get('/:id/edit-data', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId  = request.userId!;

      const story = await prisma.story.findFirst({
        where: { id, authorId: userId },
        include: {
          startSettings: {
            orderBy: { order: 'asc' },
            include: { suggestedReplies: { orderBy: { order: 'asc' } } },
          },
          examples: { orderBy: { order: 'asc' } },
        },
      });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

      const systemPrompt = decrypt(story.systemPromptEncrypted, story.systemPromptIv);

      return reply.send({
        data: {
          id: story.id,
          title: story.title,
          description: story.description,
          coverUrl: story.coverUrl,
          coverKey: story.coverKey,
          coverVerticalUrl: story.coverVerticalUrl,
          coverVerticalKey: story.coverVerticalKey,
          category: story.category,
          tags: story.tags,
          ageRating: story.ageRating,
          visibility: story.visibility,
          status: story.status,
          language: story.language,
          greeting: story.greeting,
          systemPrompt,
          startSettings: story.startSettings.map((s: any) => ({
            id: s.id,
            name: s.name,
            prologue: s.prologue ?? '',
            situation: s.situation ?? '',
            playGuide: s.playGuide ?? '',
            suggestedReplies: s.suggestedReplies.map((r: any) => r.text),
          })),
          examples: story.examples.map((e: any) => ({
            id: e.id,
            user: e.userMessage,
            assistant: e.assistantMessage,
          })),
        },
      });
    },
  });

  // ─────────────────────────────────────────────
  // PATCH STORY — 기본 필드 수정 (프로필 탭 자동저장)
  // ─────────────────────────────────────────────
  fastify.patch('/:id', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId  = request.userId!;

      const story = await prisma.story.findFirst({ where: { id, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

      const body = z.object({
        title:       z.string().max(100).optional(),
        description: z.string().max(1000).optional(),
        greeting:    z.string().max(2000).optional(),
        language:    z.string().optional(),
      }).parse(request.body);

      const updated = await prisma.story.update({
        where: { id },
        data:  body,
        select: { id: true, title: true, description: true, greeting: true, updatedAt: true },
      });

      await cache.del(`story:detail:${id}`);
      return reply.send({ data: updated });
    },
  });

  // ─────────────────────────────────────────────
  // PATCH SYSTEM PROMPT (스토리 설정 탭)
  // ─────────────────────────────────────────────
  fastify.patch('/:id/system-prompt', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId  = request.userId!;

      const story = await prisma.story.findFirst({ where: { id, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

      const { systemPrompt } = z.object({
        systemPrompt: z.string().max(10000),
      }).parse(request.body);

      const { encrypted: enc, iv } = encrypt(systemPrompt);

      await prisma.story.update({
        where: { id },
        data:  { systemPromptEncrypted: enc, systemPromptIv: iv },
      });

      await cache.del(`story:detail:${id}`);
      return reply.send({ success: true });
    },
  });

  // ─────────────────────────────────────────────
  // COVER UPLOAD (프로필 탭 — Presigned URL)
  // ─────────────────────────────────────────────
  fastify.post('/:id/cover/upload-url', {
    preHandler: [requireAuth, uploadRateLimit],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId  = request.userId!;

      const story = await prisma.story.findFirst({ where: { id, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

      const { contentType, variant } = z.object({
        contentType: z.string(),
        variant:     z.enum(['square', 'vertical']),
      }).parse(request.body);

      const result = await generatePresignedUploadUrl('stories/covers', contentType, userId);
      return reply.send({ data: result });
    },
  });

  // 업로드 완료 후 URL 저장
  fastify.patch('/:id/cover', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId  = request.userId!;

      const story = await prisma.story.findFirst({ where: { id, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

      const body = z.object({
        variant: z.enum(['square', 'vertical']),
        url:     z.string().url(),
        key:     z.string(),
      }).parse(request.body);

      const oldKey = body.variant === 'square' ? story.coverKey : story.coverVerticalKey;

      const data = body.variant === 'square'
        ? { coverUrl: body.url, coverKey: body.key }
        : { coverVerticalUrl: body.url, coverVerticalKey: body.key };

      await prisma.story.update({ where: { id }, data });

      // 이전 S3 객체 비동기 삭제
      if (oldKey) deleteS3Object(oldKey).catch(() => {});

      await cache.del(`story:detail:${id}`);
      return reply.send({ data: { url: body.url } });
    },
  });

  fastify.delete('/:id/cover', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId  = request.userId!;

      const story = await prisma.story.findFirst({ where: { id, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

      const { variant } = z.object({ variant: z.enum(['square', 'vertical']) }).parse(request.body);

      const key = variant === 'square' ? story.coverKey : story.coverVerticalKey;
      const data = variant === 'square'
        ? { coverUrl: null, coverKey: null }
        : { coverVerticalUrl: null, coverVerticalKey: null };

      await prisma.story.update({ where: { id }, data });
      if (key) deleteS3Object(key).catch(() => {});

      await cache.del(`story:detail:${id}`);
      return reply.status(204).send();
    },
  });

  // ─────────────────────────────────────────────
  // EXAMPLES CRUD (스토리 설정 탭 — 대화 예시)
  // ─────────────────────────────────────────────
  fastify.get('/:storyId/examples', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { storyId } = request.params as { storyId: string };
      const userId = request.userId!;

      const story = await prisma.story.findFirst({ where: { id: storyId, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

      const examples = await prisma.storyExample.findMany({
        where:   { storyId },
        orderBy: { order: 'asc' },
      });
      return reply.send({ data: examples });
    },
  });

  fastify.post('/:storyId/examples', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { storyId } = request.params as { storyId: string };
      const userId = request.userId!;

      const story = await prisma.story.findFirst({ where: { id: storyId, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

      const count = await prisma.storyExample.count({ where: { storyId } });
      if (count >= 20) return reply.status(400).send({ error: '예시는 최대 20개까지 등록할 수 있습니다.' });

      const body = z.object({
        userMessage:      z.string().max(500),
        assistantMessage: z.string().max(2000),
        order:            z.number().int().default(count),
      }).parse(request.body);

      const example = await prisma.storyExample.create({ data: { storyId, ...body } });
      return reply.status(201).send({ data: example });
    },
  });

  fastify.put('/:storyId/examples/:exId', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { storyId, exId } = request.params as { storyId: string; exId: string };
      const userId = request.userId!;

      const story = await prisma.story.findFirst({ where: { id: storyId, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

      const body = z.object({
        userMessage:      z.string().max(500).optional(),
        assistantMessage: z.string().max(2000).optional(),
      }).parse(request.body);

      const updated = await prisma.storyExample.update({
        where: { id: exId },
        data:  body,
      });
      return reply.send({ data: updated });
    },
  });

  fastify.delete('/:storyId/examples/:exId', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { storyId, exId } = request.params as { storyId: string; exId: string };
      const userId = request.userId!;

      const story = await prisma.story.findFirst({ where: { id: storyId, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

      await prisma.storyExample.deleteMany({ where: { id: exId, storyId } });
      return reply.status(204).send();
    },
  });

  // 예시 순서 변경 (drag & drop)
  fastify.patch('/:storyId/examples/reorder', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { storyId } = request.params as { storyId: string };
      const userId = request.userId!;

      const story = await prisma.story.findFirst({ where: { id: storyId, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

      const { orderedIds } = z.object({
        orderedIds: z.array(z.string()),
      }).parse(request.body);

      await prisma.$transaction(
        orderedIds.map((id, order) =>
          prisma.storyExample.update({ where: { id }, data: { order } })
        )
      );
      return reply.send({ success: true });
    },
  });

  // ─────────────────────────────────────────────
  // STATS CRUD (스탯 설정 탭)
  // ─────────────────────────────────────────────
  fastify.get('/:storyId/start-settings/:settingId/stats', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { storyId, settingId } = request.params as { storyId: string; settingId: string };
      const userId = request.userId!;

      const story = await prisma.story.findFirst({ where: { id: storyId, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

      const stats = await prisma.storyStat.findMany({
        where:   { startSettingId: settingId },
        include: { levels: { orderBy: { order: 'asc' } } },
        orderBy: { order: 'asc' },
      });
      return reply.send({ data: stats });
    },
  });

  const statBodySchema = z.object({
    name:         z.string().min(1).max(50),
    icon:         z.string().default('heart'),
    color:        z.string().default('#E63325'),
    minValue:     z.number().int().default(0),
    maxValue:     z.number().int().default(100),
    defaultValue: z.number().int().default(50),
    unit:         z.string().max(10).optional().nullable(),
    description:  z.string().max(500).default(''),
    order:        z.number().int().default(0),
    levels: z.array(z.object({
      label:    z.string().max(30),
      minValue: z.number().int(),
      maxValue: z.number().int(),
      order:    z.number().int().default(0),
    })).default([]),
  });

  fastify.post('/:storyId/start-settings/:settingId/stats', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { storyId, settingId } = request.params as { storyId: string; settingId: string };
      const userId = request.userId!;

      const story = await prisma.story.findFirst({ where: { id: storyId, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

      const count = await prisma.storyStat.count({ where: { startSettingId: settingId } });
      if (count >= 10) return reply.status(400).send({ error: '스탯은 최대 10개까지 등록할 수 있습니다.' });

      const body = statBodySchema.parse(request.body);
      const { levels, ...rest } = body;

      const stat = await prisma.storyStat.create({
        data: {
          ...rest,
          startSettingId: settingId,
          levels: { create: levels.map((l, i) => ({ ...l, order: i })) },
        },
        include: { levels: { orderBy: { order: 'asc' } } },
      });
      return reply.status(201).send({ data: stat });
    },
  });

  fastify.put('/:storyId/start-settings/:settingId/stats/:statId', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { storyId, settingId, statId } = request.params as { storyId: string; settingId: string; statId: string };
      const userId = request.userId!;

      const story = await prisma.story.findFirst({ where: { id: storyId, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

      const body = statBodySchema.parse(request.body);
      const { levels, ...rest } = body;

      const stat = await prisma.$transaction(async (tx) => {
        await tx.storyStatLevel.deleteMany({ where: { statId } });
        return tx.storyStat.update({
          where: { id: statId },
          data: {
            ...rest,
            levels: { create: levels.map((l, i) => ({ ...l, order: i })) },
          },
          include: { levels: { orderBy: { order: 'asc' } } },
        });
      });
      return reply.send({ data: stat });
    },
  });

  fastify.delete('/:storyId/start-settings/:settingId/stats/:statId', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { storyId, statId } = request.params as { storyId: string; statId: string };
      const userId = request.userId!;

      const story = await prisma.story.findFirst({ where: { id: storyId, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

      await prisma.storyStat.deleteMany({ where: { id: statId } });
      return reply.status(204).send();
    },
  });

  fastify.patch('/:storyId/start-settings/:settingId/stats/reorder', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { storyId } = request.params as { storyId: string };
      const userId = request.userId!;

      const story = await prisma.story.findFirst({ where: { id: storyId, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

      const { orderedIds } = z.object({ orderedIds: z.array(z.string()) }).parse(request.body);

      await prisma.$transaction(
        orderedIds.map((id, order) => prisma.storyStat.update({ where: { id }, data: { order } }))
      );
      return reply.send({ success: true });
    },
  });

  // ─────────────────────────────────────────────
  // MEDIA CRUD (미디어 탭 — S3 presigned upload)
  // ─────────────────────────────────────────────
  fastify.post('/:storyId/start-settings/:settingId/media/upload-url', {
    preHandler: [requireAuth, uploadRateLimit],
    handler: async (request, reply) => {
      const { storyId, settingId } = request.params as { storyId: string; settingId: string };
      const userId = request.userId!;

      const story = await prisma.story.findFirst({ where: { id: storyId, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

      const count = await prisma.storyMediaImage.count({ where: { startSettingId: settingId } });
      if (count >= 20) return reply.status(400).send({ error: '미디어는 최대 20개까지 등록할 수 있습니다.' });

      const { contentType } = z.object({ contentType: z.string() }).parse(request.body);
      const result = await generatePresignedUploadUrl('stories/media', contentType, userId);
      return reply.send({ data: result });
    },
  });

  fastify.post('/:storyId/start-settings/:settingId/media', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { storyId, settingId } = request.params as { storyId: string; settingId: string };
      const userId = request.userId!;

      const story = await prisma.story.findFirst({ where: { id: storyId, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

      const setting = await prisma.storyStartSetting.findFirst({ where: { id: settingId, storyId } });
      if (!setting) return reply.status(404).send({ error: '시작설정을 찾을 수 없습니다.' });

      const body = z.object({
        url:   z.string().url(),
        key:   z.string(),
        order: z.number().int().default(0),
      }).parse(request.body);

      const media = await prisma.storyMediaImage.create({
        data: { startSettingId: settingId, ...body },
      });
      return reply.status(201).send({ data: media });
    },
  });

  fastify.delete('/:storyId/start-settings/:settingId/media/:mediaId', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { storyId, settingId, mediaId } = request.params as { storyId: string; settingId: string; mediaId: string };
      const userId = request.userId!;

      const story = await prisma.story.findFirst({ where: { id: storyId, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

      const media = await prisma.storyMediaImage.findFirst({ where: { id: mediaId, startSettingId: settingId } });
      if (!media) return reply.status(404).send({ error: '미디어를 찾을 수 없습니다.' });

      await prisma.storyMediaImage.delete({ where: { id: mediaId } });
      if (media.key) deleteS3Object(media.key).catch(() => {});

      return reply.status(204).send();
    },
  });

  fastify.patch('/:storyId/start-settings/:settingId/media/reorder', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { storyId } = request.params as { storyId: string };
      const userId = request.userId!;

      const story = await prisma.story.findFirst({ where: { id: storyId, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

      const { orderedIds } = z.object({ orderedIds: z.array(z.string()) }).parse(request.body);

      await prisma.$transaction(
        orderedIds.map((id, order) => prisma.storyMediaImage.update({ where: { id }, data: { order } }))
      );
      return reply.send({ success: true });
    },
  });

  // ─────────────────────────────────────────────
  // GET MEDIA LIST
  // ─────────────────────────────────────────────
  fastify.get('/:storyId/start-settings/:settingId/media', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { storyId, settingId } = request.params as { storyId: string; settingId: string };
      const userId = request.userId!;

      const story = await prismaRead.story.findFirst({ where: { id: storyId, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

      const media = await prismaRead.storyMediaImage.findMany({
        where: { startSettingId: settingId },
        orderBy: { order: 'asc' },
      });
      return reply.send({ data: media });
    },
  });

  // ─────────────────────────────────────────────
  // STORY CHARACTERS (스토리↔캐릭터 연결 관리)
  // ─────────────────────────────────────────────
  fastify.get('/:storyId/characters', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { storyId } = request.params as { storyId: string };
      const userId = request.userId!;

      const story = await prismaRead.story.findFirst({ where: { id: storyId, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

      const characters = await prismaRead.storyCharacter.findMany({
        where: { storyId },
        include: {
          character: {
            select: { id: true, name: true, avatarUrl: true, description: true },
          },
        },
      });
      return reply.send({ data: characters });
    },
  });

  fastify.post('/:storyId/characters', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { storyId } = request.params as { storyId: string };
      const userId = request.userId!;

      const { characterId, role } = z.object({
        characterId: z.string(),
        role: z.string().max(50).optional(),
      }).parse(request.body);

      const story = await prisma.story.findFirst({ where: { id: storyId, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

      const existing = await prismaRead.storyCharacter.findUnique({
        where: { storyId_characterId: { storyId, characterId } },
      });
      if (existing) return reply.status(409).send({ error: '이미 추가된 캐릭터입니다.' });

      const storyCharacter = await prisma.storyCharacter.create({
        data: { storyId, characterId, role },
        include: {
          character: { select: { id: true, name: true, avatarUrl: true, description: true } },
        },
      });
      return reply.status(201).send({ data: storyCharacter });
    },
  });

  fastify.delete('/:storyId/characters/:characterId', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { storyId, characterId } = request.params as { storyId: string; characterId: string };
      const userId = request.userId!;

      const story = await prisma.story.findFirst({ where: { id: storyId, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

      await prisma.storyCharacter.deleteMany({
        where: { storyId, characterId },
      });
      return reply.status(204).send();
    },
  });

  // ─────────────────────────────────────────────
  // STATUS CHANGE (ONGOING → COMPLETED / HIATUS)
  // ─────────────────────────────────────────────
  fastify.patch('/:id/status', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId = request.userId!;

      const { status } = z.object({
        status: z.enum(['ONGOING', 'COMPLETED', 'HIATUS']),
      }).parse(request.body);

      const story = await prisma.story.findFirst({ where: { id, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });
      if ((story.status as string) === 'DRAFT') {
        return reply.status(400).send({ error: 'DRAFT 상태에서는 status를 변경할 수 없습니다. /publish를 사용하세요.' });
      }

      await prisma.story.update({ where: { id }, data: { status: status as any } });
      await cache.del(`story:detail:${id}`);
      return reply.send({ success: true, data: { id, status } });
    },
  });

  // ─────────────────────────────────────────────
  // PUBLISH SETTINGS PATCH (등록 탭)
  // ─────────────────────────────────────────────
  fastify.patch('/:id/publish-settings', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId  = request.userId!;

      const story = await prisma.story.findFirst({ where: { id, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

      const body = z.object({
        category:   z.enum(STORY_CATEGORY_VALUES).optional(),
        visibility: z.enum(VISIBILITY_VALUES).optional(),
        ageRating:  z.enum(AGE_RATING_VALUES).optional(),
        chatModel:  z.enum(CHAT_MODEL_VALUES).optional(),
        tags:       z.array(z.string().max(30)).max(10).optional(),
      }).parse(request.body);

      await prisma.story.update({ where: { id }, data: body as any });
      await cache.del(`story:detail:${id}`);
      return reply.send({ success: true });
    },
  });

  // ─────────────────────────────────────────────
  // PUBLISH — DRAFT → ONGOING (최종 배포)
  // 필수 필드 유효성 검사 포함
  // ─────────────────────────────────────────────
  fastify.post('/:id/publish', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId  = request.userId!;

      const story = await prisma.story.findFirst({
        where: { id, authorId: userId },
        include: { startSettings: { take: 1, orderBy: { order: 'asc' } } },
      });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });
      if (story.status !== 'DRAFT' as any) return reply.status(400).send({ error: '이미 배포된 스토리입니다.' });

      // 유효성 검사
      const systemPrompt = decrypt(story.systemPromptEncrypted, story.systemPromptIv);
      const errors: string[] = [];
      if (!story.title?.trim())          errors.push('제목을 입력해주세요.');
      if (!story.description?.trim())    errors.push('소개를 입력해주세요.');
      if (!story.greeting?.trim())       errors.push('인사말(프롤로그)을 입력해주세요.');
      if (systemPrompt.trim().length < 20) errors.push('스토리 설정(시스템 프롬프트)이 너무 짧습니다.');
      if (story.startSettings.length === 0) errors.push('시작 설정이 필요합니다.');

      if (errors.length > 0) {
        return reply.status(422).send({ error: '배포 전 필수 항목을 완성해주세요.', details: errors });
      }

      // 같은 작가의 중복 제목 체크 (발행된 스토리 기준)
      const slug = await generateUniqueSlug(story.title.trim(), userId, id);
      const isExactSlug = toSlug(story.title.trim()) === slug;
      if (!isExactSlug) {
        // 이미 같은 slug가 있어서 suffix가 붙은 경우 → 중복 제목 경고
        return reply.status(409).send({
          code: 'DUPLICATE_TITLE',
          error: `'${story.title}' 제목의 스토리가 이미 있어요.`,
          suggestion: story.title.trim() + ` (${slug.split('-').pop()})`,
        });
      }

      await prisma.story.update({
        where: { id },
        data:  { status: 'ONGOING' as any, slug },
      });

      await cache.del(`story:detail:${id}`);
      await Promise.all([
        cache.del('stories:list:*'),
        cache.del(`stories:trending:*`),
      ]);

      return reply.send({ success: true, data: { id, status: 'ONGOING' } });
    },
  });

  // ─────────────────────────────────────────────
  // DELETE STORY (작성자 삭제)
  // ─────────────────────────────────────────────
  fastify.delete('/:id', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId  = request.userId!;

      const story = await prisma.story.findFirst({ where: { id, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

      // S3 커버 이미지 삭제
      await Promise.all([
        story.coverKey         ? deleteS3Object(story.coverKey).catch(() => {})         : Promise.resolve(),
        story.coverVerticalKey ? deleteS3Object(story.coverVerticalKey).catch(() => {}) : Promise.resolve(),
      ]);

      await prisma.story.update({ where: { id }, data: { isActive: false } });
      await cache.del(`story:detail:${id}`);
      return reply.status(204).send();
    },
  });

  // ─────────────────────────────────────────────
  // LIKE STORY
  // ─────────────────────────────────────────────
  fastify.post('/:id/like', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;
      const { id } = request.params as { id: string };

      const existing = await prismaRead.storyLike.findUnique({
        where: { userId_storyId: { userId, storyId: id } },
      });

      if (existing) {
        await prisma.storyLike.delete({ where: { userId_storyId: { userId, storyId: id } } });
        await prisma.story.update({ where: { id }, data: { likeCount: { decrement: 1 } } });
        return reply.send({ liked: false });
      } else {
        await prisma.storyLike.create({ data: { userId, storyId: id } });
        await prisma.story.update({ where: { id }, data: { likeCount: { increment: 1 } } });
        return reply.send({ liked: true });
      }
    },
  });

  // ─────────────────────────────────────────────
  // FAVORITE STORY
  // ─────────────────────────────────────────────
  fastify.post('/:id/favorite', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;
      const { id } = request.params as { id: string };

      const existing = await prismaRead.storyFavorite.findUnique({
        where: { userId_storyId: { userId, storyId: id } },
      });

      if (existing) {
        await prisma.storyFavorite.delete({ where: { userId_storyId: { userId, storyId: id } } });
        await prisma.story.update({ where: { id }, data: { favoriteCount: { decrement: 1 } } });
        return reply.send({ favorited: false });
      } else {
        await prisma.storyFavorite.create({ data: { userId, storyId: id } });
        await prisma.story.update({ where: { id }, data: { favoriteCount: { increment: 1 } } });
        return reply.send({ favorited: true });
      }
    },
  });

  // ─────────────────────────────────────────────
  // START / GET STORY CONVERSATION
  // ─────────────────────────────────────────────
  fastify.post('/:id/conversations', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;
      const { id: storyId } = request.params as { id: string };

      const story = await prismaRead.story.findFirst({
        where: { id: storyId, isActive: true },
      });
      if (!story) return reply.status(404).send({ error: { message: '스토리를 찾을 수 없습니다.' } });

      // Find or create conversation
      let conversation = await prismaRead.storyConversation.findFirst({
        where: { storyId, userId, isActive: true },
        orderBy: { createdAt: 'desc' },
      });

      if (!conversation) {
        conversation = await prisma.storyConversation.create({
          data: { storyId, userId },
        });
        // Increment chat count
        await prisma.story.update({ where: { id: storyId }, data: { chatCount: { increment: 1 } } });
      }

      return reply.send({ conversation });
    },
  });

  // ─────────────────────────────────────────────
  // GET CONVERSATION MESSAGES
  // ─────────────────────────────────────────────
  fastify.get('/conversations/:conversationId/messages', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;
      const { conversationId } = request.params as { conversationId: string };
      const { cursor, limit = 30 } = request.query as { cursor?: string; limit?: number };

      const conversation = await prismaRead.storyConversation.findFirst({
        where: { id: conversationId, userId },
      });
      if (!conversation) return reply.status(404).send({ error: { message: '대화를 찾을 수 없습니다.' } });

      const messages = await prismaRead.storyMessage.findMany({
        where: { conversationId, ...(cursor ? { id: { lt: cursor } } : {}) },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
      });

      return reply.send({ messages: messages.reverse(), hasMore: messages.length === Number(limit) });
    },
  });

  // ─────────────────────────────────────────────
  // DELETE CONVERSATION (대화 삭제)
  // ─────────────────────────────────────────────
  fastify.delete('/conversations/:conversationId', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;
      const { conversationId } = request.params as { conversationId: string };

      const conversation = await prisma.storyConversation.findFirst({
        where: { id: conversationId, userId },
      });
      if (!conversation) return reply.status(404).send({ error: '대화를 찾을 수 없습니다.' });

      await prisma.storyConversation.update({
        where: { id: conversationId },
        data: { isActive: false },
      });
      return reply.status(204).send();
    },
  });

  // ─────────────────────────────────────────────
  // SEND MESSAGE (SSE Streaming)
  // ─────────────────────────────────────────────
  fastify.post('/conversations/:conversationId/messages', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;
      const { conversationId } = request.params as { conversationId: string };
      const { content } = request.body as { content: string };

      if (!content?.trim()) {
        return reply.status(400).send({ error: { message: '메시지를 입력해주세요.' } });
      }

      const conversation = await prismaRead.storyConversation.findFirst({
        where: { id: conversationId, userId },
        include: { story: true },
      });
      if (!conversation) return reply.status(404).send({ error: { message: '대화를 찾을 수 없습니다.' } });

      // Credit check
      const user = await prismaRead.user.findUnique({ where: { id: userId }, select: { creditBalance: true } });
      if (!user || user.creditBalance < 1) {
        return reply.status(402).send({ error: { code: 'INSUFFICIENT_CREDITS', message: '크레딧이 부족합니다.' } });
      }

      // Decrypt system prompt
      let systemPrompt = decrypt(conversation.story.systemPromptEncrypted, conversation.story.systemPromptIv);

      // Get recent messages for context
      const recentMessages = await prismaRead.storyMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      // ── 키워드북 주입 ───────────────────────────────────────────────────────
      try {
        const storyId = conversation.storyId;
        const cacheKey = `keyword-notes:${storyId}:all`;
        let allNotes: { id: string; keywords: string[]; content: string }[] | null = await cache.get(cacheKey);
        if (!allNotes) {
          const dbNotes = await prismaRead.storyKeywordNote.findMany({
            where: { startSetting: { storyId } },
            select: { id: true, keywords: true, content: true },
          });
          allNotes = dbNotes;
          await cache.set(cacheKey, dbNotes, 60);
        }

        if (allNotes.length > 0) {
          // 최근 AI 응답 (마지막 assistant 메시지)
          const lastAssistant = recentMessages.find((m: any) => m.role === 'ASSISTANT')?.content ?? '';
          const searchText = (content.trim() + ' ' + lastAssistant).toLowerCase();

          // 매칭된 노트 선택 (토큰 예산 2000자 이내)
          const TOKEN_BUDGET = 2000;
          const matched: typeof allNotes = [];
          let budget = 0;

          for (const note of allNotes) {
            const hit = note.keywords.some(kw => searchText.includes(kw.toLowerCase()));
            if (hit && budget + note.content.length <= TOKEN_BUDGET) {
              matched.push(note);
              budget += note.content.length;
            }
          }

          if (matched.length > 0) {
            const contextBlock = matched.map(n => n.content).join('\n\n');
            systemPrompt = systemPrompt + '\n\n--- 활성화된 세계관 정보 ---\n' + contextBlock + '\n---';

            // triggerCount 비동기 업데이트 (응답 지연 없음)
            const matchedIds = matched.map(n => n.id);
            prisma.storyKeywordNote.updateMany({
              where: { id: { in: matchedIds } },
              data: { triggerCount: { increment: 1 } },
            }).catch(() => {});
          }
        }
      } catch (kwErr) {
        logger.warn({ kwErr }, 'Keyword injection failed, proceeding without it');
      }
      // ────────────────────────────────────────────────────────────────────────

      // Save user message
      await prisma.storyMessage.create({
        data: { conversationId, role: 'USER', content: content.trim(), creditCost: 0 },
      });

      // Set SSE headers (manual CORS needed because raw streaming bypasses Fastify CORS plugin)
      const reqOrigin = request.headers.origin;
      if (reqOrigin) {
        reply.raw.setHeader('Access-Control-Allow-Origin', reqOrigin);
        reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');
      }
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('X-Accel-Buffering', 'no');
      reply.raw.flushHeaders();

      const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
        ...recentMessages.reverse().map((m: any) => ({
          role: (m.role === 'USER' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.content as string,
        })),
        { role: 'user' as const, content: content.trim() },
      ];

      let fullResponse = '';
      let inputTokens = 0;
      let outputTokens = 0;

      try {
        // OpenAI 스트리밍 (Anthropic에서 전환)
        const stream = await openai.chat.completions.create({
          model: process.env.OPENAI_HAIKU_MODEL || 'gpt-4o-mini',
          max_tokens: 1024,
          stream: true,
          stream_options: { include_usage: true },
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages,
          ],
        });

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || '';
          if (text) {
            fullResponse += text;
            reply.raw.write(`event: delta\ndata: ${JSON.stringify({ text })}\n\n`);
          }
          if (chunk.usage) {
            inputTokens = chunk.usage.prompt_tokens;
            outputTokens = chunk.usage.completion_tokens;
          }
        }

        const creditCost = Math.max(1, Math.ceil((inputTokens * 0.003 + outputTokens * 0.015) / 10));

        // Save assistant message and deduct credit
        await Promise.all([
          prisma.storyMessage.create({
            data: { conversationId, role: 'ASSISTANT', content: fullResponse, creditCost, status: 'SENT' },
          }),
          prisma.user.update({
            where: { id: userId },
            data: { creditBalance: { decrement: creditCost } },
          }),
          prisma.storyConversation.update({
            where: { id: conversationId },
            data: { messageCount: { increment: 2 }, lastMessageAt: new Date() },
          }),
        ]);

        const updatedUser = await prismaRead.user.findUnique({ where: { id: userId }, select: { creditBalance: true } });

        reply.raw.write(`event: done\ndata: ${JSON.stringify({ creditCost, remainingCredits: updatedUser?.creditBalance ?? 0 })}\n\n`);
        reply.raw.end();
      } catch (err) {
        logger.error({ err }, 'Story stream error');
        reply.raw.write(`event: error\ndata: ${JSON.stringify({ message: '오류가 발생했습니다.' })}\n\n`);
        reply.raw.end();
      }
    },
  });

  // ─────────────────────────────────────────────
  // MY STORIES
  // ─────────────────────────────────────────────
  fastify.get('/my', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;
      const { page = 1, limit = 20 } = request.query as { page?: number; limit?: number };

      const pageNum = Math.min(Math.max(Number(page), 1), 100);
      const limitNum = Math.min(Math.max(Number(limit), 1), 50);

      const [total, stories] = await Promise.all([
        prismaRead.story.count({ where: { authorId: userId, isActive: true } }),
        prismaRead.story.findMany({
          where: { authorId: userId, isActive: true },
          orderBy: { createdAt: 'desc' },
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
          select: {
            id: true, title: true, coverUrl: true, category: true,
            status: true, visibility: true, chatCount: true, likeCount: true, createdAt: true,
          },
        }),
      ]);

      return reply.send({ data: stories, meta: { total, page: pageNum, limit: limitNum } });
    },
  });

  // ─────────────────────────────────────────────
  // AI GENERATION: RANDOM NAME
  // ─────────────────────────────────────────────
  fastify.post('/generate/random-name', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      try {
        const msg = await openai.chat.completions.create({
          model: process.env.OPENAI_HAIKU_MODEL || 'gpt-4o-mini',
          max_tokens: 100,
          messages: [{
            role: 'user',
            content: '한국 판타지/로맨스 스토리에 어울리는 창의적인 스토리 제목이나 주인공 이름을 한 개만 생성해줘. 이름만 답변해. 특수문자 없이 2~10자.',
          }],
        });
        const name = (msg.choices[0].message.content ?? '').trim().slice(0, 30);
        return reply.send({ name });
      } catch (err) {
        logger.error(err, 'random name generation failed');
        // Fallback names
        const fallbacks = ['달빛 소녀', '검은 기사', '별의 수호자', '붉은 여명', '은빛 늑대', '하늘의 아이', '금빛 용사', '새벽의 전사'];
        return reply.send({ name: fallbacks[Math.floor(Math.random() * fallbacks.length)] });
      }
    },
  });

  // ─────────────────────────────────────────────
  // AI GENERATION: STORY SETTINGS (system prompt)
  // ─────────────────────────────────────────────
  fastify.post('/generate/story-settings', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { name, description, existingContent } = request.body as { name?: string; description?: string; existingContent?: string };
      if (!name && !description && !existingContent) {
        return reply.status(400).send({ error: '프로필 이름 또는 소개를 먼저 입력해주세요.' });
      }
      try {
        const baseInstruction = existingContent?.trim()
          ? `다음 스토리 정보와 기존에 작성된 내용을 바탕으로 더 풍부하고 완성도 높은 AI 스토리 시스템 프롬프트를 한국어로 재작성해줘.
스토리 제목: ${name || '미정'}
한줄소개: ${description || '미정'}
기존 작성 내용:
${existingContent}

기존 내용의 핵심은 유지하되, 더 구체적이고 풍부하게 확장해줘.`
          : `다음 스토리 정보를 바탕으로 AI 스토리 시스템 프롬프트를 한국어로 작성해줘.
스토리 제목: ${name || '미정'}
한줄소개: ${description || '미정'}`;

        const msg = await openai.chat.completions.create({
          model: process.env.OPENAI_SONNET_MODEL || 'gpt-4o',
          max_tokens: 1500,
          messages: [{
            role: 'user',
            content: `${baseInstruction}

시스템 프롬프트 작성 규칙:
- {user}는 사용자, {char}는 주인공을 지칭
- 세계관, 배경, 등장인물 성격, 관계를 상세히 설명
- 스토리 분위기와 규칙을 명확히 기술
- 1500자 이내
- 시스템 프롬프트만 답변, 설명 없이`,
          }],
        });
        const systemPrompt = (msg.choices[0].message.content ?? '').trim();
        return reply.send({ systemPrompt });
      } catch (err) {
        logger.error(err, 'story settings generation failed');
        return reply.status(500).send({ error: '생성 중 오류가 발생했습니다.' });
      }
    },
  });

  // ─────────────────────────────────────────────
  // AI GENERATION: EXAMPLE DIALOGUES
  // ─────────────────────────────────────────────
  fastify.post('/generate/examples', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { name, description, systemPrompt } = request.body as {
        name?: string; description?: string; systemPrompt?: string;
      };
      try {
        const msg = await openai.chat.completions.create({
          model: process.env.OPENAI_SONNET_MODEL || 'gpt-4o',
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: `당신은 인터랙티브 AI 스토리 대화 예시 작성 전문가입니다.

스토리 제목: ${name || '미정'}
스토리 설명: ${description || ''}
${systemPrompt ? `세계관/캐릭터 설정:\n${systemPrompt.slice(0, 600)}` : ''}

위 스토리에 어울리는 전개 예시 대화 3쌍을 생성해줘.

규칙:
- user: 사용자가 자연스럽게 던질 수 있는 짧은 한국어 말 (1~2문장, 말투는 캐주얼)
- assistant: AI 캐릭터의 응답. 반드시 *지문* "대사" 형식으로 작성
  - *지문*: 이탤릭체 별표로 감싼 행동/상황 묘사 (예: *아델라가 미소를 지으며 대답한다.*)
  - "대사": 큰따옴표로 감싼 실제 대사 (예: "오늘은 정말 바빴어! 같이 이야기해볼래?")
  - 지문과 대사는 캐릭터 성격·세계관과 어울려야 함
  - 대사는 자연스럽고 몰입감 있게

반드시 아래 JSON 형식으로만 답변 (다른 텍스트 없이):
[
  {"user": "사용자 말 1", "assistant": "*지문1* \\"대사1\\""},
  {"user": "사용자 말 2", "assistant": "*지문2* \\"대사2\\""},
  {"user": "사용자 말 3", "assistant": "*지문3* \\"대사3\\""}
]`,
          }],
        });
        const text = (msg.choices[0].message.content ?? '').trim();
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        const examples = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        return reply.send({ examples });
      } catch (err) {
        logger.error(err, 'examples generation failed');
        return reply.status(500).send({ error: '생성 중 오류가 발생했습니다.' });
      }
    },
  });

  // ─────────────────────────────────────────────
  // AI GENERATION: PROLOGUE
  // ─────────────────────────────────────────────
  fastify.post('/generate/prologue', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { name, description, systemPrompt, settingName } = request.body as {
        name?: string; description?: string; systemPrompt?: string; settingName?: string;
      };
      try {
        const msg = await openai.chat.completions.create({
          model: process.env.OPENAI_SONNET_MODEL || 'gpt-4o',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `다음 스토리의 프롤로그를 한국어로 작성해줘.
스토리: ${name || '미정'} - ${description || ''}
시작 설정: ${settingName || '기본 설정'}
${systemPrompt ? `세계관: ${systemPrompt.slice(0, 400)}` : ''}

프롤로그 작성 규칙:
- 독자를 스토리 세계로 끌어들이는 서술
- 분위기와 배경을 생생하게 묘사
- 1000자 이내
- 프롤로그 텍스트만 답변`,
          }],
        });
        const prologue = (msg.choices[0].message.content ?? '').trim();
        return reply.send({ prologue });
      } catch (err) {
        logger.error(err, 'prologue generation failed');
        return reply.status(500).send({ error: '생성 중 오류가 발생했습니다.' });
      }
    },
  });

  // ─────────────────────────────────────────────
  // AI GENERATION: STAT DESCRIPTION
  // ─────────────────────────────────────────────
  fastify.post('/generate/stat-description', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { storyName, storyDescription, systemPrompt, statName, statUnit } = request.body as {
        storyName?: string;
        storyDescription?: string;
        systemPrompt?: string;
        statName?: string;
        statUnit?: string;
      };

      if (!storyName?.trim() || !storyDescription?.trim() || !statName?.trim()) {
        return reply.status(400).send({
          error: '스토리 이름, 스토리 설정 및 정보, 스탯 이름이 필요합니다.',
        });
      }

      try {
        const msg = await openai.chat.completions.create({
          model: process.env.OPENAI_SONNET_MODEL || 'gpt-4o',
          max_tokens: 600,
          messages: [{
            role: 'user',
            content: `당신은 인터랙티브 AI 스토리 시스템의 스탯 설계 전문가입니다.

스토리 제목: ${storyName}
스토리 설정: ${storyDescription.slice(0, 600)}
${systemPrompt ? `세계관 상세: ${systemPrompt.slice(0, 400)}` : ''}
스탯 이름: ${statName}
${statUnit ? `스탯 단위: ${statUnit}` : ''}

위 스토리에서 "${statName}" 스탯에 대한 AI 행동 지침 설명을 작성해줘.

작성 규칙:
- {user}는 사용자, {char}는 주인공 캐릭터를 지칭
- 스탯이 증가/감소하는 구체적인 조건을 3~5줄로 작성
- 형식 예시: "{user}가 [행동]하면 증가한다.", "{char}가 [상태]이면 감소한다."
- 스토리 세계관과 분위기에 맞게 작성
- 설명문만 출력, 제목이나 부연설명 없이
- 500자 이내`,
          }],
        });

        const description = (msg.choices[0].message.content ?? '').trim().slice(0, 500);
        return reply.send({ description });
      } catch (err) {
        logger.error(err, 'stat description generation failed');
        return reply.status(500).send({ error: '생성 중 오류가 발생했습니다.' });
      }
    },
  });

  // ─────────────────────────────────────────────
  // START SETTINGS CRUD  (/:storyId/start-settings)
  // ─────────────────────────────────────────────
  // ─────────────────────────────────────────────
  // DRAFT SNAPSHOT — 전체 draft 상태 한번에 서버 동기화
  // startSettings(prologue/situation/playGuide/suggestedReplies) + examples 전체 upsert
  // ─────────────────────────────────────────────
  fastify.patch('/:id/draft-snapshot', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId = request.userId!;

      const story = await prisma.story.findFirst({ where: { id, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

      const { startSettings, examples } = request.body as {
        startSettings?: { localId: string; name: string; prologue: string; situation: string; playGuide: string; suggestedReplies: string[] }[];
        examples?: { localId: string; user: string; assistant: string }[];
      };

      const result: { startSettingIdMap?: Record<string, string>; exampleIdMap?: Record<string, string> } = {};

      // ── startSettings 동기화 ──
      if (startSettings !== undefined) {
        const serverSettings = await prisma.storyStartSetting.findMany({
          where: { storyId: id },
          orderBy: { order: 'asc' },
        });
        const settingIdMap: Record<string, string> = {};

        for (let i = 0; i < startSettings.length; i++) {
          const local = startSettings[i];
          const server = serverSettings[i];

          if (server) {
            await prisma.$transaction(async (tx) => {
              await tx.storySuggestedReply.deleteMany({ where: { startSettingId: server.id } });
              if (local.suggestedReplies.length > 0) {
                await tx.storySuggestedReply.createMany({
                  data: local.suggestedReplies.map((text, idx) => ({ startSettingId: server.id, text, order: idx })),
                });
              }
              await tx.storyStartSetting.update({
                where: { id: server.id },
                data: { name: local.name, prologue: local.prologue, situation: local.situation, playGuide: local.playGuide ?? '' },
              });
            });
            settingIdMap[local.localId] = server.id;
          } else {
            const created = await prisma.storyStartSetting.create({
              data: {
                storyId: id, name: local.name, prologue: local.prologue,
                situation: local.situation, playGuide: local.playGuide ?? '', order: i,
                suggestedReplies: { create: local.suggestedReplies.map((text, idx) => ({ text, order: idx })) },
              },
            });
            settingIdMap[local.localId] = created.id;
          }
        }
        // 로컬보다 서버에 더 많은 설정이 있으면 삭제
        for (let i = startSettings.length; i < serverSettings.length; i++) {
          await prisma.storyStartSetting.delete({ where: { id: serverSettings[i].id } }).catch(() => {});
        }
        result.startSettingIdMap = settingIdMap;

        // story.greeting을 첫 번째 startSetting의 prologue와 동기화
        if (startSettings.length > 0 && startSettings[0].prologue !== undefined) {
          await prisma.story.update({
            where: { id },
            data: { greeting: startSettings[0].prologue },
          });
        }
      }

      // ── examples 동기화 (전체 교체) ──
      if (examples !== undefined) {
        await prisma.storyExample.deleteMany({ where: { storyId: id } });
        const exampleIdMap: Record<string, string> = {};
        const toCreate = examples.filter(e => e.user?.trim() || e.assistant?.trim());
        for (let i = 0; i < toCreate.length; i++) {
          const ex = toCreate[i];
          const created = await prisma.storyExample.create({
            data: { storyId: id, userMessage: ex.user, assistantMessage: ex.assistant, order: i },
          });
          exampleIdMap[ex.localId] = created.id;
        }
        result.exampleIdMap = exampleIdMap;
      }

      await cache.del(`story:detail:${id}`);
      return reply.send({ data: result });
    },
  });

  fastify.get('/:storyId/start-settings', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { storyId } = request.params as { storyId: string };
      const userId = request.userId!;
      const story = await prismaRead.story.findFirst({ where: { id: storyId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });
      // 비공개 스토리는 작성자만 조회 가능
      if (story.visibility === 'PRIVATE' && story.authorId !== userId) {
        return reply.status(403).send({ error: '접근 권한이 없습니다.' });
      }

      const settings = await prismaRead.storyStartSetting.findMany({
        where: { storyId },
        orderBy: { order: 'asc' },
        include: { suggestedReplies: { orderBy: { order: 'asc' } } },
      });
      return reply.send({ data: settings });
    },
  });

  fastify.post('/:storyId/start-settings', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { storyId } = request.params as { storyId: string };
      const userId = request.userId!;
      const { name, prologue, situation, playGuide, suggestedReplies = [] } = request.body as {
        name: string; prologue?: string; situation?: string; playGuide?: string; suggestedReplies?: string[];
      };

      const story = await prisma.story.findFirst({ where: { id: storyId, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

      const count = await prisma.storyStartSetting.count({ where: { storyId } });
      if (count >= 5) return reply.status(400).send({ error: '시작 설정은 최대 5개까지 추가할 수 있습니다.' });

      const setting = await prisma.storyStartSetting.create({
        data: {
          storyId, name, prologue: prologue ?? '', situation: situation ?? '',
          playGuide: playGuide ?? '', order: count,
          suggestedReplies: {
            create: suggestedReplies.map((text, i) => ({ text, order: i })),
          },
        },
        include: { suggestedReplies: true },
      });
      return reply.status(201).send({ data: setting });
    },
  });

  fastify.put('/:storyId/start-settings/:settingId', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { storyId, settingId } = request.params as { storyId: string; settingId: string };
      const userId = request.userId!;
      const { name, prologue, situation, playGuide, suggestedReplies } = request.body as {
        name?: string; prologue?: string; situation?: string; playGuide?: string; suggestedReplies?: string[];
      };

      const story = await prisma.story.findFirst({ where: { id: storyId, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

      const updated = await prisma.$transaction(async (tx) => {
        if (suggestedReplies !== undefined) {
          await tx.storySuggestedReply.deleteMany({ where: { startSettingId: settingId } });
          await tx.storySuggestedReply.createMany({
            data: suggestedReplies.map((text, i) => ({ startSettingId: settingId, text, order: i })),
          });
        }
        return tx.storyStartSetting.update({
          where: { id: settingId },
          data: { ...(name && { name }), ...(prologue !== undefined && { prologue }), ...(situation !== undefined && { situation }), ...(playGuide !== undefined && { playGuide }) },
          include: { suggestedReplies: { orderBy: { order: 'asc' } } },
        });
      });
      return reply.send({ data: updated });
    },
  });

  fastify.delete('/:storyId/start-settings/:settingId', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { storyId, settingId } = request.params as { storyId: string; settingId: string };
      const userId = request.userId!;
      const story = await prisma.story.findFirst({ where: { id: storyId, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });
      await prisma.storyStartSetting.delete({ where: { id: settingId } });
      return reply.status(204).send();
    },
  });

  // ─────────────────────────────────────────────
  // KEYWORD NOTES CRUD
  // ─────────────────────────────────────────────
  const keywordNoteBodySchema = z.object({
    startSettingId: z.string(),
    title:    z.string().min(1).max(100).default('키워드 노트'),
    keywords: z.array(z.string().max(50)).max(20),
    content:  z.string().max(1000),
    order:    z.number().int().default(0),
  });

  // GET /api/stories/:storyId/keyword-notes
  fastify.get('/:storyId/keyword-notes', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { storyId } = request.params as { storyId: string };
      const userId = request.userId!;
      const story = await prisma.story.findFirst({ where: { id: storyId, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

      const { startSettingId } = request.query as { startSettingId?: string };
      const cacheKey = `keyword-notes:${storyId}:${startSettingId ?? 'all'}`;
      const cached = await cache.get(cacheKey);
      if (cached) return reply.send({ data: cached });

      const notes = await prisma.storyKeywordNote.findMany({
        where: {
          startSetting: { storyId },
          ...(startSettingId ? { startSettingId } : {}),
        },
        orderBy: { order: 'asc' },
      });

      await cache.set(cacheKey, notes, 60);
      return reply.send({ data: notes });
    },
  });

  // POST /api/stories/:storyId/keyword-notes
  fastify.post('/:storyId/keyword-notes', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { storyId } = request.params as { storyId: string };
      const userId = request.userId!;
      const story = await prisma.story.findFirst({ where: { id: storyId, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

      const body = keywordNoteBodySchema.parse(request.body);

      const setting = await prisma.storyStartSetting.findFirst({
        where: { id: body.startSettingId, storyId },
      });
      if (!setting) return reply.status(404).send({ error: '시작설정을 찾을 수 없습니다.' });

      const note = await prisma.storyKeywordNote.create({ data: body });

      await Promise.all([
        cache.del(`keyword-notes:${storyId}:all`),
        cache.del(`keyword-notes:${storyId}:${body.startSettingId}`),
      ]);

      return reply.status(201).send({ data: note });
    },
  });

  // PUT /api/stories/:storyId/keyword-notes/:noteId
  fastify.put('/:storyId/keyword-notes/:noteId', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { storyId, noteId } = request.params as { storyId: string; noteId: string };
      const userId = request.userId!;
      const story = await prisma.story.findFirst({ where: { id: storyId, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

      const note = await prisma.storyKeywordNote.findFirst({
        where: { id: noteId, startSetting: { storyId } },
      });
      if (!note) return reply.status(404).send({ error: '키워드 노트를 찾을 수 없습니다.' });

      const body = keywordNoteBodySchema.partial().parse(request.body);

      // startSettingId 변경 시 새 설정도 이 스토리 소속인지 검증
      if (body.startSettingId && body.startSettingId !== note.startSettingId) {
        const newSetting = await prisma.storyStartSetting.findFirst({
          where: { id: body.startSettingId, storyId },
        });
        if (!newSetting) return reply.status(404).send({ error: '시작설정을 찾을 수 없습니다.' });
      }

      const updated = await prisma.storyKeywordNote.update({ where: { id: noteId }, data: body });

      const cacheKeys = [`keyword-notes:${storyId}:all`, `keyword-notes:${storyId}:${note.startSettingId}`];
      if (body.startSettingId && body.startSettingId !== note.startSettingId) {
        cacheKeys.push(`keyword-notes:${storyId}:${body.startSettingId}`);
      }
      await Promise.all(cacheKeys.map(k => cache.del(k)));

      return reply.send({ data: updated });
    },
  });

  // DELETE /api/stories/:storyId/keyword-notes/:noteId
  fastify.delete('/:storyId/keyword-notes/:noteId', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { storyId, noteId } = request.params as { storyId: string; noteId: string };
      const userId = request.userId!;
      const story = await prisma.story.findFirst({ where: { id: storyId, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

      const note = await prisma.storyKeywordNote.findFirst({
        where: { id: noteId, startSetting: { storyId } },
      });
      if (!note) return reply.status(404).send({ error: '키워드 노트를 찾을 수 없습니다.' });

      await prisma.storyKeywordNote.delete({ where: { id: noteId } });

      await Promise.all([
        cache.del(`keyword-notes:${storyId}:all`),
        cache.del(`keyword-notes:${storyId}:${note.startSettingId}`),
      ]);

      return reply.status(204).send();
    },
  });

  // ─────────────────────────────────────────────
  // STORY ENDINGS CRUD
  // ─────────────────────────────────────────────
  const endingBodySchema = z.object({
    startSettingId: z.string().optional().nullable(),
    grade:          z.enum(['N', 'R', 'SR', 'SSR']).default('N'),
    name:           z.string().min(1).max(20),
    sortOrder:      z.number().int().default(0),
    minTurnStart:   z.number().int().min(10).default(10),
    prompt:         z.string().max(500).default(''),
    epilogue:       z.string().max(1000).optional().nullable(),
    hint:           z.string().max(20).optional().nullable(),
    imageUrl:       z.string().url().optional().nullable(),
    rules:          z.array(z.object({
      id:        z.string().optional(),
      turnStart: z.number().int().min(10),
      sortOrder: z.number().int().default(0),
    })).default([]),
  });

  // GET  /api/stories/:storyId/endings
  fastify.get('/:storyId/endings', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { storyId } = request.params as { storyId: string };
      const userId = request.userId!;
      const story = await prisma.story.findFirst({ where: { id: storyId, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

      const { startSettingId } = request.query as { startSettingId?: string };
      const endings = await prisma.storyEnding.findMany({
        where: { storyId, ...(startSettingId ? { startSettingId } : {}) },
        include: { rules: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { sortOrder: 'asc' },
      });
      return reply.send({ data: endings });
    },
  });

  // POST /api/stories/:storyId/endings
  fastify.post('/:storyId/endings', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { storyId } = request.params as { storyId: string };
      const userId = request.userId!;
      const story = await prisma.story.findFirst({ where: { id: storyId, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

      // 시작설정 별 최대 10개 제한
      const existing = await prisma.storyEnding.count({ where: { storyId } });
      if (existing >= 10) return reply.status(400).send({ error: '엔딩은 최대 10개까지 등록할 수 있습니다.' });

      const body = endingBodySchema.parse(request.body);
      const { rules, ...rest } = body;

      const ending = await prisma.storyEnding.create({
        data: {
          ...rest,
          storyId,
          rules: {
            create: rules.map((r, i) => ({ turnStart: r.turnStart, sortOrder: i })),
          },
        },
        include: { rules: { orderBy: { sortOrder: 'asc' } } },
      });
      return reply.status(201).send({ data: ending });
    },
  });

  // PUT /api/stories/:storyId/endings/:endingId
  fastify.put('/:storyId/endings/:endingId', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { storyId, endingId } = request.params as { storyId: string; endingId: string };
      const userId = request.userId!;
      const story = await prisma.story.findFirst({ where: { id: storyId, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

      const ending = await prisma.storyEnding.findFirst({ where: { id: endingId, storyId } });
      if (!ending) return reply.status(404).send({ error: '엔딩을 찾을 수 없습니다.' });

      const body = endingBodySchema.parse(request.body);
      const { rules, ...rest } = body;

      const updated = await prisma.$transaction(async (tx) => {
        // Replace rules
        await tx.storyEndingRule.deleteMany({ where: { endingId } });
        return tx.storyEnding.update({
          where: { id: endingId },
          data: {
            ...rest,
            rules: {
              create: rules.map((r, i) => ({ turnStart: r.turnStart, sortOrder: i })),
            },
          },
          include: { rules: { orderBy: { sortOrder: 'asc' } } },
        });
      });
      return reply.send({ data: updated });
    },
  });

  // DELETE /api/stories/:storyId/endings/:endingId
  fastify.delete('/:storyId/endings/:endingId', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { storyId, endingId } = request.params as { storyId: string; endingId: string };
      const userId = request.userId!;
      const story = await prisma.story.findFirst({ where: { id: storyId, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });
      await prisma.storyEnding.deleteMany({ where: { id: endingId, storyId } });
      return reply.status(204).send();
    },
  });

  // ─────────────────────────────────────────────
  // AI PREVIEW CHAT (창작 폼 내 실시간 테스트용)
  // 드래프트 스토리의 systemPrompt로 실제 AI 대화 스트리밍
  // ─────────────────────────────────────────────
  fastify.post('/preview-chat', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { systemPrompt, history, userMessage, characterName, exampleDialogues } = request.body as {
        systemPrompt: string;
        history: Array<{ role: 'user' | 'assistant'; content: string }>;
        userMessage: string;
        characterName?: string;
        exampleDialogues?: Array<{ id: string; messages: Array<{ role: 'character' | 'user'; content: string }> }>;
      };

      if (!userMessage?.trim()) {
        return reply.status(400).send({ error: '메시지를 입력해주세요.' });
      }

      const reqOrigin2 = request.headers.origin;
      if (reqOrigin2) {
        reply.raw.setHeader('Access-Control-Allow-Origin', reqOrigin2);
        reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');
      }
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('X-Accel-Buffering', 'no');
      reply.raw.flushHeaders();

      try {
        let baseSystem = systemPrompt?.trim()
          ? systemPrompt
          : `당신은 ${characterName || 'AI 캐릭터'}입니다. 캐릭터에 맞게 자연스럽게 대화해주세요.`;

        // 예시 대화를 few-shot으로 시스템 프롬프트에 포함
        if (exampleDialogues && exampleDialogues.length > 0) {
          const validExamples = exampleDialogues.filter(ex => ex.messages && ex.messages.length > 0);
          if (validExamples.length > 0) {
            const exampleText = validExamples.map((ex, i) => {
              const lines = ex.messages.map(m =>
                m.role === 'character'
                  ? `${characterName || '캐릭터'}: ${m.content}`
                  : `사용자: ${m.content}`
              ).join('\n');
              return `[예시 ${i + 1}]\n${lines}`;
            }).join('\n\n');
            baseSystem += `\n\n아래는 대화 예시입니다. 이 예시를 참고하여 캐릭터의 말투와 성격을 유지하세요:\n\n${exampleText}`;
          }
        }

        const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
          ...((history ?? []).slice(-10) as Array<{ role: 'user' | 'assistant'; content: string }>),
          { role: 'user', content: userMessage.trim() },
        ];

        const stream = await openai.chat.completions.create({
          model: process.env.OPENAI_HAIKU_MODEL || 'gpt-4o-mini',
          max_tokens: 512,
          stream: true,
          messages: [
            { role: 'system', content: baseSystem },
            ...messages,
          ],
        });

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || '';
          if (text) {
            reply.raw.write(`event: delta\ndata: ${JSON.stringify({ text })}\n\n`);
          }
        }

        reply.raw.write(`event: done\ndata: ${JSON.stringify({})}\n\n`);
        reply.raw.end();
      } catch (err) {
        logger.error(err, 'preview chat failed');
        reply.raw.write(`event: error\ndata: ${JSON.stringify({ message: 'AI 응답 오류가 발생했습니다.' })}\n\n`);
        reply.raw.end();
      }
    },
  });

  // POST /api/stories/generate/epilogue  (AI 자동생성)
  fastify.post('/generate/epilogue', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { storyName, prompt, endingName } = request.body as {
        storyName: string; prompt: string; endingName: string;
      };
      const msg = await openai.chat.completions.create({
        model: process.env.OPENAI_HAIKU_MODEL || 'gpt-4o-mini',
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: `스토리 "${storyName}"의 엔딩 "${endingName}"에 대한 에필로그를 300자 이내로 작성해줘.\n조건: ${prompt}\n감동적이고 자연스럽게 마무리되도록 써줘.`,
        }],
      });
      const text = (msg.choices[0].message.content ?? '');
      return reply.send({ epilogue: text.slice(0, 1000) });
    },
  });
};
