// import Anthropic from '@anthropic-ai/sdk'; // Anthropic 비활성화 - OpenAI로 전환
import OpenAI from 'openai';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { decrypt } from '../lib/encryption';
import { logger } from '../lib/logger';
import { aiRequestTotal, aiRequestDuration, aiTokensUsed, creditsConsumedTotal } from '../lib/metrics';
import type { Message as PrismaMessage } from '@prisma/client';

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

// ─────────────────────────────────────────────
// CONTEXT WINDOW MANAGEMENT
// Keeps token count within model limits
// ─────────────────────────────────────────────
const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  'gpt-4o-mini': 128_000,
  'gpt-4o': 128_000,
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

  const response = await openai.chat.completions.create({
    model: config.OPENAI_HAIKU_MODEL,
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `다음 대화를 간결하게 요약해주세요. 중요한 사실, 관계, 감정적 맥락을 보존하세요. 3-5문장으로:\n\n${text}`,
      },
    ],
  });

  const summary = response.choices[0].message.content ?? '';
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
export interface EpisodicMemory {
  userFacts: Record<string, unknown>;
  keyEvents: Array<{ turn: number; event: string }>;
  relationshipMilestones: string[];
}

export function buildSystemPrompt(
  decryptedSystemPrompt: string,
  characterName: string,
  opts?: {
    conversationSummary?: string;
    episodicMemory?: EpisodicMemory | null;
    relationshipLevel?: number;
    emotionalTone?: string | null;
    lastSessionSummary?: string | null;
    userCharacterMemory?: { cumulativeSummary?: string | null; userProfile?: Record<string, unknown> | null } | null;
    situationImages?: Array<{ id: string; description: string; triggerKeywords: string[] }> | null;
  }
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

  if (opts?.conversationSummary) {
    parts.push('', `[이전 대화 요약]`, opts.conversationSummary);
  }

  if (opts?.lastSessionSummary) {
    parts.push('', `[지난 세션 요약]`, opts.lastSessionSummary);
    parts.push(`- 위 내용을 바탕으로 자연스럽게 이어지는 대화를 이어가세요.`);
  }

  if (opts?.userCharacterMemory?.cumulativeSummary) {
    parts.push('', `[누적 기억]`, opts.userCharacterMemory.cumulativeSummary);
  }

  if (opts?.userCharacterMemory?.userProfile && Object.keys(opts.userCharacterMemory.userProfile).length > 0) {
    const profile = opts.userCharacterMemory.userProfile;
    const profileLines = Object.entries(profile)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => `  ${k}: ${Array.isArray(v) ? (v as string[]).join(', ') : v}`);
    if (profileLines.length > 0) {
      parts.push('', `[유저 정보]`, ...profileLines);
    }
  }

  if (opts?.episodicMemory) {
    const em = opts.episodicMemory;
    if (em.keyEvents && em.keyEvents.length > 0) {
      parts.push('', `[중요 사건]`);
      em.keyEvents.slice(-5).forEach((e) => parts.push(`  - (턴 ${e.turn}) ${e.event}`));
    }
    if (em.relationshipMilestones && em.relationshipMilestones.length > 0) {
      parts.push('', `[관계 이정표]`, `  ${em.relationshipMilestones.join(' → ')}`);
    }
  }

  if (opts?.relationshipLevel !== undefined && opts.relationshipLevel > 0) {
    const levelDesc =
      opts.relationshipLevel >= 80 ? '매우 친밀한 사이' :
      opts.relationshipLevel >= 60 ? '서로 이름을 부르는 사이' :
      opts.relationshipLevel >= 40 ? '친해지고 있는 사이' :
      opts.relationshipLevel >= 20 ? '서로를 알아가는 사이' : '처음 만나는 사이';
    const tone = opts.emotionalTone ? ` — 현재 분위기: ${opts.emotionalTone}` : '';
    parts.push('', `[관계 상태] 친밀도 ${opts.relationshipLevel}/100 — ${levelDesc}${tone}`);
  }

  if (opts?.situationImages && opts.situationImages.length > 0) {
    parts.push('', `[상황 이미지 트리거 안내]`);
    parts.push(`- 아래 상황에 해당하는 장면이 펼쳐질 때, 응답 끝에 [IMAGE:이미지ID] 태그를 정확히 한 번 삽입하세요.`);
    parts.push(`- 태그는 응답 마지막 줄에 단독으로 위치해야 합니다. 예: [IMAGE:abc123]`);
    opts.situationImages.forEach((img) => {
      parts.push(`  ID:${img.id} | ${img.description} | 키워드: ${img.triggerKeywords.join(', ')}`);
    });
  }

  return parts.join('\n');
}

