import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getVoiceLibrary, cloneVoice, deleteClonedVoice, streamTTS, previewVoice } from '../services/voice.service';
import { requireAuth } from '../plugins/auth.plugin';
import { uploadRateLimit } from '../plugins/rate-limit.plugin';
import { logger } from '../lib/logger';
import OpenAI from 'openai';
import { config } from '../config';
import { toFile } from 'openai/uploads';

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

export const voiceRoutes: FastifyPluginAsync = async (fastify) => {

  // ─────────────────────────────────────────────
  // GET /api/voice/library — ElevenLabs 음성 목록
  // ─────────────────────────────────────────────
  fastify.get('/library', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const voices = await getVoiceLibrary();
      const filtered = voices.map((v) => ({
        voiceId: v.voice_id,
        name: v.name,
        previewUrl: v.preview_url,
        labels: v.labels,
        category: v.category,
      }));
      return reply.send({ success: true, data: filtered });
    },
  });

  // ─────────────────────────────────────────────
  // GET /api/voice/preview/:voiceId — 미리 듣기 스트림
  // ─────────────────────────────────────────────
  fastify.get<{ Params: { voiceId: string } }>('/preview/:voiceId', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const { voiceId } = request.params;
      const stream = await previewVoice(voiceId);
      reply.header('Content-Type', 'audio/mpeg');
      reply.header('Transfer-Encoding', 'chunked');
      return reply.send(stream);
    },
  });

  // ─────────────────────────────────────────────
  // POST /api/voice/clone — 목소리 클로닝
  // ─────────────────────────────────────────────
  fastify.post('/clone', {
    preHandler: [requireAuth, uploadRateLimit],
    handler: async (request, reply) => {
      const data = await request.file();
      if (!data) return reply.code(400).send({ success: false, error: { code: 'NO_FILE', message: '오디오 파일이 필요합니다.' } });

      const nameField = (request.body as any)?.name;
      const voiceName = nameField || '내 목소리';

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) chunks.push(chunk);
      const audioBuffer = Buffer.concat(chunks);

      if (audioBuffer.length > 25 * 1024 * 1024) {
        return reply.code(400).send({ success: false, error: { code: 'FILE_TOO_LARGE', message: '파일은 25MB 이하여야 합니다.' } });
      }

      const voiceId = await cloneVoice(voiceName, audioBuffer, data.filename);
      return reply.send({ success: true, data: { voiceId, name: voiceName } });
    },
  });

  // ─────────────────────────────────────────────
  // DELETE /api/voice/:voiceId — 클론 음성 삭제
  // ─────────────────────────────────────────────
  fastify.delete<{ Params: { voiceId: string } }>('/:voiceId', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      await deleteClonedVoice(request.params.voiceId);
      return reply.send({ success: true });
    },
  });

  // ─────────────────────────────────────────────
  // POST /api/voice/speak — TTS 스트리밍
  // ─────────────────────────────────────────────
  const speakSchema = z.object({
    text: z.string().min(1).max(5000),
    voiceId: z.string(),
    voiceSettings: z.object({
      stability: z.number().min(0).max(1).optional(),
      similarity_boost: z.number().min(0).max(1).optional(),
      style: z.number().min(0).max(1).optional(),
      speed: z.number().min(0.5).max(2).optional(),
    }).optional(),
  });

  fastify.post('/speak', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const body = speakSchema.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: body.error.issues[0].message } });
      }

      const { text, voiceId, voiceSettings } = body.data;
      const stream = await streamTTS(text, voiceId, voiceSettings);

      reply.header('Content-Type', 'audio/mpeg');
      reply.header('Transfer-Encoding', 'chunked');
      reply.header('Cache-Control', 'no-cache');
      return reply.send(stream);
    },
  });

  // ─────────────────────────────────────────────
  // POST /api/voice/transcribe — STT (Whisper)
  // ─────────────────────────────────────────────
  fastify.post('/transcribe', {
    preHandler: [requireAuth],
    handler: async (request, reply) => {
      const data = await request.file();
      if (!data) return reply.code(400).send({ success: false, error: { code: 'NO_FILE', message: '오디오 파일이 필요합니다.' } });

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) chunks.push(chunk);
      const audioBuffer = Buffer.concat(chunks);

      const file = await toFile(audioBuffer, data.filename || 'audio.webm', { type: data.mimetype || 'audio/webm' });

      const transcription = await openai.audio.transcriptions.create({
        file,
        model: 'whisper-1',
        language: 'ko',
      });

      return reply.send({ success: true, data: { text: transcription.text } });
    },
  });
};
