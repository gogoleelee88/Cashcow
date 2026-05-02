'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Heart, ArrowLeft, BookOpen, Users, ChevronRight, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../stores/auth.store';
import { toast } from '../ui/toaster';

const COVER_COLORS = [
  'from-rose-400 to-pink-600',
  'from-blue-400 to-indigo-600',
  'from-purple-400 to-violet-600',
];

export function StoryDetailContent({ storyId }: { storyId: string }) {
  const { isAuthenticated } = useAuthStore();

  const { data: story, isLoading } = useQuery({
    queryKey: ['story', storyId],
    queryFn: () => api.stories.get(storyId),
    staleTime: 1000 * 60 * 5,
  });

  const startMutation = useMutation({
    mutationFn: () => api.stories.startConversation(storyId),
    onSuccess: (res: any) => {
      window.location.href = `/story/${storyId}/chat?conv=${res.conversation.id}`;
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

    </div>
  );
}
