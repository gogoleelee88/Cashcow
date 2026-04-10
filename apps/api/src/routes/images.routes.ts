import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../plugins/auth.plugin';
import { prisma } from '../lib/prisma';
import { enqueueImageJob } from '../services/queue.service';
import OpenAI from 'openai';
import { config } from '../config';

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

interface StyleData {
  concept: string;
  basePrompt: string;
  coreKeywords: string;
  variationHints: string;
}

const STYLE_DATA: Record<string, StyleData> = {
  청초: {
    concept: 'Pure & Innocent — 맑고 깨끗하며 마음이 정화되는 투명한 분위기',
    basePrompt: 'A portrait of a pure and innocent [character], soft gentle smile, wearing simple white linen clothes, standing in a sunlit morning flower garden, morning dew, soft natural lighting, pastel color palette, soft focus, ethereal and clean vibe, highly detailed anime style, 4k',
    coreKeywords: 'soft natural lighting, white linen, ethereal and clean vibe, pastel palette',
    variationHints: 'Vary: season (spring/summer/autumn), specific flowers, time of day (dawn/morning), background details (river, meadow, greenhouse), accessories (ribbon, flower crown, straw hat), hair length, expression nuance',
  },
  순정: {
    concept: 'Romantic & Sentimental — 90년대 순정만화처럼 아련하고 감성적인 로맨스',
    basePrompt: 'A sentimental romantic portrait of a [character], looking deeply into the viewer\'s eyes, slight blush on cheeks, wearing a cozy knit sweater, falling cherry blossom petals in the background, warm golden hour lighting, 90s shojo manga aesthetic, nostalgic and emotional atmosphere, masterpiece',
    coreKeywords: 'looking deeply into viewer\'s eyes, golden hour lighting, 90s shojo manga aesthetic, nostalgic',
    variationHints: 'Vary: weather (rain/snow/autumn leaves), clothing (cardigan/school uniform/coat), setting (rooftop/library/train window/café), specific emotional expression (longing/happiness/wistfulness), season',
  },
  키치: {
    concept: 'Kitsch & Quirky — Y2K 감성이 듬뿍 담긴 통통 튀는 화려한 스타일',
    basePrompt: 'A kitschy and colorful [character], playful winking expression, wearing vibrant Y2K fashion with colorful hair clips, holding a retro flip phone, background filled with pop-art stickers and neon shapes, hyper-pop aesthetic, bold outlines, trendy vibe, 8k resolution',
    coreKeywords: 'kitschy, Y2K fashion, hyper-pop aesthetic, bold outlines, neon',
    variationHints: 'Vary: specific accessories (platform shoes/chunky jewelry/mini bag), hair color and style, prop (lollipop/camera/headphones), background pattern (stars/hearts/holographic), color scheme',
  },
  로판: {
    concept: 'Romantic Fantasy — 웹툰에서 튀어나온 화려한 유럽풍 귀족 스타일',
    basePrompt: 'An elegant [character] from a romantic fantasy webtoon, wearing intricately detailed royal Victorian attire with gold embroidery, aristocratic posture, standing in a grand palace ballroom with glowing crystal chandeliers, dramatic cinematic lighting, majestic atmosphere, Korean webtoon art style, gorgeous',
    coreKeywords: 'royal Victorian attire, grand palace, cinematic lighting, Korean webtoon art style',
    variationHints: 'Vary: setting (rose garden/moonlit balcony/throne room/enchanted forest), outfit color and embellishment, magical elements (floating petals/glowing particles/starlight), season, specific royal accessories (crown/scepter/cape)',
  },
  모에: {
    concept: 'Moe & Cute — 지켜주고 싶은 귀엽고 사랑스러운 애니메이션 감성',
    basePrompt: 'An incredibly cute moe [character], big expressive sparkling eyes, sweet innocent expression, wearing an oversized fluffy animal hoodie, hugging a soft plushie, pastel pink bedroom background, soft lighting, Kyoto Animation style, kawaii aesthetic, extremely adorable',
    coreKeywords: 'sparkling eyes, oversized animal hoodie, kawaii aesthetic, Kyoto Animation style',
    variationHints: 'Vary: animal theme (cat/bunny/bear/fox), plushie type, room decor details, specific action (drinking hot cocoa/reading/sleeping), hair accessories, soft color palette shift (mint/lavender/peach)',
  },
  액션: {
    concept: 'Action & Dynamic — 역동적이고 날카로우며 능력자물에 어울리는 스타일',
    basePrompt: 'A dynamic action shot of a fierce [character], intense focused expression, wind blowing violently through hair, wearing dark tactical techwear, mid-air combat pose, neon-lit cyberpunk city alley background, dramatic rim lighting, motion blur, cinematic angles, high contrast',
    coreKeywords: 'dynamic action shot, tactical techwear, dramatic rim lighting, motion blur, cinematic',
    variationHints: 'Vary: power type (lightning/fire/ice/shadow), setting (rooftop/ruins/underground arena/storm), specific battle pose, weapon or ability effect, lighting color (electric blue/crimson/white), costume detail',
  },
  모던: {
    concept: 'Modern & Chic — 차갑고 세련된 도시적 분위기, 오피스물 감성',
    basePrompt: 'A chic modern [character], confident relaxed posture, drinking espresso, wearing a perfectly tailored dark designer suit and turtleneck, sitting in a high-end minimalist café with large glass windows overlooking a modern metropolis, cold daylight, vogue magazine editorial style, photorealistic anime',
    coreKeywords: 'tailored dark suit, minimalist café, vogue editorial style, cold daylight, photorealistic anime',
    variationHints: 'Vary: location (penthouse/art gallery/airport lounge/bookstore), outfit color (navy/burgundy/cream/black), prop (book/laptop/phone/wine glass), time of day (golden hour/night city lights/rainy day), accessory (glasses/watch/earrings)',
  },
  와일드: {
    concept: 'Wild & Rugged — 거칠고 퇴폐미 흐르는 야성적 매력',
    basePrompt: 'A rugged wild [character], intense feral gaze, slightly messy hair, sweat on skin, wearing a distressed leather jacket, sitting on a vintage motorcycle in a desert landscape, dust in the air, harsh midday sun, strong dark shadows, gritty texture, highly detailed illustration',
    coreKeywords: 'intense feral gaze, distressed leather jacket, gritty texture, harsh lighting, rugged',
    variationHints: 'Vary: environment (cliff edge/abandoned warehouse/rainy street/forest), additional clothing detail (ripped jeans/boots/chain), weather/atmosphere, hair style (wet/windswept/half-tied), specific dangerous prop, wound or scar detail',
  },
  남사친: {
    concept: 'Boy/Girl-next-door — 편안하고 친근한 소꿉친구 재질',
    basePrompt: 'A friendly and approachable close childhood friend [character], sitting casually on a neighborhood playground swing at sunset, wearing a comfortable oversized hoodie and sweatpants, smiling warmly and offering an ice cream, everyday casual vibe, warm cozy lighting, slice of life anime style, nostalgic',
    coreKeywords: 'childhood friend, casual vibe, warm cozy lighting, slice of life anime style, nostalgic',
    variationHints: 'Vary: everyday location (convenience store/school rooftop/bicycle ride/movie theater), shared activity, specific season and weather, clothing color, food/item shared, time of day (after school/summer evening/winter morning)',
  },
  육아물: {
    concept: 'Childcare & Family — 다정하고 따뜻한 힐링 육아물 로맨스',
    basePrompt: 'A heartwarming scene of a gentle [character] lovingly holding a cute sleeping toddler in their arms, warm parental smile, looking down affectionately, wearing comfortable soft loungewear, sunlit cozy nursery room background, soft pastel colors, peaceful and healing atmosphere, masterpiece',
    coreKeywords: 'holding sleeping toddler, parental smile, peaceful healing atmosphere, soft pastel, cozy',
    variationHints: 'Vary: specific parenting moment (feeding/reading bedtime story/bath time/playground), child age and appearance, setting (kitchen/park/hospital/home), season (rainy day indoors/spring garden), emotional expression (tired but happy/proud/tender)',
  },
  집착: {
    concept: 'Obsessive & Possessive — 얀데레, 나만 바라보는 위험하고 짙은 집착',
    basePrompt: 'An obsessive possessive [character], staring intensely directly at the viewer with a dark yandere gaze, slight dangerous smirk, reaching out a hand towards the camera, face partially hidden in deep shadow, dramatic red and purple backlighting, close up portrait, psychological thriller romance vibe, intense atmosphere',
    coreKeywords: 'dark yandere gaze, face in shadow, dramatic backlighting, psychological thriller romance',
    variationHints: 'Vary: shadow depth and color (deep blue/crimson/void black), specific haunting detail (photograph/tied ribbon/shattered glass behind), expression micro-nuance (fake smile/crying/laughing), setting clue (bedroom wall/rain window/empty corridor), possession symbol',
  },
};

