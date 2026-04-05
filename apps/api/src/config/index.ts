import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  API_BASE_URL: z.string().url(),
  WEB_BASE_URL: z.string().url(),
  ALLOWED_ORIGINS: z.string().transform((s) => s.split(',')),

  // Database
  DATABASE_URL: z.string(),
  DATABASE_DIRECT_URL: z.string().optional(),
  DATABASE_READ_URL: z.string().optional(),

  // Redis
  REDIS_URL: z.string(),
  REDIS_TLS: z.coerce.boolean().default(false),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Encryption
  ENCRYPTION_KEY: z.string().length(64), // 32 bytes as hex

  // Anthropic
  ANTHROPIC_API_KEY: z.string(),
  ANTHROPIC_HAIKU_MODEL: z.string().default('claude-haiku-4-5-20251001'),
  ANTHROPIC_SONNET_MODEL: z.string().default('claude-sonnet-4-6'),

  // AWS
  AWS_REGION: z.string().default('ap-northeast-2'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET: z.string().default('characterverse-assets'),
  AWS_CLOUDFRONT_URL: z.string().optional(),

  // OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  KAKAO_CLIENT_ID: z.string().optional(),
  KAKAO_CLIENT_SECRET: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_TEAM_ID: z.string().optional(),
  APPLE_KEY_ID: z.string().optional(),
  APPLE_PRIVATE_KEY: z.string().optional(),

  // Payments
  TOSS_CLIENT_KEY: z.string().optional(),
  TOSS_SECRET_KEY: z.string().optional(),
  TOSS_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // NICE 체크플러스 본인인증 (https://www.niceapi.co.kr)
  NICE_CLIENT_ID: z.string().optional(),
  NICE_CLIENT_SECRET: z.string().optional(),
  NICE_PRODUCT_ID: z.string().default('2101979031'),
  NICE_RETURN_URL: z.string().optional(),

  // Monitoring
  SENTRY_DSN: z.string().optional(),
  SLACK_WEBHOOK_URL: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  PROMETHEUS_PORT: z.coerce.number().default(9090),
});

function loadConfig() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    result.error.issues.forEach((issue) => {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    });
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();
export type Config = typeof config;
