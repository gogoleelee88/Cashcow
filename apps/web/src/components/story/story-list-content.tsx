'use client';

import { useState } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { BookOpen, Flame, Clock, TrendingUp, ChevronRight, Search, Plus } from 'lucide-react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../stores/auth.store';
import { ChatHistorySidebar } from '../layout/ChatHistorySidebar';

const STORY_CATEGORIES = [
  { value: undefined, label: '전체' },
  { value: 'ROMANCE', label: '로맨스' },
  { value: 'FANTASY', label: '판타지' },
  { value: 'MYSTERY', label: '미스터리' },
  { value: 'THRILLER', label: '스릴러' },
  { value: 'SF', label: 'SF' },
  { value: 'HISTORICAL', label: '역사' },
  { value: 'HORROR', label: '공포' },
  { value: 'COMEDY', label: '코미디' },
  { value: 'ADVENTURE', label: '모험' },
  { value: 'SLICE_OF_LIFE', label: '일상' },
];

const SORT_OPTIONS = [
  { value: 'trending', label: '트렌딩', icon: Flame },
  { value: 'newest', label: '최신', icon: Clock },
  { value: 'popular', label: '인기', icon: TrendingUp },
];

const COVER_COLORS = [
  'from-rose-400 to-pink-600',
  'from-blue-400 to-indigo-600',
  'from-purple-400 to-violet-600',
  'from-amber-400 to-orange-600',
  'from-emerald-400 to-teal-600',
  'from-cyan-400 to-sky-600',
];

function StoryCoverPlaceholder({ title, index }: { title: string; index: number }) {
  const gradient = COVER_COLORS[index % COVER_COLORS.length];
  return (
    <div className={cn('w-full h-full bg-gradient-to-br flex items-end p-3', gradient)}>
      <p className="text-white font-bold text-sm line-clamp-2 leading-tight">{title}</p>
    </div>
  );
}

function StoryCard({ story, index }: { story: any; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="group"
    >
      <Link href={`/story/${story.id}`}>
        <div className="relative aspect-[3/4] rounded-2xl overflow-hidden mb-2.5 bg-surface">
          {story.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={story.coverUrl} alt={story.title} className="w-full h-full object-cover" />
          ) : (
            <StoryCoverPlaceholder title={story.title} index={index} />
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300" />
          <div className="absolute top-2 left-2">
            <span className="px-2 py-0.5 bg-white/90 backdrop-blur-sm rounded-full text-xs font-medium text-text-secondary">
              {story.category}
            </span>
          </div>
          {story.isFeatured && (
            <div className="absolute top-2 right-2">
              <span className="px-2 py-0.5 bg-brand text-white rounded-full text-xs font-bold">추천</span>
            </div>
          )}
        </div>
        <div>
          <p className="text-text-primary font-semibold text-sm truncate group-hover:text-brand transition-colors">
            {story.title}
          </p>
          <p className="text-text-muted text-xs mt-0.5 truncate">
            {story.author?.displayName ?? '작자미상'}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-text-muted text-xs">{(story.chatCount ?? 0).toLocaleString()} 대화</span>
            <span className="text-text-muted text-xs">·</span>
            <span className="text-text-muted text-xs">♥ {(story.likeCount ?? 0).toLocaleString()}</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function StoryCardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[3/4] rounded-2xl bg-surface mb-2.5" />
      <div className="h-4 bg-surface rounded w-3/4 mb-1.5" />
      <div className="h-3 bg-surface rounded w-1/2" />
    </div>
  );
}

export function StoryListContent() {
  const [activeCategory, setActiveCategory] = useState<string | undefined>(undefined);
  const [activeSort, setActiveSort] = useState('trending');
  const { user } = useAuthStore();

  const { data: trendingData, isLoading: trendingLoading } = useQuery({
    queryKey: ['stories', 'trending'],
    queryFn: () => api.stories.trending('24h'),
    staleTime: 1000 * 60 * 5,
  });

  const {
    data: storiesData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['stories', 'list', activeCategory, activeSort],
    queryFn: ({ pageParam = 1 }) =>
      api.stories.list({ page: pageParam, limit: 24, category: activeCategory, sort: activeSort }),
    getNextPageParam: (lastPage: any) =>
      lastPage.meta?.hasMore ? (lastPage.meta.page || 1) + 1 : undefined,
    initialPageParam: 1,
    staleTime: 1000 * 60 * 2,
  });

  const stories = storiesData?.pages.flatMap((p: any) => p.data) ?? [];
  const trending = trendingData?.data ?? [];

  return (
    <div className="flex min-h-[calc(100vh-56px)] bg-white">
      <ChatHistorySidebar />
      <div className="flex-1 min-w-0 px-6 py-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-text-primary font-black text-2xl flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-brand" />
            스토리
          </h1>
          <p className="text-text-muted text-sm mt-1">AI와 함께하는 인터랙티브 스토리</p>
        </div>
        {user && (
          <Link href="/creator/new?type=story" className="btn-primary flex items-center gap-2 text-sm py-2">
            <Plus className="w-4 h-4" />
            스토리 만들기
          </Link>
        )}
      </div>

      {/* Trending stories horizontal scroll */}
      {(trending.length > 0 || trendingLoading) && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              <h2 className="text-text-primary font-bold">지금 인기 스토리</h2>
            </div>
            <button className="text-brand text-sm font-medium flex items-center gap-1 hover:underline">
              전체 <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar -mx-4 px-4">
            {trendingLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-36">
                    <StoryCardSkeleton />
                  </div>
                ))
              : trending.slice(0, 8).map((story: any, i: number) => (
                  <div key={story.id} className="flex-shrink-0 w-36 sm:w-44">
                    <StoryCard story={story} index={i} />
                  </div>
                ))}
          </div>
        </section>
      )}

      {/* Category pills */}
      <div className="flex gap-2 overflow-x-auto pb-3 hide-scrollbar -mx-4 px-4 mb-4">
        {STORY_CATEGORIES.map(({ value, label }) => (
          <button
            key={label}
            onClick={() => setActiveCategory(value)}
            className={cn(
              activeCategory === value ? 'category-pill-active' : 'category-pill'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Sort tabs */}
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

      {/* Story grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 24 }).map((_, i) => <StoryCardSkeleton key={i} />)}
        </div>
      ) : stories.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {stories.map((story: any, i: number) => (
              <StoryCard key={story.id} story={story} index={i} />
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
        <div className="text-center py-24">
          <BookOpen className="w-14 h-14 text-text-muted mx-auto mb-4" />
          <p className="text-text-primary font-semibold mb-2">아직 스토리가 없습니다</p>
          <p className="text-text-muted text-sm mb-4">첫 번째 스토리를 만들어보세요!</p>
          {user && (
            <Link href="/creator/new?type=story" className="btn-primary text-sm py-2 px-6">
              스토리 만들기
            </Link>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
