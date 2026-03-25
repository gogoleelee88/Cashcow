import type { FastifyPluginAsync } from 'fastify';
import { register } from '../lib/metrics';
import { checkDatabaseHealth } from '../lib/prisma';
import { checkRedisHealth } from '../lib/redis';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  // Basic liveness probe
  fastify.get('/live', {
    handler: async (request, reply) => {
      return reply.send({ status: 'ok', timestamp: new Date().toISOString() });
    },
  });

  // Readiness probe — checks all dependencies
  fastify.get('/ready', {
    handler: async (request, reply) => {
      const [dbHealthy, redisHealthy] = await Promise.all([
        checkDatabaseHealth(),
        checkRedisHealth(),
      ]);

      const allHealthy = dbHealthy && redisHealthy;

      return reply.code(allHealthy ? 200 : 503).send({
        status: allHealthy ? 'ready' : 'not_ready',
        checks: {
          database: dbHealthy ? 'ok' : 'error',
          redis: redisHealthy ? 'ok' : 'error',
        },
        timestamp: new Date().toISOString(),
      });
    },
  });

  // Prometheus metrics endpoint
  fastify.get('/metrics', {
    handler: async (request, reply) => {
      reply.header('Content-Type', register.contentType);
      return reply.send(await register.metrics());
    },
  });
};
