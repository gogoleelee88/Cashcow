import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma, prismaRead } from '../lib/prisma';
import { cache, CacheKeys } from '../lib/redis';
import { encrypt, decrypt } from '../lib/encryption';
import { generatePresignedUploadUrl, uploadBufferToStorage, deleteS3Object } from '../services/storage.service';
import { requireAuth, requireAgeVerification } from '../plugins/auth.plugin';
import { searchRateLimit, uploadRateLimit } from '../plugins/rate-limit.plugin';
import { logger } from '../lib/logger';
import type { CharacterCategory, CharacterVisibility, AgeRating, AudienceTarget } from '@prisma/client';
import { randomBytes } from 'crypto';

const CACHE_TTL_CHARACTER_LIST = 120;  // 2 min
const CACHE_TTL_CHARACTER_DETAIL = 300; // 5 min
const CACHE_TTL_TRENDING = 600;         // 10 min
const CACHE_TTL_RANKINGS = 300;         // 5 min

const exampleMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['character', 'user']),
  content: z.string().max(2000),
});
const exampleDialogueSchema = z.object({
  id: z.string(),
  messages: z.array(exampleMessageSchema).max(50),
});

const situationImageSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  description: z.string().max(200),
  triggerKeywords: z.array(z.string().max(50)).max(20),
});

const createCharacterSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().min(10).max(500),
  detailDescription: z.string().max(1000).optional(),
  systemPrompt: z.string().min(20).max(10000),
  greeting: z.string().min(1).max(1000),
  prologue: z.string().max(2000).optional(),
  exampleDialogues: z.array(exampleDialogueSchema).max(20).optional(),
  playGuide: z.string().max(2000).optional(),
  suggestedReplies: z.array(z.string().max(100)).max(10).optional(),
  situationImages: z.array(situationImageSchema).max(50).optional(),
  category: z.enum(['ANIME', 'GAME', 'MOVIE', 'BOOK', 'ORIGINAL', 'CELEBRITY', 'HISTORICAL', 'VTUBER', 'OTHER']),
  tags: z.array(z.string().max(30)).max(10).default([]),
  visibility: z.enum(['PUBLIC', 'PRIVATE', 'UNLISTED']).default('PUBLIC'),
  ageRating: z.enum(['ALL', 'TEEN', 'MATURE']).default('ALL'),
  audienceTarget: z.enum(['ALL', 'MALE_ORIENTED', 'FEMALE_ORIENTED']).default('ALL'),
  commentDisabled: z.boolean().default(false),
  voiceProvider: z.enum(['elevenlabs', 'openai']).optional(),
  voiceId: z.string().max(100).optional(),
  voiceSettings: z.object({
    stability: z.number().min(0).max(1).optional(),
    similarity_boost: z.number().min(0).max(1).optional(),
    style: z.number().min(0).max(1).optional(),
    speed: z.number().min(0.5).max(2).optional(),
  }).optional(),
  imageKey: z.string().optional(),
  language: z.string().default('ko'),
  model: z.enum(['claude-haiku-3', 'claude-sonnet-4']).default('claude-haiku-3'),
  temperature: z.number().min(0).max(1).default(0.8),
  maxTokens: z.number().min(128).max(4096).default(1024),
});

