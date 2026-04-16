'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Send, MoreHorizontal, Trash2, Pin, RefreshCw,
  Zap, ChevronDown, Copy, Check, Info, AlertCircle,
  MessageCircle, Settings, Sparkles
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { api, streamChatMessage } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { useChatStore } from '../../stores/chat.store';
import { formatRelativeTime, getCharacterAvatarUrl, formatCount } from '@characterverse/utils';
import type { ChatMessage, Conversation } from '@characterverse/types';
import { Sidebar } from '../layout/sidebar';
import Link from 'next/link';

// ─────────────────────────────────────────────
// MAIN LAYOUT: 3-column on desktop (sidebar | conversation list | chat)
// ─────────────────────────────────────────────
export function ChatPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const characterId = searchParams?.get('characterId');
  const conversationId = searchParams?.get('conversationId');
  const { user, isAuthenticated, isLoading, accessToken } = useAuthStore();
  const queryClient = useQueryClient();

  const [activeConvId, setActiveConvId] = useState<string | null>(conversationId ?? null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Redirect to login if not authenticated — wait for Zustand to finish hydrating from localStorage first
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(`/login?redirect=/chat${characterId ? `?characterId=${characterId}` : ''}`);
    }
  }, [isLoading, isAuthenticated, router, characterId]);

  // Auto-start conversation from characterId param
  const startConversationMutation = useMutation({
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
      startConversationMutation.mutate(characterId);
    }
  }, [characterId, conversationId, isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading || !isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Global Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Desktop: shifted right by sidebar */}
      <div className="flex flex-1 lg:ml-[240px] min-w-0">
        {/* Conversation list (left panel) */}
        <div className={cn(
          'flex flex-col w-[280px] flex-shrink-0 border-r border-border bg-background-secondary',
          'hidden md:flex'
        )}>
          <ConversationList
            activeConvId={activeConvId}
            onSelectConversation={(id) => {
              setActiveConvId(id);
              router.replace(`/chat?conversationId=${id}`, { scroll: false });
            }}
          />
        </div>

        {/* Chat area */}
        <div className="flex-1 min-w-0">
          {activeConvId ? (
            <ChatWindow
              conversationId={activeConvId}
              accessToken={accessToken!}
              user={user!}
            />
          ) : (
            <EmptyChatState onNewChat={() => router.push('/explore')} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CONVERSATION LIST
// ─────────────────────────────────────────────
function ConversationList({
  activeConvId,
  onSelectConversation,
}: {
  activeConvId: string | null;
  onSelectConversation: (id: string) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.chat.conversations(),
    refetchInterval: 30_000,
  });

  const conversations: Conversation[] = data?.data ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="font-semibold text-text-primary">대화</h2>
        <Link href="/explore"
          className="p-2 rounded-xl hover:bg-surface text-text-muted hover:text-brand-light transition-all">
          <Sparkles className="w-4.5 h-4.5" />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl">
                <div className="w-10 h-10 rounded-full skeleton flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 skeleton rounded-lg w-3/4" />
                  <div className="h-3 skeleton rounded-lg w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center px-4">
            <MessageCircle className="w-10 h-10 text-text-muted mb-3" />
            <p className="text-text-secondary text-sm font-medium mb-1">대화가 없어요</p>
            <p className="text-text-muted text-xs">캐릭터를 탐색하고 대화를 시작해보세요</p>
            <Link href="/explore" className="btn-primary mt-4 text-sm py-2">
              캐릭터 탐색
            </Link>
          </div>
        ) : (
          <div className="p-2">
            {conversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeConvId}
                onClick={() => onSelectConversation(conv.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ConversationItem({
  conversation,
  isActive,
  onClick,
}: {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}) {
  const char = conversation.character;
  const lastMsg = conversation.lastMessage;
  const avatarSrc = char?.avatarUrl || getCharacterAvatarUrl(null, char?.name || '');

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-150',
        isActive
          ? 'bg-brand/15 border border-brand/25'
          : 'hover:bg-surface border border-transparent'
      )}
    >
      <div className="relative flex-shrink-0">
        <div className="w-10 h-10 rounded-full overflow-hidden ring-1 ring-border">
          <Image
            src={avatarSrc}
            alt={char?.name || ''}
            width={40}
            height={40}
            className="object-cover"
          />
        </div>
        {conversation.isPinned && (
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
            <Pin className="w-2.5 h-2.5 text-white" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-text-primary text-sm font-medium truncate">{char?.name}</span>
          {lastMsg && (
            <span className="text-text-muted text-xs flex-shrink-0 ml-1">
              {formatRelativeTime(lastMsg.createdAt)}
            </span>
          )}
        </div>
        <p className="text-text-muted text-xs truncate">
          {lastMsg
            ? lastMsg.role === 'USER' ? `나: ${lastMsg.content}` : lastMsg.content
            : '대화를 시작해보세요'}
        </p>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────
// CHAT WINDOW
// ─────────────────────────────────────────────
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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

  // Fetch conversation info
  const { data: convData } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () =>
      api.chat.conversations().then((r) =>
        r.data.find((c: Conversation) => c.id === conversationId)
      ),
  });

  // Fetch messages
  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => api.chat.messages(conversationId),
    staleTime: 0,
  });

  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (messagesData?.data) {
      setLocalMessages(messagesData.data);
    }
  }, [messagesData?.data]);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
  }, []);

  useEffect(() => {
    scrollToBottom(false);
  }, [localMessages]);

  useEffect(() => {
    if (isStreaming) scrollToBottom();
  }, [streamingContent, isStreaming, scrollToBottom]);

  const sendMessage = useCallback(async () => {
    const content = inputValue.trim();
    if (!content || isStreaming) return;

    setInputValue('');
    setIsStreaming(true);
    setStreamingContent('');

    // Optimistic: add user message immediately
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

    streamChatMessage(conversationId, content, accessToken, {
      signal: abortControllerRef.current.signal,
      onDelta: (text) => {
        setStreamingContent((prev) => prev + text);
      },
      onDone: ({ messageId, creditCost, remainingCredits }) => {
        setIsStreaming(false);
        const assistantMsg: ChatMessage = {
          id: messageId,
          conversationId,
          role: 'ASSISTANT',
          content: streamingContent,
          status: 'SENT',
          createdAt: new Date().toISOString(),
        };
        setLocalMessages((prev) => [...prev, assistantMsg]);
        setStreamingContent('');
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        queryClient.setQueryData(['user'], (old: any) =>
          old ? { ...old, creditBalance: remainingCredits } : old
        );
      },
      onError: (message) => {
        setIsStreaming(false);
        setStreamingContent('');
        const errorMsg: ChatMessage = {
          id: `error-${Date.now()}`,
          conversationId,
          role: 'ASSISTANT',
          content: message,
          status: 'ERROR',
          createdAt: new Date().toISOString(),
        };
        setLocalMessages((prev) => [...prev, errorMsg]);
      },
    });
  }, [inputValue, isStreaming, conversationId, accessToken, streamingContent, queryClient]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleCopy = async (messageId: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(messageId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const stopStreaming = () => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
    if (streamingContent) {
      setLocalMessages((prev) => [
        ...prev,
        {
          id: `aborted-${Date.now()}`,
          conversationId,
          role: 'ASSISTANT',
          content: streamingContent,
          status: 'SENT',
          createdAt: new Date().toISOString(),
        },
      ]);
    }
    setStreamingContent('');
  };

  const character = convData?.character;
  const avatarSrc = character?.avatarUrl || getCharacterAvatarUrl(null, character?.name || '');

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background-secondary/80 backdrop-blur-sm">
        <Link href="/chat" className="p-2 rounded-xl hover:bg-surface text-text-secondary hover:text-text-primary transition-all md:hidden">
          <ArrowLeft className="w-5 h-5" />
        </Link>

        {character && (
          <Link href={`/characters/${character.id}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-border flex-shrink-0">
              <Image src={avatarSrc} alt={character.name} width={36} height={36} className="object-cover" />
            </div>
            <div className="min-w-0">
              <p className="text-text-primary font-semibold text-sm truncate">{character.name}</p>
              <p className="text-text-muted text-xs truncate">{character.category}</p>
            </div>
          </Link>
        )}

        <div className="flex items-center gap-1 ml-auto">
          <button className="p-2 rounded-xl hover:bg-surface text-text-muted hover:text-text-primary transition-all">
            <Settings className="w-4.5 h-4.5" />
          </button>
          <button className="p-2 rounded-xl hover:bg-surface text-text-muted hover:text-text-primary transition-all">
            <MoreHorizontal className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messagesLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={cn('flex gap-3', i % 2 === 0 ? '' : 'flex-row-reverse')}>
                <div className="w-8 h-8 rounded-full skeleton flex-shrink-0" />
                <div className={cn('space-y-1.5', i % 2 === 0 ? 'items-start' : 'items-end', 'flex flex-col')}>
                  <div className="h-4 skeleton rounded-xl w-64" />
                  <div className="h-4 skeleton rounded-xl w-48" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Character greeting */}
            {localMessages.length === 0 && character && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3"
              >
                <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-border flex-shrink-0 mt-1">
                  <Image src={avatarSrc} alt={character.name} width={36} height={36} className="object-cover" />
                </div>
                <div className="max-w-[80%]">
                  <div className="message-assistant rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed">
                    {character.greeting || `안녕하세요! 저는 ${character.name}입니다. 무엇이든 물어보세요!`}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Message list */}
            {localMessages.map((message, index) => (
              <MessageBubble
                key={message.id}
                message={message}
                avatarSrc={message.role === 'ASSISTANT' ? avatarSrc : user.avatarUrl}
                userName={message.role === 'USER' ? user.displayName : character?.name}
                isCopied={copiedId === message.id}
                onCopy={() => handleCopy(message.id, message.content)}
                index={index}
              />
            ))}

            {/* Streaming message */}
            {isStreaming && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3"
              >
                <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-border flex-shrink-0 mt-1">
                  <Image src={avatarSrc} alt={character?.name || ''} width={36} height={36} className="object-cover" />
                </div>
                <div className="max-w-[80%]">
                  <div className="message-assistant rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed">
                    {streamingContent || (
                      <div className="flex items-center gap-1 py-0.5">
                        <span className="w-2 h-2 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    )}
                    {streamingContent && (
                      <span className="inline-block w-0.5 h-4 bg-brand ml-0.5 animate-pulse align-middle" />
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-border bg-background-secondary/80 backdrop-blur-sm px-4 py-4">
        <div className="flex items-end gap-3 max-w-4xl mx-auto">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                // Auto-resize
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder="메시지를 입력하세요... (Enter로 전송, Shift+Enter로 줄바꿈)"
              rows={1}
              disabled={isStreaming}
              className={cn(
                'w-full resize-none bg-surface border border-border rounded-2xl px-4 py-3 pr-12',
                'text-text-primary placeholder-text-muted text-sm leading-relaxed',
                'focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/50',
                'transition-all duration-200 max-h-40',
                'disabled:opacity-60 disabled:cursor-not-allowed'
              )}
              style={{ minHeight: '48px' }}
            />
          </div>

          {isStreaming ? (
            <button
              onClick={stopStreaming}
              className="flex-shrink-0 w-11 h-11 rounded-xl bg-red-500/20 hover:bg-red-500/30
                         border border-red-500/30 text-red-400 flex items-center justify-center
                         transition-all duration-200"
            >
              <div className="w-4 h-4 rounded-sm bg-red-400" />
            </button>
          ) : (
            <button
              onClick={sendMessage}
              disabled={!inputValue.trim()}
              className={cn(
                'flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200',
                inputValue.trim()
                  ? 'bg-brand hover:bg-brand-hover text-white shadow-brand hover:shadow-lg'
                  : 'bg-surface text-text-muted border border-border cursor-not-allowed'
              )}
            >
              <Send className="w-4.5 h-4.5" />
            </button>
          )}
        </div>

        <p className="text-text-muted text-xs text-center mt-2">
          AI 응답은 실제 인물/사실과 다를 수 있습니다. 1 크레딧 / 메시지
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MESSAGE BUBBLE
// ─────────────────────────────────────────────
function MessageBubble({
  message,
  avatarSrc,
  userName,
  isCopied,
  onCopy,
  index,
}: {
  message: ChatMessage;
  avatarSrc: string | null;
  userName?: string;
  isCopied: boolean;
  onCopy: () => void;
  index: number;
}) {
  const isUser = message.role === 'USER';
  const isError = message.status === 'ERROR';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.3) }}
      className={cn('flex items-start gap-3 group', isUser && 'flex-row-reverse')}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-border flex-shrink-0 mt-1">
          {avatarSrc ? (
            <Image src={avatarSrc} alt={userName || ''} width={36} height={36} className="object-cover" />
          ) : (
            <div className="w-full h-full bg-brand/20 flex items-center justify-center text-brand text-sm font-bold">
              {(userName || 'A')[0].toUpperCase()}
            </div>
          )}
        </div>
      )}

      {/* Message content */}
      <div className={cn('max-w-[75%] flex flex-col', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'px-4 py-3 text-sm leading-relaxed rounded-2xl',
            isUser ? 'message-user rounded-tr-sm' : 'message-assistant rounded-tl-sm',
            isError && 'border-red-500/30 bg-red-500/10 text-red-300'
          )}
        >
          {isError && <AlertCircle className="inline w-4 h-4 mr-1.5 -mt-0.5" />}
          <span className="whitespace-pre-wrap">{message.content}</span>
        </div>

        {/* Actions */}
        <div className={cn(
          'flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity',
          isUser ? 'flex-row-reverse' : 'flex-row'
        )}>
          <span className="text-text-muted text-xs">
            {formatRelativeTime(message.createdAt)}
          </span>
          <button
            onClick={onCopy}
            className="p-1 rounded-lg hover:bg-surface text-text-muted hover:text-text-primary transition-all"
          >
            {isCopied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-border flex-shrink-0 mt-1">
          {avatarSrc ? (
            <Image src={avatarSrc} alt={userName || '나'} width={36} height={36} className="object-cover" />
          ) : (
            <div className="w-full h-full bg-brand/30 flex items-center justify-center text-brand text-sm font-bold">
              {(userName || 'U')[0].toUpperCase()}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────
function EmptyChatState({ onNewChat }: { onNewChat: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <motion.div
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ repeat: Infinity, duration: 3 }}
        className="w-20 h-20 rounded-2xl bg-brand/15 border border-brand/25 flex items-center justify-center mb-6"
      >
        <MessageCircle className="w-10 h-10 text-brand-light" />
      </motion.div>
      <h2 className="text-text-primary font-bold text-xl mb-2">대화를 시작해보세요</h2>
      <p className="text-text-muted text-sm mb-6 max-w-sm">
        수백 명의 AI 캐릭터 중에서 선택하거나, 직접 만들어보세요.
      </p>
      <button onClick={onNewChat} className="btn-primary">
        캐릭터 탐색하기
      </button>
    </div>
  );
}
