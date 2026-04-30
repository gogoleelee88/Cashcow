import type { FastifyPluginAsync } from 'fastify';
import { prisma, prismaRead } from '../lib/prisma';
import { requireAuth } from '../plugins/auth.plugin';
import { chatRateLimit } from '../plugins/rate-limit.plugin';
import { filterUserMessage, estimateTokens, extractEpisodicMemory, updateRelationshipState, generateConversationGreeting } from '../services/ai.service';
import { decrypt } from '../lib/encryption';
import { enqueueMemoryCompression, enqueueAutoModeration } from '../services/queue.service';
import { chatMessagesTotal, creditsConsumedTotal } from '../lib/metrics';
import { logger } from '../lib/logger';

export const chatRoutes: FastifyPluginAsync = async (fastify) => {
  // ─────────────────────────────────────────────
  // GET CONVERSATIONS
  // ─────────────────────────────────────────────
  fastify.get('/conversations', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { page = 1, limit = 20 } = request.query as { page?: number; limit?: number };
      const skip = (Number(page) - 1) * Number(limit);

      const conversations = await prismaRead.conversation.findMany({
        where: { userId: request.userId!, isActive: true },
        orderBy: [{ isPinned: 'desc' }, { lastMessageAt: 'desc' }],
        skip,
        take: Number(limit),
        include: {
          character: {
            select: { id: true, name: true, avatarUrl: true, category: true, greeting: true, prologue: true, playGuide: true, suggestedReplies: true, situationImages: true },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            where: { isHidden: false },
            select: { id: true, role: true, content: true, createdAt: true },
          },
        },
      });

      const result = conversations.map(({ messages, ...conv }) => ({
        ...conv,
        lastMessage: messages[0] ?? null,
        generatedGreeting: (conv as any).generatedGreeting ?? null,
      }));

      return reply.send({ success: true, data: result });
    },
  });

  // ─────────────────────────────────────────────
  // GET OR CREATE CONVERSATION
  // ─────────────────────────────────────────────
  fastify.post('/conversations', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { characterId } = request.body as { characterId: string };

      const character = await prismaRead.character.findFirst({
        where: { id: characterId, visibility: { not: 'PRIVATE' }, isActive: true },
        select: {
          id: true, name: true, greeting: true, ageRating: true,
          systemPromptEncrypted: true, systemPromptIv: true,
        },
      });

      if (!character) {
        return reply.code(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: '캐릭터를 찾을 수 없습니다.' },
        });
      }

      // Age restriction check
      if (character.ageRating === 'MATURE') {
        const user = await prisma.user.findUnique({
          where: { id: request.userId! },
          select: { ageVerified: true },
        });
        if (!user?.ageVerified) {
          return reply.code(403).send({
            success: false,
            error: { code: 'AGE_VERIFICATION_REQUIRED', message: '성인 콘텐츠에 접근하려면 성인 인증이 필요합니다.' },
          });
        }
      }

      // Get or create conversation (one per user-character pair by default)
      let conversation = await prisma.conversation.findFirst({
        where: { userId: request.userId!, characterId, isActive: true },
        orderBy: { createdAt: 'desc' },
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            userId: request.userId!,
            characterId,
            title: character.name,
          },
        });

        // Increment chat count
        await prisma.character.update({
          where: { id: characterId },
          data: { chatCount: { increment: 1 } },
        });

        // 캐릭터 시스템프롬프트 기반 동적 greeting 생성 (비동기, 응답 블로킹 안 함)
        const systemPromptRaw = character.systemPromptEncrypted && character.systemPromptIv
          ? decrypt(character.systemPromptEncrypted, character.systemPromptIv)
          : '';

        generateConversationGreeting(
          character.name,
          systemPromptRaw,
          character.greeting
        ).then((generated) => {
          return prisma.conversation.update({
            where: { id: conversation!.id },
            data: { generatedGreeting: generated },
          });
        }).catch((err) => logger.warn({ err }, 'generateConversationGreeting failed'));
      }

      return reply.send({ success: true, data: conversation });
    },
  });

  // ─────────────────────────────────────────────
  // GENERATE GREETING FOR EXISTING CONVERSATION
  // ─────────────────────────────────────────────
  fastify.post('/conversations/:id/greeting', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };

      const conversation = await prisma.conversation.findFirst({
        where: { id, userId: request.userId!, isActive: true },
        include: {
          character: {
            select: { id: true, name: true, greeting: true, systemPromptEncrypted: true, systemPromptIv: true },
          },
        },
      });

      if (!conversation) {
        return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: '대화를 찾을 수 없습니다.' } });
      }

      const char = conversation.character;
      const systemPromptRaw = char.systemPromptEncrypted && char.systemPromptIv
        ? decrypt(char.systemPromptEncrypted, char.systemPromptIv)
        : '';

      const generated = await generateConversationGreeting(char.name, systemPromptRaw, char.greeting);

      await prisma.conversation.update({
        where: { id },
        data: { generatedGreeting: generated },
      });

      return reply.send({ success: true, data: { generatedGreeting: generated } });
    },
  });

  // ─────────────────────────────────────────────
  // GET CONVERSATION MESSAGES
  // ─────────────────────────────────────────────
  fastify.get('/conversations/:id/messages', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const { cursor, limit = 30 } = request.query as { cursor?: string; limit?: number };

      const conversation = await prismaRead.conversation.findFirst({
        where: { id, userId: request.userId! },
      });

      if (!conversation) {
        return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: '대화를 찾을 수 없습니다.' } });
      }

      const where: any = { conversationId: id };
      if (cursor) {
        where.createdAt = { lt: new Date(cursor) };
      }

      const messages = await prismaRead.message.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Number(limit) + 1,
        select: {
          id: true, role: true, content: true, status: true,
          isFiltered: true, isHidden: true, createdAt: true,
        },
      });

      const hasMore = messages.length > Number(limit);
      if (hasMore) messages.pop();
      messages.reverse();

      const processed = messages.map((m) =>
        m.isHidden ? { ...m, content: '[삭제된 메시지입니다.]' } : m
      );

      return reply.send({
        success: true,
        data: processed,
        meta: {
          hasMore,
          nextCursor: hasMore ? messages[0]?.createdAt.toISOString() : null,
        },
      });
    },
  });

  // ─────────────────────────────────────────────
  // SEND MESSAGE + STREAM RESPONSE
  // Uses Server-Sent Events for streaming
  // ─────────────────────────────────────────────
  fastify.post('/conversations/:id/messages', {
    preHandler: [requireAuth, chatRateLimit],
    handler: async (request, reply) => {
      const { id: conversationId } = request.params as { id: string };
      const { content } = request.body as { content: string };

      if (!content?.trim()) {
        return reply.code(400).send({
          success: false,
          error: { code: 'EMPTY_MESSAGE', message: '메시지를 입력해주세요.' },
        });
      }

      if (content.length > 4000) {
        return reply.code(400).send({
          success: false,
          error: { code: 'MESSAGE_TOO_LONG', message: '메시지가 너무 깁니다. (최대 4,000자)' },
        });
      }

      // Content safety check
      const filterResult = filterUserMessage(content);
      if (!filterResult.safe) {
        return reply.code(400).send({
          success: false,
          error: { code: 'CONTENT_FILTERED', message: '정책에 위반되는 내용이 포함되어 있습니다.' },
        });
      }

      const conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, userId: request.userId!, isActive: true },
        include: {
          character: {
            select: {
              id: true, name: true, model: true, maxTokens: true,
              systemPromptEncrypted: true, systemPromptIv: true,
              temperature: true, creatorId: true, revenuePerChat: true,
              situationImages: true,
            },
          },
        },
      });

      if (!conversation) {
        return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: '대화를 찾을 수 없습니다.' } });
      }

      // Credit check
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: request.userId! },
        select: { creditBalance: true, subscriptionTier: true },
      });

      // Free tier has message limits
      const minCreditRequired = conversation.character.model === 'claude-sonnet-4' ? 5 : 1;
      if (user.subscriptionTier === 'FREE' && user.creditBalance < minCreditRequired) {
        return reply.code(402).send({
          success: false,
          error: { code: 'INSUFFICIENT_CREDITS', message: '크레딧이 부족합니다. 충전해주세요.' },
        });
      }

      // Save user message
      const userMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'USER',
          content,
          inputTokens: estimateTokens(content),
        },
      });

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date(), messageCount: { increment: 1 } },
      });

      // Setup SSE streaming
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('X-Accel-Buffering', 'no');
      // CORS headers must be set manually here because reply.raw.flushHeaders()
      // bypasses Fastify's onSend lifecycle where @fastify/cors normally injects them
      const origin = request.headers.origin;
      if (origin) {
        reply.raw.setHeader('Access-Control-Allow-Origin', origin);
        reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');
      }
      reply.raw.flushHeaders();

      const sendEvent = (event: string, data: unknown) => {
        reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      // AbortController for disconnection handling
      const abortController = new AbortController();
      request.raw.on('close', () => {
        abortController.abort();
        logger.debug({ conversationId }, 'Client disconnected during stream');
      });

      let assistantMessageId: string | null = null;

      try {
        sendEvent('start', { conversationId, userMessageId: userMessage.id });

        const { streamChatResponse, calculateCreditCost } = await import('../services/ai.service');
        const { config } = await import('../config');

        const model = conversation.character.model === 'claude-sonnet-4'
          ? config.OPENAI_SONNET_MODEL
          : config.OPENAI_HAIKU_MODEL;

        await streamChatResponse({
          characterId: conversation.characterId,
          conversationId,
          userId: request.userId!,
          userMessage: content,
          signal: abortController.signal,

          onChunk: (text) => {
            sendEvent('delta', { text });
          },

          onComplete: async ({ inputTokens, outputTokens, fullText, imageId }) => {
            const creditCost = calculateCreditCost(inputTokens, outputTokens, model);

            // Save assistant message
            const assistantMessage = await prisma.message.create({
              data: {
                conversationId,
                role: 'ASSISTANT',
                content: fullText,
                inputTokens,
                outputTokens,
                creditCost,
              },
            });

            assistantMessageId = assistantMessage.id;

            // Deduct credits and record usage
            await prisma.$transaction([
              prisma.user.update({
                where: { id: request.userId! },
                data: { creditBalance: { decrement: creditCost } },
              }),
              prisma.conversation.update({
                where: { id: conversationId },
                data: {
                  messageCount: { increment: 1 },
                  tokenCount: { increment: inputTokens + outputTokens },
                  lastMessageAt: new Date(),
                },
              }),
              prisma.transaction.create({
                data: {
                  userId: request.userId!,
                  type: 'USAGE',
                  amount: creditCost,
                  credits: -creditCost,
                  status: 'COMPLETED',
                  description: `Chat with ${conversation.character.name}`,
                },
              }),
            ]);

            // Update metrics
            chatMessagesTotal.inc({ tier: user.subscriptionTier });
            creditsConsumedTotal.inc({ model: conversation.character.model }, creditCost);

            // 상황 이미지 SSE 이벤트 (Phase 3)
            if (imageId) {
              type SituationImage = { id: string; url: string; triggerKeywords: string[]; description: string };
              const situationImages = (conversation.character as any).situationImages as SituationImage[] | null;
              const matchedImage = situationImages?.find((img) => img.id === imageId);
              if (matchedImage) {
                sendEvent('image', { imageId, imageUrl: matchedImage.url });
              }
            }

            // 비동기 백그라운드 메모리 트리거들 (응답 지연 없음)
            const msgCount = await prisma.message.count({ where: { conversationId } });

            // 자동 모더레이션: 모든 AI 응답 비동기 검수
            enqueueAutoModeration({
              messageId: assistantMessage.id,
              content: fullText,
              characterName: conversation.character.name,
              conversationId,
              userId: request.userId!,
            }).catch((err) => logger.warn({ err, conversationId }, 'Auto moderation enqueue failed'));

            // 계층 1: 20의 배수마다 압축 (20, 40, 60...)
            if (msgCount % 20 === 0) {
              enqueueMemoryCompression(conversationId).catch((err) =>
                logger.warn({ err, conversationId }, 'Memory compression enqueue failed')
              );
            }

            // 계층 2: 30의 배수마다 에피소딕 기억 추출
            if (msgCount % 30 === 0) {
              extractEpisodicMemory(conversationId).catch((err) =>
                logger.warn({ err, conversationId }, 'Episodic memory extraction failed')
              );
            }

            // 계층 3: 50의 배수마다 관계 상태 업데이트
            if (msgCount % 50 === 0) {
              updateRelationshipState(conversationId).catch((err) =>
                logger.warn({ err, conversationId }, 'Relationship state update failed')
              );
            }

            sendEvent('done', {
              messageId: assistantMessage.id,
              inputTokens,
              outputTokens,
              creditCost,
              remainingCredits: user.creditBalance - creditCost,
            });

            reply.raw.end();
          },

          onError: async (err) => {
            logger.error({ err, conversationId }, 'AI stream error');

            // Save error message so user knows what happened
            if (!assistantMessageId) {
              await prisma.message.create({
                data: {
                  conversationId,
                  role: 'ASSISTANT',
                  content: '죄송합니다. 일시적인 오류가 발생했습니다. 다시 시도해주세요.',
                  status: 'ERROR',
                },
              });
            }

            sendEvent('error', { message: '응답 생성 중 오류가 발생했습니다.' });
            reply.raw.end();
          },
        });
      } catch (err) {
        logger.error({ err, conversationId }, 'Chat handler error');
        sendEvent('error', { message: '서버 오류가 발생했습니다.' });
        reply.raw.end();
      }

      return reply;
    },
  });

  // ─────────────────────────────────────────────
  // DELETE CONVERSATION
  // ─────────────────────────────────────────────
  fastify.delete('/conversations/:id', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };

      const conversation = await prisma.conversation.findFirst({
        where: { id, userId: request.userId! },
      });

      if (!conversation) {
        return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: '대화를 찾을 수 없습니다.' } });
      }

      await prisma.conversation.update({ where: { id }, data: { isActive: false } });
      return reply.send({ success: true });
    },
  });

  // ─────────────────────────────────────────────
  // PIN / UNPIN CONVERSATION
  // ─────────────────────────────────────────────
  fastify.post('/conversations/:id/pin', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };

      const conversation = await prisma.conversation.findFirst({
        where: { id, userId: request.userId! },
      });

      if (!conversation) {
        return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: '대화를 찾을 수 없습니다.' } });
      }

      const updated = await prisma.conversation.update({
        where: { id },
        data: { isPinned: !conversation.isPinned },
      });

      return reply.send({ success: true, data: { isPinned: updated.isPinned } });
    },
  });
};
