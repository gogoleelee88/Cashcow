'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, MoreVertical, Pencil, Loader2, MessageCircle,
  Sparkles, ChevronDown, BookOpen,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { api, streamChatMessage } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { getCharacterAvatarUrl } from '@characterverse/utils';
import type { ChatMessage, Conversation } from '@characterverse/types';
import { MainLayout } from '../layout/main-layout';

// ── 메인 컴포넌트 ─────────────────────────────────────────────────
export function ChatPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const characterId = searchParams?.get('characterId');
  const conversationId = searchParams?.get('conversationId');
  const { user, isAuthenticated, isLoading, accessToken } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeConvId, setActiveConvId] = useState<string | null>(conversationId ?? null);
  const [sidebarTab, setSidebarTab] = useState<'episode' | 'party'>('episode');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(`/login?redirect=/chat${characterId ? `?characterId=${characterId}` : ''}`);
    }
  }, [isLoading, isAuthenticated, router, characterId]);

  const startConvMutation = useMutation({
    mutationFn: (charId: string) => api.chat.createConversation(charId),
    onSuccess: (res) => {
      const conv = res.data;
      setActiveConvId(conv.id);
      router.replace(`/chat?conversationId=${conv.id}`, { scroll: false });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  useEffect(() => {
    if (characterId && !conversationId && isAuthenticated) {
      startConvMutation.mutate(characterId);
    }
  }, [characterId, conversationId, isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading || !isAuthenticated) return null;

  return (
    <MainLayout showSearch={true}>
      <div className="flex bg-white" style={{ height: 'calc(100vh - 56px)' }}>

        {/* ── 왼쪽 사이드바 ── */}
        <aside className="hidden lg:flex flex-col w-[200px] flex-shrink-0 border-r border-gray-100 bg-white">
          {/* 상단 탭 */}
          <div className="flex border-b border-gray-100">
            {(['episode', 'party'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setSidebarTab(t)}
                className={cn(
                  'flex-1 py-3 text-[12px] font-semibold transition-colors relative',
                  sidebarTab === t ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
                )}
              >
                {t === 'episode' ? '에피소드' : '파티챗'}
                {sidebarTab === t && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-900 rounded-t" />
                )}
              </button>
            ))}
          </div>

          {/* 채팅 히스토리 헤더 */}
          <div className="flex items-center justify-between px-3 py-2.5">
            <span className="text-[11px] font-semibold text-gray-500 tracking-wide">채팅 히스토리</span>
            <button className="flex items-center gap-0.5 text-[11px] text-gray-400 hover:text-gray-600 transition-colors">
              <Pencil className="w-3 h-3" />편집
            </button>
          </div>

          {/* 대화 목록 */}
          <div className="flex-1 overflow-y-auto hide-scrollbar">
            <ConversationSidebar
              activeConvId={activeConvId}
              onSelect={(id) => {
                setActiveConvId(id);
                router.replace(`/chat?conversationId=${id}`, { scroll: false });
              }}
            />
          </div>
        </aside>

        {/* ── 메인 채팅 영역 ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {activeConvId ? (
            <ChatWindow
              conversationId={activeConvId}
              accessToken={accessToken!}
              user={user!}
            />
          ) : (
            <EmptyChatState />
          )}
        </div>
      </div>
    </MainLayout>
  );
}

// ── 대화 목록 사이드바 ────────────────────────────────────────────
function ConversationSidebar({
  activeConvId,
  onSelect,
}: {
  activeConvId: string | null;
  onSelect: (id: string) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.chat.conversations(),
    refetchInterval: 30_000,
  });
  const conversations: Conversation[] = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="p-2 space-y-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-2.5 bg-gray-100 animate-pulse rounded w-3/4" />
              <div className="h-2 bg-gray-100 animate-pulse rounded w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
        <MessageCircle className="w-7 h-7 text-gray-200 mb-2" />
        <p className="text-[11px] text-gray-400">아직 대화가 없어요</p>
        <Link href="/" className="mt-3 text-[11px] text-brand hover:underline">캐릭터 탐색</Link>
      </div>
    );
  }

  return (
    <>
      {conversations.map((conv) => (
        <SidebarConvItem
          key={conv.id}
          conv={conv}
          isActive={conv.id === activeConvId}
          onClick={() => onSelect(conv.id)}
        />
      ))}
    </>
  );
}

function SidebarConvItem({ conv, isActive, onClick }: { conv: Conversation; isActive: boolean; onClick: () => void }) {
  const [imgErr, setImgErr] = useState(false);
  const char = conv.character;
  const src = imgErr ? getCharacterAvatarUrl(null, char?.name ?? '') : char?.avatarUrl;

  const formatTime = (d: string) => {
    if (!d) return '';
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}분`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `${h}시간`;
    return `${Math.floor(h / 24)}일`;
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-start gap-2 px-2 py-2.5 cursor-pointer group transition-colors',
        isActive ? 'bg-gray-50' : 'hover:bg-gray-50'
      )}
    >
      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-gray-100 mt-0.5">
        {src
          ? <Image src={src} alt={char?.name ?? ''} width={32} height={32} className="object-cover" onError={() => setImgErr(true)} />
          : <div className="w-full h-full bg-brand/10 flex items-center justify-center text-brand text-xs font-bold">{char?.name?.[0] ?? '?'}</div>
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <p className="text-[12px] font-semibold text-gray-800 truncate pr-1">{char?.name ?? '알 수 없음'}</p>
          <span className="text-[10px] text-gray-400 flex-shrink-0">{formatTime((conv as any).lastMessageAt ?? (conv as any).updatedAt ?? '')}</span>
        </div>
        <p className="text-[11px] text-gray-400 truncate leading-snug">
          {(conv as any).messages?.[0]?.content ?? '대화를 시작해보세요'}
        </p>
      </div>
      <button
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-gray-400 hover:text-gray-600"
        onClick={(e) => e.stopPropagation()}
      >
        <MoreVertical className="w-3 h-3" />
      </button>
    </div>
  );
}

// ── 채팅 윈도우 ───────────────────────────────────────────────────
function ChatWindow({
  conversationId,
  accessToken,
  user,
}: {
  conversationId: string;
  accessToken: string;
  user: any;
}) {
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [showSuggest, setShowSuggest] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

  const { data: convData } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => api.chat.conversations().then((r) => r.data.find((c: Conversation) => c.id === conversationId)),
  });

  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => api.chat.messages(conversationId),
    staleTime: 0,
  });

  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  useEffect(() => { if (messagesData?.data) setLocalMessages(messagesData.data); }, [messagesData?.data]);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
  }, []);
  useEffect(() => { scrollToBottom(false); }, [localMessages]);
  useEffect(() => { if (isStreaming) scrollToBottom(); }, [streamingContent, isStreaming, scrollToBottom]);

  const sendMessage = useCallback(async () => {
    const content = inputValue.trim();
    if (!content || isStreaming) return;

    setInputValue('');
    setIsStreaming(true);
    setStreamingContent('');
    setShowSuggest(false);

    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      conversationId,
      role: 'USER',
      content,
      status: 'SENT',
      createdAt: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, tempUserMsg]);

    abortControllerRef.current = new AbortController();
    let accumulated = '';

    streamChatMessage(conversationId, content, accessToken, {
      signal: abortControllerRef.current.signal,
      onDelta: (text) => {
        accumulated += text;
        setStreamingContent(accumulated);
      },
      onDone: ({ messageId, remainingCredits }) => {
        setIsStreaming(false);
        setLocalMessages((prev) => [
          ...prev,
          { id: messageId, conversationId, role: 'ASSISTANT', content: accumulated, status: 'SENT', createdAt: new Date().toISOString() },
        ]);
        setStreamingContent('');
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        queryClient.setQueryData(['user'], (old: any) => old ? { ...old, creditBalance: remainingCredits } : old);
      },
      onError: (message) => {
        setIsStreaming(false);
        setStreamingContent('');
        setLocalMessages((prev) => [
          ...prev,
          { id: `error-${Date.now()}`, conversationId, role: 'ASSISTANT', content: message, status: 'ERROR', createdAt: new Date().toISOString() },
        ]);
      },
    });
  }, [inputValue, isStreaming, conversationId, accessToken, queryClient]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const stopStreaming = () => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
    if (streamingContent) {
      setLocalMessages((prev) => [
        ...prev,
        { id: `aborted-${Date.now()}`, conversationId, role: 'ASSISTANT', content: streamingContent, status: 'SENT', createdAt: new Date().toISOString() },
      ]);
    }
    setStreamingContent('');
  };

  // 지문 삽입: 커서 위치에 ** ** 를 넣고 사이에 포커스
  const insertNarration = () => {
    const el = inputRef.current;
    if (!el) return;
    const start = el.selectionStart ?? inputValue.length;
    const end = el.selectionEnd ?? inputValue.length;
    const selected = inputValue.slice(start, end);
    const before = inputValue.slice(0, start);
    const after = inputValue.slice(end);
    const newValue = `${before}*${selected}*${after}`;
    setInputValue(newValue);
    // 커서를 * 안쪽으로
    requestAnimationFrame(() => {
      el.focus();
      const cursorPos = selected ? start + 1 + selected.length + 1 : start + 1;
      el.setSelectionRange(selected ? cursorPos : start + 1, selected ? cursorPos : start + 1);
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 100)}px`;
    });
  };

  const character = convData?.character;

  return (
    <div className="flex flex-col h-full">
      {/* ── 상단 탭바 ── */}
      <div className="flex items-center border-b border-gray-100 bg-white flex-shrink-0 px-3" style={{ minHeight: '44px' }}>
        {/* 캐릭터 이름 */}
        {character && (
          <Link
            href={`/characters/${character.id}`}
            className="text-[13px] text-gray-700 hover:text-gray-900 transition-colors font-semibold"
          >
            {character.name}
          </Link>
        )}

        {/* 우측 */}
        <div className="flex items-center gap-2 ml-auto">
          <button className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-gray-200 text-[11px] text-gray-500 hover:border-gray-300 transition-colors">
            <Sparkles className="w-3 h-3 text-brand" />
            프로핏 1.0
            <ChevronDown className="w-2.5 h-2.5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* ── 메시지 스크롤 영역 ── */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-[640px] mx-auto px-5 py-8">
          {messagesLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
            </div>
          ) : (
            <>
              {/* 첫 인사 (메시지 없을 때) */}
              {localMessages.length === 0 && character && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <SceneOpening
                    character={character}
                    greeting={character.greeting || `안녕하세요! 저는 ${character.name}입니다.`}
                  />
                </motion.div>
              )}

              {/* 메시지 목록 */}
              {localMessages.map((msg, i) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: Math.min(i * 0.008, 0.1) }}
                >
                  {msg.role === 'ASSISTANT' ? (
                    <StoryBlock
                      content={msg.content}
                      characterName={character?.name}
                      isError={msg.status === 'ERROR'}
                    />
                  ) : (
                    <UserMessage content={msg.content} user={user} />
                  )}
                </motion.div>
              ))}

              {/* 스트리밍 중 */}
              {isStreaming && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {streamingContent ? (
                    <StoryBlock content={streamingContent} characterName={character?.name} isStreaming />
                  ) : (
                    <TypingIndicator />
                  )}
                </motion.div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── 입력 바 ── */}
      <div className="flex-shrink-0 bg-white border-t border-gray-100 px-5 py-3">
        <div className="max-w-[640px] mx-auto">
          {/* 추천 답변 패널 */}
          <AnimatePresence>
            {showSuggest && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="mb-2 flex flex-wrap gap-1.5"
              >
                {['네, 맞아요.', '계속 이야기해 주세요.', '흥미롭네요!', '더 자세히 알려주세요.'].map((s) => (
                  <button
                    key={s}
                    onClick={() => { setInputValue(s); setShowSuggest(false); inputRef.current?.focus(); }}
                    className="px-3 py-1.5 rounded-full border border-gray-200 text-[12px] text-gray-600 bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* 입력 컨테이너 */}
          <div className="rounded-2xl border border-gray-200 bg-white focus-within:border-gray-300 transition-colors overflow-hidden">
            {/* 라벨 */}
            <div className="px-4 pt-3 pb-1">
              <span className="text-[11px] text-gray-400 font-medium">메시지 보내기</span>
            </div>

            {/* 텍스트 입력 */}
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder=""
              rows={1}
              disabled={isStreaming}
              className="w-full resize-none px-4 pb-2 text-[14px] text-gray-800 placeholder-gray-300 focus:outline-none bg-transparent leading-relaxed"
              style={{ minHeight: '32px', maxHeight: '80px' }}
            />

            {/* 하단 액션바 */}
            <div className="flex items-center gap-2 px-3 pb-3 pt-1">
              {/* 행동하기 버튼 */}
              <button
                type="button"
                onClick={insertNarration}
                disabled={isStreaming}
                className="flex-shrink-0 px-2.5 py-1 rounded-full border border-red-400 text-[12px] font-medium text-red-400 hover:bg-red-50 transition-colors disabled:opacity-40 whitespace-nowrap"
              >
                *행동하기*
              </button>

              {/* 추천답변 버튼 */}
              <button
                onClick={() => setShowSuggest((v) => !v)}
                className={cn(
                  'flex-shrink-0 flex items-center gap-1 text-[12px] font-medium transition-colors',
                  showSuggest ? 'text-brand' : 'text-gray-400 hover:text-brand'
                )}
              >
                추천답변
              </button>

              <div className="flex-1" />

              {/* 전송 / 정지 버튼 */}
              {isStreaming ? (
                <button
                  onClick={stopStreaming}
                  className="w-9 h-9 rounded-full bg-red-400 flex items-center justify-center hover:bg-red-500 transition-colors"
                >
                  <div className="w-3 h-3 rounded-sm bg-white" />
                </button>
              ) : (
                <button
                  onClick={sendMessage}
                  disabled={!inputValue.trim()}
                  className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center transition-all',
                    inputValue.trim() ? 'bg-brand hover:bg-brand-hover shadow-sm' : 'bg-gray-200'
                  )}
                >
                  <Send className={cn('w-4 h-4', inputValue.trim() ? 'text-white' : 'text-gray-400')} />
                </button>
              )}
            </div>
          </div>

          <p className="text-center text-[11px] text-gray-300 mt-2">
            AI 응답은 실제 인물·사실과 다를 수 있습니다 · 1 크레딧 / 메시지
          </p>
        </div>
      </div>
    </div>
  );
}

