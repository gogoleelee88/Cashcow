import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../plugins/auth.plugin';
import { prismaRead, prisma } from '../lib/prisma';
import { z } from 'zod';

export const userRoutes: FastifyPluginAsync = async (fastify) => {
  // ─────────────────────────────────────────────
  // GET PUBLIC USER PROFILE
  // ─────────────────────────────────────────────
  fastify.get('/:username/profile', {
    handler: async (request, reply) => {
      const { username } = request.params as { username: string };
      const viewerUserId = (request as any).userId as string | undefined;

      const user = await prismaRead.user.findUnique({
        where: { username },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          bio: true,
          role: true,
          subscriptionTier: true,
          isVerified: true,
          createdAt: true,
          _count: {
            select: {
              characters: { where: { isActive: true, visibility: 'PUBLIC' } },
              followers: true,
              following: true,
            },
          },
          characters: {
            where: { isActive: true, visibility: 'PUBLIC' },
            orderBy: { chatCount: 'desc' },
            take: 12,
            select: {
              id: true, name: true, description: true, avatarUrl: true,
              chatCount: true, likeCount: true, isFeatured: true, category: true, tags: true,
            },
          },
        },
      });

      if (!user) {
        return reply.code(404).send({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: '사용자를 찾을 수 없습니다.' },
        });
      }

      let isFollowing = false;
      if (viewerUserId && viewerUserId !== user.id) {
        const follow = await prismaRead.follow.findUnique({
          where: { followerId_followingId: { followerId: viewerUserId, followingId: user.id } },
        });
        isFollowing = !!follow;
      }

      const [totalChatAgg, totalLikeAgg] = await Promise.all([
        prismaRead.character.aggregate({
          where: { creatorId: user.id, isActive: true },
          _sum: { chatCount: true },
        }),
        prismaRead.character.aggregate({
          where: { creatorId: user.id, isActive: true },
          _sum: { likeCount: true },
        }),
      ]);

      const { _count, ...safeUser } = user;

      return reply.send({
        success: true,
        data: {
          ...safeUser,
          characterCount: _count.characters,
          followerCount: _count.followers,
          followingCount: _count.following,
          totalChatCount: totalChatAgg._sum.chatCount ?? 0,
          totalLikeCount: totalLikeAgg._sum.likeCount ?? 0,
          isFollowing,
        },
      });
    },
  });

  // ─────────────────────────────────────────────
  // FOLLOW / UNFOLLOW (toggle)
  // ─────────────────────────────────────────────
  fastify.post('/:username/follow', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { username } = request.params as { username: string };
      const followerId = request.userId!;

      const target = await prismaRead.user.findUnique({
        where: { username },
        select: { id: true },
      });
      if (!target) {
        return reply.code(404).send({ success: false, error: { code: 'USER_NOT_FOUND' } });
      }
      if (target.id === followerId) {
        return reply.code(400).send({ success: false, error: { code: 'CANNOT_FOLLOW_SELF' } });
      }

      const existing = await prisma.follow.findUnique({
        where: { followerId_followingId: { followerId, followingId: target.id } },
      });

      if (existing) {
        await prisma.follow.delete({
          where: { followerId_followingId: { followerId, followingId: target.id } },
        });
        return reply.send({ success: true, data: { following: false } });
      } else {
        await prisma.follow.create({ data: { followerId, followingId: target.id } });
        return reply.send({ success: true, data: { following: true } });
      }
    },
  });

  // ─────────────────────────────────────────────
  // UPDATE OWN PROFILE
  // ─────────────────────────────────────────────
  fastify.patch('/me', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;
      const schema = z.object({
        displayName: z.string().min(1).max(30).optional(),
        bio: z.string().max(200).optional(),
        avatarUrl: z.string().url().nullish(),
      });

      const body = schema.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message },
        });
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: body.data,
        select: {
          id: true, username: true, displayName: true, avatarUrl: true,
          email: true, creditBalance: true, role: true, bio: true,
          subscriptionTier: true, isVerified: true, ageVerified: true,
          createdAt: true, updatedAt: true,
        },
      });

      const { creditBalance, ...rest } = updated as any;
      return reply.send({ success: true, data: { ...rest, credits: creditBalance } });
    },
  });

  // ─────────────────────────────────────────────
  // CREATOR EARNINGS SUMMARY
  // ─────────────────────────────────────────────
  fastify.get('/me/earnings', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [creatorProfile, recentSettlements, currentMonthChats] = await Promise.all([
        prismaRead.creatorProfile.findUnique({
          where: { userId },
          select: { totalEarnings: true, pendingEarnings: true },
        }),
        prismaRead.settlement.findMany({
          where: { creatorId: userId },
          orderBy: { createdAt: 'desc' },
          take: 6,
          include: {
            items: {
              select: {
                characterId: true, characterName: true,
                chatCount: true, creditsEarned: true, amount: true,
              },
            },
          },
        }),
        prismaRead.message.count({
          where: {
            conversation: { character: { creatorId: userId } },
            role: 'ASSISTANT',
            createdAt: { gte: monthStart },
          },
        }),
      ]);

      // Per-character stats this month
      const myChars = await prismaRead.character.findMany({
        where: { creatorId: userId, isActive: true },
        select: { id: true, name: true, avatarUrl: true, chatCount: true, likeCount: true },
        orderBy: { chatCount: 'desc' },
        take: 10,
      });

      return reply.send({
        success: true,
        data: {
          totalEarnings: creatorProfile?.totalEarnings ?? 0,
          pendingEarnings: creatorProfile?.pendingEarnings ?? 0,
          currentMonthChats,
          estimatedCurrentMonthEarnings: Math.floor(currentMonthChats * 0.7 * 10), // 70% of 10 KRW per chat
          settlements: recentSettlements,
          topCharacters: myChars,
        },
      });
    },
  });

  // ─────────────────────────────────────────────
  // SETTLEMENT HISTORY
  // ─────────────────────────────────────────────
  fastify.get('/me/settlements', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;
      const { page = 1, limit = 10 } = request.query as { page?: number; limit?: number };
      const skip = (Number(page) - 1) * Number(limit);

      const [settlements, total] = await Promise.all([
        prismaRead.settlement.findMany({
          where: { creatorId: userId },
          orderBy: { createdAt: 'desc' },
          skip,
          take: Number(limit),
          include: {
            items: {
              select: { characterName: true, chatCount: true, amount: true },
            },
          },
        }),
        prismaRead.settlement.count({ where: { creatorId: userId } }),
      ]);

      return reply.send({
        success: true,
        data: settlements,
        meta: { page: Number(page), limit: Number(limit), total },
      });
    },
  });

  // ─────────────────────────────────────────────
  // ENSURE/UPDATE CREATOR PROFILE
  // ─────────────────────────────────────────────
  fastify.post('/me/creator-profile', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;
      const schema = z.object({
        displayName: z.string().min(1).max(50),
        bio: z.string().max(500).optional(),
        website: z.string().url().optional(),
      });

      const body = schema.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message },
        });
      }

      const profile = await prisma.creatorProfile.upsert({
        where: { userId },
        create: { userId, ...body.data },
        update: body.data,
      });

      await prisma.user.update({
        where: { id: userId },
        data: { role: 'CREATOR' },
      });

      return reply.send({ success: true, data: profile });
    },
  });

  // ─────────────────────────────────────────────
  // NOTIFICATIONS
  // ─────────────────────────────────────────────
  fastify.get('/me/notifications', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;
      const { page = 1, limit = 20 } = request.query as { page?: number; limit?: number };
      const skip = (Number(page) - 1) * Number(limit);

      const [notifications, unreadCount] = await Promise.all([
        prismaRead.notification.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          skip,
          take: Number(limit),
        }),
        prismaRead.notification.count({ where: { userId, isRead: false } }),
      ]);

      return reply.send({
        success: true,
        data: notifications,
        meta: { unreadCount },
      });
    },
  });

  fastify.post('/me/notifications/read-all', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;
      await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });
      return reply.send({ success: true });
    },
  });

  // ─────────────────────────────────────────────
  // ADULT VERIFICATION — NICE 체크플러스 본인인증
  // ─────────────────────────────────────────────

  /**
   * POST /me/age-verify/initiate
   * NICE 체크플러스 암호화 요청 데이터 생성 및 반환
   * 프론트엔드는 이 데이터로 NICE 팝업 또는 리다이렉트 폼을 실행함
   */
  fastify.post('/me/age-verify/initiate', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { carrier } = request.body as {
        carrier: 'SKT' | 'KT' | 'LGU' | 'SKT_MVNO' | 'KT_MVNO' | 'LGU_MVNO';
      };

      const VALID_CARRIERS = ['SKT', 'KT', 'LGU', 'SKT_MVNO', 'KT_MVNO', 'LGU_MVNO'];
      if (!VALID_CARRIERS.includes(carrier)) {
        return reply.status(400).send({ success: false, error: '올바른 통신사를 선택해주세요.' });
      }

      const userId = request.userId!;
      const user = await prismaRead.user.findUnique({
        where: { id: userId },
        select: { ageVerified: true, username: true },
      });

      if (user?.ageVerified) {
        return reply.status(400).send({ success: false, error: '이미 성인인증이 완료된 계정입니다.' });
      }

      const { getRedis } = await import('../lib/redis');
      const redis = getRedis();
      const { niceService } = await import('../services/nice.service');

      // 요청번호: 중복 없는 고유값 (NICE 측에서 검증)
      const requestNo = `${userId.replace(/-/g, '').slice(0, 8)}_${Date.now()}`;

      // Redis에 세션 저장 (10분 TTL)
      const SESSION_TTL = 600;
      await redis.setex(
        `age_verify:req:${requestNo}`,
        SESSION_TTL,
        JSON.stringify({ userId, carrier, status: 'pending', createdAt: Date.now() })
      );

      // NICE API가 설정된 경우: 실제 암호화 토큰 생성
      if (niceService.isConfigured) {
        try {
          const encRequest = await niceService.createVerifyRequest(requestNo);
          return reply.send({
            success: true,
            requestNo,
            tokenVersionId: encRequest.tokenVersionId,
            encData: encRequest.encData,
            integrityValue: encRequest.integrityValue,
            checkUrl: encRequest.checkUrl,
            expiresIn: SESSION_TTL,
            mode: 'nice',
          });
        } catch (err) {
          fastify.log.error({ err }, 'NICE API request failed, falling back to sandbox');
          // NICE API 오류 시 샌드박스로 폴백
        }
      }

      // ── SANDBOX MODE (NICE 자격증명 미설정 시) ──────────────────────────
      // NICE 테스트 환경: https://nice.checkplus.co.kr/sandbox/...
      // 실제 서비스 시 NICE_CLIENT_ID, NICE_CLIENT_SECRET 환경변수 설정 필요
      const sandboxToken = `sandbox_${requestNo}`;
      await redis.setex(`age_verify:sandbox:${sandboxToken}`, SESSION_TTL, requestNo);

      return reply.send({
        success: true,
        requestNo,
        sandboxToken,
        expiresIn: SESSION_TTL,
        mode: 'sandbox',
        // 샌드박스 안내
        _notice: 'NICE_CLIENT_ID / NICE_CLIENT_SECRET 환경변수를 설정하면 실제 PASS 인증으로 전환됩니다.',
      });
    },
  });

  /**
   * POST /age-verify/callback  (인증 필요 없음 — NICE에서 직접 호출)
   * NICE 체크플러스 인증 완료 콜백
   * NICE_RETURN_URL 환경변수로 이 엔드포인트를 등록해야 함
   */
  fastify.post('/age-verify/callback', {
    handler: async (request, reply) => {
      const body = request.body as {
        token_version_id?: string;
        enc_data?: string;
        integrity_value?: string;
        // 폼 POST 방식의 경우
        EncodeData?: string;
        AuthType?: string;
      };

      const { getRedis } = await import('../lib/redis');
      const redis = getRedis();

      // NICE 표준 콜백 파라미터
      const tokenVersionId = body.token_version_id;
      const encData = body.enc_data ?? body.EncodeData;
      const integrityValue = body.integrity_value;

      if (!encData) {
        fastify.log.warn({ body }, 'NICE callback received without encData');
        return reply.status(400).send({ success: false, error: 'Missing encData' });
      }

      try {
        const { niceService, NiceCheckPlusService } = await import('../services/nice.service');
        const result = await niceService.decryptCallback(
          tokenVersionId!,
          encData,
          integrityValue!,
          '',
        );

        // 성인 여부 확인 (19세 미만 차단)
        if (!NiceCheckPlusService.isAdult(result.birthdate)) {
          fastify.log.warn({ birthdate: result.birthdate }, 'Non-adult verification attempt');
          // 세션에 실패 상태 기록
          return reply.redirect(
            `${process.env.WEB_BASE_URL}/verify-age/result?status=underage`
          );
        }

        // requestNo로 세션 조회 → userId 확인
        const rawSession = await redis.get(`age_verify:req:${result.receivedata}`);
        if (!rawSession) {
          fastify.log.error({ receivedata: result.receivedata }, 'Age verify session not found');
          return reply.redirect(`${process.env.WEB_BASE_URL}/verify-age/result?status=expired`);
        }

        const session = JSON.parse(rawSession) as { userId: string; carrier: string };

        // DB 업데이트: 인증 완료 + CI/DI 저장
        await prisma.user.update({
          where: { id: session.userId },
          data: {
            ageVerified: true,
            ageVerifiedAt: new Date(),
            // CI/DI는 별도 암호화 저장 권장 (개인정보 보호법)
            // ci: encrypt(result.ci),
            // di: encrypt(result.di),
          },
        });

        // 세션 완료 처리
        await redis.del(`age_verify:req:${result.receivedata}`);
        // 완료 토큰을 짧게 저장 (프론트엔드 폴링용)
        await redis.setex(
          `age_verify:done:${session.userId}`,
          300,
          JSON.stringify({ name: result.name, verifiedAt: new Date().toISOString() })
        );

        fastify.log.info({ userId: session.userId }, 'Age verification completed');
        return reply.redirect(`${process.env.WEB_BASE_URL}/verify-age/result?status=success`);
      } catch (err) {
        fastify.log.error({ err }, 'NICE callback processing failed');
        return reply.redirect(`${process.env.WEB_BASE_URL}/verify-age/result?status=error`);
      }
    },
  });

  /**
   * POST /age-verify/sandbox-complete  (개발/테스트 전용)
   * NICE 자격증명 없이 인증 완료 처리 (샌드박스 모드)
   */
  fastify.post('/age-verify/sandbox-complete', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      if (process.env.NODE_ENV === 'production') {
        return reply.status(404).send({ error: 'Not found' });
      }

      const { sandboxToken } = request.body as { sandboxToken: string };
      const userId = request.userId!;

      const { getRedis } = await import('../lib/redis');
      const redis = getRedis();

      const requestNo = await redis.get(`age_verify:sandbox:${sandboxToken}`);
      if (!requestNo) {
        return reply.status(400).send({ success: false, error: '샌드박스 토큰이 만료되었습니다.' });
      }

      const rawSession = await redis.get(`age_verify:req:${requestNo}`);
      if (!rawSession) {
        return reply.status(400).send({ success: false, error: '인증 세션을 찾을 수 없습니다.' });
      }

      const session = JSON.parse(rawSession) as { userId: string };
      if (session.userId !== userId) {
        return reply.status(403).send({ success: false, error: '인증 정보가 일치하지 않습니다.' });
      }

      await prisma.user.update({
        where: { id: userId },
        data: { ageVerified: true, ageVerifiedAt: new Date() },
      });

      await Promise.all([
        redis.del(`age_verify:sandbox:${sandboxToken}`),
        redis.del(`age_verify:req:${requestNo}`),
        redis.setex(`age_verify:done:${userId}`, 300, JSON.stringify({ verifiedAt: new Date().toISOString() })),
      ]);

      return reply.send({ success: true, message: '[샌드박스] 성인인증이 완료되었습니다.' });
    },
  });

  /**
   * GET /me/age-verify/status
   * 인증 완료 여부 폴링 (프론트엔드에서 1초마다 호출)
   */
  fastify.get('/me/age-verify/status', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;

      const [user, doneRaw] = await Promise.all([
        prismaRead.user.findUnique({
          where: { id: userId },
          select: { ageVerified: true, ageVerifiedAt: true },
        }),
        (async () => {
          const { getRedis } = await import('../lib/redis');
          return getRedis().get(`age_verify:done:${userId}`);
        })(),
      ]);

      return reply.send({
        success: true,
        isVerified: user?.ageVerified ?? false,
        verifiedAt: user?.ageVerifiedAt ?? null,
        justVerified: !!doneRaw, // 방금 인증 완료됐는지 (축하 UI용)
      });
    },
  });
};
