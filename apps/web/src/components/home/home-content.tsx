'use client';

import { useState } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { TrendingUp, Flame, Clock, ChevronRight, Sparkles, BookOpen, Users, ArrowRight, Star } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { CharacterCard, CharacterCardSkeleton } from '../characters/character-card';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import { CATEGORY_LABELS, CATEGORY_ICONS } from '@characterverse/utils';
import type { CharacterCategory } from '@characterverse/types';
import { useAuthStore } from '../../stores/auth.store';

const SORT_OPTIONS = [
  { value: 'trending', label: '트렌딩', icon: Flame },
  { value: 'newest', label: '최신', icon: Clock },
  { value: 'popular', label: '인기', icon: TrendingUp },
];

const ALL_CATEGORIES: CharacterCategory[] = ['ANIME', 'GAME', 'ORIGINAL', 'MOVIE', 'BOOK', 'VTUBER', 'CELEBRITY', 'HISTORICAL'];

// Mock story data for UI (will be replaced by API)
const MOCK_STORIES = [
  { id: '1', title: '어둠 속의 탐정', coverUrl: null, category: '추리', author: '장르마스터', likeCount: 2341, chatCount: 8921 },
  { id: '2', title: '마법사의 제자', coverUrl: null, category: '판타지', author: '판타지작가', likeCount: 1892, chatCount: 6543 },
  { id: '3', title: '첫사랑의 계절', coverUrl: null, category: '로맨스', author: '감성소설러', likeCount: 3210, chatCount: 12400 },
  { id: '4', title: '우주 전쟁 연대기', coverUrl: null, category: 'SF', author: 'SF매니아', likeCount: 987, chatCount: 3200 },
  { id: '5', title: '학교의 비밀', coverUrl: null, category: '미스터리', author: '미스터리왕', likeCount: 1543, chatCount: 5670 },
];

const STORY_COLORS = ['bg-rose-100', 'bg-blue-100', 'bg-purple-100', 'bg-amber-100', 'bg-emerald-100'];
const STORY_TEXT_COLORS = ['text-rose-600', 'text-blue-600', 'text-purple-600', 'text-amber-600', 'text-emerald-600'];

function StoryCard({ story, index }: { story: typeof MOCK_STORIES[0]; index: number }) {
  return (
    <Link href={`/story/${story.id}`} className="flex-shrink-0 w-44 sm:w-48 group">
      <div className={cn(
        'w-full aspect-[3/4] rounded-2xl mb-2.5 overflow-hidden relative',
        STORY_COLORS[index % STORY_COLORS.length]
      )}>
        <div className="absolute inset-0 flex items-center justify-center">
          <BookOpen className={cn('w-12 h-12', STORY_TEXT_COLORS[index % STORY_TEXT_COLORS.length])} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform">
          <span className="text-white text-xs font-medium">대화하기 →</span>
        </div>
        <div className="absolute top-2 left-2 px-2 py-0.5 bg-white/90 rounded-full text-xs font-medium text-text-secondary">
          {story.category}
        </div>
      </div>
      <p className="text-text-primary font-semibold text-sm truncate mb-0.5 group-hover:text-brand transition-colors">{story.title}</p>
      <p className="text-text-muted text-xs">{story.author} · {story.chatCount.toLocaleString()} 대화</p>
    </Link>
  );
}

