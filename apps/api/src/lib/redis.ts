import IORedis, { Redis, RedisOptions } from 'ioredis';
import { config } from '../config';
import { logger } from './logger';

const redisOptions: RedisOptions = {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 5000);
    logger.warn({ times, delay }, 'Redis reconnecting...');
    return delay;
  },
  reconnectOnError(err) {
    const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
    return targetErrors.some((e) => err.message.includes(e));
  },
};

if (config.REDIS_TLS) {
  redisOptions.tls = {};
}

let redisInstance: Redis | null = null;
let subscriberInstance: Redis | null = null;
let bullInstance: Redis | null = null;

function createRedisClient(label: string): Redis {
  const client = new IORedis(config.REDIS_URL, redisOptions);
  client.on('connect', () => logger.info({ label }, 'Redis connected'));
  client.on('error', (err) => logger.error({ label, err }, 'Redis error'));
  client.on('close', () => logger.warn({ label }, 'Redis connection closed'));
  return client;
}

export function getRedis(): Redis {
  if (!redisInstance) redisInstance = createRedisClient('main');
  return redisInstance;
}

// Dedicated subscriber client (cannot be used for other commands)
export function getSubscriber(): Redis {
  if (!subscriberInstance) subscriberInstance = createRedisClient('subscriber');
  return subscriberInstance;
}

// Dedicated BullMQ client
export function getBullRedis(): Redis {
  if (!bullInstance) bullInstance = createRedisClient('bullmq');
  return bullInstance;
}

export async function disconnectRedis(): Promise<void> {
  await Promise.all([
    redisInstance?.quit(),
    subscriberInstance?.quit(),
    bullInstance?.quit(),
  ]);
}

export async function checkRedisHealth(): Promise<boolean> {
  try {
    const pong = await getRedis().ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────
// CACHE HELPERS
// ─────────────────────────────────────────────
const DEFAULT_TTL = 300; // 5 minutes

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const redis = getRedis();
    const data = await redis.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  },

  async set<T>(key: string, value: T, ttlSeconds = DEFAULT_TTL): Promise<void> {
    const redis = getRedis();
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  },

  async del(key: string): Promise<void> {
    await getRedis().del(key);
  },

  async delPattern(pattern: string): Promise<void> {
    const redis = getRedis();
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  },

  async remember<T>(
    key: string,
    ttlSeconds: number,
    factory: () => Promise<T>
  ): Promise<T> {
    const cached = await cache.get<T>(key);
    if (cached !== null) return cached;
    const value = await factory();
    await cache.set(key, value, ttlSeconds);
    return value;
  },
};

// Cache key factories
export const CacheKeys = {
  characterList: (category?: string, sort?: string, page?: number) =>
    `chars:list:${category ?? 'all'}:${sort ?? 'trending'}:${page ?? 1}`,
  characterDetail: (id: string) => `chars:detail:${id}`,
  trending: (period: string) => `trending:${period}`,
  userProfile: (id: string) => `user:profile:${id}`,
  oauthState: (state: string) => `oauth:state:${state}`,
  rateLimitBlock: (key: string) => `rl:block:${key}`,
  ageVerification: (token: string) => `age:verify:${token}`,
} as const;
