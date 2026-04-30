'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, MoreVertical, Pencil, Loader2, MessageCircle,
  Sparkles, ChevronDown, BookOpen, LayoutList, Smile, Plus,
  Mic, MicOff, Volume2, VolumeX, Play, Square, ChevronLeft,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { api, streamChatMessage, voiceApi } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { getCharacterAvatarUrl } from '@characterverse/utils';
import type { ChatMessage, Conversation } from '@characterverse/types';
import { MainLayout } from '../layout/main-layout';

type UiStyle = 'story' | 'kakao';

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
  const [mobileShowList, setMobileShowList] = useState(!conversationId);
  const [uiStyle, setUiStyle] = useState<UiStyle>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('chatUiStyle') as UiStyle) ?? 'story';
    }
    return 'story';
  });

  const toggleUiStyle = () => {
    const next: UiStyle = uiStyle === 'story' ? 'kakao' : 'story';
    setUiStyle(next);
    localStorage.setItem('chatUiStyle', next);
  };

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
        <aside
          className={cn(
            'hidden lg:flex flex-col w-[200px] flex-shrink-0 border-r transition-colors',
            uiStyle === 'kakao' ? 'bg-white border-gray-200' : 'bg-white border-gray-100'
          )}
        >
          {uiStyle === 'story' ? (
            <>
              {/* 스토리 스타일 사이드바 헤더 */}
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
              <div className="flex items-center justify-between px-3 py-2.5">
                <span className="text-[11px] font-semibold text-gray-500 tracking-wide">채팅 히스토리</span>
                <button className="flex items-center gap-0.5 text-[11px] text-gray-400 hover:text-gray-600 transition-colors">
                  <Pencil className="w-3 h-3" />편집
                </button>
              </div>
            </>
          ) : (
            <>
              {/* 카카오 스타일 사이드바 헤더 */}
              <div className="flex items-center justify-between px-3 py-3">
                <span className="text-[15px] font-bold text-gray-900">채팅</span>
                <div className="flex items-center gap-3">
                  <button className="text-gray-500 hover:text-gray-700"><MessageCircle className="w-4 h-4" /></button>
                  <button className="text-gray-500 hover:text-gray-700"><Plus className="w-4 h-4" /></button>
                </div>
              </div>
              {/* 카카오 스타일 탭 */}
              <div className="flex border-b border-gray-200">
                {(['episode', 'party'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setSidebarTab(t)}
                    className={cn(
                      'flex-1 py-2.5 text-[12px] font-semibold transition-colors relative',
                      sidebarTab === t ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
                    )}
                  >
                    {t === 'episode' ? '에피소드' : '단톡'}
                    {sidebarTab === t && (
                      <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-900 rounded-t" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* 대화 목록 */}
          <div className="flex-1 overflow-y-auto hide-scrollbar">
            <ConversationSidebar
              activeConvId={activeConvId}
              uiStyle={uiStyle}
              onSelect={(id) => {
                setActiveConvId(id);
                router.replace(`/chat?conversationId=${id}`, { scroll: false });
              }}
            />
          </div>
        </aside>

        {/* ── 모바일 전체화면 대화 목록 (lg 미만 + mobileShowList) ── */}
        <div className={cn('flex-col flex-1 min-w-0 lg:hidden', mobileShowList ? 'flex' : 'hidden')}>
          <MobileChatList
            activeConvId={activeConvId}
            sidebarTab={sidebarTab}
            setSidebarTab={setSidebarTab}
            onSelect={(id) => {
              setActiveConvId(id);
              setMobileShowList(false);
              router.replace(`/chat?conversationId=${id}`, { scroll: false });
            }}
          />
        </div>

        {/* ── 메인 채팅 영역 (데스크탑 항상 / 모바일은 대화 선택 후) ── */}
        <div className={cn('flex-col min-w-0', !mobileShowList ? 'flex flex-1' : 'hidden lg:flex lg:flex-1')}>
          {activeConvId ? (
            <ChatWindow
              conversationId={activeConvId}
              accessToken={accessToken!}
              user={user!}
              uiStyle={uiStyle}
              onToggleUiStyle={toggleUiStyle}
              onBack={() => {
                setMobileShowList(true);
                setActiveConvId(null);
                router.replace('/chat', { scroll: false });
              }}
            />
          ) : (
            <EmptyChatState />
          )}
        </div>
      </div>
    </MainLayout>
  );
}

// ── 모바일 전체화면 대화 목록 ──────────────────────────────────────
function MobileChatList({
  activeConvId, sidebarTab, setSidebarTab, onSelect,
}: {
  activeConvId: string | null;
  sidebarTab: 'episode' | 'party';
  setSidebarTab: (t: 'episode' | 'party') => void;
  onSelect: (id: string) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.chat.conversations(),
    refetchInterval: 30_000,
  });
  const conversations: Conversation[] = data?.data ?? [];

  return (
    <div className="flex flex-col h-full bg-white">
      {/* 에피소드 / 파티챗 탭 */}
      <div className="flex border-b border-gray-100 flex-shrink-0">
        {(['episode', 'party'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setSidebarTab(t)}
            className={cn(
              'flex-1 py-3.5 text-sm font-semibold transition-colors relative',
              sidebarTab === t ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
            )}
          >
            {t === 'episode' ? '에피소드' : '파티챗'}
            {sidebarTab === t && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900 rounded-t" />
            )}
          </button>
        ))}
      </div>

      {/* 대화 목록 */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-1">
                <div className="w-12 h-12 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-100 animate-pulse rounded w-1/3" />
                  <div className="h-2.5 bg-gray-100 animate-pulse rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center">
              <MessageCircle className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-sm text-gray-400">아직 대화가 없어요</p>
            <Link href="/" className="text-sm text-brand font-medium hover:underline">캐릭터 탐색</Link>
          </div>
        ) : (
          conversations.map((conv) => (
            <MobileConvItem
              key={conv.id}
              conv={conv}
              isActive={conv.id === activeConvId}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}

function MobileConvItem({ conv, isActive, onSelect }: {
  conv: Conversation;
  isActive: boolean;
  onSelect: (id: string) => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const char = conv.character;
  const src = imgErr ? getCharacterAvatarUrl(null, char?.name ?? '') : char?.avatarUrl;
  const lastMsg = (conv as any).lastMessage?.content ?? '대화를 시작해보세요';
  const unreadCount: number = (conv as any).unreadCount ?? 0;

  const formatTime = (d: string) => {
    if (!d) return '';
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '방금';
    if (mins < 60) return `${mins}분`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `${h}시간`;
    return `${Math.floor(h / 24)}일`;
  };
  const timeStr = formatTime((conv as any).lastMessageAt ?? (conv as any).updatedAt ?? '');

  return (
    <div
      onClick={() => onSelect(conv.id)}
      className={cn(
        'flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors border-b border-gray-50',
        isActive ? 'bg-brand/5' : 'active:bg-gray-50'
      )}
    >
      <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-gray-100">
        {src
          ? <Image src={src} alt={char?.name ?? ''} width={48} height={48} className="object-cover" onError={() => setImgErr(true)} />
          : <div className="w-full h-full bg-brand/10 flex items-center justify-center text-brand text-base font-bold">{char?.name?.[0] ?? '?'}</div>
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <p className="text-[14px] font-bold text-gray-900 truncate pr-1">{char?.name ?? '알 수 없음'}</p>
          <span className="text-[11px] text-gray-400 flex-shrink-0">{timeStr}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] text-gray-500 truncate flex-1">{lastMsg}</p>
          {unreadCount > 0 && (
            <span className="flex-shrink-0 min-w-[20px] h-5 rounded-full bg-brand text-white text-[11px] font-bold flex items-center justify-center px-1.5 leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 대화 목록 사이드바 ────────────────────────────────────────────
function ConversationSidebar({
  activeConvId,
  uiStyle,
  onSelect,
}: {
  activeConvId: string | null;
  uiStyle: UiStyle;
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
            <div className={cn('w-10 h-10 bg-gray-100 animate-pulse flex-shrink-0', uiStyle === 'kakao' ? 'rounded-xl' : 'rounded-full')} />
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
          uiStyle={uiStyle}
          onClick={() => onSelect(conv.id)}
        />
      ))}
    </>
  );
}

function SidebarConvItem({
  conv, isActive, uiStyle, onClick,
}: {
  conv: Conversation;
  isActive: boolean;
  uiStyle: UiStyle;
  onClick: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const char = conv.character;
  const src = imgErr ? getCharacterAvatarUrl(null, char?.name ?? '') : char?.avatarUrl;
  const lastMsg = (conv as any).lastMessage?.content ?? '대화를 시작해보세요';

  const formatTime = (d: string) => {
    if (!d) return '';
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}분`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `${h}시간`;
    return `${Math.floor(h / 24)}일`;
  };
  const timeStr = formatTime((conv as any).lastMessageAt ?? (conv as any).updatedAt ?? '');

  if (uiStyle === 'kakao') {
    return (
      <div
        onClick={onClick}
        className={cn(
          'flex items-center gap-2.5 px-3 py-3 cursor-pointer transition-colors',
          isActive ? 'bg-gray-100' : 'hover:bg-gray-50'
        )}
      >
        {/* 카카오 스타일: 둥근 사각형 아바타 */}
        <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 bg-gray-200">
          {src
            ? <Image src={src} alt={char?.name ?? ''} width={44} height={44} className="object-cover" onError={() => setImgErr(true)} />
            : <div className="w-full h-full bg-yellow-400 flex items-center justify-center text-white text-sm font-bold">{char?.name?.[0] ?? '?'}</div>
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <p className="text-[13px] font-bold text-gray-900 truncate pr-1">{char?.name ?? '알 수 없음'}</p>
            <span className="text-[10px] text-gray-400 flex-shrink-0">{timeStr}</span>
          </div>
          <p className="text-[12px] text-gray-500 truncate">{lastMsg}</p>
        </div>
      </div>
    );
  }

  // 스토리 스타일
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
          <span className="text-[10px] text-gray-400 flex-shrink-0">{timeStr}</span>
        </div>
        <p className="text-[11px] text-gray-400 truncate leading-snug">{lastMsg}</p>
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
  conversationId, accessToken, user, uiStyle, onToggleUiStyle, onBack,
}: {
  conversationId: string;
  accessToken: string;
  user: any;
  uiStyle: UiStyle;
  onToggleUiStyle: () => void;
  onBack?: () => void;
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
  const [situationImage, setSituationImage] = useState<{ imageId: string; imageUrl: string } | null>(null);
  useEffect(() => { if (messagesData?.data) setLocalMessages(messagesData.data); }, [messagesData?.data]);

  // ── 음성 기능 state ──
  const [autoPlay, setAutoPlay] = useState(false);
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const playTTS = useCallback(async (text: string, msgId: string) => {
    const voiceId = convData?.character?.voiceId;
    const voiceSettings = convData?.character?.voiceSettings;
    if (!voiceId) return;
    if (playingMsgId === msgId) {
      audioRef.current?.pause();
      setPlayingMsgId(null);
      return;
    }
    try {
      setPlayingMsgId(msgId);
      const blob = await voiceApi.speak(text, voiceId, voiceSettings ?? undefined);
      const url = URL.createObjectURL(blob);
      if (audioRef.current) { audioRef.current.pause(); URL.revokeObjectURL(audioRef.current.src); }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setPlayingMsgId(null); URL.revokeObjectURL(url); };
      audio.onerror = () => { setPlayingMsgId(null); };
      await audio.play();
    } catch { setPlayingMsgId(null); }
  }, [convData?.character, playingMsgId]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        try {
          const text = await voiceApi.transcribe(blob);
          if (text.trim()) setInputValue(text.trim());
        } catch {}
        setIsRecording(false);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch { setIsRecording(false); }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

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
    const stripImageTag = (text: string) => text.replace(/\[IMAGE:[^\]]+\]\s*$/g, '').trimEnd();

    streamChatMessage(conversationId, content, accessToken, {
      signal: abortControllerRef.current.signal,
      onDelta: (text) => { accumulated += text; setStreamingContent(stripImageTag(accumulated)); },
      onDone: ({ messageId, remainingCredits }) => {
        const cleanContent = stripImageTag(accumulated);
        setIsStreaming(false);
        setLocalMessages((prev) => [
          ...prev,
          { id: messageId, conversationId, role: 'ASSISTANT', content: cleanContent, status: 'SENT', createdAt: new Date().toISOString() },
        ]);
        setStreamingContent('');
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        queryClient.setQueryData(['user'], (old: any) => old ? { ...old, creditBalance: remainingCredits } : old);
        if (autoPlay && convData?.character?.voiceId) {
          playTTS(accumulated, messageId);
        }
      },
      onImage: (data) => { setSituationImage(data); },
      onError: (message) => {
        setIsStreaming(false);
        setStreamingContent('');
        setSituationImage(null);
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

  // 지문 삽입: 커서 위치에 * * 넣고 사이에 포커스
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
    requestAnimationFrame(() => {
      el.focus();
      const pos = selected ? start + 1 + selected.length + 1 : start + 1;
      el.setSelectionRange(selected ? pos : start + 1, selected ? pos : start + 1);
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 100)}px`;
    });
  };

  const character = convData?.character;

  // generatedGreeting이 아직 생성 중이면 폴링 (최대 10초)
  const greetingReady = convData?.generatedGreeting != null;
  const [greetingPolling, setGreetingPolling] = useState(false);
  useEffect(() => {
    if (localMessages.length > 0 || greetingReady) return;
    setGreetingPolling(true);
    const maxTries = 10;
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
      if (tries >= maxTries) { clearInterval(timer); setGreetingPolling(false); }
    }, 1000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [greetingReady, localMessages.length]);
  useEffect(() => { if (greetingReady) setGreetingPolling(false); }, [greetingReady]);

  const effectiveGreeting = convData?.generatedGreeting ?? character?.greeting ?? `안녕하세요! 저는 ${character?.name}입니다.`;

  return (
    <div className="flex flex-col h-full">
      {/* ── 상단 탭바 ── */}
      {uiStyle === 'kakao' ? (
        <div className="flex-shrink-0 bg-white border-b border-gray-200">
          {/* 캐릭터 행 */}
          <div className="flex items-center px-4 h-[52px]">
            {/* 모바일 뒤로 가기 */}
            {onBack && (
              <button onClick={onBack} className="lg:hidden mr-2 p-1 -ml-1 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            {character && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl overflow-hidden bg-gray-200">
                  {character.avatarUrl
                    ? <Image src={character.avatarUrl} alt={character.name} width={32} height={32} className="object-cover" />
                    : <div className="w-full h-full bg-yellow-400 flex items-center justify-center text-white text-xs font-bold">{character.name?.[0]}</div>
                  }
                </div>
                <span className="text-[15px] font-bold text-gray-900">{character.name}</span>
              </div>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={onToggleUiStyle}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-200 text-[11px] text-gray-500 hover:border-gray-300 transition-colors"
              >
                <LayoutList className="w-3 h-3" />
                카카오
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center flex-shrink-0 px-3 bg-white border-b border-gray-100 h-[44px]">
          {/* 모바일 뒤로 가기 */}
          {onBack && (
            <button onClick={onBack} className="lg:hidden mr-1 p-1 -ml-1 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          {character && (
            <Link
              href={`/characters/${character.id}`}
              className="text-[13px] text-gray-700 hover:text-gray-900 transition-colors font-semibold"
            >
              {character.name}
            </Link>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onToggleUiStyle}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-200 text-[11px] text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-colors"
            >
              <LayoutList className="w-3 h-3" />
              스토리
            </button>
            <button className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-gray-200 text-[11px] text-gray-500 hover:border-gray-300 transition-colors">
              <Sparkles className="w-3 h-3 text-brand" />
              프로핏 1.0
              <ChevronDown className="w-2.5 h-2.5 text-gray-400" />
            </button>
          </div>
        </div>
      )}

      {/* ── 플레이 가이드 패널 ── */}
      {character?.playGuide && <PlayGuidePanel text={character.playGuide as string} characterId={character.id} />}

      {/* ── 메시지 영역 ── */}
      <div
        className={cn(
          'flex-1 overflow-y-auto transition-colors',
          uiStyle === 'kakao' ? '' : 'bg-white'
        )}
        style={uiStyle === 'kakao' ? { backgroundColor: '#b2c7d9' } : {}}
      >
        {uiStyle === 'story' ? (
          <div className="max-w-[640px] mx-auto px-5 py-8">
            {messagesLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
              </div>
            ) : (
              <>
                {localMessages.length === 0 && character && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    {greetingPolling ? (
                      <div className="flex flex-col items-center gap-3 py-16 text-gray-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-xs">첫 인사를 준비하고 있어요...</span>
                      </div>
                    ) : (
                      <SceneOpening
                        character={character}
                        greeting={effectiveGreeting}
                      />
                    )}
                  </motion.div>
                )}
                {localMessages.map((msg, i) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, delay: Math.min(i * 0.008, 0.1) }}
                  >
                    {msg.role === 'ASSISTANT'
                      ? <StoryBlock content={msg.content} characterName={character?.name} characterAvatarUrl={character?.avatarUrl} isError={msg.status === 'ERROR'} />
                      : <UserMessage content={msg.content} user={user} />
                    }
                  </motion.div>
                ))}
                {isStreaming && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    {streamingContent
                      ? <StoryBlock content={streamingContent} characterName={character?.name} characterAvatarUrl={character?.avatarUrl} isStreaming />
                      : <TypingIndicator characterAvatarUrl={character?.avatarUrl} />
                    }
                  </motion.div>
                )}
                {situationImage && !isStreaming && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mb-8"
                  >
                    <SituationImageCard imageUrl={situationImage.imageUrl} onClose={() => setSituationImage(null)} />
                  </motion.div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          /* ── 카카오 스타일 메시지 영역 ── */
          <div className="px-4 py-4">
            {messagesLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-5 h-5 text-white/60 animate-spin" />
              </div>
            ) : (
              <>
                {localMessages.length === 0 && character && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <KakaoDateSeparator date={new Date()} />
                    {greetingPolling ? (
                      <TypingIndicator characterAvatarUrl={character?.avatarUrl} />
                    ) : (
                      <KakaoBubble
                        content={effectiveGreeting}
                        character={character}
                      />
                    )}
                  </motion.div>
                )}
                {localMessages.map((msg, i) => {
                  const prev = localMessages[i - 1];
                  const showDate = !prev || !isSameDay(new Date(msg.createdAt), new Date(prev.createdAt));
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      {showDate && <KakaoDateSeparator date={new Date(msg.createdAt)} />}
                      {msg.role === 'ASSISTANT'
                        ? <KakaoBubble content={msg.content} character={character} isError={msg.status === 'ERROR'} />
                        : <KakaoUserBubble content={msg.content} user={user} />
                      }
                    </motion.div>
                  );
                })}
                {isStreaming && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    {streamingContent
                      ? <KakaoBubble content={streamingContent} character={character} isStreaming />
                      : <KakaoTypingIndicator />
                    }
                  </motion.div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── 입력 바 ── */}
      {uiStyle === 'story' ? (
        <StoryInputBar
          inputValue={inputValue}
          setInputValue={setInputValue}
          isStreaming={isStreaming}
          showSuggest={showSuggest}
          setShowSuggest={setShowSuggest}
          inputRef={inputRef}
          handleKeyDown={handleKeyDown}
          sendMessage={sendMessage}
          stopStreaming={stopStreaming}
          insertNarration={insertNarration}
          suggestOptions={Array.isArray(character?.suggestedReplies) ? character.suggestedReplies as string[] : undefined}
          hasVoice={!!character?.voiceId}
          isRecording={isRecording}
          onMicClick={isRecording ? stopRecording : startRecording}
          autoPlay={autoPlay}
          onAutoPlayToggle={() => setAutoPlay((v) => !v)}
        />
      ) : (
        <KakaoInputBar
          inputValue={inputValue}
          setInputValue={setInputValue}
          isStreaming={isStreaming}
          showSuggest={showSuggest}
          setShowSuggest={setShowSuggest}
          inputRef={inputRef}
          handleKeyDown={handleKeyDown}
          sendMessage={sendMessage}
          stopStreaming={stopStreaming}
          insertNarration={insertNarration}
          suggestOptions={Array.isArray(character?.suggestedReplies) ? character.suggestedReplies as string[] : undefined}
          hasVoice={!!character?.voiceId}
          isRecording={isRecording}
          onMicClick={isRecording ? stopRecording : startRecording}
          autoPlay={autoPlay}
          onAutoPlayToggle={() => setAutoPlay((v) => !v)}
        />
      )}
    </div>
  );
}

// ── 날짜 동일 비교 ────────────────────────────────────────────────
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// ── 씬 오프닝 ─────────────────────────────────────────────────────
function SceneOpening({ character, greeting }: { character: any; greeting: string }) {
  return (
    <div className="mb-10">
      {character.name && (
        <p className="text-[12px] text-gray-400 mb-4 leading-relaxed">
          [{character.name}의 이야기가 시작됩니다]
        </p>
      )}
      {character.avatarUrl && (
        <div className="relative w-full rounded-xl overflow-hidden mb-6 bg-gray-50" style={{ aspectRatio: '3/4', maxHeight: '420px' }}>
          <Image src={character.avatarUrl} alt={character.name} fill className="object-cover" sizes="640px" />
        </div>
      )}
      {character.prologue && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100">
          <p className="text-[13px] text-gray-500 leading-[1.9] whitespace-pre-wrap italic">{character.prologue}</p>
        </div>
      )}
      <StoryBlock content={greeting} characterName={character.name} />
    </div>
  );
}

// * ... * 지문 인라인 렌더링
function renderNarration(text: string) {
  const parts = text.split(/(\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i} className="not-italic text-gray-400 text-[13px]">{part.slice(1, -1)}</em>;
    }
    return <span key={i}>{part}</span>;
  });
}

// ── 스토리 블록 ───────────────────────────────────────────────────
function StoryBlock({
  content, characterName, characterAvatarUrl, isStreaming, isError,
}: {
  content: string;
  characterName?: string;
  characterAvatarUrl?: string | null;
  isStreaming?: boolean;
  isError?: boolean;
}) {
  const [imgErr, setImgErr] = useState(false);
  const cleanContent = content.replace(/\[IMAGE:[^\]]+\]\s*$/g, '').trimEnd();
  const lines = cleanContent.split('\n');
  return (
    <div className={cn('mb-8', isError && 'opacity-50')}>
      {characterName && (
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 bg-gray-100">
            {characterAvatarUrl && !imgErr
              ? <Image src={characterAvatarUrl} alt={characterName} width={24} height={24} className="object-cover" onError={() => setImgErr(true)} />
              : <div className="w-full h-full bg-brand/10 flex items-center justify-center text-brand text-[10px] font-bold">{characterName[0]}</div>
            }
          </div>
          <span className="text-[11px] text-gray-400 font-medium">{characterName}</span>
        </div>
      )}
      <div className="space-y-2.5">
        {lines.map((line, i) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={i} className="h-1.5" />;

          if (/^\[.+\]$/.test(trimmed)) {
            return <p key={i} className="text-[12px] text-gray-400 leading-relaxed">{trimmed}</p>;
          }

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

          if (/^["'"'].+["'"']$/.test(trimmed)) {
            return <p key={i} className="text-[14px] font-semibold text-gray-900 leading-relaxed italic">{trimmed}</p>;
          }

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

function TypingIndicator({ characterAvatarUrl }: { characterAvatarUrl?: string | null }) {
  const [imgErr, setImgErr] = useState(false);
  return (
    <div className="mb-6 flex items-center gap-2 h-7">
      {characterAvatarUrl && !imgErr && (
        <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 bg-gray-100">
          <Image src={characterAvatarUrl} alt="" width={24} height={24} className="object-cover" onError={() => setImgErr(true)} />
        </div>
      )}
      <div className="flex items-center gap-1">
        {[0, 120, 240].map((d) => (
          <span key={d} className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: `${d}ms` }} />
        ))}
      </div>
    </div>
  );
}

function UserMessage({ content, user }: { content: string; user: any }) {
  const [imgErr, setImgErr] = useState(false);
  return (
    <div className="flex flex-col items-end mb-6">
      <div className="flex items-end gap-2">
        <div className="max-w-[65%]">
          {user?.displayName && <p className="text-[11px] text-gray-400 mb-1 text-right">{user.displayName}</p>}
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

// ── 카카오 스타일 컴포넌트 ────────────────────────────────────────

function KakaoDateSeparator({ date }: { date: Date }) {
  const label = date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  return (
    <div className="flex items-center justify-center my-4">
      <span className="px-3 py-1 rounded-full text-[11px] text-white/80 font-medium" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
        📅 {label}
      </span>
    </div>
  );
}

function KakaoBubble({
  content, character, isStreaming, isError,
}: {
  content: string;
  character: any;
  isStreaming?: boolean;
  isError?: boolean;
}) {
  const [imgErr, setImgErr] = useState(false);
  const cleanContent = content.replace(/\[IMAGE:[^\]]+\]\s*$/g, '').trimEnd();
  const src = imgErr ? null : character?.avatarUrl;

  return (
    <div className={cn('flex items-start gap-2 mb-3', isError && 'opacity-50')}>
      {/* 아바타 */}
      <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-gray-300">
        {src
          ? <Image src={src} alt={character?.name ?? ''} width={40} height={40} className="object-cover" onError={() => setImgErr(true)} />
          : <div className="w-full h-full bg-yellow-400 flex items-center justify-center text-white text-sm font-bold">{character?.name?.[0] ?? '?'}</div>
        }
      </div>
      <div className="max-w-[70%]">
        <p className="text-[12px] font-bold text-gray-800 mb-1">{character?.name}</p>
        <div
          className="px-3.5 py-2.5 rounded-2xl rounded-tl-sm text-[14px] text-gray-800 leading-relaxed whitespace-pre-wrap"
          style={{ backgroundColor: '#ffffff' }}
        >
          {isStreaming && !cleanContent ? (
            <span className="flex items-center gap-1 h-5">
              {[0, 100, 200].map((d) => (
                <span key={d} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
              ))}
            </span>
          ) : (
            <>
              {cleanContent.includes('*') ? renderNarration(cleanContent) : cleanContent}
              {isStreaming && cleanContent && (
                <span className="inline-block w-0.5 h-4 bg-gray-500 animate-pulse align-middle ml-0.5" />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function KakaoUserBubble({ content, user }: { content: string; user: any }) {
  const [imgErr, setImgErr] = useState(false);
  return (
    <div className="flex justify-end items-end gap-2 mb-3">
      <div
        className="max-w-[70%] px-3.5 py-2.5 rounded-2xl rounded-tr-sm text-[14px] text-gray-900 leading-relaxed whitespace-pre-wrap"
        style={{ backgroundColor: '#FFEB00' }}
      >
        {content.includes('*') ? renderNarration(content) : content}
      </div>
      <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 bg-gray-200">
        {user?.avatarUrl && !imgErr
          ? <Image src={user.avatarUrl} alt={user.displayName ?? ''} width={36} height={36} className="object-cover" onError={() => setImgErr(true)} />
          : <div className="w-full h-full bg-brand/20 flex items-center justify-center text-brand text-sm font-bold">{user?.displayName?.[0]?.toUpperCase() ?? 'U'}</div>
        }
      </div>
    </div>
  );
}

function KakaoTypingIndicator() {
  return (
    <div className="flex items-start gap-2 mb-3">
      <div className="w-10 h-10 rounded-xl bg-gray-300 flex-shrink-0" />
      <div className="px-3.5 py-3 rounded-2xl rounded-tl-sm bg-white flex items-center gap-1">
        {[0, 100, 200].map((d) => (
          <span key={d} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
        ))}
      </div>
    </div>
  );
}

// ── 스토리 입력바 ─────────────────────────────────────────────────
function StoryInputBar({
  inputValue, setInputValue, isStreaming, showSuggest, setShowSuggest,
  inputRef, handleKeyDown, sendMessage, stopStreaming, insertNarration, suggestOptions,
  hasVoice, isRecording, onMicClick, autoPlay, onAutoPlayToggle,
}: InputBarProps) {
  const options = (suggestOptions && suggestOptions.length > 0) ? suggestOptions : DEFAULT_SUGGEST_OPTIONS;
  return (
    <div className="flex-shrink-0 bg-white border-t border-gray-100 px-5 py-3">
      <div className="max-w-[640px] mx-auto">
        <AnimatePresence>
          {showSuggest && (
            <motion.div
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
              className="mb-2 flex flex-wrap gap-1.5"
            >
              {options.map((s) => (
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

        <div className="rounded-2xl border border-gray-200 bg-white focus-within:border-gray-300 transition-colors overflow-hidden">
          <div className="px-4 pt-3 pb-1">
            <span className="text-[11px] text-gray-400 font-medium">메시지 보내기</span>
          </div>
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 80)}px`;
            }}
            onKeyDown={handleKeyDown}
            placeholder=""
            rows={1}
            disabled={isStreaming}
            className="w-full resize-none px-4 pb-2 text-[14px] text-gray-800 placeholder-gray-300 focus:outline-none bg-transparent leading-relaxed"
            style={{ minHeight: '32px', maxHeight: '80px' }}
          />
          <div className="flex items-center gap-2 px-3 pb-3 pt-1">
            <button
              type="button"
              onClick={insertNarration}
              disabled={isStreaming}
              className="flex-shrink-0 px-2.5 py-1 rounded-full border border-red-400 text-[12px] font-medium text-red-400 hover:bg-red-50 transition-colors disabled:opacity-40"
            >
              *행동하기*
            </button>
            <button
              onClick={() => setShowSuggest((v) => !v)}
              className={cn('flex-shrink-0 text-[12px] font-medium transition-colors', showSuggest ? 'text-brand' : 'text-gray-400 hover:text-brand')}
            >
              추천답변
            </button>
            <div className="flex-1" />
            {hasVoice && (
              <>
                <button
                  onClick={onAutoPlayToggle}
                  title={autoPlay ? '자동재생 끄기' : '자동재생 켜기'}
                  className={cn('w-8 h-8 rounded-full flex items-center justify-center transition-colors', autoPlay ? 'text-brand' : 'text-gray-300 hover:text-gray-500')}
                >
                  {autoPlay ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
                <button
                  onClick={onMicClick}
                  title={isRecording ? '녹음 중지' : '음성 입력'}
                  className={cn('w-8 h-8 rounded-full flex items-center justify-center transition-colors', isRecording ? 'bg-red-500 text-white animate-pulse' : 'text-gray-400 hover:text-brand')}
                >
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              </>
            )}
            {isStreaming ? (
              <button onClick={stopStreaming} className="w-9 h-9 rounded-full bg-red-400 flex items-center justify-center hover:bg-red-500 transition-colors">
                <div className="w-3 h-3 rounded-sm bg-white" />
              </button>
            ) : (
              <button
                onClick={sendMessage}
                disabled={!inputValue.trim()}
                className={cn('w-9 h-9 rounded-full flex items-center justify-center transition-all', inputValue.trim() ? 'bg-brand hover:bg-brand-hover shadow-sm' : 'bg-gray-200')}
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
  );
}

// ── 카카오 입력바 ─────────────────────────────────────────────────
function KakaoInputBar({
  inputValue, setInputValue, isStreaming, showSuggest, setShowSuggest,
  inputRef, handleKeyDown, sendMessage, stopStreaming, insertNarration, suggestOptions,
  hasVoice, isRecording, onMicClick, autoPlay, onAutoPlayToggle,
}: InputBarProps) {
  const options = (suggestOptions && suggestOptions.length > 0) ? suggestOptions : DEFAULT_SUGGEST_OPTIONS;
  return (
    <div className="flex-shrink-0 bg-white" style={{ borderTop: '1px solid #e5e5e5' }}>
      {/* 추천답변 pills */}
      <AnimatePresence>
        {showSuggest && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            className="px-4 pt-2.5 flex flex-wrap gap-1.5"
          >
            {options.map((s) => (
              <button
                key={s}
                onClick={() => { setInputValue(s); setShowSuggest(false); inputRef.current?.focus(); }}
                className="px-3 py-1.5 rounded-full border border-gray-200 text-[12px] text-gray-600 bg-white hover:bg-gray-50 transition-colors"
              >
                {s}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 행동하기 / 추천답변 버튼 줄 */}
      <div className="flex items-center gap-2 px-4 pt-2.5 pb-1.5">
        <button
          type="button"
          onClick={insertNarration}
          disabled={isStreaming}
          className="px-2.5 py-[3px] rounded-full border border-red-400 text-[12px] font-medium text-red-400 hover:bg-red-50 transition-colors disabled:opacity-40 leading-snug"
        >
          *행동하기*
        </button>
        <button
          onClick={() => setShowSuggest((v) => !v)}
          className={cn('text-[12px] font-medium transition-colors', showSuggest ? 'text-brand' : 'text-gray-500 hover:text-brand')}
        >
          추천답변
        </button>
      </div>

      {/* 입력 로우: 아이콘 + 텍스트 flat + 전송 */}
      <div className="flex items-end px-3 pb-4 pt-0 gap-1">
        {/* 이모지 */}
        <button className="flex-shrink-0 w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
          <Smile className="w-[22px] h-[22px]" />
        </button>
        {/* 첨부 */}
        <button className="flex-shrink-0 w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
          <Plus className="w-[22px] h-[22px]" />
        </button>
        {/* 마이크 */}
        {hasVoice && (
          <button
            onClick={onMicClick}
            title={isRecording ? '녹음 중지' : '음성 입력'}
            className={cn('flex-shrink-0 w-9 h-9 flex items-center justify-center transition-colors', isRecording ? 'text-red-500 animate-pulse' : 'text-gray-400 hover:text-brand')}
          >
            {isRecording ? <MicOff className="w-[22px] h-[22px]" /> : <Mic className="w-[22px] h-[22px]" />}
          </button>
        )}

        {/* 텍스트 입력 — 보더/배경 없는 flat 스타일 */}
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`;
          }}
          onKeyDown={handleKeyDown}
          placeholder="메시지 입력"
          rows={1}
          disabled={isStreaming}
          className="flex-1 resize-none text-[14px] text-gray-800 placeholder-gray-400 focus:outline-none bg-transparent leading-relaxed py-2 px-1"
          style={{ minHeight: '36px', maxHeight: '100px' }}
        />

        {/* 전송 버튼 */}
        {isStreaming ? (
          <button
            onClick={stopStreaming}
            className="flex-shrink-0 w-9 h-9 rounded-full bg-red-400 flex items-center justify-center hover:bg-red-500 transition-colors mb-0.5"
          >
            <div className="w-3 h-3 rounded-sm bg-white" />
          </button>
        ) : (
          <button
            onClick={sendMessage}
            disabled={!inputValue.trim()}
            className={cn(
              'flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all mb-0.5',
              !inputValue.trim() && 'bg-gray-200'
            )}
            style={inputValue.trim() ? { backgroundColor: '#FFEB00' } : {}}
          >
            <Send className={cn('w-4 h-4 rotate-[-45deg]', inputValue.trim() ? 'text-gray-800' : 'text-gray-400')} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── 공통 타입 ─────────────────────────────────────────────────────
const DEFAULT_SUGGEST_OPTIONS = ['네, 맞아요.', '계속 이야기해 주세요.', '흥미롭네요!', '더 자세히 알려주세요.'];

interface InputBarProps {
  inputValue: string;
  setInputValue: (v: string) => void;
  isStreaming: boolean;
  showSuggest: boolean;
  setShowSuggest: (v: boolean | ((prev: boolean) => boolean)) => void;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  sendMessage: () => void;
  stopStreaming: () => void;
  insertNarration: () => void;
  suggestOptions?: string[];
  hasVoice?: boolean;
  isRecording?: boolean;
  onMicClick?: () => void;
  autoPlay?: boolean;
  onAutoPlayToggle?: () => void;
}

// ── 플레이 가이드 패널 ───────────────────────────────────────────────
function PlayGuidePanel({ text, characterId }: { text: string; characterId?: string }) {
  const lsKey = characterId ? `playGuide-closed-${characterId}` : null;
  const [open, setOpen] = useState(() => {
    if (!lsKey || typeof window === 'undefined') return true;
    return localStorage.getItem(lsKey) !== 'true';
  });

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (lsKey) localStorage.setItem(lsKey, next ? 'false' : 'true');
  };

  return (
    <div className="flex-shrink-0 border-b border-blue-100 bg-blue-50">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left"
      >
        <BookOpen className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
        <span className="text-[12px] font-semibold text-blue-600 flex-1">플레이 가이드</span>
        <ChevronDown className={cn('w-3.5 h-3.5 text-blue-400 transition-transform', open ? '' : '-rotate-90')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="px-4 pb-3 text-[12px] text-blue-700 leading-relaxed whitespace-pre-wrap">{text}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── 상황 이미지 카드 (Phase 3 킬러 기능) ───────────────────────────
function SituationImageCard({ imageUrl, onClose }: { imageUrl: string; onClose: () => void }) {
  return (
    <div className="relative rounded-xl overflow-hidden bg-gray-50 border border-gray-100">
      <Image
        src={imageUrl}
        alt="상황 이미지"
        width={640}
        height={640}
        className="w-full h-auto object-contain"
        style={{ maxHeight: '480px' }}
      />
      <button
        onClick={onClose}
        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/40 flex items-center justify-center text-white text-[12px] hover:bg-black/60 transition-colors"
      >
        ✕
      </button>
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
