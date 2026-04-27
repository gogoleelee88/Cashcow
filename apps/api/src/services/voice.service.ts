import { config } from '../config';
import { logger } from '../lib/logger';

const ELEVEN_BASE = 'https://api.elevenlabs.io/v1';

function elevenHeaders() {
  return {
    'xi-api-key': config.ELEVENLABS_API_KEY ?? '',
    'Content-Type': 'application/json',
  };
}

// ─────────────────────────────────────────────
// VOICE LIBRARY
// ─────────────────────────────────────────────
export interface ElevenVoice {
  voice_id: string;
  name: string;
  preview_url: string | null;
  labels: Record<string, string>;
  category: string;
}

let voiceCache: { data: ElevenVoice[]; ts: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function getVoiceLibrary(): Promise<ElevenVoice[]> {
  if (voiceCache && Date.now() - voiceCache.ts < CACHE_TTL) return voiceCache.data;

  const res = await fetch(`${ELEVEN_BASE}/voices`, { headers: elevenHeaders() });
  if (!res.ok) throw new Error(`ElevenLabs voices error: ${res.status}`);

  const json = await res.json() as { voices: ElevenVoice[] };
  voiceCache = { data: json.voices, ts: Date.now() };
  return json.voices;
}

// ─────────────────────────────────────────────
// VOICE CLONE
// ─────────────────────────────────────────────
export async function cloneVoice(name: string, audioBuffer: Buffer, fileName: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form: any = new FormData();
  form.append('name', name);
  form.append('files', new Blob([audioBuffer as any]), fileName);

  const res = await fetch(`${ELEVEN_BASE}/voices/add`, {
    method: 'POST',
    headers: { 'xi-api-key': config.ELEVENLABS_API_KEY ?? '' },
    body: form,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Voice clone failed: ${err}`);
  }
  const json = await res.json() as { voice_id: string };
  return json.voice_id;
}

export async function deleteClonedVoice(voiceId: string): Promise<void> {
  await fetch(`${ELEVEN_BASE}/voices/${voiceId}`, {
    method: 'DELETE',
    headers: elevenHeaders(),
  });
}

// ─────────────────────────────────────────────
// TTS STREAM
// ─────────────────────────────────────────────
export interface VoiceSettings {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  speed?: number;
}

export async function streamTTS(
  text: string,
  voiceId: string,
  settings: VoiceSettings = {}
): Promise<ReadableStream<Uint8Array>> {
  const body = {
    text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: settings.stability ?? 0.5,
      similarity_boost: settings.similarity_boost ?? 0.8,
      style: settings.style ?? 0.3,
      use_speaker_boost: true,
    },
    speed: settings.speed ?? 1.0,
  };

  const res = await fetch(
    `${ELEVEN_BASE}/text-to-speech/${voiceId}/stream?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: { ...elevenHeaders(), Accept: 'audio/mpeg' },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    logger.error({ voiceId, err }, 'ElevenLabs TTS error');
    throw new Error(`TTS failed: ${res.status}`);
  }

  return res.body!;
}

// ─────────────────────────────────────────────
// VOICE PREVIEW (sample audio for a voice)
// ─────────────────────────────────────────────
export async function previewVoice(voiceId: string): Promise<ReadableStream<Uint8Array>> {
  const sampleText = '안녕하세요! 저는 이 캐릭터의 목소리예요. 어떠신가요?';
  return streamTTS(sampleText, voiceId);
}

// ─────────────────────────────────────────────
// EMOTION-BASED SETTINGS
// ─────────────────────────────────────────────
export function emotionToVoiceSettings(emotionalTone: string | null, relationshipLevel = 0): VoiceSettings {
  const base: VoiceSettings = { stability: 0.5, similarity_boost: 0.8, style: 0.3, speed: 1.0 };

  if (!emotionalTone) return base;

  const tone = emotionalTone.toLowerCase();
  if (tone.includes('설렘') || tone.includes('기쁨')) {
    return { ...base, stability: 0.4, style: 0.7, speed: 1.05 };
  }
  if (tone.includes('슬픔') || tone.includes('그리움')) {
    return { ...base, stability: 0.8, style: 0.2, speed: 0.9 };
  }
  if (tone.includes('긴장') || tone.includes('불안')) {
    return { ...base, stability: 0.35, style: 0.5, speed: 1.1 };
  }
  if (tone.includes('따뜻') || tone.includes('친근')) {
    return { ...base, stability: 0.65, style: 0.45, speed: 0.98 };
  }

  // 친밀도에 따라 미세 조정
  if (relationshipLevel >= 71) {
    return { ...base, stability: 0.4, style: 0.6, speed: 1.02 };
  }

  return base;
}
