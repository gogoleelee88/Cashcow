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
  if (!config.ELEVENLABS_API_KEY) {
    throw Object.assign(new Error('음성 클로닝 서비스가 설정되지 않았습니다.'), { code: 'SERVICE_UNAVAILABLE' });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form: any = new FormData();
  form.append('name', name);
  form.append('files', new Blob([audioBuffer as any]), fileName);

  let res: Response;
  try {
    res = await fetch(`${ELEVEN_BASE}/voices/add`, {
      method: 'POST',
      headers: { 'xi-api-key': config.ELEVENLABS_API_KEY },
      body: form,
    });
  } catch (networkErr) {
    logger.error({ networkErr }, 'ElevenLabs network error during voice clone');
    throw Object.assign(new Error('음성 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.'), { code: 'NETWORK_ERROR' });
  }

  if (!res.ok) {
    let detail = '';
    try {
      const errJson = await res.json() as { detail?: { message?: string; status?: string } | string };
      if (typeof errJson.detail === 'object') detail = errJson.detail?.message ?? errJson.detail?.status ?? '';
      else if (typeof errJson.detail === 'string') detail = errJson.detail;
    } catch {
      detail = await res.text().catch(() => '');
    }

    logger.error({ status: res.status, detail }, 'ElevenLabs voice clone failed');

    if (res.status === 401 || res.status === 403) {
      const msg = detail.toLowerCase();
      if (msg.includes('missing_permissions') || msg.includes('permission')) {
        throw Object.assign(new Error('음성 클로닝 권한이 없습니다. ElevenLabs API 키에 클로닝 권한이 필요합니다.'), { code: 'AUTH_ERROR' });
      }
      throw Object.assign(new Error('음성 서비스 인증 오류입니다.'), { code: 'AUTH_ERROR' });
    }
    if (res.status === 422) {
      const msg = detail.toLowerCase();
      if (msg.includes('too short') || msg.includes('duration')) {
        throw Object.assign(new Error('오디오가 너무 짧습니다. 최소 1분 이상의 파일을 사용하세요.'), { code: 'AUDIO_TOO_SHORT' });
      }
      if (msg.includes('format') || msg.includes('codec')) {
        throw Object.assign(new Error('지원하지 않는 오디오 형식입니다. mp3, wav, m4a 파일을 사용하세요.'), { code: 'INVALID_FORMAT' });
      }
      throw Object.assign(new Error(detail || '오디오 파일을 처리할 수 없습니다. 파일을 확인해주세요.'), { code: 'INVALID_AUDIO' });
    }
    if (res.status === 429) {
      throw Object.assign(new Error('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'), { code: 'RATE_LIMITED' });
    }
    if (res.status === 400) {
      const msg = detail.toLowerCase();
      if (msg.includes('paid_plan') || msg.includes('upgrade') || msg.includes('subscription')) {
        throw Object.assign(new Error('음성 클로닝은 ElevenLabs 유료 플랜이 필요합니다.'), { code: 'PLAN_REQUIRED' });
      }
    }
    throw Object.assign(new Error('음성 클로닝에 실패했습니다. 잠시 후 다시 시도해주세요.'), { code: 'CLONE_FAILED' });
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
