import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma, prismaRead } from '../lib/prisma';
import { cache } from '../lib/redis';
import { encrypt, decrypt } from '../lib/encryption';
import { requireAuth } from '../plugins/auth.plugin';
import { searchRateLimit } from '../plugins/rate-limit.plugin';
import { logger } from '../lib/logger';
// StoryCategory, CharacterVisibility, AgeRating types used as strings (Prisma client not yet generated)
import Anthropic from '@anthropic-ai/sdk';

const CACHE_TTL_LIST = 120;
const CACHE_TTL_DETAIL = 300;
const CACHE_TTL_TRENDING = 600;

const createStorySchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(10).max(1000),
  systemPrompt: z.string().min(20).max(10000),
  greeting: z.string().min(1).max(2000),
  category: z.enum(['ROMANCE', 'FANTASY', 'MYSTERY', 'THRILLER', 'SF', 'HISTORICAL', 'HORROR', 'COMEDY', 'ADVENTURE', 'SLICE_OF_LIFE', 'OTHER']),
  tags: z.array(z.string().max(30)).max(10).default([]),
  visibility: z.enum(['PUBLIC', 'PRIVATE', 'UNLISTED']).default('PUBLIC'),
  ageRating: z.enum(['ALL', 'TEEN', 'MATURE']).default('ALL'),
  language: z.string().default('ko'),
});

export const storyRoutes: FastifyPluginAsync = async (fastify) => {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
  // CREATE STORY
  // ─────────────────────────────────────────────
  fastify.post('/', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;
      const body = createStorySchema.parse(request.body);

      const { encrypted: enc, iv } = encrypt(body.systemPrompt);

      const story = await prisma.story.create({
        data: {
          title: body.title,
          description: body.description,
          greeting: body.greeting,
          category: body.category as any,
          tags: body.tags,
          visibility: body.visibility as any,
          ageRating: body.ageRating as any,
          language: body.language,
          systemPromptEncrypted: enc,
          systemPromptIv: iv,
          authorId: userId,
        },
        select: { id: true, title: true, createdAt: true },
      });

      return reply.status(201).send({ story });
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
      const systemPrompt = decrypt(conversation.story.systemPromptEncrypted, conversation.story.systemPromptIv);

      // Get recent messages for context
      const recentMessages = await prismaRead.storyMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      // Save user message
      await prisma.storyMessage.create({
        data: { conversationId, role: 'USER', content: content.trim(), creditCost: 0 },
      });

      // Set SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      const messages = [
        ...recentMessages.reverse().map((m: any) => ({
          role: m.role === 'USER' ? 'user' : 'assistant' as const,
          content: m.content,
        })),
        { role: 'user' as const, content: content.trim() },
      ];

      let fullResponse = '';
      let inputTokens = 0;
      let outputTokens = 0;

      try {
        const stream = anthropic.messages.stream({
          model: 'claude-haiku-4-5',
          max_tokens: 1024,
          system: systemPrompt,
          messages,
        });

        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            fullResponse += event.delta.text;
            reply.raw.write(`event: delta\ndata: ${JSON.stringify({ text: event.delta.text })}\n\n`);
          }
          if (event.type === 'message_delta' && event.usage) {
            outputTokens = event.usage.output_tokens;
          }
          if (event.type === 'message_start' && event.message.usage) {
            inputTokens = event.message.usage.input_tokens;
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
        prismaRead.story.count({ where: { authorId: userId } }),
        prismaRead.story.findMany({
          where: { authorId: userId },
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
        const msg = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 100,
          messages: [{
            role: 'user',
            content: '한국 판타지/로맨스 스토리에 어울리는 창의적인 스토리 제목이나 주인공 이름을 한 개만 생성해줘. 이름만 답변해. 특수문자 없이 2~10자.',
          }],
        });
        const name = (msg.content[0] as { text: string }).text.trim().slice(0, 30);
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
      const { name, description } = request.body as { name?: string; description?: string };
      if (!name && !description) {
        return reply.status(400).send({ error: '프로필 이름 또는 소개를 먼저 입력해주세요.' });
      }
      try {
        const msg = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1500,
          messages: [{
            role: 'user',
            content: `다음 스토리 정보를 바탕으로 AI 스토리 시스템 프롬프트를 한국어로 작성해줘.
스토리 제목: ${name || '미정'}
한줄소개: ${description || '미정'}

시스템 프롬프트 작성 규칙:
- {user}는 사용자, {char}는 주인공을 지칭
- 세계관, 배경, 등장인물 성격, 관계를 상세히 설명
- 스토리 분위기와 규칙을 명확히 기술
- 1500자 이내
- 시스템 프롬프트만 답변, 설명 없이`,
          }],
        });
        const systemPrompt = (msg.content[0] as { text: string }).text.trim();
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
        const msg = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: `다음 스토리를 위한 전개 예시 대화 3쌍을 생성해줘.
스토리: ${name || '미정'} - ${description || ''}
${systemPrompt ? `설정: ${systemPrompt.slice(0, 500)}` : ''}

반드시 다음 JSON 형식으로만 답변:
[
  {"user": "사용자 입력 예시 1", "assistant": "AI 응답 예시 1"},
  {"user": "사용자 입력 예시 2", "assistant": "AI 응답 예시 2"},
  {"user": "사용자 입력 예시 3", "assistant": "AI 응답 예시 3"}
]`,
          }],
        });
        const text = (msg.content[0] as { text: string }).text.trim();
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
        const msg = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
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
        const prologue = (msg.content[0] as { text: string }).text.trim();
        return reply.send({ prologue });
      } catch (err) {
        logger.error(err, 'prologue generation failed');
        return reply.status(500).send({ error: '생성 중 오류가 발생했습니다.' });
      }
    },
  });

  // ─────────────────────────────────────────────
  // START SETTINGS CRUD  (/:storyId/start-settings)
  // ─────────────────────────────────────────────
  fastify.get('/:storyId/start-settings', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { storyId } = request.params as { storyId: string };
      const userId = request.userId!;
      const story = await prismaRead.story.findFirst({ where: { id: storyId, authorId: userId } });
      if (!story) return reply.status(404).send({ error: '스토리를 찾을 수 없습니다.' });

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
};
