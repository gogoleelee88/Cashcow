import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

export const register = new Registry();

// Default Node.js metrics (memory, CPU, GC, event loop)
collectDefaultMetrics({ register, prefix: 'characterverse_' });

// HTTP request metrics
export const httpRequestDuration = new Histogram({
  name: 'characterverse_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const httpRequestTotal = new Counter({
  name: 'characterverse_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// AI metrics
export const aiRequestTotal = new Counter({
  name: 'characterverse_ai_requests_total',
  help: 'Total AI API requests',
  labelNames: ['model', 'status'],
  registers: [register],
});

export const aiRequestDuration = new Histogram({
  name: 'characterverse_ai_request_duration_seconds',
  help: 'AI API request duration',
  labelNames: ['model', 'status'],
  buckets: [0.5, 1, 2, 5, 10, 20, 30, 60],
  registers: [register],
});

export const aiTokensUsed = new Counter({
  name: 'characterverse_ai_tokens_total',
  help: 'Total AI tokens used',
  labelNames: ['model', 'type'], // type: input | output
  registers: [register],
});

// Queue metrics
export const queueDepth = new Gauge({
  name: 'characterverse_queue_depth',
  help: 'Current queue depth',
  labelNames: ['queue_name'],
  registers: [register],
});

export const queueJobDuration = new Histogram({
  name: 'characterverse_queue_job_duration_seconds',
  help: 'Queue job processing duration',
  labelNames: ['queue_name', 'job_type'],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60],
  registers: [register],
});

// Business metrics
export const activeUsers = new Gauge({
  name: 'characterverse_active_users',
  help: 'Currently active users (WebSocket connections)',
  registers: [register],
});

export const chatMessagesTotal = new Counter({
  name: 'characterverse_chat_messages_total',
  help: 'Total chat messages sent',
  labelNames: ['tier'],
  registers: [register],
});

export const creditsConsumedTotal = new Counter({
  name: 'characterverse_credits_consumed_total',
  help: 'Total credits consumed',
  labelNames: ['model'],
  registers: [register],
});

export const authEventsTotal = new Counter({
  name: 'characterverse_auth_events_total',
  help: 'Authentication events',
  labelNames: ['event', 'provider'], // event: login|logout|register|refresh|fail
  registers: [register],
});
