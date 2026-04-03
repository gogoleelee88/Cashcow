import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../plugins/auth.plugin';
import { verifyHmac } from '../lib/encryption';
import { config } from '../config';
import { logger } from '../lib/logger';
import { alertCritical } from '../lib/slack';

const CREDIT_PACKAGES = [
  { id: 'pack_100', name: '100 크레딧', credits: 100, price: 1100, bonusCredits: 0, isPopular: false },
  { id: 'pack_500', name: '500 크레딧', credits: 500, price: 4900, bonusCredits: 50, isPopular: false },
  { id: 'pack_1000', name: '1,000 크레딧', credits: 1000, price: 8900, bonusCredits: 150, isPopular: true },
  { id: 'pack_5000', name: '5,000 크레딧', credits: 5000, price: 39000, bonusCredits: 1000, isPopular: false },
  // 크래커 패키지 (crack.wrtn.ai 스타일)
  { id: 'cracker_200',   name: '200 크래커',    credits: 200,   price: 2000,  bonusCredits: 0,    isPopular: false },
  { id: 'cracker_500',   name: '500 크래커',    credits: 500,   price: 4900,  bonusCredits: 50,   isPopular: false },
  { id: 'cracker_1000',  name: '1,000 크래커',  credits: 1000,  price: 9600,  bonusCredits: 100,  isPopular: false },
  { id: 'cracker_3000',  name: '3,000 크래커',  credits: 3000,  price: 28000, bonusCredits: 500,  isPopular: true  },
  { id: 'cracker_5000',  name: '5,000 크래커',  credits: 5000,  price: 46000, bonusCredits: 1000, isPopular: false },
  { id: 'cracker_10000', name: '10,000 크래커', credits: 10000, price: 90000, bonusCredits: 3000, isPopular: false },
];

const SUBSCRIPTION_PLANS = [
  {
    id: 'plan_basic', tier: 'BASIC', name: 'BASIC', price: 4900, currency: 'KRW',
    billingPeriod: 'MONTHLY', features: ['월 1,000 크레딧', '광고 없음', '캐릭터 10개 생성'],
    monthlyCredits: 1000, maxCharacters: 10, prioritySupport: false, customModel: false,
  },
  {
    id: 'plan_pro', tier: 'PRO', name: 'PRO', price: 14900, currency: 'KRW',
    billingPeriod: 'MONTHLY', features: ['월 5,000 크레딧', '우선 지원', '캐릭터 50개', 'Claude Sonnet 사용 가능'],
    monthlyCredits: 5000, maxCharacters: 50, prioritySupport: true, customModel: true,
  },
];

