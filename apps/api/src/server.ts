import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import { Server } from 'socket.io';
import { createServer } from 'http';
import * as Sentry from '@sentry/node';
import { config } from './config';
import { logger } from './lib/logger';
import { disconnectPrisma } from './lib/prisma';
import { disconnectRedis, getRedis } from './lib/redis';
import { startWorkers, stopWorkers, startTrendingWorker } from './services/queue.service';
import { activeUsers } from './lib/metrics';
import { alertCritical } from './lib/slack';
import authPlugin from './plugins/auth.plugin';
import rateLimitPlugin from './plugins/rate-limit.plugin';
import { authRoutes } from './routes/auth.routes';
import { characterRoutes } from './routes/characters.routes';
import { chatRoutes } from './routes/chat.routes';
import { paymentRoutes } from './routes/payments.routes';
import { healthRoutes } from './routes/health.routes';
import { notificationRoutes } from './routes/notifications.routes';
import { userRoutes } from './routes/users.routes';
import { verifyAccessToken } from './services/auth.service';

// ─────────────────────────────────────────────
// SENTRY INIT
// ─────────────────────────────────────────────
if (config.SENTRY_DSN) {
  Sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.NODE_ENV,
    tracesSampleRate: config.NODE_ENV === 'production' ? 0.1 : 1.0,
  });
}

// ─────────────────────────────────────────────
// FASTIFY INSTANCE
// ─────────────────────────────────────────────
const app = Fastify({
  logger: {
    level: config.LOG_LEVEL,
    serializers: {
      req: (req) => ({ method: req.method, url: req.url, remoteAddress: req.socket.remoteAddress }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  },
  trustProxy: true,                    // Behind nginx/load balancer
  maxParamLength: 200,
  bodyLimit: 1024 * 1024,              // 1MB body limit
  ajv: {
    customOptions: { removeAdditional: 'all', useDefaults: true, coerceTypes: 'array' },
  },
});

// Expose config for route handlers
(app as any).config = config;

// ─────────────────────────────────────────────
// PLUGINS
// ─────────────────────────────────────────────
async function registerPlugins(): Promise<void> {
  await app.register(cors, {
    origin: config.ALLOWED_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  });

  await app.register(cookie, {
    secret: config.JWT_ACCESS_SECRET,
  });

  await app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  });

  await app.register(rateLimitPlugin);
  await app.register(authPlugin);

  // Raw body plugin for webhook signature verification
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    (req as any).rawBody = body;
    try {
      done(null, JSON.parse(body.toString()));
    } catch (err) {
      done(err as Error, undefined);
    }
  });
}

// ─────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────
async function registerRoutes(): Promise<void> {
  app.register(healthRoutes, { prefix: '/health' });
  app.register(authRoutes, { prefix: '/api/auth' });
  app.register(characterRoutes, { prefix: '/api/characters' });
  app.register(chatRoutes, { prefix: '/api/chat' });
  app.register(paymentRoutes, { prefix: '/api/payments' });
  app.register(notificationRoutes, { prefix: '/api/notifications' });
  app.register(userRoutes, { prefix: '/api/users' });

  // 404 handler
  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      success: false,
      error: { code: 'NOT_FOUND', message: `Route ${request.method} ${request.url} not found` },
    });
  });

  // Global error handler
  app.setErrorHandler((error, request, reply) => {
    // Capture to Sentry
    if (config.SENTRY_DSN) {
      Sentry.captureException(error, {
        tags: { route: request.url, method: request.method },
        user: request.userId ? { id: request.userId } : undefined,
      });
    }

    const statusCode = error.statusCode || 500;

    if (statusCode >= 500) {
      logger.error({ err: error, requestId: request.id }, 'Unhandled error');
    }

    return reply.code(statusCode).send({
      success: false,
      error: {
        code: (error as any).code || 'INTERNAL_ERROR',
        message: config.NODE_ENV === 'production' && statusCode >= 500
          ? '서버 오류가 발생했습니다.'
          : error.message,
      },
    });
  });
}

// ─────────────────────────────────────────────
// SOCKET.IO — Real-time chat streaming
// ─────────────────────────────────────────────
function setupSocketIO(httpServer: ReturnType<typeof createServer>): void {
  const io = new Server(httpServer, {
    cors: {
      origin: config.ALLOWED_ORIGINS,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Auth middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.slice(7);
    if (!token) return next(new Error('Authentication required'));

    try {
      const payload = verifyAccessToken(token);
      (socket as any).userId = payload.sub;
      (socket as any).user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = (socket as any).userId as string;
    socket.join(`user:${userId}`);
    activeUsers.inc();
    logger.debug({ userId, socketId: socket.id }, 'Socket connected');

    socket.on('join:conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on('leave:conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on('disconnect', () => {
      activeUsers.dec();
      logger.debug({ userId, socketId: socket.id }, 'Socket disconnected');
    });
  });

  // Make io available globally
  (globalThis as any).__io = io;
}

// ─────────────────────────────────────────────
// STARTUP
// ─────────────────────────────────────────────
async function start(): Promise<void> {
  try {
    await registerPlugins();
    await registerRoutes();

    const httpServer = createServer(app.server);
    setupSocketIO(httpServer);

    // Verify Redis connection
    await getRedis().ping();
    logger.info('Redis connected');

    // Start BullMQ workers + cron schedulers
    startWorkers();
    startTrendingWorker();
    logger.info('BullMQ workers and cron schedulers started');

    await app.listen({ port: config.PORT, host: config.HOST });
    logger.info(`🚀 CharacterVerse API running at http://${config.HOST}:${config.PORT}`);

    if (config.NODE_ENV === 'production') {
      await app.ready();
      logger.info('Server fully ready for production traffic');
    }
  } catch (err) {
    logger.fatal({ err }, 'Failed to start server');
    await alertCritical('Server startup failed', err);
    process.exit(1);
  }
}

// ─────────────────────────────────────────────
// GRACEFUL SHUTDOWN
// ─────────────────────────────────────────────
const shutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, 'Graceful shutdown initiated');

  try {
    await app.close();
    await stopWorkers();
    await disconnectPrisma();
    await disconnectRedis();
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', async (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  await alertCritical('Uncaught exception', err);
  process.exit(1);
});
process.on('unhandledRejection', async (reason) => {
  logger.fatal({ reason }, 'Unhandled rejection');
  await alertCritical('Unhandled promise rejection', reason);
  process.exit(1);
});

start();
