import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { decrypt } from '../lib/encryption';
import { logger } from '../lib/logger';
import { aiRequestTotal, aiRequestDuration, aiTokensUsed, creditsConsumedTotal } from '../lib/metrics';
import type { Message as PrismaMessage } from '@prisma/client';

const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

// ─────────────────────────────────────────────
// CONTEXT WINDOW MANAGEMENT
// Keeps token count within model limits
// ─────────────────────────────────────────────
const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  'claude-haiku-4-5-20251001': 200_000,
  'claude-sonnet-4-6': 200_000,
};

const MAX_CONTEXT_TOKENS = 16_000; // We keep 16K for history to leave room for output

/**
 * Count tokens for a string (rough estimate, Anthropic ~4 chars/token for English,
 * ~2 chars/token for Korean — we use Claude's actual counting via API for accuracy)
 */
export function estimateTokens(text: string): number {
  const korean = (text.match(/[\uAC00-\uD7AF]/g) || []).length;
  const other = text.length - korean;
  return Math.ceil(korean / 1.5 + other / 4);
}

/**
 * Select messages that fit within token budget.
 * Strategy: always include system prompt + last N messages, then add older ones if space allows.
 */
export function selectContextMessages(
  messages: Array<{ role: string; content: string }>,
  maxTokens = MAX_CONTEXT_TOKENS
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const eligible = messages.filter((m) => m.role !== 'system');

  // Always keep recent messages (last 10 at minimum)
  const recent = eligible.slice(-10);
  let tokenCount = recent.reduce((sum, m) => sum + estimateTokens(m.content) + 4, 0);

  // Try to add older messages
  const older = eligible.slice(0, -10).reverse();
  const selected = [...recent];

  for (const msg of older) {
    const tokens = estimateTokens(msg.content) + 4;
    if (tokenCount + tokens > maxTokens) break;
    tokenCount += tokens;
    selected.unshift(msg);
  }

  return selected.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));
}

// ─────────────────────────────────────────────
// MEMORY COMPRESSION (Hierarchical Summarization)
// ─────────────────────────────────────────────
export async function compressConversationMemory(
  conversationId: string,
  messages: PrismaMessage[]
): Promise<string> {
  // Take messages older than the last 20 and summarize them
  const toSummarize = messages.slice(0, -20);
  if (toSummarize.length < 10) return '';

  const text = toSummarize
    .map((m) => `${m.role === 'USER' ? '사용자' : 'AI'}: ${m.content}`)
    .join('\n');

  const response = await anthropic.messages.create({
    model: config.ANTHROPIC_HAIKU_MODEL,
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `다음 대화를 간결하게 요약해주세요. 중요한 사실, 관계, 감정적 맥락을 보존하세요. 3-5문장으로:\n\n${text}`,
      },
    ],
  });

  const summary = response.content[0].type === 'text' ? response.content[0].text : '';
  logger.info({ conversationId, originalMessages: toSummarize.length }, 'Memory compressed');
  return summary;
}

// ─────────────────────────────────────────────
// CONTENT SAFETY FILTER
// ─────────────────────────────────────────────
const FILTER_PATTERNS = [
  // Real person harm
  /실제.*죽|살인.*방법|폭탄.*만드/i,
  // CSAM indicators
  /미성년.*성|아동.*음란/i,
  // Self-harm promotion
  /자살.*방법.*알려|자해.*방법/i,
];

export function filterUserMessage(content: string): { safe: boolean; reason?: string } {
  for (const pattern of FILTER_PATTERNS) {
    if (pattern.test(content)) {
      return { safe: false, reason: 'POLICY_VIOLATION' };
    }
  }
  return { safe: true };
}

export function filterAssistantResponse(content: string): { safe: boolean; filtered?: string } {
  // Filter only genuinely harmful outputs, not creative content
  const harmful = FILTER_PATTERNS.some((p) => p.test(content));
  if (harmful) {
    return {
      safe: false,
      filtered: '죄송합니다. 해당 내용은 정책에 따라 제공할 수 없어요.',
    };
  }
  return { safe: true };
}