// ── 씬 오프닝 (첫 인사 + 이미지) ─────────────────────────────────
function SceneOpening({ character, greeting }: { character: any; greeting: string }) {
  return (
    <div className="mb-10">
      {/* 씬 헤더 */}
      {character.name && (
        <p className="text-[12px] text-gray-400 mb-4 leading-relaxed">
          [{character.name}의 이야기가 시작됩니다]
        </p>
      )}

      {/* 캐릭터 이미지 */}
      {character.avatarUrl && (
        <div className="relative w-full rounded-xl overflow-hidden mb-6 bg-gray-50" style={{ aspectRatio: '3/4', maxHeight: '420px' }}>
          <Image
            src={character.avatarUrl}
            alt={character.name}
            fill
            className="object-cover"
            sizes="640px"
          />
        </div>
      )}

      {/* 인사 텍스트 */}
      <StoryBlock content={greeting} characterName={character.name} />
    </div>
  );
}

// * ... * 지문을 이탤릭 회색으로, 나머지는 일반 텍스트로 렌더링
function renderNarration(text: string) {
  const parts = text.split(/(\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={i} className="not-italic text-gray-400 text-[13px]">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ── 스토리 블록 (AI 메시지) ───────────────────────────────────────
function StoryBlock({
  content,
  characterName,
  isStreaming,
  isError,
}: {
  content: string;
  characterName?: string;
  isStreaming?: boolean;
  isError?: boolean;
}) {
  const lines = content.split('\n');

  return (
    <div className={cn('mb-8', isError && 'opacity-50')}>
      <div className="space-y-2.5">
        {lines.map((line, i) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={i} className="h-1.5" />;

          // 씬 헤더: [ ... ]
          if (/^\[.+\]$/.test(trimmed)) {
            return (
              <p key={i} className="text-[12px] text-gray-400 leading-relaxed">
                {trimmed}
              </p>
            );
          }

          // 캐릭터 대사: "이름 | 대사" 또는 "이름: 대사" 또는 "이름 : 대사"
          const dialogPipe = trimmed.match(/^(.+?)\s*\|\s*(.+)$/);
          const dialogColon = trimmed.match(/^([가-힣a-zA-Z\s]{1,15})\s*[:：]\s*(.+)$/);
          const dialog = dialogPipe || dialogColon;
          if (dialog) {
            return (
              <p key={i} className="text-[14px] leading-relaxed">
                <span className="font-bold text-gray-900">{dialog[1]}</span>
                <span className="text-gray-500 mx-1">|</span>
                <span className="text-gray-800">{dialog[2]}</span>
              </p>
            );
          }

          // 따옴표 대사: "대사" 또는 '대사'
          if (/^["'"'].+["'"']$/.test(trimmed)) {
            return (
              <p key={i} className="text-[14px] font-semibold text-gray-900 leading-relaxed italic">
                {trimmed}
              </p>
            );
          }

          // 지문: *지문 내용* — 인라인 * 포함 혼합 텍스트 렌더링
          if (trimmed.includes('*')) {
            return (
              <p key={i} className="text-[14px] text-gray-600 leading-[1.9]">
                {renderNarration(trimmed)}
                {isStreaming && i === lines.length - 1 && (
                  <span className="inline-block w-0.5 h-4 bg-brand animate-pulse align-middle ml-0.5" />
                )}
              </p>
            );
          }

          // 서사 텍스트
          return (
            <p key={i} className="text-[14px] text-gray-600 leading-[1.9]">
              {trimmed}
              {isStreaming && i === lines.length - 1 && (
                <span className="inline-block w-0.5 h-4 bg-brand animate-pulse align-middle ml-0.5" />
              )}
            </p>
          );
        })}
      </div>
    </div>
  );
}

// ── 타이핑 인디케이터 ─────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="mb-6 flex items-center gap-1 h-7">
      {[0, 120, 240].map((d) => (
        <span
          key={d}
          className="w-2 h-2 rounded-full bg-gray-300 animate-bounce"
          style={{ animationDelay: `${d}ms` }}
        />
      ))}
    </div>
  );
}

// ── 유저 메시지 ───────────────────────────────────────────────────
function UserMessage({ content, user }: { content: string; user: any }) {
  const [imgErr, setImgErr] = useState(false);

  return (
    <div className="flex flex-col items-end mb-6">
      <div className="flex items-end gap-2">
        <div className="max-w-[65%]">
          {user?.displayName && (
            <p className="text-[11px] text-gray-400 mb-1 text-right">{user.displayName}</p>
          )}
          <div className="px-4 py-2.5 bg-gray-100 rounded-2xl rounded-br-md text-[14px] text-gray-800 leading-relaxed whitespace-pre-wrap">
            {content.includes('*') ? renderNarration(content) : content}
          </div>
        </div>
        <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 bg-gray-100 mb-0.5">
          {user?.avatarUrl && !imgErr
            ? <Image src={user.avatarUrl} alt={user.displayName ?? ''} width={28} height={28} className="object-cover" onError={() => setImgErr(true)} />
            : <div className="w-full h-full bg-brand/10 flex items-center justify-center text-brand text-xs font-bold">{user?.displayName?.[0]?.toUpperCase() ?? 'U'}</div>
          }
        </div>
      </div>
    </div>
  );
}

// ── 빈 상태 ───────────────────────────────────────────────────────
function EmptyChatState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-4">
        <BookOpen className="w-7 h-7 text-gray-200" />
      </div>
      <p className="text-[15px] font-semibold text-gray-700 mb-1">대화를 선택해주세요</p>
      <p className="text-[13px] text-gray-400 mb-5">왼쪽에서 대화를 선택하거나 새 캐릭터와 대화해보세요.</p>
      <Link href="/" className="px-5 py-2.5 rounded-full bg-brand text-white text-[13px] font-semibold hover:bg-brand-hover transition-colors">
        캐릭터 탐색
      </Link>
    </div>
  );
}
