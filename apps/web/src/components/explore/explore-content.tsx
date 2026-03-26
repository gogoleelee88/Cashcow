'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Filter, SlidersHorizontal, X } from 'lucide-react';
import { CharacterGrid } from '../characters/character-grid';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import { CATEGORY_LABELS, CATEGORY_ICONS } from '@characterverse/utils';
import type { CharacterCategory } from '@characterverse/types';

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as CharacterCategory[];
const SORT_OPTIONS = [
  { value: 'trending', label: '트렌딩' },
  { value: 'newest', label: '최신' },
  { value: 'popular', label: '인기' },
  { value: 'liked', label: '좋아요' },
];
const LANGUAGE_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'ko', label: '한국어' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
];

export function ExploreContent() {
  const searchParams = useSearchParams();
  const [category, setCategory] = useState<CharacterCategory | undefined>(
    (searchParams?.get('category') as CharacterCategory) || undefined
  );
  const [sort, setSort] = useState(searchParams?.get('sort') || 'trending');
  const [language, setLanguage] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const q = searchParams?.get('q') || undefined;

  const {
    data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage
  } = useInfiniteQuery({
    queryKey: ['explore', category, sort, language, q],
    queryFn: ({ pageParam = 1 }) =>
      api.characters.list({ page: pageParam, limit: 24, category, sort, language: language || undefined, q }),
    getNextPageParam: (lastPage: any) => lastPage.meta?.hasMore ? lastPage.meta.page + 1 : undefined,
    initialPageParam: 1,
    staleTime: 1000 * 60 * 2,
  });

  const characters = data?.pages.flatMap((p: any) => p.data) ?? [];
  const total = data?.pages[0]?.meta?.total ?? 0;

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6">
      {/* Search result header */}
      {q && (
        <div className="mb-5">
          <h2 className="text-text-primary font-bold text-xl mb-1">
            "{q}" 검색 결과
          </h2>
          <p className="text-text-muted text-sm">{total.toLocaleString()}개의 캐릭터</p>
        </div>
      )}

      {/* Category pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar -mx-4 px-4 mb-5">
        <button
          onClick={() => setCategory(undefined)}
          className={cn(
            'flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all',
            !category ? 'bg-brand text-white shadow-brand' : 'bg-surface text-text-secondary border border-border hover:bg-surface-hover'
          )}
        >
          전체
        </button>
        {ALL_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat === category ? undefined : cat)}
            className={cn(
              'flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all',
              category === cat ? 'bg-brand text-white shadow-brand' : 'bg-surface text-text-secondary border border-border hover:bg-surface-hover'
            )}
          >
            <span>{CATEGORY_ICONS[cat]}</span>
            <span>{CATEGORY_LABELS[cat]}</span>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex gap-1">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSort(opt.value)}
              className={cn(
                'px-3.5 py-2 rounded-xl text-sm font-medium transition-all',
                sort === opt.value
                  ? 'bg-brand/15 text-brand-light border border-brand/30'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Language filter */}
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-surface border border-border rounded-xl px-3 py-2 text-sm text-text-secondary
                       focus:outline-none focus:ring-2 focus:ring-brand/30 transition-all cursor-pointer"
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {total > 0 && (
            <span className="text-text-muted text-sm">{total.toLocaleString()}개</span>
          )}
        </div>
      </div>

      {/* Grid */}
      <CharacterGrid
        characters={characters}
        isLoading={isLoading || isFetchingNextPage}
        hasMore={hasNextPage}
        onLoadMore={fetchNextPage}
        skeletonCount={isLoading ? 24 : 4}
        columns="auto"
      />
    </div>
  );
}
