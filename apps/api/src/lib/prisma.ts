import { PrismaClient, Prisma } from '@prisma/client';
import { config } from '../config';
import { logger } from './logger';

// Primary write client
const primaryClient = new PrismaClient({
  datasources: {
    db: { url: config.DATABASE_URL },
  },
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

// Read replica client (fallback to primary if not configured)
const readClient = new PrismaClient({
  datasources: {
    db: { url: config.DATABASE_READ_URL || config.DATABASE_URL },
  },
  log: [{ emit: 'event', level: 'error' }],
});

// Log slow queries
primaryClient.$on('query', (e: Prisma.QueryEvent) => {
  if (e.duration > 500) {
    logger.warn({ query: e.query, duration: e.duration, params: e.params }, 'Slow query detected');
  }
});

primaryClient.$on('error', (e: Prisma.LogEvent) => {
  logger.error({ message: e.message, target: e.target }, 'Prisma error');
});

readClient.$on('error', (e: Prisma.LogEvent) => {
  logger.error({ message: e.message, target: e.target }, 'Prisma read replica error');
});

// Prisma singleton with read/write splitting
export const prisma = primaryClient;
export const prismaRead = readClient;

// Graceful shutdown
export async function disconnectPrisma(): Promise<void> {
  await Promise.all([primaryClient.$disconnect(), readClient.$disconnect()]);
}

// Health check
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await primaryClient.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
