'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Bookmark, ArrowLeft, Send, BookOpen, Users, ChevronRight, Loader2, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../stores/auth.store';
import { toast } from '../ui/toaster';
import { streamStoryMessage } from '../../lib/api';

const COVER_COLORS = [
  'from-rose-400 to-pink-600',
  'from-blue-400 to-indigo-600',
  'from-purple-400 to-violet-600',
];

interface Message {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  createdAt: string;
}

function ChatView({ conversationId, greeting }: { conversationId: string; greeting: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const streamingTextRef = useRef('');
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { accessToken, user, setUser } = useAuthStore();

  const { data: msgData } = useQuery({
    queryKey: ['story-messages', conversationId],
    queryFn: () => api.stories.messages(conversationId),
    staleTime: 0,
  });

  useEffect(() => {
    if (msgData?.messages) {
      if ((msgData.messages as Message[]).length === 0) {
        // Show greeting as first message
        setMessages([{
          id: 'greeting',
          role: 'ASSISTANT',
          content: greeting,
          createdAt: new Date().toISOString(),
        }]);
      } else {
        setMessages(msgData.messages as Message[]);
      }
    }
  }, [msgData, greeting]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  const handleSend = () => {
    if (!input.trim() || streaming || !accessToken) return;
    const content = input.trim();
    setInput('');
    setStreaming(true);
    setStreamingText('');

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'USER',
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    abortRef.current = new AbortController();

    streamingTextRef.current = '';
    streamStoryMessage(
      conversationId,
      content,
      accessToken,
      {
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
        },
        onError: (message) => {
          toast.error('오류', message);
          setStreaming(false);
          setStreamingText('');
        },
        signal: abortRef.current.signal,
      }
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn('flex', msg.role === 'USER' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed',
                msg.role === 'USER'
                  ? 'bg-brand text-white rounded-br-md'
                  : 'bg-surface text-text-primary rounded-bl-md border border-border'
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {streaming && (
          <div className="flex justify-start">
            <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-bl-md text-sm leading-relaxed bg-surface text-text-primary border border-border">
              {streamingText || (
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="이야기를 계속해보세요..."
            className="flex-1 input-base py-2.5"
            disabled={streaming}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || streaming}
            className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center text-white
                       disabled:opacity-40 hover:bg-brand-hover active:scale-95 transition-all flex-shrink-0"
          >
            {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

export function StoryDetailContent({ storyId }: { storyId: string }) {
  const { user, isAuthenticated, accessToken } = useAuthStore();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const { data: story, isLoading } = useQuery({
    queryKey: ['story', storyId],
    queryFn: () => api.stories.get(storyId),
    staleTime: 1000 * 60 * 5,
  });

  const startMutation = useMutation({
    mutationFn: () => api.stories.startConversation(storyId),
    onSuccess: (res: any) => {
      setConversationId(res.conversation.id);
      setChatOpen(true);
    },
    onError: () => toast.error('오류', '대화를 시작할 수 없습니다.'),
  });

  const likeMutation = useMutation({
    mutationFn: () => api.stories.like(storyId),
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-surface rounded w-1/2" />
          <div className="h-48 bg-surface rounded-2xl" />
          <div className="h-4 bg-surface rounded w-full" />
          <div className="h-4 bg-surface rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-center">
        <p className="text-text-muted">스토리를 찾을 수 없습니다.</p>
        <Link href="/story" className="btn-primary mt-4 inline-block">스토리 목록으로</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Back button */}
      <Link href="/story" className="inline-flex items-center gap-2 text-text-muted hover:text-text-primary mb-6 text-sm transition-colors">
        <ArrowLeft className="w-4 h-4" />
        스토리 목록
      </Link>

      {/* Story header */}
      <div className="flex gap-6 mb-6">
        {/* Cover */}
        <div className="flex-shrink-0 w-32 h-44 rounded-2xl overflow-hidden bg-surface">
          {story.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={story.coverUrl} alt={story.title} className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${COVER_COLORS[0]} flex items-end p-3`}>
              <p className="text-white font-bold text-xs line-clamp-3 leading-tight">{story.title}</p>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 bg-brand/10 text-brand text-xs font-medium rounded-full">
              {story.category}
            </span>
            {story.isFeatured && (
              <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-xs font-bold rounded-full border border-amber-200">추천</span>
            )}
          </div>
          <h1 className="text-text-primary font-black text-2xl mb-2 leading-tight">{story.title}</h1>
          <p className="text-text-secondary text-sm mb-3 line-clamp-3">{story.description}</p>

          <div className="flex items-center gap-4 text-xs text-text-muted mb-4">
            <span className="flex items-center gap-1">
              <MessageCircle className="w-3.5 h-3.5" />
              {(story.chatCount ?? 0).toLocaleString()} 대화
            </span>
            <span className="flex items-center gap-1">
              <Heart className="w-3.5 h-3.5" />
              {(story.likeCount ?? 0).toLocaleString()} 좋아요
            </span>
            {story.author && (
              <span>by {story.author.displayName}</span>
            )}
          </div>

          {/* Tags */}
          {story.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {story.tags.map((tag: string) => (
                <span key={tag} className="px-2.5 py-0.5 bg-surface text-text-muted rounded-full text-xs">#{tag}</span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (!isAuthenticated) return toast.error('로그인 필요', '로그인 후 이용해주세요.');
                startMutation.mutate();
              }}
              disabled={startMutation.isPending}
              className="btn-primary flex items-center gap-2 text-sm py-2.5 px-5"
            >
              <BookOpen className="w-4 h-4" />
              {startMutation.isPending ? '시작 중...' : '이야기 시작하기'}
            </button>
            <button
              onClick={() => {
                if (!isAuthenticated) return toast.error('로그인 필요', '로그인 후 이용해주세요.');
                likeMutation.mutate();
              }}
              className={cn(
                'p-2.5 rounded-xl border transition-all',
                story.isLiked ? 'bg-red-50 border-red-200 text-red-500' : 'border-border text-text-muted hover:border-red-200 hover:text-red-500'
              )}
            >
              <Heart className={cn('w-5 h-5', story.isLiked && 'fill-current')} />
            </button>
          </div>
        </div>
      </div>

      {/* Characters in story */}
      {story.characters?.length > 0 && (
        <div className="card p-5 mb-5">
          <h2 className="text-text-primary font-semibold mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-brand" />
            등장 캐릭터
          </h2>
          <div className="flex gap-3 overflow-x-auto hide-scrollbar">
            {story.characters.map((char: any) => (
              <Link key={char.id} href={`/characters/${char.id}`}
                className="flex-shrink-0 flex flex-col items-center gap-1.5 group">
                <div className="w-14 h-14 rounded-full overflow-hidden bg-surface border-2 border-border group-hover:border-brand/40 transition-all">
                  {char.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={char.avatarUrl} alt={char.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-brand/10 flex items-center justify-center">
                      <span className="text-brand font-bold text-lg">{char.name[0]}</span>
                    </div>
                  )}
                </div>
                <p className="text-text-secondary text-xs font-medium group-hover:text-brand transition-colors">{char.name}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Chapters */}
      {story.chapters?.length > 0 && (
        <div className="card p-5 mb-5">
          <h2 className="text-text-primary font-semibold mb-3 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-brand" />
            챕터 목록 ({story.chapters.length})
          </h2>
          <div className="space-y-2">
            {story.chapters.map((ch: any, i: number) => (
              <div key={ch.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-text-muted text-xs font-mono w-6">{i + 1}</span>
                  <span className="text-text-primary text-sm font-medium">{ch.title}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-text-muted" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat panel */}
      <AnimatePresence>
        {chatOpen && conversationId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setChatOpen(false)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="w-full max-w-lg h-[70vh] bg-white rounded-3xl overflow-hidden flex flex-col shadow-card-hover"
            >
              {/* Chat header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-brand" />
                  <span className="text-text-primary font-semibold text-sm">{story.title}</span>
                </div>
                <button
                  onClick={() => setChatOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-surface text-text-muted transition-all"
                >
                  ✕
                </button>
              </div>
              <ChatView conversationId={conversationId} greeting={story.greeting} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
