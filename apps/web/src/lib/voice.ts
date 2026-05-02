import { voiceApi } from './api';

// ─────────────────────────────────────────────
// AudioQueue — sequential blob playback
// ─────────────────────────────────────────────
export class AudioQueue {
  private queue: { blob: Blob; onEnd?: () => void }[] = [];
  private playing = false;
  private audio: HTMLAudioElement | null = null;
  private currentObjectUrl: string | null = null;

  onPlayingChange?: (playing: boolean) => void;

  enqueue(blob: Blob, onEnd?: () => void) {
    this.queue.push({ blob, onEnd });
    if (!this.playing) this.playNext();
  }

  private playNext() {
    const item = this.queue.shift();
    if (!item) {
      this.playing = false;
      this.onPlayingChange?.(false);
      return;
    }
    this.playing = true;
    this.onPlayingChange?.(true);
    if (this.currentObjectUrl) URL.revokeObjectURL(this.currentObjectUrl);
    const url = URL.createObjectURL(item.blob);
    this.currentObjectUrl = url;
    const audio = new Audio(url);
    this.audio = audio;
    audio.onended = () => { item.onEnd?.(); this.playNext(); };
    audio.onerror = () => { this.playNext(); };
    audio.play().catch(() => { this.playNext(); });
  }

  stop() {
    this.queue = [];
    this.audio?.pause();
    this.audio = null;
    if (this.currentObjectUrl) { URL.revokeObjectURL(this.currentObjectUrl); this.currentObjectUrl = null; }
    this.playing = false;
    this.onPlayingChange?.(false);
  }

  get isPlaying() { return this.playing; }
}

// ─────────────────────────────────────────────
// SentenceStreamingTTS
// Buffers streamed text and fires TTS per sentence
// ─────────────────────────────────────────────
const SENTENCE_END = /[.!?。]/;

export class SentenceStreamingTTS {
  private buffer = '';
  private queue: AudioQueue;
  private voiceId: string;
  private voiceSettings?: object;

  constructor(voiceId: string, queue: AudioQueue, voiceSettings?: object) {
    this.voiceId = voiceId;
    this.queue = queue;
    this.voiceSettings = voiceSettings;
  }

  push(delta: string) {
    this.buffer += delta;
    const sentences = this.flush();
    for (const s of sentences) this.speakSentence(s);
  }

  flushRemaining() {
    const text = this.buffer.trim();
    this.buffer = '';
    if (text) this.speakSentence(text);
  }

  private flush(): string[] {
    const sentences: string[] = [];
    let idx: number;
    while ((idx = this.buffer.search(SENTENCE_END)) !== -1) {
      sentences.push(this.buffer.slice(0, idx + 1).trim());
      this.buffer = this.buffer.slice(idx + 1);
    }
    return sentences.filter(Boolean);
  }

  private speakSentence(text: string) {
    voiceApi.speak(text, this.voiceId, this.voiceSettings)
      .then((blob) => { this.queue.enqueue(blob); })
      .catch(() => {});
  }
}