// ─────────────────────────────────────────────
// EPISODIC MEMORY EXTRACTION (계층 2)
// 30번째 메시지마다 중요 사건/팩트 추출
// ─────────────────────────────────────────────
export async function extractEpisodicMemory(conversationId: string): Promise<void> {
  const [conversation, messages] = await Promise.all([
    prisma.conversation.findUnique({ where: { id: conversationId } }),
    prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true },
    }),
  ]);
  if (!conversation || messages.length < 10) return;

  const existing = (conversation.episodicMemory as EpisodicMemory | null) ?? {
    userFacts: {}, keyEvents: [], relationshipMilestones: [],
  };

  const recentSlice = messages.slice(-30);
  const dialogText = recentSlice
    .map((m, i) => `${m.role === 'USER' ? '사용자' : 'AI'}: ${m.content.slice(0, 300)}`)
    .join('\n');

  const response = await openai.chat.completions.create({
    model: config.OPENAI_HAIKU_MODEL,
    max_tokens: 600,
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content: `당신은 대화 분석 AI입니다. 대화에서 중요한 정보를 추출해 JSON으로 반환하세요.
반드시 아래 형식으로만 응답하세요 (JSON만, 설명 없이):
{
  "userFacts": { "name": "이름이 밝혀진 경우만", "likes": ["좋아하는 것"], "dislikes": ["싫어하는 것"] },
  "keyEvents": [{ "event": "중요한 사건 1문장" }],
  "relationshipMilestones": ["관계 이정표"]
}`,
      },
      { role: 'user', content: `대화:\n${dialogText}` },
    ],
  });

  try {
    const raw = response.choices[0].message.content ?? '{}';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;
    const extracted = JSON.parse(jsonMatch[0]);

    const merged: EpisodicMemory = {
      userFacts: { ...existing.userFacts, ...extracted.userFacts },
      keyEvents: [
        ...existing.keyEvents,
        ...(extracted.keyEvents ?? []).map((e: { event: string }) => ({
          turn: messages.length,
          event: e.event,
        })),
      ].slice(-20), // 최대 20개만 유지
      relationshipMilestones: Array.from(
        new Set([...existing.relationshipMilestones, ...(extracted.relationshipMilestones ?? [])])
      ).slice(-10),
    };

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { episodicMemory: merged as any, episodicUpdatedAt: new Date() },
    });

    // UserCharacterMemory 동기화
    await syncUserCharacterMemory(conversation.userId, conversation.characterId, merged);

    logger.info({ conversationId }, 'Episodic memory extracted');
  } catch (err) {
    logger.warn({ err, conversationId }, 'Failed to parse episodic memory JSON');
  }
}

// ─────────────────────────────────────────────
// RELATIONSHIP STATE UPDATE (계층 3)
// 50번째 메시지마다 친밀도/감정 재계산
// ─────────────────────────────────────────────
export async function updateRelationshipState(conversationId: string): Promise<void> {
  const [conversation, messages] = await Promise.all([
    prisma.conversation.findUnique({ where: { id: conversationId } }),
    prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true },
      take: 50,
    }),
  ]);
  if (!conversation) return;

  const dialogText = messages
    .map((m) => `${m.role === 'USER' ? '사용자' : 'AI'}: ${m.content.slice(0, 200)}`)
    .join('\n');

  const response = await openai.chat.completions.create({
    model: config.OPENAI_HAIKU_MODEL,
    max_tokens: 300,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: `대화를 분석해 관계 상태를 JSON으로 반환하세요. JSON만 응답하세요:
{
  "relationshipLevel": 0~100 숫자,
  "emotionalTone": "현재 감정 분위기 한 단어 (따뜻함/설렘/긴장/평온/슬픔 등)",
  "lastSessionSummary": "이 대화를 1~2문장으로 요약 (다음에 만날 때 인사말에 활용할 내용)"
}`,
      },
      { role: 'user', content: `대화:\n${dialogText}` },
    ],
  });

  try {
    const raw = response.choices[0].message.content ?? '{}';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;
    const result = JSON.parse(jsonMatch[0]);

    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        relationshipLevel: Math.min(100, Math.max(0, result.relationshipLevel ?? conversation.relationshipLevel)),
        emotionalTone: result.emotionalTone ?? conversation.emotionalTone,
        lastSessionSummary: result.lastSessionSummary ?? conversation.lastSessionSummary,
      },
    });

    logger.info({ conversationId, level: result.relationshipLevel }, 'Relationship state updated');
  } catch (err) {
    logger.warn({ err, conversationId }, 'Failed to parse relationship state JSON');
  }
}

// ─────────────────────────────────────────────
// USER CHARACTER MEMORY SYNC (다중 대화 간 기억 공유)
// ─────────────────────────────────────────────
export async function syncUserCharacterMemory(
  userId: string,
  characterId: string,
  episodic: EpisodicMemory
): Promise<void> {
  const existing = await prisma.userCharacterMemory.findUnique({
    where: { userId_characterId: { userId, characterId } },
  });

  const mergedProfile = {
    ...(existing?.userProfile as Record<string, unknown> ?? {}),
    ...episodic.userFacts,
  };

  if (existing) {
    await prisma.userCharacterMemory.update({
      where: { userId_characterId: { userId, characterId } },
      data: {
        userProfile: mergedProfile as any,
        totalInteractions: { increment: 1 },
        updatedAt: new Date(),
      },
    });
  } else {
    await prisma.userCharacterMemory.create({
      data: { userId, characterId, userProfile: mergedProfile as any, totalInteractions: 1 },
    });
  }
}