export function HomeContent() {
  const [activeSort, setActiveSort] = useState('trending');
  const [activeCategory, setActiveCategory] = useState<CharacterCategory | undefined>();
  const { user } = useAuthStore();

  const { data: trendingData, isLoading: trendingLoading } = useQuery({
    queryKey: ['characters', 'trending'],
    queryFn: () => api.characters.trending('24h'),
    staleTime: 1000 * 60 * 5,
  });

  const {
    data: feedData,
    isLoading: feedLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['characters', 'feed', activeSort, activeCategory],
    queryFn: ({ pageParam = 1 }) =>
      api.characters.list({
        page: pageParam,
        limit: 20,
        sort: activeSort,
        category: activeCategory,
      }),
    getNextPageParam: (lastPage: any) =>
      lastPage.meta?.hasMore ? (lastPage.meta.page || 1) + 1 : undefined,
    initialPageParam: 1,
    staleTime: 1000 * 60 * 2,
  });

  const characters = feedData?.pages.flatMap((p: any) => p.data) ?? [];
  const trending = trendingData?.data ?? [];

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6">

      {/* ─── HERO BANNER (non-authenticated) ─── */}
      {!user && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand/5 via-brand/3 to-transparent border border-brand/15"
        >
          <div className="relative z-10 py-10 px-8 flex flex-col md:flex-row items-center gap-8">
            <div className="text-center md:text-left flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand/10 text-brand rounded-full text-xs font-semibold mb-4">
                <Sparkles className="w-3.5 h-3.5" />
                AI 기반 인터랙티브 스토리텔링
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-text-primary mb-3 leading-tight">
                좋아하는 캐릭터와<br />
                <span className="text-brand">특별한 이야기</span>를 만드세요
              </h1>
              <p className="text-text-secondary text-base mb-6 max-w-md">
                수천 개의 AI 캐릭터 및 스토리와 대화하고, 나만의 세계를 창조해보세요.
              </p>
              <div className="flex items-center gap-3 justify-center md:justify-start">
                <Link href="/register" className="btn-primary flex items-center gap-2">
                  무료로 시작하기
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/story" className="btn-secondary flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  스토리 탐색
                </Link>
              </div>
            </div>
            <div className="hidden md:grid grid-cols-3 gap-2 flex-shrink-0">
              {[...Array(6)].map((_, i) => (
                <div key={i} className={cn(
                  'w-20 h-24 rounded-xl border border-border/50',
                  i % 2 === 0 ? 'bg-surface' : 'bg-brand/5'
                )} />
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── STORY SECTION ─── */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-brand" />
            <h2 className="text-text-primary font-bold text-lg">인기 스토리</h2>
          </div>
          <Link href="/story" className="flex items-center gap-1 text-brand text-sm font-medium hover:underline">
            전체 보기 <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar -mx-4 px-4">
          {MOCK_STORIES.map((story, i) => (
            <StoryCard key={story.id} story={story} index={i} />
          ))}
          <Link
            href="/story"
            className="flex-shrink-0 w-44 sm:w-48 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-2xl aspect-[3/4] text-text-muted hover:text-brand hover:border-brand/40 transition-all"
          >
            <ChevronRight className="w-6 h-6" />
            <span className="text-sm font-medium">더보기</span>
          </Link>
        </div>
      </section>

      {/* ─── TRENDING CHARACTERS ─── */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            <h2 className="text-text-primary font-bold text-lg">지금 인기 캐릭터</h2>
          </div>
          <Link href="/explore?sort=trending" className="flex items-center gap-1 text-brand text-sm font-medium hover:underline">
            전체 보기 <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar -mx-4 px-4">
          {trendingLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-36 sm:w-40">
                  <CharacterCardSkeleton />
                </div>
              ))
            : trending.slice(0, 10).map((char: any, i: number) => (
                <div key={char.id} className="flex-shrink-0 w-36 sm:w-40">
                  <CharacterCard character={char} index={i} />
                </div>
              ))}
        </div>
      </section>

      {/* ─── CATEGORY PILLS ─── */}
      <div className="flex gap-2 overflow-x-auto pb-3 hide-scrollbar -mx-4 px-4 mb-5">
        <button
          onClick={() => setActiveCategory(undefined)}
          className={cn(!activeCategory ? 'category-pill-active' : 'category-pill')}
        >
          전체
        </button>
        {ALL_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat === activeCategory ? undefined : cat)}
            className={cn(activeCategory === cat ? 'category-pill-active' : 'category-pill')}
          >
            <span className="mr-1">{CATEGORY_ICONS[cat]}</span>
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* ─── SORT TABS ─── */}
      <div className="flex items-center gap-1 mb-5 border-b border-border">
        {SORT_OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setActiveSort(value)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all duration-200 relative -mb-px',
              activeSort === value
                ? 'text-brand border-b-2 border-brand'
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ─── CHARACTER GRID ─── */}
      {feedLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {Array.from({ length: 20 }).map((_, i) => <CharacterCardSkeleton key={i} />)}
        </div>
      ) : characters.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {characters.map((char: any, i: number) => (
              <CharacterCard key={char.id} character={char} index={i} />
            ))}
          </div>
          {hasNextPage && (
            <div className="mt-8 text-center">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="btn-secondary px-8 py-3 text-sm"
              >
                {isFetchingNextPage ? '불러오는 중...' : '더 보기'}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-20">
          <Users className="w-12 h-12 text-text-muted mx-auto mb-3" />
          <p className="text-text-muted text-sm">캐릭터가 없습니다</p>
        </div>
      )}
    </div>
  );
}
