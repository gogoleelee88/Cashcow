import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { getBullRedis } from '../lib/redis';
import { logger } from '../lib/logger';
import { alertCritical } from '../lib/slack';
import { queueDepth, queueJobDuration } from '../lib/metrics';
import { prisma } from '../lib/prisma';

const connection = { client: getBullRedis() };

// ─────────────────────────────────────────────
// QUEUE DEFINITIONS
// ─────────────────────────────────────────────
export const chatQueue = new Queue('chat', {
  connection: getBullRedis(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

export const settlementQueue = new Queue('settlement', {
  connection: getBullRedis(),
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  },
});

export const notificationQueue = new Queue('notification', {
  connection: getBullRedis(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'fixed', delay: 1000 },
    removeOnComplete: { count: 200 },
  },
});

export const memoryCompressionQueue = new Queue('memory-compression', {
  connection: getBullRedis(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
  },
});

// ─────────────────────────────────────────────
// JOB TYPES
// ─────────────────────────────────────────────
export interface ChatJobData {
  conversationId: string;
  messageId: string;      // The user message ID that triggered this
  userId: string;
  characterId: string;
  userMessage: string;
  socketId?: string;      // For real-time delivery
}

export interface SettlementJobData {
  periodStart: string;  // ISO date
  periodEnd: string;
  creatorId?: string;   // If null, process all creators
}

export interface NotificationJobData {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface MemoryCompressionJobData {
  conversationId: string;
}

// ─────────────────────────────────────────────
// JOB PRODUCERS
// ─────────────────────────────────────────────
export async function enqueueChatJob(data: ChatJobData): Promise<string> {
  const job = await chatQueue.add('process-chat', data, {
    priority: 1,
  });
  queueDepth.inc({ queue_name: 'chat' });
  return job.id!;
}

export async function enqueueSettlementJob(data: SettlementJobData): Promise<void> {
  await settlementQueue.add('run-settlement', data, {
    jobId: `settlement-${data.periodStart}-${data.creatorId || 'all'}`,
    priority: 5,
  });
}

export async function enqueueNotification(data: NotificationJobData): Promise<void> {
  await notificationQueue.add('send-notification', data);
}

export async function enqueueMemoryCompression(conversationId: string): Promise<void> {
  await memoryCompressionQueue.add(
    'compress-memory',
    { conversationId },
    { jobId: `memory-${conversationId}`, delay: 5000 }  // 5s delay to batch
  );
}

// ─────────────────────────────────────────────
// SETTLEMENT PROCESSOR
// ─────────────────────────────────────────────
async function processSettlement(job: Job<SettlementJobData>): Promise<void> {
  const { periodStart, periodEnd, creatorId } = job.data;
  const start = new Date(periodStart);
  const end = new Date(periodEnd);

  logger.info({ periodStart, periodEnd, creatorId }, 'Starting settlement run');

  // Find all creators to settle
  const creatorsQuery = creatorId
    ? [await prisma.creatorProfile.findUniqueOrThrow({ where: { userId: creatorId } })]
    : await prisma.creatorProfile.findMany({ where: { user: { isActive: true } } });

  for (const creator of creatorsQuery) {
    await processCreatorSettlement(creator.userId, creator.id, start, end);
  }

  logger.info({ count: creatorsQuery.length }, 'Settlement run complete');
}

async function processCreatorSettlement(
  creatorId: string,
  creatorProfileId: string,
  start: Date,
  end: Date
): Promise<void> {
  const characters = await prisma.character.findMany({ where: { creatorId } });
  if (characters.length === 0) return;

  const items = await Promise.all(
    characters.map(async (char) => {
      const messages = await prisma.message.count({
        where: {
          conversation: { characterId: char.id },
          role: 'ASSISTANT',
          createdAt: { gte: start, lt: end },
        },
      });

      const credits = await prisma.message.aggregate({
        where: {
          conversation: { characterId: char.id },
          role: 'ASSISTANT',
          createdAt: { gte: start, lt: end },
        },
        _sum: { creditCost: true },
      });

      return {
        characterId: char.id,
        characterName: char.name,
        chatCount: messages,
        creditsEarned: credits._sum.creditCost || 0,
        amount: Math.floor((credits._sum.creditCost || 0) * 0.7 * 10), // Convert credits to KRW, 70% to creator
      };
    })
  );

  const validItems = items.filter((i) => i.chatCount > 0);
  if (validItems.length === 0) return;

  const grossAmount = validItems.reduce((sum, i) => sum + i.amount, 0);
  const platformFeeRate = 0.3;
  const platformFee = Math.floor(grossAmount * platformFeeRate);
  const netAmount = grossAmount - platformFee;

  // Create audit hash for tamper detection
  const { createHash } = await import('crypto');
  const auditData = JSON.stringify({ creatorId, periodStart: start, periodEnd: end, grossAmount, netAmount });
  const auditHash = createHash('sha256').update(auditData).digest('hex');

  await prisma.settlement.create({
    data: {
      creatorId,
      creatorProfileId,
      periodStart: start,
      periodEnd: end,
      totalChats: validItems.reduce((s, i) => s + i.chatCount, 0),
      grossAmount,
      platformFeeRate,
      platformFee,
      netAmount,
      status: 'PENDING',
      auditHash,
      items: {
        create: validItems,
      },
    },
  });

  // Update creator's pending earnings
  await prisma.creatorProfile.update({
    where: { id: creatorProfileId },
    data: { pendingEarnings: { increment: netAmount } },
  });

  logger.info({ creatorId, netAmount }, 'Creator settlement created');
}

// ─────────────────────────────────────────────
// NOTIFICATION PROCESSOR
// ─────────────────────────────────────────────
async function processNotification(job: Job<NotificationJobData>): Promise<void> {
  const { userId, type, title, body, data } = job.data;
  await prisma.notification.create({
    data: { userId, type: type as any, title, body, data: data as any },
  });
}

// ─────────────────────────────────────────────
// MEMORY COMPRESSION PROCESSOR
// ─────────────────────────────────────────────
async function processMemoryCompression(job: Job<MemoryCompressionJobData>): Promise<void> {
  const { conversationId } = job.data;
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
  });

  if (messages.length < 30) return; // Don't compress short conversations

  const { compressConversationMemory } = await import('./ai.service');
  const summary = await compressConversationMemory(conversationId, messages);

  if (summary) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { summary, summaryAt: new Date() },
    });
  }
}

