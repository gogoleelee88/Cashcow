'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../stores/auth.store';
import { toast } from '../ui/toaster';
import { streamStoryMessage } from '../../lib/api';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface Message {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  createdAt: string;
}

type TextSegment =
  | { type: 'system'; content: string }
  | { type: 'inner_thought'; text: string }
  | { type: 'dialogue'; character: string; line: string }
  | { type: 'prose'; text: string };

// ─────────────────────────────────────────────
// TEXT PARSER  (AI 응답 → 세그먼트 배열)
// ─────────────────────────────────────────────
function parseAssistantText(raw: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const lines = raw.split('\n');
  let i = 0;
  let proseBuf = '';

  const flushProse = () => {
    if (proseBuf.trim()) {
      segments.push({ type: 'prose', text: proseBuf.trim() });
      proseBuf = '';
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // [SYSTEM] 블록
    if (trimmed === '[SYSTEM]' || trimmed.startsWith('[SYSTEM]')) {
      flushProse();
      let content = trimmed === '[SYSTEM]' ? '' : trimmed.slice(8).trim();
      i++;
      while (i < lines.length) {
        const next = lines[i].trim();
        if (next === '[/SYSTEM]') { i++; break; }
        if (next === '' && content.trim()) break; // blank line ends block
        content += (content ? '\n' : '') + lines[i];
        i++;
      }
      segments.push({ type: 'system', content: content.trim() });
      continue;
    }

    // [속마음: ...] 패턴
    const innerMatch = trimmed.match(/^\[속마음[：:]\s*(.+)\]$/) ||
                       trimmed.match(/^\[속마음[：:]\s*(.+)$/); // 닫는 ] 없는 경우도 허용
    if (innerMatch) {
      flushProse();
      segments.push({ type: 'inner_thought', text: innerMatch[1].replace(/\]$/, '').trim() });
      i++;
      continue;
    }

    // 대사: 캐릭터명 | "..." 또는 캐릭터명 | '...'
    const dialogueMatch = trimmed.match(/^(.{1,20}?)\s*\|\s*["""''](.+)["""'']?\s*$/) ||
                          trimmed.match(/^(.{1,20}?)\s*\|\s*"(.+)"$/) ||
                          trimmed.match(/^(.{1,20}?)\s*\|\s*"(.+)$/);
    if (dialogueMatch && !trimmed.startsWith('[')) {
      flushProse();
      const charName = dialogueMatch[1].trim();
      const dialogue = dialogueMatch[2].replace(/["""'']+$/, '').trim();
      segments.push({ type: 'dialogue', character: charName, line: dialogue });
      i++;
      continue;
    }

    // 빈 줄 → 문단 구분
    if (trimmed === '') {
      flushProse();
    } else {
      proseBuf += (proseBuf ? '\n' : '') + line;
    }
    i++;
  }

  flushProse();
  return segments;
}

// ─────────────────────────────────────────────
// SEGMENT RENDERER
// ─────────────────────────────────────────────
function SegmentRenderer({ seg, idx }: { seg: TextSegment; idx: number }) {
  if (seg.type === 'system') {
    const lines = seg.content.split('\n').filter(Boolean);
    return (
      <div className="rounded-lg overflow-hidden my-4" style={{ background: '#111827' }}>
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
          <span className="text-xs font-mono" style={{ color: '#6b7280' }}>[SYSTEM]</span>
          <button
            onClick={() => navigator.clipboard?.writeText(seg.content)}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            title="복사"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
            </svg>
          </button>
        </div>
        <div className="px-4 py-3 space-y-1">
          {lines.map((l, li) => {
            const isWarning = l.includes('⚠') || l.includes('▲');
            const isBullet = l.trimStart().startsWith('▶') || l.trimStart().startsWith('•') || l.trimStart().startsWith('·');
            return (
              <p
                key={li}
                className="text-sm leading-relaxed"
                style={{
                  color: isWarning ? '#fbbf24' : '#d1d5db',
                  paddingLeft: isBullet ? '8px' : '0',
                  fontWeight: isWarning ? 600 : 400,
                }}
              >
                {l}
              </p>
            );
          })}
        </div>
      </div>
    );
  }

  if (seg.type === 'inner_thought') {
    return (
      <p key={idx} className="text-gray-900 font-bold text-[15px] leading-relaxed my-3">
        [{seg.text}]
      </p>
    );
  }

  if (seg.type === 'dialogue') {
    return (
      <p key={idx} className="text-[15px] leading-relaxed my-2">
        <span className="font-bold text-gray-900">{seg.character}</span>
        <span className="mx-1.5" style={{ color: '#d1d5db' }}>|</span>
        <span className="text-gray-800">"{seg.line}"</span>
      </p>
    );
  }

  // prose
  return (
    <p key={idx} className="text-[15px] leading-[1.85] text-gray-700 my-3 whitespace-pre-wrap break-keep">
      {seg.text}
    </p>
  );
}

// ─────────────────────────────────────────────
// SCENE HEADER  (에피소드 구분선)
// ─────────────────────────────────────────────
function SceneHeader({ episode, createdAt }: { episode: number; createdAt: string }) {
  const d = new Date(createdAt);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');

  return (
    <div className="flex items-center justify-center py-7">
      <p className="text-[13px] tracking-wide" style={{ color: '#6b7280' }}>
        {'[ '}
        <span style={{ color: '#f59e0b' }}>✦</span>
        {` #${episode} | ${month < 10 ? '0' + month : month}·${day < 10 ? '0' + day : day}(${weekday}) | ${h}:${m}`}
        {' ]'}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// ASSISTANT BUBBLE  (소설 형식)
// ─────────────────────────────────────────────
function AssistantContent({ content, streaming }: { content: string; streaming?: boolean }) {
  const segments = parseAssistantText(content);

  if (segments.length === 0 && streaming) {
    return (
      <span className="flex items-center gap-1 py-2">
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </span>
    );
  }

  return (
    <div>
      {segments.map((seg, i) => <SegmentRenderer key={i} seg={seg} idx={i} />)}
      {streaming && content && (
        <span className="inline-block w-0.5 h-4 bg-gray-500 ml-0.5 animate-pulse align-middle" />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────
function Sidebar({
  storyTitle,
  coverUrl,
  storyId,
}: {
  storyTitle: string;
  coverUrl?: string | null;
  storyId: string;
}) {
  return (
    <div
      className="flex-shrink-0 flex flex-col border-r border-gray-100 bg-white overflow-hidden"
      style={{ width: '240px' }}
    >
      {/* 스토리 상단 */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
        <button
          onClick={() => { window.location.href = `/story/${storyId}`; }}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors flex-shrink-0"
          title="스토리로 돌아가기"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt={storyTitle} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-brand/20 flex items-center justify-center">
              <span className="text-brand font-bold text-xs">{storyTitle[0]}</span>
            </div>
          )}
        </div>
        <p className="text-[13px] font-semibold text-gray-800 truncate leading-tight">{storyTitle}</p>
      </div>

      {/* 채팅 내역 탭 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-[13px] font-semibold text-gray-700">채팅 내역</span>
        <button className="text-[12px] text-gray-400 hover:text-gray-600 transition-colors">편집</button>
      </div>

      {/* 현재 대화 */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-start gap-2.5 px-3 py-3 bg-gray-50 mx-2 mt-2 rounded-xl">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverUrl} alt={storyTitle} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-brand/20 flex items-center justify-center">
                <span className="text-brand font-bold text-sm">{storyTitle[0]}</span>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-gray-800 truncate">{storyTitle}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">현재 대화</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN CHAT PAGE
// ─────────────────────────────────────────────
export function StoryChatPage({ storyId }: { storyId: string }) {
  const searchParams = useSearchParams();
  const conversationId = searchParams?.get('conv') ?? null;
  const { accessToken, isAuthenticated } = useAuthStore();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [suggestedRepliesOpen, setSuggestedRepliesOpen] = useState(false);
  const streamingTextRef = useRef('');
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Story data
  const { data: story } = useQuery({
    queryKey: ['story', storyId],
    queryFn: () => api.stories.get(storyId),
    staleTime: 1000 * 60 * 5,
  });

  // Start settings (추천답변)
  const { data: startSettingsData } = useQuery({
    queryKey: ['story-start-settings', storyId],
    queryFn: () => api.stories.listStartSettings(storyId),
    staleTime: 1000 * 60 * 5,
    enabled: !!storyId,
  });
  const suggestedReplies: string[] = (startSettingsData?.data?.[0]?.suggestedReplies ?? [])
    .map((r: any) => (typeof r === 'string' ? r : r.text))
    .filter((r: string) => r.trim());
  const playGuide: string = (startSettingsData?.data?.[0]?.playGuide ?? '').trim();

  const [playGuideOpen, setPlayGuideOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(`playGuide-closed-${storyId}`) !== '1';
  });

  // Messages
  const { data: msgData } = useQuery({
    queryKey: ['story-messages', conversationId],
    queryFn: () => api.stories.messages(conversationId!),
    enabled: !!conversationId,
    staleTime: 0,
  });

  useEffect(() => {
    if (msgData?.messages) {
      setMessages(msgData.messages as Message[]);
    }
  }, [msgData]);

  // 인증 체크는 handleSend에서만 — 초기 hydration 전에 redirect하면 localStorage 미로드 상태


  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  const handleSend = useCallback(() => {
    if (!input.trim() || streaming || !accessToken || !conversationId) return;
    const content = input.trim();
    setInput('');
    setStreaming(true);
    setStreamingText('');

    setMessages((prev) => [...prev, {
      id: `user-${Date.now()}`,
      role: 'USER',
      content,
      createdAt: new Date().toISOString(),
    }]);

    abortRef.current = new AbortController();
    streamingTextRef.current = '';

    streamStoryMessage(conversationId, content, accessToken, {
      onDelta: (text) => {
        streamingTextRef.current += text;
        setStreamingText((prev) => prev + text);
      },
      onDone: () => {
        const finalContent = streamingTextRef.current;
        streamingTextRef.current = '';
        setMessages((prev) => [...prev, {
          id: `assistant-${Date.now()}`,
          role: 'ASSISTANT',
          content: finalContent,
          createdAt: new Date().toISOString(),
        }]);
        setStreamingText('');
        setStreaming(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      },
      onError: (msg) => {
        toast.error('오류', msg);
        setStreaming(false);
        setStreamingText('');
      },
      signal: abortRef.current.signal,
    });
  }, [input, streaming, accessToken, conversationId]);

  if (!story || !conversationId) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
          <p className="text-sm text-gray-400">불러오는 중...</p>
        </div>
      </div>
    );
  }

  // ── 메시지를 에피소드 단위로 분리 ──────────────────────
  // greeting (#0) + 이후 user+assistant 쌍마다 #1, #2, ...
  // messages 배열: [USER, ASSISTANT, USER, ASSISTANT, ...]
  const renderItems: Array<
    | { kind: 'scene'; episode: number; createdAt: string }
    | { kind: 'user'; msg: Message }
    | { kind: 'assistant'; msg: Message }
    | { kind: 'streaming' }
  > = [];

  // Episode #0 — greeting
  renderItems.push({ kind: 'scene', episode: 0, createdAt: story.createdAt ?? new Date().toISOString() });

  let episodeCount = 1;
  let i = 0;
  while (i < messages.length) {
    const msg = messages[i];
    if (msg.role === 'USER') {
      // new episode starts with each user turn
      renderItems.push({ kind: 'scene', episode: episodeCount++, createdAt: msg.createdAt });
      renderItems.push({ kind: 'user', msg });
    } else {
      renderItems.push({ kind: 'assistant', msg });
    }
    i++;
  }

  if (streaming) {
    renderItems.push({ kind: 'streaming' });
  }

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* ── 사이드바 ────────────────────── */}
      <Sidebar storyTitle={story.title} coverUrl={story.coverUrl} storyId={storyId} />

      {/* ── 메인 콘텐츠 ─────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* AI 고지 */}
        <div className="flex-shrink-0 text-center py-3 border-b border-gray-100">
          <p className="text-[12px]" style={{ color: '#9ca3af' }}>이 대화는 AI로 생성된 가상의 이야기입니다</p>
        </div>

        {/* 플레이 가이드 패널 */}
        {playGuide && (
          <div className="flex-shrink-0 border-b border-amber-100 bg-amber-50">
            <button
              onClick={() => {
                const next = !playGuideOpen;
                setPlayGuideOpen(next);
                if (!next) localStorage.setItem(`playGuide-closed-${storyId}`, '1');
                else localStorage.removeItem(`playGuide-closed-${storyId}`);
              }}
              className="w-full flex items-center justify-between px-6 py-2 text-amber-700 hover:bg-amber-100 transition-colors"
            >
              <span className="text-[12px] font-semibold flex items-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/>
                </svg>
                플레이 가이드
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d={playGuideOpen ? 'M4.5 15.75l7.5-7.5 7.5 7.5' : 'M19.5 8.25l-7.5 7.5-7.5-7.5'} />
              </svg>
            </button>
            {playGuideOpen && (
              <div className="px-6 pb-3">
                <p className="text-[13px] text-amber-800 leading-relaxed whitespace-pre-wrap">{playGuide}</p>
              </div>
            )}
          </div>
        )}

        {/* 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[680px] mx-auto px-6 pb-8">

            {/* 씬 #0 + 프롤로그 */}
            <SceneHeader episode={0} createdAt={story.createdAt ?? new Date().toISOString()} />
            <AssistantContent content={story.greeting ?? ''} />

            {/* 대화 내역 */}
            {renderItems.filter(it => it.kind !== 'scene' || (it as any).episode > 0).map((item, idx) => {
              if (item.kind === 'scene') {
                return <SceneHeader key={`scene-${idx}`} episode={(item as any).episode} createdAt={(item as any).createdAt} />;
              }

              if (item.kind === 'user') {
                const msg = (item as any).msg as Message;
                return (
                  <div key={msg.id} className="flex items-start justify-between gap-2 py-2 border-t border-b border-gray-100 my-3">
                    <p className="text-[15px] text-gray-700 leading-relaxed">{msg.content}</p>
                    <button className="flex-shrink-0 p-1 text-gray-300 hover:text-gray-500 transition-colors mt-0.5">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
                      </svg>
                    </button>
                  </div>
                );
              }

              if (item.kind === 'assistant') {
                const msg = (item as any).msg as Message;
                return (
                  <div key={msg.id}>
                    <AssistantContent content={msg.content} />
                  </div>
                );
              }

              if (item.kind === 'streaming') {
                return (
                  <div key="streaming">
                    <AssistantContent content={streamingText} streaming />
                  </div>
                );
              }

              return null;
            })}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* ── 입력창 ───────────────────────── */}
        <div className="flex-shrink-0 border-t border-gray-100 px-6 py-4 bg-white">
          <div className="max-w-[680px] mx-auto">
            {/* 추천답변 목록 */}
            {suggestedRepliesOpen && suggestedReplies.length > 0 && (
              <div className="flex flex-col items-end gap-2 mb-2">
                {suggestedReplies.map((reply, idx) => (
                  <button
                    key={idx}
                    onClick={() => { setInput(reply); setSuggestedRepliesOpen(false); inputRef.current?.focus(); }}
                    className="px-4 py-2 rounded-2xl border border-brand text-brand text-xs font-medium hover:bg-brand hover:text-white transition-colors max-w-[80%] text-right"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            )}
            <div className="rounded-2xl border border-gray-200 bg-gray-50 focus-within:border-gray-300 transition-colors overflow-hidden">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="메시지 보내기"
                disabled={streaming}
                className="w-full bg-transparent px-4 pt-3 pb-2 text-[14px] text-gray-700 placeholder:text-gray-300 outline-none disabled:cursor-not-allowed"
              />
              <div className="flex items-center justify-between px-3 pb-3">
                <div className="flex items-center gap-2">
                  {/* 특수 기능 버튼 */}
                  <button className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-gray-500 transition-colors text-base">
                    ✳
                  </button>
                  <button
                    onClick={() => suggestedReplies.length > 0 && setSuggestedRepliesOpen(p => !p)}
                    className={cn(
                      'flex items-center gap-1 px-3 h-7 rounded-full border text-[12px] transition-colors',
                      suggestedReplies.length === 0
                        ? 'border-gray-200 text-gray-300 cursor-default'
                        : suggestedRepliesOpen
                          ? 'border-brand text-brand bg-brand/5'
                          : 'border-gray-200 text-gray-400 hover:bg-gray-100'
                    )}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d={suggestedRepliesOpen ? 'M19.5 8.25l-7.5 7.5-7.5-7.5' : 'M4.5 15.75l7.5-7.5 7.5 7.5'} />
                    </svg>
                    추천답변
                  </button>
                </div>
                {/* 전송 버튼 */}
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || streaming}
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
                  style={{ background: '#E63325' }}
                >
                  {streaming ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="3"/>
                      <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M5 12h14m-7-7l7 7-7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 우측 스크롤 네비게이션 ───────── */}
      <div className="flex-shrink-0 flex flex-col items-center justify-center gap-2 px-2">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="w-9 h-9 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all shadow-sm"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
          </svg>
        </button>
        <button
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
          className="w-9 h-9 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all shadow-sm"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
