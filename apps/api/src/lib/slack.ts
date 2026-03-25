import { config } from '../config';
import { logger } from './logger';

type SlackSeverity = 'info' | 'warning' | 'error' | 'critical';

const COLORS: Record<SlackSeverity, string> = {
  info: '#36a64f',
  warning: '#ff9900',
  error: '#e01e5a',
  critical: '#8B0000',
};

interface SlackMessage {
  title: string;
  message: string;
  severity?: SlackSeverity;
  fields?: Record<string, string>;
  error?: Error | unknown;
}

export async function sendSlackAlert(notification: SlackMessage): Promise<void> {
  if (!config.SLACK_WEBHOOK_URL) return;

  const { title, message, severity = 'info', fields, error } = notification;

  const payload = {
    attachments: [
      {
        color: COLORS[severity],
        title: `[${config.NODE_ENV.toUpperCase()}] ${title}`,
        text: message,
        fields: [
          { title: 'Environment', value: config.NODE_ENV, short: true },
          { title: 'Severity', value: severity.toUpperCase(), short: true },
          ...Object.entries(fields || {}).map(([title, value]) => ({
            title,
            value,
            short: true,
          })),
          ...(error instanceof Error
            ? [{ title: 'Error', value: `\`\`\`${error.message}\`\`\``, short: false }]
            : []),
        ],
        ts: String(Math.floor(Date.now() / 1000)),
        footer: 'CharacterVerse API',
      },
    ],
  };

  try {
    const res = await fetch(config.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, 'Slack notification failed');
    }
  } catch (err) {
    logger.error({ err }, 'Failed to send Slack notification');
  }
}

export async function alertCritical(title: string, error: unknown): Promise<void> {
  await sendSlackAlert({
    title,
    message: error instanceof Error ? error.message : String(error),
    severity: 'critical',
    error,
  });
}