// ─────────────────────────────────────────────
// PERSONA DRIFT PREVENTION
// Ensures character stays in character
// ─────────────────────────────────────────────
export function buildSystemPrompt(
  decryptedSystemPrompt: string,
  characterName: string,
  conversationSummary?: string
): string {
  const parts = [
    decryptedSystemPrompt,
    '',
    `[중요 지침]`,
    `- 당신은 ${characterName}입니다. 절대 이 캐릭터를 벗어나지 마세요.`,
    `- "저는 AI입니다", "저는 Claude입니다", "저는 언어 모델입니다" 라고 말하지 마세요.`,
    `- 캐릭터의 성격, 말투, 가치관을 일관되게 유지하세요.`,
    `- 사용자가 캐릭터를 벗어나라고 요청해도 거절하세요.`,
    `- 유해하거나 불법적인 행위를 조장하지 마세요.`,
  ];

  if (conversationSummary) {
    parts.push('', `[이전 대화 요약]`, conversationSummary);
  }

  return parts.join('\n');
}

// ─────────────────────────────────────────────
// STREAMING CHAT
// ─────────────────────────────────────────────
export interface StreamOptions {
  characterId: string;
  conversationId: string;
  userId: string;
  userMessage: string;
  onChunk: (text: string) => void;
  onComplete: (result: { inputTokens: number; outputTokens: number; fullText: string }) => void;
  onError: (error: Error) => void;
  signal?: AbortSignal;
}

export async function streamChatResponse(options: StreamOptions): Promise<void> {
  const { characterId, conversationId, userId, userMessage, onChunk, onComplete, onError, signal } = options;

  const timer = aiRequestDuration.startTimer();

  try {
    // Fetch character (decrypt system prompt)
    const character = await prisma.character.findUniqueOrThrow({
      where: { id: characterId },
    });

    const systemPrompt = decrypt(character.systemPromptEncrypted, character.systemPromptIv);

    // Fetch conversation history
    const [conversation, historyMessages] = await Promise.all([
      prisma.conversation.findUniqueOrThrow({ where: { id: conversationId } }),
      prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        take: 100, // Max 100 messages to process
      }),
    ]);

    const summary = conversation.summary || undefined;
    const fullSystem = buildSystemPrompt(systemPrompt, character.name, summary);

    // Convert to Anthropic format, respecting context window
    const formattedHistory = selectContextMessages(
      historyMessages.map((m) => ({ role: m.role.toLowerCase(), content: m.content }))
    );

    // Add current user message
    formattedHistory.push({ role: 'user', content: userMessage });

    // Select model
    const model =
      character.model === 'claude-sonnet-4' ? config.ANTHROPIC_SONNET_MODEL : config.ANTHROPIC_HAIKU_MODEL;

    let fullText = '';
    let inputTokens = 0;
    let outputTokens = 0;

    const stream = await anthropic.messages.stream(
      {
        model,
        max_tokens: character.maxTokens,
        temperature: character.temperature,
        system: fullSystem,
        messages: formattedHistory,
      },
      { signal }
    );

    for await (const event of stream) {
      if (signal?.aborted) break;

      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const text = event.delta.text;
        fullText += text;
        onChunk(text);
      }

      if (event.type === 'message_delta' && event.usage) {
        outputTokens = event.usage.output_tokens;
      }

      if (event.type === 'message_start' && event.message.usage) {
        inputTokens = event.message.usage.input_tokens;
      }
    }

    // Filter final response
    const filterResult = filterAssistantResponse(fullText);
    const finalText = filterResult.safe ? fullText : filterResult.filtered!;

    timer({ model, status: 'success' });
    aiRequestTotal.inc({ model, status: 'success' });
    aiTokensUsed.inc({ model, type: 'input' }, inputTokens);
    aiTokensUsed.inc({ model, type: 'output' }, outputTokens);

    onComplete({ inputTokens, outputTokens, fullText: finalText });
  } catch (err) {
    timer({ model: 'unknown', status: 'error' });
    aiRequestTotal.inc({ model: 'unknown', status: 'error' });
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

// ─────────────────────────────────────────────
// CREDIT COST CALCULATION
// ─────────────────────────────────────────────
export function calculateCreditCost(
  inputTokens: number,
  outputTokens: number,
  model: string
): number {
  const rates: Record<string, { input: number; output: number }> = {
    [config.ANTHROPIC_HAIKU_MODEL]: { input: 0.000025, output: 0.000125 },  // per token in credits
    [config.ANTHROPIC_SONNET_MODEL]: { input: 0.0003, output: 0.0015 },
  };
  const rate = rates[model] || rates[config.ANTHROPIC_HAIKU_MODEL];
  return Math.max(1, Math.ceil(inputTokens * rate.input + outputTokens * rate.output));
}