export const paymentRoutes: FastifyPluginAsync = async (fastify) => {
  // ─────────────────────────────────────────────
  // GET PACKAGES
  // ─────────────────────────────────────────────
  fastify.get('/packages', {
    handler: async (request, reply) => {
      return reply.send({ success: true, data: CREDIT_PACKAGES });
    },
  });

  fastify.get('/plans', {
    handler: async (request, reply) => {
      return reply.send({ success: true, data: SUBSCRIPTION_PLANS });
    },
  });

  // ─────────────────────────────────────────────
  // TOSS PAYMENTS — Initiate
  // ─────────────────────────────────────────────
  fastify.post('/toss/initiate', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { packageId } = request.body as { packageId: string };
      const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId);

      if (!pkg) {
        return reply.code(400).send({ success: false, error: { code: 'INVALID_PACKAGE', message: '유효하지 않은 패키지입니다.' } });
      }

      const orderId = `order_${Date.now()}_${request.userId!.slice(-6)}`;

      // Create pending transaction
      await prisma.transaction.create({
        data: {
          userId: request.userId!,
          type: 'PURCHASE',
          amount: pkg.price,
          credits: pkg.credits + pkg.bonusCredits,
          status: 'PENDING',
          provider: 'TOSS',
          providerOrderId: orderId,
          description: `${pkg.name} 구매`,
          metadata: { packageId, price: pkg.price, credits: pkg.credits, bonus: pkg.bonusCredits },
        },
      });

      return reply.send({
        success: true,
        data: {
          orderId,
          orderName: pkg.name,
          amount: pkg.price,
          clientKey: config.TOSS_CLIENT_KEY,
          successUrl: `${config.WEB_BASE_URL}/payment/success`,
          failUrl: `${config.WEB_BASE_URL}/payment/fail`,
        },
      });
    },
  });

  // ─────────────────────────────────────────────
  // TOSS PAYMENTS — Webhook (server-to-server, HMAC verified)
  // ─────────────────────────────────────────────
  fastify.post('/toss/webhook', {
    config: { rawBody: true }, // Need raw body for HMAC
    handler: async (request, reply) => {
      const signature = request.headers['toss-payments-signature'] as string;
      const rawBody = (request as any).rawBody as Buffer;

      if (!signature || !rawBody) {
        return reply.code(400).send({ error: 'Missing signature' });
      }

      // Verify HMAC-SHA256 signature
      if (config.TOSS_WEBHOOK_SECRET) {
        const valid = verifyHmac(rawBody, config.TOSS_WEBHOOK_SECRET, signature);
        if (!valid) {
          logger.warn({ ip: request.ip }, 'Invalid Toss webhook signature');
          return reply.code(401).send({ error: 'Invalid signature' });
        }
      }

      const event = request.body as any;
      logger.info({ eventType: event.eventType, orderId: event.data?.orderId }, 'Toss webhook received');

      try {
        if (event.eventType === 'PAYMENT_STATUS_CHANGED') {
          await handleTossPaymentStatusChange(event.data);
        }
      } catch (err) {
        logger.error({ err, event }, 'Toss webhook processing error');
        await alertCritical('Toss webhook processing failed', err);
        // Return 200 to prevent Toss from retrying (we log and alert instead)
      }

      return reply.send({ ok: true });
    },
  });

  // ─────────────────────────────────────────────
  // TOSS PAYMENTS — Confirm (after client-side approval)
  // ─────────────────────────────────────────────
  fastify.post('/toss/confirm', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { paymentKey, orderId, amount } = request.body as {
        paymentKey: string;
        orderId: string;
        amount: number;
      };

      const transaction = await prisma.transaction.findFirst({
        where: { providerOrderId: orderId, userId: request.userId!, status: 'PENDING' },
      });

      if (!transaction) {
        return reply.code(400).send({ success: false, error: { code: 'INVALID_ORDER', message: '유효하지 않은 주문입니다.' } });
      }

      // Amount tampering check
      if (transaction.amount !== amount) {
        logger.warn({ orderId, expectedAmount: transaction.amount, receivedAmount: amount }, '🚨 Payment amount mismatch');
        return reply.code(400).send({ success: false, error: { code: 'AMOUNT_MISMATCH', message: '결제 금액이 일치하지 않습니다.' } });
      }

      // Confirm payment with Toss API
      const credentials = Buffer.from(`${config.TOSS_SECRET_KEY}:`).toString('base64');
      const tossResponse = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paymentKey, orderId, amount }),
      });

      if (!tossResponse.ok) {
        const err = await tossResponse.json();
        logger.error({ err, orderId }, 'Toss payment confirmation failed');
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: 'FAILED', metadata: { ...(transaction.metadata as any), tossError: err } },
        });
        return reply.code(400).send({
          success: false,
          error: { code: 'PAYMENT_FAILED', message: err.message || '결제에 실패했습니다.' },
        });
      }

      const tossData = await tossResponse.json();

      // Credit user atomically
      await prisma.$transaction([
        prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: 'COMPLETED',
            providerPaymentId: paymentKey,
            webhookVerified: false,
            metadata: { ...(transaction.metadata as any), tossData },
          },
        }),
        prisma.user.update({
          where: { id: request.userId! },
          data: { creditBalance: { increment: transaction.credits } },
        }),
      ]);

      logger.info({ userId: request.userId, credits: transaction.credits, orderId }, 'Payment completed');

      return reply.send({
        success: true,
        data: { credits: transaction.credits, orderId },
      });
    },
  });

  // ─────────────────────────────────────────────
  // STRIPE — Create Payment Intent (global)
  // ─────────────────────────────────────────────
  fastify.post('/stripe/create-intent', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { packageId } = request.body as { packageId: string };
      const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId);

      if (!pkg || !config.STRIPE_SECRET_KEY) {
        return reply.code(400).send({ success: false, error: { code: 'INVALID_PACKAGE' } });
      }

      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(config.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

      const orderId = `stripe_order_${Date.now()}_${request.userId!.slice(-6)}`;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: pkg.price,
        currency: 'krw',
        metadata: { userId: request.userId!, packageId, orderId },
        automatic_payment_methods: { enabled: true },
      });

      await prisma.transaction.create({
        data: {
          userId: request.userId!,
          type: 'PURCHASE',
          amount: pkg.price,
          credits: pkg.credits + pkg.bonusCredits,
          status: 'PENDING',
          provider: 'STRIPE',
          providerOrderId: orderId,
          providerPaymentId: paymentIntent.id,
          description: `${pkg.name} 구매 (Stripe)`,
        },
      });

      return reply.send({
        success: true,
        data: { clientSecret: paymentIntent.client_secret, publishableKey: config.STRIPE_PUBLISHABLE_KEY },
      });
    },
  });

  // ─────────────────────────────────────────────
  // STRIPE WEBHOOK
  // ─────────────────────────────────────────────
  fastify.post('/stripe/webhook', {
    config: { rawBody: true },
    handler: async (request, reply) => {
      const sig = request.headers['stripe-signature'] as string;
      const rawBody = (request as any).rawBody as Buffer;

      if (!config.STRIPE_SECRET_KEY || !config.STRIPE_WEBHOOK_SECRET) {
        return reply.code(400).send({ error: 'Stripe not configured' });
      }

      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(config.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

      let event: any;
      try {
        event = stripe.webhooks.constructEvent(rawBody, sig, config.STRIPE_WEBHOOK_SECRET);
      } catch (err) {
        logger.warn({ err }, 'Invalid Stripe webhook signature');
        return reply.code(400).send({ error: 'Invalid signature' });
      }

      if (event.type === 'payment_intent.succeeded') {
        const pi = event.data.object;
        await handleStripePaymentSuccess(pi.id, pi.metadata.userId, pi.metadata.orderId);
      }

      return reply.send({ received: true });
    },
  });

  // ─────────────────────────────────────────────
  // TRANSACTION HISTORY
  // ─────────────────────────────────────────────
  fastify.get('/transactions', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { page = 1, limit = 20 } = request.query as { page?: number; limit?: number };
      const skip = (Number(page) - 1) * Number(limit);

      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          where: { userId: request.userId! },
          orderBy: { createdAt: 'desc' },
          skip,
          take: Number(limit),
          select: {
            id: true, type: true, amount: true, credits: true, status: true,
            provider: true, description: true, createdAt: true,
          },
        }),
        prisma.transaction.count({ where: { userId: request.userId! } }),
      ]);

      return reply.send({ success: true, data: transactions, meta: { page: Number(page), total } });
    },
  });
};

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
async function handleTossPaymentStatusChange(data: any): Promise<void> {
  if (data.status !== 'DONE') return;

  const transaction = await prisma.transaction.findFirst({
    where: { providerOrderId: data.orderId, status: { in: ['PENDING', 'COMPLETED'] } },
  });

  if (!transaction || transaction.status === 'COMPLETED') return;

  await prisma.$transaction([
    prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: 'COMPLETED', webhookVerified: true, providerPaymentId: data.paymentKey },
    }),
    prisma.user.update({
      where: { id: transaction.userId },
      data: { creditBalance: { increment: transaction.credits } },
    }),
  ]);
}

async function handleStripePaymentSuccess(
  paymentIntentId: string,
  userId: string,
  orderId: string
): Promise<void> {
  const transaction = await prisma.transaction.findFirst({
    where: { providerPaymentId: paymentIntentId, status: 'PENDING' },
  });

  if (!transaction) return;

  await prisma.$transaction([
    prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: 'COMPLETED', webhookVerified: true },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { creditBalance: { increment: transaction.credits } },
    }),
  ]);

  logger.info({ userId, credits: transaction.credits, paymentIntentId }, 'Stripe payment completed');
}