// ─────────────────────────────────────────────
// SITUATION IMAGE TAG PARSER (Phase 3)
// AI 응답에서 [IMAGE:id] 태그 추출
// ─────────────────────────────────────────────
export function parseImageTag(text: string): { cleanText: string; imageId: string | null } {
  const match = text.match(/\[IMAGE:([^\]]+)\]\s*$/);
  if (!match) return { cleanText: text, imageId: null };
  return {
    cleanText: text.slice(0, match.index).trimEnd(),
    imageId: match[1],
  };
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
  onComplete: (result: { inputTokens: number; outputTokens: number; fullText: string; imageId?: string | null }) => Promise<void>;
  onError: (error: Error) => Promise<void> | void;
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

    // Fetch conversation history + UserCharacterMemory in parallel
    const [conversation, historyMessages, userCharMemory] = await Promise.all([
      prisma.conversation.findUniqueOrThrow({ where: { id: conversationId } }),
      prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        take: 100,
      }),
      prisma.userCharacterMemory.findUnique({
        where: { userId_characterId: { userId, characterId } },
      }),
    ]);

    type SituationImage = { id: string; url: string; triggerKeywords: string[]; description: string };
    const situationImages = (character.situationImages as SituationImage[] | null)?.map((img) => ({
      id: img.id,
      description: img.description,
      triggerKeywords: img.triggerKeywords,
    }));

    const fullSystem = buildSystemPrompt(systemPrompt, character.name, {
      conversationSummary: conversation.summary ?? undefined,
      episodicMemory: (conversation.episodicMemory as EpisodicMemory | null) ?? null,
      relationshipLevel: (conversation as any).relationshipLevel ?? 0,
      emotionalTone: (conversation as any).emotionalTone ?? null,
      lastSessionSummary: (conversation as any).lastSessionSummary ?? null,
      userCharacterMemory: userCharMemory
        ? { cumulativeSummary: userCharMemory.cumulativeSummary, userProfile: userCharMemory.userProfile as Record<string, unknown> | null }
        : null,
      situationImages: situationImages ?? null,
    });

    // Build few-shot messages from creator's example dialogues
    // Format stored in DB: [{id, messages:[{id, role:'character'|'user', content}]}]
    type ExampleMsg = { role: 'character' | 'user'; content: string };
    type ExampleDialogue = { id: string; messages: ExampleMsg[] };
    const exampleDialogues = character.exampleDialogues as ExampleDialogue[] | null;
    const fewShotMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    if (exampleDialogues && exampleDialogues.length > 0) {
      for (const example of exampleDialogues.slice(0, 3)) {
        for (const msg of example.messages) {
          if (msg.content?.trim()) {
            fewShotMessages.push({
              role: msg.role === 'user' ? 'user' : 'assistant',
              content: msg.content,
            });
          }
        }
      }
    }

    // Convert to Anthropic format, respecting context window
    const formattedHistory = selectContextMessages(
      historyMessages.map((m) => ({ role: m.role.toLowerCase(), content: m.content }))
    );

    // Add current user message
    formattedHistory.push({ role: 'user', content: userMessage });

    // Select model (OpenAI)
    const model =
      character.model === 'claude-sonnet-4' ? config.OPENAI_SONNET_MODEL : config.OPENAI_HAIKU_MODEL;

    let fullText = '';
    let inputTokens = 0;
    let outputTokens = 0;

    const stream = await openai.chat.completions.create(
      {
        model,
        max_tokens: character.maxTokens,
        temperature: character.temperature,
        stream: true,
        stream_options: { include_usage: true },
        messages: [
          { role: 'system', content: fullSystem },
          ...fewShotMessages,
          ...formattedHistory,
        ],
      },
      { signal }
    );

    for await (const chunk of stream) {
      if (signal?.aborted) break;

      const text = chunk.choices[0]?.delta?.content || '';
      if (text) {
        fullText += text;
        onChunk(text);
      }

      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens;
        outputTokens = chunk.usage.completion_tokens;
      }
    }

    // Parse situation image tag before filtering
    const { cleanText, imageId } = parseImageTag(fullText);

    // Filter final response
    const filterResult = filterAssistantResponse(cleanText);
    const finalText = filterResult.safe ? cleanText : filterResult.filtered!;

    timer({ model, status: 'success' });
    aiRequestTotal.inc({ model, status: 'success' });
    aiTokensUsed.inc({ model, type: 'input' }, inputTokens);
    aiTokensUsed.inc({ model, type: 'output' }, outputTokens);

    await onComplete({ inputTokens, outputTokens, fullText: finalText, imageId });
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
  // OpenAI pricing (credits per token)
  const rates: Record<string, { input: number; output: number }> = {
    [config.OPENAI_HAIKU_MODEL]: { input: 0.000015, output: 0.00006 },   // gpt-4o-mini
    [config.OPENAI_SONNET_MODEL]: { input: 0.00025, output: 0.001 },      // gpt-4o
  };
  const rate = rates[model] || rates[config.OPENAI_HAIKU_MODEL];
  return Math.max(1, Math.ceil(inputTokens * rate.input + outputTokens * rate.output));
}