// ─────────────────────────────────────────────
// WORKERS
// ─────────────────────────────────────────────
let settlementWorker: Worker | null = null;
let notificationWorker: Worker | null = null;
let memoryWorker: Worker | null = null;

export function startWorkers(): void {
  settlementWorker = new Worker(
    'settlement',
    async (job: Job) => {
      const timer = queueJobDuration.startTimer({ queue_name: 'settlement', job_type: job.name });
      try {
        await processSettlement(job as Job<SettlementJobData>);
        timer();
      } catch (err) {
        timer();
        throw err;
      }
    },
    { connection: getBullRedis(), concurrency: 1 }
  );

  notificationWorker = new Worker(
    'notification',
    async (job: Job) => {
      await processNotification(job as Job<NotificationJobData>);
      queueDepth.dec({ queue_name: 'notification' });
    },
    { connection: getBullRedis(), concurrency: 10 }
  );

  memoryWorker = new Worker(
    'memory-compression',
    async (job: Job) => {
      await processMemoryCompression(job as Job<MemoryCompressionJobData>);
    },
    { connection: getBullRedis(), concurrency: 3 }
  );

  [settlementWorker, notificationWorker, memoryWorker].forEach((worker) => {
    worker.on('failed', async (job, err) => {
      logger.error({ jobId: job?.id, queue: worker.name, err }, 'Job failed');
      if (job?.attemptsMade === job?.opts.attempts) {
        await alertCritical(`Job failed permanently: ${worker.name}/${job?.id}`, err);
      }
    });
  });

  // ─── CRON: Monthly settlement (1st of each month at 02:00 KST = 17:00 UTC prev day)
  scheduleMonthlyCron();

  logger.info('BullMQ workers started');
}

export async function stopWorkers(): Promise<void> {
  await Promise.all([
    settlementWorker?.close(),
    notificationWorker?.close(),
    memoryWorker?.close(),
  ]);
}

// ─────────────────────────────────────────────
// MONTHLY SETTLEMENT CRON
// Runs on the 1st of every month at 02:00 KST (17:00 UTC previous day)
// Uses BullMQ Scheduler to avoid double-runs on multi-instance deployments
// ─────────────────────────────────────────────
async function scheduleMonthlyCron(): Promise<void> {
  try {
    // Remove existing repeatable job and re-add (idempotent)
    const repeatableJobs = await settlementQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      if (job.name === 'monthly-settlement') {
        await settlementQueue.removeRepeatableByKey(job.key);
      }
    }

    const now = new Date();
    // Calculate previous month period
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 1); // First day of current month
    const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1); // First day of previous month

    await settlementQueue.add(
      'monthly-settlement',
      {
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
      } as SettlementJobData,
      {
        repeat: {
          pattern: '0 17 28-31 * *', // 17:00 UTC on last days of month (02:00 KST next day)
          utc: true,
        },
        jobId: 'monthly-settlement-cron',
      }
    );

    logger.info({ pattern: '0 17 28-31 * *' }, 'Monthly settlement cron scheduled');
  } catch (err) {
    logger.error({ err }, 'Failed to schedule monthly settlement cron');
  }
}

// ─────────────────────────────────────────────
// TRENDING SCORE UPDATE (every hour)
// ─────────────────────────────────────────────
export const trendingQueue = new Queue('trending', {
  connection: getBullRedis(),
  defaultJobOptions: {
    removeOnComplete: { count: 10 },
    removeOnFail: { count: 20 },
  },
});

export function startTrendingWorker(): void {
  const worker = new Worker(
    'trending',
    async () => {
      await updateTrendingScores();
    },
    { connection: getBullRedis(), concurrency: 1 }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Trending update job failed');
  });

  // Schedule every hour
  trendingQueue.add(
    'update-trending',
    {},
    {
      repeat: { every: 60 * 60 * 1000 }, // every 1 hour
      jobId: 'trending-hourly',
    }
  );

  logger.info('Trending update worker started');
}

async function updateTrendingScores(): Promise<void> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Update trending score: weighted combination of recent chats + likes
  await prisma.$executeRaw`
    UPDATE characters
    SET "trendingScore" = (
      (SELECT COUNT(*) FROM messages m
       JOIN conversations cv ON cv.id = m."conversationId"
       WHERE cv."characterId" = characters.id
       AND m."createdAt" > ${since24h}
       AND m.role = 'ASSISTANT'
      ) * 0.6
      + characters."likeCount" * 0.4
    )
    WHERE characters."isActive" = true
    AND characters.visibility = 'PUBLIC'
  `;

  logger.info('Trending scores updated');
}