const IMAGE_GEN_COST = 190; // credits per image

export const imageRoutes: FastifyPluginAsync = async (fastify) => {
  // ── 프롬프트 헬퍼 ───────────────────────────────────────────────────────────
  fastify.post('/prompt-helper', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { style, userInput } = request.body as { style?: string; userInput?: string };
      const styleData = style ? STYLE_DATA[style] : null;

      const systemPrompt = styleData
        ? `You are an expert anime/illustration image prompt engineer.
Your job: generate a UNIQUE variation of a style-specific prompt each time — never repeat the same output twice.

STYLE: ${style} — ${styleData.concept}
BASE TEMPLATE: ${styleData.basePrompt}
CORE KEYWORDS (always keep these): ${styleData.coreKeywords}
VARIATION ELEMENTS (change these creatively each call): ${styleData.variationHints}

RULES:
- Always write in English, comma-separated
- Replace [character] with a specific description (e.g. "1boy with silver hair", "1girl with warm brown eyes")
- Keep core style keywords intact; creatively vary everything else
- If user input is provided, naturally weave it in while preserving the style's essence
- Output ONLY the final prompt — no explanation, no quotes, no markdown
- Max 120 words`
        : `You are an expert anime/illustration image prompt engineer.
Generate a creative, detailed English image generation prompt.
Output ONLY the prompt — comma-separated, max 100 words, no explanation.`;

      const userMessage = userInput
        ? `User's idea: "${userInput}"\nGenerate a prompt that incorporates this idea into the ${style ?? 'anime'} style.`
        : `Generate a fresh unique variation for the ${style ?? 'anime'} style.`;

      const completion = await openai.chat.completions.create({
        model: config.OPENAI_HAIKU_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 250,
        temperature: 1.0,
        presence_penalty: 0.6,
        frequency_penalty: 0.4,
      });

      const prompt = completion.choices[0]?.message?.content?.trim() ?? '';
      return reply.send({ success: true, data: { prompt } });
    },
  });

  // ── 신규 생성 (Job 기반) ────────────────────────────────────────────────────
  fastify.post('/generate', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;
      const { prompt, style, ratio = '1:1', count = 1 } = request.body as {
        prompt: string;
        style?: string;
        ratio?: string;
        count?: number;
      };

      if (!prompt?.trim()) {
        return reply.code(400).send({ success: false, error: { code: 'NO_PROMPT', message: '프롬프트를 입력해 주세요.' } });
      }

      const safeCount = Math.min(4, Math.max(1, count));
      const totalCost = safeCount * IMAGE_GEN_COST;

      // 크레딧 차감 + DB 레코드 생성 (트랜잭션)
      let imageRecord: { id: string };
      try {
        imageRecord = await prisma.$transaction(async (tx) => {
          const user = await tx.user.findUniqueOrThrow({
            where: { id: userId },
            select: { creditBalance: true },
          });

          if (user.creditBalance < totalCost) {
            throw Object.assign(new Error('크레딧이 부족합니다.'), { code: 'INSUFFICIENT_CREDITS' });
          }

          await tx.user.update({
            where: { id: userId },
            data: { creditBalance: { decrement: totalCost } },
          });

          await tx.transaction.create({
            data: {
              userId,
              type: 'USAGE',
              amount: totalCost,
              credits: -totalCost,
              status: 'COMPLETED',
            },
          });

          return tx.generatedImage.create({
            data: {
              userId,
              prompt: prompt.trim(),
              style: style ?? null,
              ratio,
              type: 'GENERATE',
              status: 'PENDING',
              creditsUsed: totalCost,
            },
          });
        });
      } catch (err: any) {
        if (err.code === 'INSUFFICIENT_CREDITS') {
          return reply.code(402).send({ success: false, error: { code: 'INSUFFICIENT_CREDITS', message: err.message } });
        }
        throw err;
      }

      // Job 큐에 등록
      const jobId = await enqueueImageJob({
        imageRecordId: imageRecord.id,
        type: 'GENERATE',
        userId,
        prompt: prompt.trim(),
        style,
        ratio,
        count: safeCount,
      });

      await prisma.generatedImage.update({
        where: { id: imageRecord.id },
        data: { jobId },
      });

      return reply.code(202).send({
        success: true,
        data: { imageId: imageRecord.id, jobId },
      });
    },
  });

  // ── 이미지 변형 (Job 기반) ──────────────────────────────────────────────────
  fastify.post('/transform', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;

      let imageBuffer: Buffer | null = null;
      let imageFilename = 'image.png';
      let imageMimetype = 'image/png';
      let prompt = '';
      let count = 1;
      let ratio = '1:1';

      for await (const part of request.parts()) {
        if (part.type === 'file' && part.fieldname === 'image') {
          imageBuffer = await part.toBuffer();
          imageFilename = part.filename || 'image.png';
          imageMimetype = part.mimetype;
        } else if (part.type === 'field') {
          const val = part.value as string;
          if (part.fieldname === 'prompt') prompt = val;
          if (part.fieldname === 'count') count = Math.min(4, Math.max(1, parseInt(val) || 1));
          if (part.fieldname === 'ratio') ratio = val;
        }
      }

      if (!imageBuffer) {
        return reply.code(400).send({ success: false, error: { code: 'NO_IMAGE', message: '이미지를 업로드해 주세요.' } });
      }
      if (!prompt.trim()) {
        return reply.code(400).send({ success: false, error: { code: 'NO_PROMPT', message: '변형할 내용을 입력해 주세요.' } });
      }

      const totalCost = count * IMAGE_GEN_COST;

      let imageRecord: { id: string };
      try {
        imageRecord = await prisma.$transaction(async (tx) => {
          const user = await tx.user.findUniqueOrThrow({
            where: { id: userId },
            select: { creditBalance: true },
          });

          if (user.creditBalance < totalCost) {
            throw Object.assign(new Error('크레딧이 부족합니다.'), { code: 'INSUFFICIENT_CREDITS' });
          }

          await tx.user.update({
            where: { id: userId },
            data: { creditBalance: { decrement: totalCost } },
          });

          await tx.transaction.create({
            data: {
              userId,
              type: 'USAGE',
              amount: totalCost,
              credits: -totalCost,
              status: 'COMPLETED',
            },
          });

          return tx.generatedImage.create({
            data: {
              userId,
              prompt: prompt.trim(),
              ratio,
              type: 'TRANSFORM',
              status: 'PENDING',
              creditsUsed: totalCost,
            },
          });
        });
      } catch (err: any) {
        if (err.code === 'INSUFFICIENT_CREDITS') {
          return reply.code(402).send({ success: false, error: { code: 'INSUFFICIENT_CREDITS', message: err.message } });
        }
        throw err;
      }

      const jobId = await enqueueImageJob({
        imageRecordId: imageRecord.id,
        type: 'TRANSFORM',
        userId,
        prompt: prompt.trim(),
        ratio,
        count,
        sourceImageBase64: imageBuffer.toString('base64'),
        sourceImageMimetype: imageMimetype,
        sourceImageFilename: imageFilename,
      });

      await prisma.generatedImage.update({
        where: { id: imageRecord.id },
        data: { jobId },
      });

      return reply.code(202).send({
        success: true,
        data: { imageId: imageRecord.id, jobId },
      });
    },
  });

  // ── Job 폴링: GET /images/jobs/:imageId ─────────────────────────────────────
  fastify.get('/jobs/:imageId', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;
      const { imageId } = request.params as { imageId: string };

      const image = await prisma.generatedImage.findFirst({
        where: { id: imageId, userId },
        select: { id: true, status: true, urls: true, errorMsg: true, creditsUsed: true, style: true, ratio: true, type: true, createdAt: true },
      });

      if (!image) {
        return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: '이미지를 찾을 수 없습니다.' } });
      }

      return reply.send({ success: true, data: image });
    },
  });

  // ── 라이브러리: GET /images/library ─────────────────────────────────────────
  fastify.get('/library', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;
      const { cursor, limit = '20' } = request.query as { cursor?: string; limit?: string };
      const take = Math.min(50, parseInt(limit) || 20);

      const images = await prisma.generatedImage.findMany({
        where: { userId, status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: { id: true, urls: true, prompt: true, style: true, ratio: true, type: true, isLiked: true, creditsUsed: true, createdAt: true },
      });

      const hasMore = images.length > take;
      const items = hasMore ? images.slice(0, take) : images;
      const nextCursor = hasMore ? items[items.length - 1].id : null;

      return reply.send({ success: true, data: { items, nextCursor } });
    },
  });

  // ── 좋아요 탭: GET /images/liked ─────────────────────────────────────────────
  fastify.get('/liked', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;
      const { cursor, limit = '20' } = request.query as { cursor?: string; limit?: string };
      const take = Math.min(50, parseInt(limit) || 20);

      const images = await prisma.generatedImage.findMany({
        where: { userId, status: 'COMPLETED', isLiked: true },
        orderBy: { createdAt: 'desc' },
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: { id: true, urls: true, prompt: true, style: true, ratio: true, type: true, isLiked: true, creditsUsed: true, createdAt: true },
      });

      const hasMore = images.length > take;
      const items = hasMore ? images.slice(0, take) : images;
      const nextCursor = hasMore ? items[items.length - 1].id : null;

      return reply.send({ success: true, data: { items, nextCursor } });
    },
  });

  // ── 좋아요 토글: PATCH /images/:imageId/like ────────────────────────────────
  fastify.patch('/:imageId/like', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const userId = request.userId!;
      const { imageId } = request.params as { imageId: string };

      const image = await prisma.generatedImage.findFirst({
        where: { id: imageId, userId },
        select: { isLiked: true },
      });

      if (!image) {
        return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: '이미지를 찾을 수 없습니다.' } });
      }

      const updated = await prisma.generatedImage.update({
        where: { id: imageId },
        data: { isLiked: !image.isLiked },
        select: { id: true, isLiked: true },
      });

      return reply.send({ success: true, data: updated });
    },
  });
};
