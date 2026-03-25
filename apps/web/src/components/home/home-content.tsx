'use client';

import { useState } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { TrendingUp, Flame, Sparkles, Clock, ChevronRight, Zap } from 'lucide-react';
import Link from 'next/link';
import { CharacterGrid } from '../characters/character-grid';
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

const FEATURED_CATEGORIES: CharacterCategory[] = ['ANIME', 'GAME', 'ORIGINAL', 'MOVIE'];

export function HomeContent() {
  const [activeSort, setActiveSort] = useState('trending');
  const [activeCategory, setActiveCategory] = useState<CharacterCategory | undefined>();
  const { user } = useAuthStore();

  // Trending characters (horizontal scroll)
  const { data: trendingData, isLoading: trendingLoading } = useQuery({
    queryKey: ['characters', 'trending'],
    queryFn: () => api.characters.trending('24h'),
    staleTime: 1000 * 60 * 5,
  });

  // Main character feed (infinite scroll)
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

      {/* ─── HERO BANNER (for non-authenticated) ─── */}
      {!user && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 relative overflow-hidden rounded-3xl"
          style={{
            background: 'linear-gradient(135deg, rgba(124,92,252,0.2) 0%, rgba(232,121,249,0.15) 50%, rgba(34,211,238,0.1) 100%)',
            border: '1px solid rgba(124,92,252,0.3)',
          }}
        >
          <div className="absolute inset-0 bg-hero-gradient opacity-40" />
          <div className="relative z-10 py-10 px-8 text-center">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 4 }}
              className="text-5xl mb-4 inline-block"
            >
              ✨
            </motion.div>
            <h1 className="text-3xl md:text-4xl font-bold text-text-primary mb-3">
              <span className="gradient-text">AI 캐릭터</span>와 대화하세요
            </h1>
            <p className="text-text-secondary text-base mb-6 max-w-md mx-auto">
              좋아하는 캐릭터와 자유롭게 대화하고, 나만의 특별한 캐릭터를 만들어보세요.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/register" className="btn-primary flex items-center gap-2">
                <Zap className="w-4 h-4" />
                무료로 시작하기
              </Link>
              <Link href="/explore" className="btn-secondary">
                캐릭터 탐색
              </Link>
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── TRENDING NOW (horizontal scroll) ─── */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-400" />
            <h2 className="text-text-primary font-bold text-lg">지금 트렌딩</h2>
          </div>
          <Link href="/explore?sort=trending" className="flex items-center gap-1 text-brand-light text-sm hover:underline">
            전체 보기 <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar -mx-4 px-4">
          {trendingLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-36">
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
      <section className="mb-6">
        <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar -mx-4 px-4">
          <button
            onClick={() => setActiveCategory(undefined)}
            className={cn(
              'flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
              !activeCategory
                ? 'bg-brand text-white shadow-brand'
                : 'bg-surface text-text-secondary hover:bg-surface-hover hover:text-text-primary border border-border'
            )}
          >
            전체
          </button>
          {FEATURED_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat === activeCategory ? undefined : cat)}
              className={cn(
                'flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
                activeCategory === cat
                  ? 'bg-brand text-white shadow-brand'
                  : 'bg-surface text-text-secondary hover:bg-surface-hover hover:text-text-primary border border-border'
              )}
            >
              <span>{CATEGORY_ICONS[cat]}</span>
              <span>{CATEGORY_LABELS[cat]}</span>
            </button>
          ))}
          <Link
            href="/explore"
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium
                       bg-surface text-text-muted hover:text-text-primary border border-border transition-all"
          >
            더보기 <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>

      {/* ─── SORT TABS ─── */}
      <div className="flex items-center gap-1 mb-5">
        {SORT_OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setActiveSort(value)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
              activeSort === value
                ? 'bg-brand/15 text-brand-light border border-brand/30'
                : 'text-text-muted hover:text-text-primary hover:bg-surface'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ─── MAIN CHARACTER GRID ─── */}
      <CharacterGrid
        characters={characters}
        isLoading={feedLoading || isFetchingNextPage}
        hasMore={hasNextPage}
        onLoadMore={fetchNextPage}
        skeletonCount={feedLoading ? 20 : 4}
      />
    </div>
  );
}