export const characterRoutes: FastifyPluginAsync = async (fastify) => {
  // ─────────────────────────────────────────────
  // LIST / SEARCH CHARACTERS
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
        ageRating,
        language,
        tags,
        audienceTarget,
        isFanCreation,
      } = request.query as {
        page?: number;
        limit?: number;
        category?: CharacterCategory;
        sort?: string;
        q?: string;
        ageRating?: AgeRating;
        language?: string;
        tags?: string;
        audienceTarget?: AudienceTarget;
        isFanCreation?: string;
      };

      const pageNum = Math.min(Math.max(Number(page), 1), 100);
      const limitNum = Math.min(Math.max(Number(limit), 1), 50);
      const skip = (pageNum - 1) * limitNum;

      // Cache key (only cache first page of non-search queries)
      const cacheKey =
        !q && pageNum <= 3
          ? CacheKeys.characterList(category, sort, pageNum)
          : null;

      if (cacheKey) {
        const cached = await cache.get(cacheKey);
        if (cached) return reply.send(cached);
      }

      const where: any = {
        visibility: 'PUBLIC',
        isActive: true,
      };

      if (category) where.category = category;
      if (ageRating) where.ageRating = ageRating;
      if (language) where.language = language;
      if (audienceTarget) where.audienceTarget = audienceTarget;
      if (isFanCreation === 'true') where.isFanCreation = true;
      if (q) {
        where.OR = [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { tags: { has: q } },
        ];
      }
      if (tags) {
        const tagList = tags.split(',').map((t) => t.trim());
        where.tags = { hasSome: tagList };
      }

      const orderBy = {
        trending: { trendingScore: 'desc' as const },
        newest: { createdAt: 'desc' as const },
        popular: { chatCount: 'desc' as const },
        liked: { likeCount: 'desc' as const },
        weekly: { weeklyChats: 'desc' as const },
        monthly: { monthlyChats: 'desc' as const },
      }[sort] || { trendingScore: 'desc' as const };

      const [characters, total] = await Promise.all([
        prismaRead.character.findMany({
          where,
          orderBy,
          skip,
          take: limitNum,
          select: {
            id: true,
            name: true,
            description: true,
            avatarUrl: true,
            category: true,
            tags: true,
            ageRating: true,
            language: true,
            chatCount: true,
            likeCount: true,
            weeklyChats: true,
            monthlyChats: true,
            trendingScore: true,
            isFeatured: true,
            isOfficial: true,
            isFanCreation: true,
            gender: true,
            audienceTarget: true,
            greeting: true,
            model: true,
            createdAt: true,
            creator: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
        }),
        prismaRead.character.count({ where }),
      ]);

      const response = {
        success: true,
        data: characters,
        meta: {
          page: pageNum,
          limit: limitNum,
          total,
          hasMore: skip + limitNum < total,
        },
      };

      if (cacheKey) await cache.set(cacheKey, response, CACHE_TTL_CHARACTER_LIST);
      return reply.send(response);
    },
  });

  // ─────────────────────────────────────────────
  // TRENDING
  // ─────────────────────────────────────────────
  fastify.get('/trending', {
    handler: async (request, reply) => {
      const { period = '24h' } = request.query as { period?: string };
      const cacheKey = CacheKeys.trending(period);

      const cached = await cache.get(cacheKey);
      if (cached) return reply.send(cached);

      const since = new Date(
        Date.now() - ({ '1h': 3600, '24h': 86400, '7d': 604800 }[period] || 86400) * 1000
      );

      // Calculate trending based on recent chat activity
      const trending = await prismaRead.$queryRaw<Array<{ id: string; score: number }>>`
        SELECT c.id,
               (c."chatCount" * 0.4 + c."likeCount" * 0.3 +
                COUNT(DISTINCT m.id) FILTER (WHERE m."createdAt" > ${since}) * 0.3) AS score
        FROM characters c
        LEFT JOIN conversations cv ON cv."characterId" = c.id
        LEFT JOIN messages m ON m."conversationId" = cv.id
        WHERE c.visibility = 'PUBLIC' AND c."isActive" = true
        GROUP BY c.id
        ORDER BY score DESC
        LIMIT 20
      `;

      const ids = trending.map((t) => t.id);
      const characters = await prismaRead.character.findMany({
        where: { id: { in: ids } },
        select: {
          id: true, name: true, description: true, avatarUrl: true,
          category: true, chatCount: true, likeCount: true, greeting: true,
          isFeatured: true, isOfficial: true, model: true,
          creator: { select: { id: true, username: true, displayName: true } },
        },
      });

      // Preserve trending order
      const ordered = ids.map((id) => characters.find((c) => c.id === id)).filter(Boolean);
      const response = { success: true, data: ordered };

      await cache.set(cacheKey, response, CACHE_TTL_TRENDING);
      return reply.send(response);
    },
  });

  // ─────────────────────────────────────────────
  // RANKINGS (일간/주간/월간 + 타겟별)
  // ─────────────────────────────────────────────
  fastify.get('/rankings', {
    handler: async (request, reply) => {
      const {
        period = 'weekly',
        audienceTarget,
        isFanCreation,
        sort = 'chats',
        limit = 50,
      } = request.query as {
        period?: 'daily' | 'weekly' | 'monthly';
        audienceTarget?: AudienceTarget;
        isFanCreation?: string;
        sort?: 'chats' | 'likes' | 'newest';
        limit?: number;
      };

      const cacheKey = `rankings:${period}:${audienceTarget || 'all'}:${isFanCreation || 'false'}:${sort}`;
      const cached = await cache.get(cacheKey);
      if (cached) return reply.send(cached);

      const where: any = { visibility: 'PUBLIC', isActive: true };
      if (audienceTarget) where.audienceTarget = audienceTarget;
      if (isFanCreation === 'true') where.isFanCreation = true;

      const orderBy =
        sort === 'likes'
          ? { likeCount: 'desc' as const }
          : sort === 'newest'
          ? { createdAt: 'desc' as const }
          : period === 'daily'
          ? { trendingScore: 'desc' as const }
          : period === 'monthly'
          ? { monthlyChats: 'desc' as const }
          : { weeklyChats: 'desc' as const };

      const characters = await prismaRead.character.findMany({
        where,
        orderBy,
        take: Math.min(Number(limit), 100),
        select: {
          id: true,
          name: true,
          description: true,
          avatarUrl: true,
          category: true,
          tags: true,
          chatCount: true,
          likeCount: true,
          weeklyChats: true,
          monthlyChats: true,
          trendingScore: true,
          isFeatured: true,
          isOfficial: true,
          isFanCreation: true,
          gender: true,
          audienceTarget: true,
          greeting: true,
          model: true,
          createdAt: true,
          creator: {
            select: { id: true, username: true, displayName: true, avatarUrl: true },
          },
        },
      });

      const response = { success: true, data: characters, meta: { period, sort, total: characters.length } };
      await cache.set(cacheKey, response, CACHE_TTL_RANKINGS);
      return reply.send(response);
    },
  });

  // ─────────────────────────────────────────────
  // GET CHARACTER DETAIL
  // ─────────────────────────────────────────────
  fastify.get('/:id', {
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId = request.userId;
      const cacheKey = CacheKeys.characterDetail(id);

      const cached = await cache.get<any>(cacheKey);
      if (cached) {
        // Personalize cached response
        if (userId) {
          const [like, fav] = await Promise.all([
            prismaRead.characterLike.findUnique({ where: { userId_characterId: { userId, characterId: id } } }),
            prismaRead.characterFavorite.findUnique({ where: { userId_characterId: { userId, characterId: id } } }),
          ]);
          return reply.send({ ...cached, data: { ...cached.data, isLiked: !!like, isFavorited: !!fav } });
        }
        return reply.send(cached);
      }

      const character = await prismaRead.character.findFirst({
        where: { id, visibility: { not: 'PRIVATE' }, isActive: true },
        include: {
          creator: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
      });

      if (!character) {
        return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: '캐릭터를 찾을 수 없습니다.' } });
      }

      // Strip system prompt from response
      const { systemPromptEncrypted, systemPromptIv, ...safe } = character;

      const response = { success: true, data: safe };
      await cache.set(cacheKey, response, CACHE_TTL_CHARACTER_DETAIL);

      if (userId) {
        const [like, fav] = await Promise.all([
          prismaRead.characterLike.findUnique({ where: { userId_characterId: { userId, characterId: id } } }),
          prismaRead.characterFavorite.findUnique({ where: { userId_characterId: { userId, characterId: id } } }),
        ]);
        return reply.send({ ...response, data: { ...safe, isLiked: !!like, isFavorited: !!fav } });
      }

      return reply.send(response);
    },
  });

  // ─────────────────────────────────────────────
  // CREATE CHARACTER
  // ─────────────────────────────────────────────
  fastify.post('/', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const body = createCharacterSchema.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message },
        });
      }

      // Check creator character limit based on tier
      const user = await prisma.user.findUniqueOrThrow({ where: { id: request.userId } });
      const limits: Record<string, number> = {
        FREE: 3, BASIC: 10, PRO: 50, ENTERPRISE: 999,
      };
      const characterCount = await prisma.character.count({ where: { creatorId: request.userId! } });
      if (characterCount >= limits[user.subscriptionTier]) {
        return reply.code(403).send({
          success: false,
          error: { code: 'LIMIT_REACHED', message: `현재 플랜에서 최대 ${limits[user.subscriptionTier]}개의 캐릭터를 만들 수 있습니다.` },
        });
      }

      // Mature content requires age verification
      if (body.data.ageRating === 'MATURE' && !user.ageVerified) {
        return reply.code(403).send({
          success: false,
          error: { code: 'AGE_VERIFICATION_REQUIRED', message: '성인 콘텐츠 생성에는 성인 인증이 필요합니다.' },
        });
      }

      // Encrypt system prompt at rest
      const { encrypted, iv } = encrypt(body.data.systemPrompt);

      // imageKey → avatarUrl / avatarKey
      const { config: cfg } = await import('../config');
      const avatarKey = body.data.imageKey ?? null;
      const avatarUrl = avatarKey
        ? `${cfg.SUPABASE_URL}/storage/v1/object/public/characterverse/${avatarKey}`
        : null;

      const character = await prisma.character.create({
        data: {
          name: body.data.name,
          description: body.data.description,
          detailDescription: body.data.detailDescription ?? null,
          avatarUrl,
          avatarKey,
          systemPromptEncrypted: encrypted,
          systemPromptIv: iv,
          greeting: body.data.greeting,
          prologue: body.data.prologue ?? null,
          exampleDialogues: body.data.exampleDialogues as any ?? [],
          playGuide: body.data.playGuide ?? null,
          suggestedReplies: body.data.suggestedReplies as any ?? null,
          situationImages: body.data.situationImages as any ?? null,
          voiceProvider: body.data.voiceProvider ?? null,
          voiceId: body.data.voiceId ?? null,
          voiceSettings: body.data.voiceSettings as any ?? null,
          category: body.data.category,
          tags: body.data.tags,
          visibility: body.data.visibility,
          ageRating: body.data.ageRating,
          audienceTarget: body.data.audienceTarget,
          commentDisabled: body.data.commentDisabled,
          language: body.data.language,
          model: body.data.model,
          temperature: body.data.temperature,
          maxTokens: body.data.maxTokens,
          creatorId: request.userId!,
        },
        include: { creator: { select: { id: true, username: true, displayName: true } } },
      });

      const { systemPromptEncrypted, systemPromptIv, ...safe } = character;
      return reply.code(201).send({ success: true, data: safe });
    },
  });

  // ─────────────────────────────────────────────
  // UPDATE CHARACTER
  // ─────────────────────────────────────────────
  fastify.patch('/:id', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const character = await prisma.character.findFirst({
        where: { id, creatorId: request.userId! },
      });

      if (!character) {
        return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: '캐릭터를 찾을 수 없습니다.' } });
      }

      const body = createCharacterSchema.partial().safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message } });
      }

      const updateData: any = { ...body.data };
      if (body.data.systemPrompt) {
        const { encrypted, iv } = encrypt(body.data.systemPrompt);
        updateData.systemPromptEncrypted = encrypted;
        updateData.systemPromptIv = iv;
        delete updateData.systemPrompt;
      }
      if (body.data.exampleDialogues !== undefined) {
        updateData.exampleDialogues = body.data.exampleDialogues as any;
      }
      if (body.data.playGuide !== undefined) {
        updateData.playGuide = body.data.playGuide;
      }
      if (body.data.suggestedReplies !== undefined) {
        updateData.suggestedReplies = body.data.suggestedReplies as any;
      }

      const updated = await prisma.character.update({
        where: { id },
        data: updateData,
        include: { creator: { select: { id: true, username: true, displayName: true } } },
      });

      // Invalidate cache
      await cache.del(CacheKeys.characterDetail(id));

      const { systemPromptEncrypted, systemPromptIv, ...safe } = updated;
      return reply.send({ success: true, data: safe });
    },
  });

  // ─────────────────────────────────────────────
  // DELETE CHARACTER
  // ─────────────────────────────────────────────
  fastify.delete('/:id', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const character = await prisma.character.findFirst({
        where: { id, creatorId: request.userId! },
      });

      if (!character) {
        return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: '캐릭터를 찾을 수 없습니다.' } });
      }

      // Soft delete
      await prisma.character.update({ where: { id }, data: { isActive: false, visibility: 'PRIVATE' } });

      // Clean up S3 assets
      if (character.avatarKey) await deleteS3Object(character.avatarKey);
      if (character.backgroundKey) await deleteS3Object(character.backgroundKey);

      await cache.del(CacheKeys.characterDetail(id));
      return reply.send({ success: true });
    },
  });

  // ─────────────────────────────────────────────
  // LIKE / UNLIKE
  // ─────────────────────────────────────────────
  fastify.post('/:id/like', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId = request.userId!;

      const existing = await prisma.characterLike.findUnique({
        where: { userId_characterId: { userId, characterId: id } },
      });

      if (existing) {
        await prisma.$transaction([
          prisma.characterLike.delete({ where: { userId_characterId: { userId, characterId: id } } }),
          prisma.character.update({ where: { id }, data: { likeCount: { decrement: 1 } } }),
        ]);
        await cache.del(CacheKeys.characterDetail(id));
        return reply.send({ success: true, data: { liked: false } });
      } else {
        await prisma.$transaction([
          prisma.characterLike.create({ data: { userId, characterId: id } }),
          prisma.character.update({ where: { id }, data: { likeCount: { increment: 1 } } }),
        ]);
        await cache.del(CacheKeys.characterDetail(id));
        return reply.send({ success: true, data: { liked: true } });
      }
    },
  });

  // ─────────────────────────────────────────────
  // FAVORITE / UNFAVORITE
  // ─────────────────────────────────────────────
  fastify.post('/:id/favorite', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId = request.userId!;

      const existing = await prisma.characterFavorite.findUnique({
        where: { userId_characterId: { userId, characterId: id } },
      });

      if (existing) {
        await prisma.$transaction([
          prisma.characterFavorite.delete({ where: { userId_characterId: { userId, characterId: id } } }),
          prisma.character.update({ where: { id }, data: { favoriteCount: { decrement: 1 } } }),
        ]);
        return reply.send({ success: true, data: { favorited: false } });
      } else {
        await prisma.$transaction([
          prisma.characterFavorite.create({ data: { userId, characterId: id } }),
          prisma.character.update({ where: { id }, data: { favoriteCount: { increment: 1 } } }),
        ]);
        return reply.send({ success: true, data: { favorited: true } });
      }
    },
  });

  // ─────────────────────────────────────────────
  // DIRECT MULTIPART UPLOAD (Supabase Storage)
  // POST /api/characters/upload
  // ─────────────────────────────────────────────
  fastify.post('/upload', {
    preHandler: [requireAuth, uploadRateLimit],
    config: { rawBody: false },
    handler: async (request, reply) => {
      const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      const MAX_SIZE = 5 * 1024 * 1024; // 5MB

      let fileBuffer: Buffer | null = null;
      let mimetype = '';
      let uploadType: 'avatar' | 'background' = 'avatar';

      for await (const part of request.parts()) {
        if (part.type === 'file' && part.fieldname === 'file') {
          mimetype = part.mimetype;
          if (!ALLOWED_TYPES.includes(mimetype)) {
            return reply.code(400).send({
              success: false,
              error: { code: 'INVALID_TYPE', message: 'JPG, PNG, WebP, GIF만 업로드할 수 있어요.' },
            });
          }
          fileBuffer = await part.toBuffer();
        } else if (part.type === 'field' && part.fieldname === 'type') {
          const val = part.value as string;
          if (val === 'background') uploadType = 'background';
        }
      }

      if (!fileBuffer) {
        return reply.code(400).send({
          success: false,
          error: { code: 'NO_FILE', message: '파일을 선택해 주세요.' },
        });
      }
      if (fileBuffer.length > MAX_SIZE) {
        return reply.code(400).send({
          success: false,
          error: { code: 'FILE_TOO_LARGE', message: '5MB 이하의 파일만 업로드할 수 있어요.' },
        });
      }

      const ext = mimetype.split('/')[1].replace('jpeg', 'jpg');
      const userId = request.userId!;
      const folder = uploadType === 'background' ? 'characters/backgrounds' : 'characters/avatars';
      const filename = `${userId}/${randomBytes(16).toString('hex')}.${ext}`;
      const key = `${folder}/${filename}`;

      let url: string;
      try {
        url = await uploadBufferToStorage(fileBuffer, folder as any, filename, mimetype);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error({ err, userId, key, size: fileBuffer.length }, 'Character image upload to storage failed');
        return reply.code(500).send({
          success: false,
          error: { code: 'STORAGE_ERROR', message: msg },
        });
      }

      logger.info({ userId, key, size: fileBuffer.length }, 'Character image uploaded to Supabase');
      return reply.send({ success: true, data: { url, key } });
    },
  });

  // ─────────────────────────────────────────────
  // UPLOAD URL (Pre-signed S3) — production only
  // ─────────────────────────────────────────────
  fastify.post('/upload-url', {
    preHandler: [requireAuth, uploadRateLimit],
    handler: async (request, reply) => {
      const { contentType, type } = request.body as {
        contentType: string;
        type: 'avatar' | 'background';
      };

      const uploadPath = type === 'background' ? 'characters/backgrounds' : 'characters/avatars';
      const result = await generatePresignedUploadUrl(uploadPath, contentType, request.userId!);
      return reply.send({ success: true, data: result });
    },
  });

  // ─────────────────────────────────────────────
  // MY CHARACTERS
  // ─────────────────────────────────────────────
  fastify.get('/my', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { page = 1, limit = 20 } = request.query as { page?: number; limit?: number };
      const skip = (Number(page) - 1) * Number(limit);

      const [characters, total] = await Promise.all([
        prisma.character.findMany({
          where: { creatorId: request.userId!, isActive: true },
          orderBy: { createdAt: 'desc' },
          skip,
          take: Number(limit),
          select: {
            id: true, name: true, description: true, avatarUrl: true,
            category: true, visibility: true, chatCount: true, likeCount: true,
            createdAt: true, updatedAt: true,
          },
        }),
        prisma.character.count({ where: { creatorId: request.userId!, isActive: true } }),
      ]);

      return reply.send({ success: true, data: characters, meta: { page: Number(page), limit: Number(limit), total } });
    },
  });

  // ─────────────────────────────────────────────
  // AI-ASSISTED CHARACTER GENERATION
  // Generates system prompt + greeting from brief concept
  // ─────────────────────────────────────────────
  fastify.post('/generate', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const schema = z.object({
        name: z.string().min(1).max(50),
        concept: z.string().min(5).max(300),
        category: z.enum(['ANIME', 'GAME', 'MOVIE', 'BOOK', 'ORIGINAL', 'CELEBRITY', 'HISTORICAL', 'VTUBER', 'OTHER']),
        language: z.string().default('ko'),
      });

      const body = schema.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message },
        });
      }

      const { name, concept, category, language } = body.data;

      const OpenAI = (await import('openai')).default;
      const { config: cfg } = await import('../config');
      const openai = new OpenAI({ apiKey: cfg.OPENAI_API_KEY });

      const langInstruction = language === 'ko' ? '한국어로 작성해주세요.' : 'Write in English.';

      let text: string;
      try {
        const response = await openai.chat.completions.create({
          model: cfg.OPENAI_HAIKU_MODEL,
          max_tokens: 1500,
          messages: [
            {
              role: 'user',
              content: `당신은 AI 캐릭터 제작 전문가입니다. 다음 정보를 바탕으로 캐릭터의 시스템 프롬프트와 첫 인사말을 생성해주세요.

캐릭터 이름: ${name}
캐릭터 개념: ${concept}
카테고리: ${category}

다음 JSON 형식으로 응답해주세요 (${langInstruction}):
{
  "systemPrompt": "캐릭터의 성격, 말투, 배경, 특징을 상세히 설명하는 시스템 프롬프트 (200-500자)",
  "greeting": "캐릭터가 처음 인사하는 말 (50-150자)",
  "description": "캐릭터 한 줄 소개 (50-100자)",
  "tags": ["태그1", "태그2", "태그3"]
}

JSON만 응답하고, 다른 텍스트는 포함하지 마세요.`,
            },
          ],
        });
        text = response.choices[0].message.content ?? '';
      } catch (err: any) {
        logger.error({ err, name, category }, 'OpenAI API call failed in /generate');
        return reply.code(502).send({
          success: false,
          error: { code: 'AI_API_ERROR', message: `OpenAI 호출 실패: ${err?.message ?? '알 수 없는 오류'}` },
        });
      }

      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found');
        const generated = JSON.parse(jsonMatch[0]);

        return reply.send({
          success: true,
          data: {
            systemPrompt: generated.systemPrompt || '',
            greeting: generated.greeting || '',
            description: generated.description || '',
            tags: Array.isArray(generated.tags) ? generated.tags.slice(0, 5) : [],
          },
        });
      } catch {
        logger.warn({ text }, 'Failed to parse AI generation response');
        return reply.code(500).send({
          success: false,
          error: { code: 'GENERATION_FAILED', message: 'AI 응답 파싱 실패. 직접 입력해주세요.' },
        });
      }
    },
  });

  // ─────────────────────────────────────────────
  // REPORT CHARACTER
  // ─────────────────────────────────────────────
  fastify.post('/:id/report', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const { reason, description } = request.body as { reason: string; description?: string };

      const character = await prismaRead.character.findFirst({
        where: { id, isActive: true },
        select: { creatorId: true },
      });

      if (!character) {
        return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND' } });
      }

      await prisma.report.create({
        data: {
          reporterId: request.userId!,
          reportedId: character.creatorId,
          characterId: id,
          reason,
          description,
        },
      });

      return reply.send({ success: true });
    },
  });

  // ─────────────────────────────────────────────
  // CHARACTER DRAFT — SAVE
  // ─────────────────────────────────────────────
  fastify.put('/draft', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;
      const data = request.body as Record<string, unknown>;

      await prisma.characterDraft.upsert({
        where: { userId },
        create: { userId, data: data as any },
        update: { data: data as any, updatedAt: new Date() },
      });

      return reply.code(200).send({ success: true });
    },
  });

  // ─────────────────────────────────────────────
  // CHARACTER DRAFT — GET
  // ─────────────────────────────────────────────
  fastify.get('/draft', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;

      const draft = await prismaRead.characterDraft.findUnique({
        where: { userId },
        select: { data: true, updatedAt: true },
      });

      if (!draft) {
        return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND' } });
      }

      return reply.send({ success: true, data: draft });
    },
  });

  // ─────────────────────────────────────────────
  // CHARACTER DRAFT — DELETE
  // ─────────────────────────────────────────────
  fastify.delete('/draft', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;

      await prisma.characterDraft.deleteMany({ where: { userId } });

      return reply.code(200).send({ success: true });
    },
  });

  // ── COMMENTS ──────────────────────────────────────────────

  fastify.get('/:id/comments', {
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const { page = '1', limit = '10' } = request.query as any;
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(50, parseInt(limit));
      const skip = (pageNum - 1) * limitNum;

      const userId = request.userId;

      const [comments, total] = await Promise.all([
        prismaRead.characterComment.findMany({
          where: { characterId: id },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum,
          include: {
            user: { select: { id: true, displayName: true, username: true, avatarUrl: true } },
            reactions: { select: { type: true, userId: true } },
          },
        }),
        prismaRead.characterComment.count({ where: { characterId: id } }),
      ]);

      const enriched = comments.map((c) => ({
        ...c,
        likeCount: c.reactions.filter((r) => r.type === 'LIKE').length,
        dislikeCount: c.reactions.filter((r) => r.type === 'DISLIKE').length,
        myReaction: userId ? (c.reactions.find((r) => r.userId === userId)?.type ?? null) : null,
        reactions: undefined,
      }));

      return reply.send({ success: true, data: enriched, meta: { total, page: pageNum, limit: limitNum } });
    },
  });

  fastify.post('/:id/comments', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId = request.userId!;
      const body = z.object({ content: z.string().min(1).max(500) }).parse(request.body);

      const character = await prismaRead.character.findUnique({ where: { id }, select: { id: true, commentDisabled: true } });
      if (!character) return reply.code(404).send({ success: false, error: { message: '캐릭터를 찾을 수 없습니다.' } });
      if (character.commentDisabled) return reply.code(403).send({ success: false, error: { message: '댓글이 비활성화된 캐릭터입니다.' } });

      const comment = await prisma.characterComment.create({
        data: { characterId: id, userId, content: body.content },
        include: { user: { select: { id: true, displayName: true, username: true, avatarUrl: true } } },
      });

      return reply.code(201).send({ success: true, data: comment });
    },
  });

  fastify.delete('/:id/comments/:commentId', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { id, commentId } = request.params as { id: string; commentId: string };
      const userId = request.userId!;

      const comment = await prismaRead.characterComment.findUnique({ where: { id: commentId } });
      if (!comment || comment.characterId !== id) return reply.code(404).send({ success: false });

      const user = await prismaRead.user.findUnique({ where: { id: userId }, select: { role: true } });
      if (comment.userId !== userId && user?.role !== 'ADMIN') {
        return reply.code(403).send({ success: false, error: { message: '권한이 없습니다.' } });
      }

      await prisma.characterComment.delete({ where: { id: commentId } });
      return reply.send({ success: true });
    },
  });

  // 댓글 좋아요/싫어요 토글
  fastify.post('/:id/comments/:commentId/react', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { commentId } = request.params as { id: string; commentId: string };
      const userId = request.userId!;
      const { type } = z.object({ type: z.enum(['LIKE', 'DISLIKE']) }).parse(request.body);

      const existing = await prismaRead.characterCommentReaction.findUnique({
        where: { commentId_userId: { commentId, userId } },
      });

      if (existing) {
        if (existing.type === type) {
          // 같은 타입 → 취소
          await prisma.characterCommentReaction.delete({ where: { id: existing.id } });
          return reply.send({ success: true, action: 'removed', type });
        } else {
          // 다른 타입 → 전환
          await prisma.characterCommentReaction.update({ where: { id: existing.id }, data: { type } });
          return reply.send({ success: true, action: 'switched', type });
        }
      }

      await prisma.characterCommentReaction.create({ data: { commentId, userId, type } });
      return reply.send({ success: true, action: 'added', type });
    },
  });

  // 댓글 신고
  fastify.post('/:id/comments/:commentId/report', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { id, commentId } = request.params as { id: string; commentId: string };
      const userId = request.userId!;
      const { reason } = z.object({ reason: z.string().min(1).max(200) }).parse(request.body);

      const comment = await prismaRead.characterComment.findUnique({ where: { id: commentId } });
      if (!comment || comment.characterId !== id) return reply.code(404).send({ success: false });

      await prisma.report.create({
        data: {
          reporterId: userId,
          reportedId: comment.userId,
          characterId: id,
          reason,
          description: `댓글 신고: ${commentId}`,
        },
      });

      return reply.send({ success: true });
    },
  });
};
