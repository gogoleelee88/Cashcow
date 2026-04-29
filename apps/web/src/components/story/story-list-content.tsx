'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, ChevronDown, BookOpen, X, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../stores/auth.store';
import { AnnouncementSlider } from '../home/AnnouncementSlider';
import { ChatHistorySidebar } from '../layout/ChatHistorySidebar';

// ── 탭 정의 ───────────────────────────────────────────────────────
type TabKey =
  | 'recommended'
  | 'new-ranking'
  | 'all-ranking'
  | 'today-new'
  | 'female-popular'
  | 'romance'
  | 'fantasy'
  | 'mystery'
  | 'thriller'
  | 'sf'
  | 'historical'
  | 'horror'
  | 'comedy'
  | 'adventure'
  | 'slice-of-life';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'recommended',   label: '추천' },
  { key: 'new-ranking',   label: '신규 랭킹' },
  { key: 'all-ranking',   label: '전체 랭킹' },
  { key: 'today-new',     label: '오늘 신작' },
  { key: 'female-popular',label: '여성 인기' },
  { key: 'romance',       label: '로맨스' },
  { key: 'fantasy',       label: '판타지' },
  { key: 'mystery',       label: '미스터리' },
  { key: 'thriller',      label: '스릴러' },
  { key: 'sf',            label: 'SF' },
  { key: 'historical',    label: '역사' },
  { key: 'horror',        label: '공포' },
  { key: 'comedy',        label: '코미디' },
  { key: 'adventure',     label: '모험' },
  { key: 'slice-of-life', label: '일상' },
];

type Period = 'daily' | 'weekly' | 'monthly';
type SortOpt = 'popular' | 'newest' | 'trending';

const PERIOD_LABELS: Record<Period, string> = { daily: '일간', weekly: '주간', monthly: '월간' };
const SORT_LABELS: Record<SortOpt, string> = { popular: '추천 인기순', newest: '최신순', trending: '트렌딩순' };

const GENRE_TAB_KEYS: TabKey[] = ['romance', 'fantasy', 'mystery', 'thriller', 'sf', 'historical', 'horror', 'comedy', 'adventure', 'slice-of-life'];

const GENRE_CATEGORY_MAP: Partial<Record<TabKey, string>> = {
  romance: 'ROMANCE', fantasy: 'FANTASY', mystery: 'MYSTERY',
  thriller: 'THRILLER', sf: 'SF', historical: 'HISTORICAL',
  horror: 'HORROR', comedy: 'COMEDY', adventure: 'ADVENTURE',
  'slice-of-life': 'SLICE_OF_LIFE',
};

const GENRE_OPTIONS: { key: TabKey; label: string }[] = [
  { key: 'romance',       label: '로맨스' },
  { key: 'fantasy',       label: '판타지' },
  { key: 'mystery',       label: '미스터리' },
  { key: 'thriller',      label: '스릴러' },
  { key: 'sf',            label: 'SF' },
  { key: 'historical',    label: '역사' },
  { key: 'horror',        label: '공포' },
  { key: 'comedy',        label: '코미디' },
  { key: 'adventure',     label: '모험' },
  { key: 'slice-of-life', label: '일상' },
];

const LS_KEY = 'story_preferred_genres';

const COVER_COLORS = [
  'from-rose-400 to-pink-600', 'from-blue-400 to-indigo-600',
  'from-purple-400 to-violet-600', 'from-amber-400 to-orange-600',
  'from-emerald-400 to-teal-600', 'from-cyan-400 to-sky-600',
];

// ── 선호장르 hook ─────────────────────────────────────────────────
function usePreferredGenres() {
  const [genres, setGenres] = useState<TabKey[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]'); } catch { return []; }
  });

  const save = (next: TabKey[]) => {
    setGenres(next);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  };

  return { genres, save };
}

// ── 드롭다운 ──────────────────────────────────────────────────────
function SimpleDropdown<T extends string>({
  value, options, labels, onChange,
}: {
  value: T; options: T[]; labels: Record<T, string>; onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[13px] text-gray-600 hover:bg-gray-100 transition-colors"
      >
        {labels[value]}
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full mt-1 left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden min-w-[120px]"
          >
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                className={cn(
                  'w-full text-left px-3 py-2 text-[13px] hover:bg-gray-50 transition-colors',
                  opt === value ? 'text-brand font-semibold' : 'text-gray-600'
                )}
              >
                {labels[opt]}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── 선호장르 패널 ─────────────────────────────────────────────────
function GenrePreferencePanel({
  current, onSave, onClose,
}: {
  current: TabKey[]; onSave: (genres: TabKey[]) => void; onClose: () => void;
}) {
  const [selected, setSelected] = useState<TabKey[]>(current);
  const toggle = (key: TabKey) =>
    setSelected((prev) => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  return (
    <div className="absolute right-0 top-full mt-2 z-50 w-[300px] bg-white rounded-2xl border border-gray-200 shadow-2xl p-4">
      <p className="text-[14px] font-bold text-gray-800 mb-3">선호장르 설정</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {GENRE_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => toggle(key)}
            className={cn(
              'px-3 py-1 rounded-full text-[12px] font-medium border transition-all',
              selected.includes(key)
                ? 'border-brand text-brand bg-brand/5'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            )}
          >
            {label}
          </button>
        ))}
        {selected.length === 0 && (
          <span className="px-3 py-1 rounded-full text-[12px] font-medium border border-brand text-brand bg-brand/5">
            설정안됨
          </span>
        )}
      </div>
      <p className="text-[11px] text-gray-400 leading-relaxed mb-4">
        선호장르를 설정하시면 원하는 장르의 스토리만 필터링하여 보실 수 있습니다.
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setSelected([])}
          className="px-3 py-2 text-[12px] text-gray-500 hover:text-gray-700 transition-colors"
        >
          초기화
        </button>
        <button
          onClick={() => { onSave(selected); onClose(); }}
          className="flex-1 py-2 rounded-xl bg-gray-900 text-white text-[13px] font-semibold hover:bg-black transition-colors"
        >
          저장
        </button>
        <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── 스토리 카드 ───────────────────────────────────────────────────
function StoryGridCard({ story, rank, index, showRank = true }: { story: any; rank: number; index: number; showRank?: boolean }) {
  const [imgErr, setImgErr] = useState(false);
  const gradient = COVER_COLORS[index % COVER_COLORS.length];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.025, 0.4) }}
      className="cursor-pointer group"
    >
      <Link href={`/story/${story.id}`}>
        <div className="relative rounded-lg overflow-hidden bg-gray-100" style={{ aspectRatio: '3/4' }}>
          {story.coverUrl && !imgErr ? (
            <Image
              src={story.coverUrl}
              alt={story.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => setImgErr(true)}
              sizes="(max-width: 640px) 50vw, 20vw"
            />
          ) : (
            <div className={cn('absolute inset-0 bg-gradient-to-br flex items-end p-3', gradient)}>
              <p className="text-white font-bold text-sm line-clamp-2 leading-tight">{story.title}</p>
            </div>
          )}

          {story.isFeatured && (
            <div className="absolute top-0 left-0 bg-brand text-white text-[9px] font-bold px-1.5 py-0.5 rounded-br-md">
              추천
            </div>
          )}

          {showRank && (
            <div className="absolute bottom-1.5 left-2 z-10">
              <span
                className="text-white font-black leading-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
                style={{ fontSize: rank <= 9 ? '32px' : '26px', textShadow: '0 2px 6px rgba(0,0,0,0.7)' }}
              >
                {rank}
              </span>
            </div>
          )}

          <div className="absolute bottom-2 right-2 z-10 w-6 h-6 rounded-sm bg-black/40 flex items-center justify-center">
            <BookOpen className="w-3.5 h-3.5 text-white/90" strokeWidth={1.5} />
          </div>
        </div>

        <div className="mt-1.5 px-0.5">
          <h3 className="text-[13px] font-bold text-gray-900 leading-snug line-clamp-2 mb-0.5">
            {story.title}
          </h3>
          <div className="flex items-center gap-1 text-[11px] text-gray-500">
            <span>{(story.chatCount ?? 0).toLocaleString()}</span>
            {story.author && (
              <>
                <span className="text-gray-300">·</span>
                <span className="truncate">{story.author.displayName ?? story.author.username}</span>
              </>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function GridCardSkeleton() {
  return (
    <div>
      <div className="rounded-lg overflow-hidden aspect-[3/4] bg-gray-100 animate-pulse" />
      <div className="mt-1.5 space-y-1 px-0.5">
        <div className="h-3.5 bg-gray-100 rounded animate-pulse w-4/5" />
        <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2" />
      </div>
    </div>
  );
}

// ── 탭별 콘텐츠 ───────────────────────────────────────────────────
function StoryTabContent({ tabKey, preferredGenres }: { tabKey: TabKey; preferredGenres: TabKey[] }) {
  const [period, setPeriod] = useState<Period>('daily');
  const [sort, setSort] = useState<SortOpt>('popular');

  const isRankingTab = tabKey === 'new-ranking' || tabKey === 'all-ranking';
  const isGenreTab = GENRE_TAB_KEYS.includes(tabKey);

  const sortParam = sort === 'newest' ? 'newest' : sort === 'trending' ? 'trending' : 'popular';
  const category = GENRE_CATEGORY_MAP[tabKey];

  const trendingQuery = useQuery({
    queryKey: ['stories', 'trending', tabKey, period],
    queryFn: () => api.stories.trending(period),
    enabled: isRankingTab,
    staleTime: 3 * 60 * 1000,
  });

  const listQuery = useInfiniteQuery({
    queryKey: ['stories', 'list', tabKey, sort],
    queryFn: ({ pageParam = 1 }) => api.stories.list({
      page: pageParam,
      limit: 50,
      category: category,
      sort: tabKey === 'today-new' ? 'newest'
          : tabKey === 'female-popular' ? 'popular'
          : sortParam,
    }),
    getNextPageParam: (last: any) => last?.meta?.hasMore ? (last.meta.page + 1) : undefined,
    initialPageParam: 1,
    enabled: !isRankingTab,
    staleTime: 3 * 60 * 1000,
  });

  let stories: any[] = [];
  let isLoading = false;
  let hasNextPage = false;
  let isFetchingNextPage = false;

  if (isRankingTab) {
    isLoading = trendingQuery.isLoading;
    stories = trendingQuery.data?.data ?? [];
  } else {
    isLoading = listQuery.isLoading;
    stories = listQuery.data?.pages.flatMap((p: any) => p.data ?? []) ?? [];
    hasNextPage = !!listQuery.hasNextPage;
    isFetchingNextPage = listQuery.isFetchingNextPage;
  }

  // 선호장르 필터 적용 (비장르 탭 + 선호장르 설정 시)
  if (!isGenreTab && preferredGenres.length > 0) {
    const preferredCategories = preferredGenres.map(g => GENRE_CATEGORY_MAP[g]).filter(Boolean);
    stories = stories.filter((s: any) => preferredCategories.includes(s.category));
  }

  return (
    <div>
      {/* 서브 필터 */}
      <div className="flex items-center justify-between mb-4 py-2 border-b border-gray-100">
        <div className="flex items-center gap-0.5">
          {isRankingTab && (
            <SimpleDropdown value={period} options={['daily', 'weekly', 'monthly']} labels={PERIOD_LABELS} onChange={setPeriod} />
          )}
          {!isRankingTab && (
            <SimpleDropdown value={sort} options={['popular', 'newest', 'trending']} labels={SORT_LABELS} onChange={setSort} />
          )}
        </div>
      </div>

      {/* 그리드 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-x-3 gap-y-5">
        {isLoading
          ? Array.from({ length: 20 }).map((_, i) => <GridCardSkeleton key={i} />)
          : stories.map((s: any, i: number) => (
              <StoryGridCard key={s.id} story={s} rank={i + 1} index={i} showRank={isRankingTab} />
            ))
        }
        {!isLoading && stories.length === 0 && (
          <p className="col-span-5 text-center text-gray-400 text-sm py-16">아직 스토리가 없습니다.</p>
        )}
      </div>

      {hasNextPage && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => listQuery.fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-8 py-2.5 rounded-full border border-gray-200 text-[13px] text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {isFetchingNextPage ? '불러오는 중...' : '더 보기'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────
export function StoryListContent() {
  const [activeTab, setActiveTab] = useState<TabKey>('new-ranking');
  const [genrePanelOpen, setGenrePanelOpen] = useState(false);
  const { genres: preferredGenres, save: saveGenres } = usePreferredGenres();
  const { user } = useAuthStore();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setGenrePanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSaveGenres = (next: TabKey[]) => {
    saveGenres(next);
    if (GENRE_TAB_KEYS.includes(activeTab) && next.length > 0 && !next.includes(activeTab)) {
      setActiveTab('new-ranking');
    }
  };

  const visibleTabs = preferredGenres.length > 0
    ? TABS.filter(t => !GENRE_TAB_KEYS.includes(t.key) || preferredGenres.includes(t.key))
    : TABS;

  const renderContent = useCallback(() => (
    <StoryTabContent key={activeTab} tabKey={activeTab} preferredGenres={preferredGenres} />
  ), [activeTab, preferredGenres]);

  return (
    <div className="flex min-h-[calc(100vh-56px)] bg-white">
      <ChatHistorySidebar />

      <main className="flex-1 min-w-0 px-6 py-4">
        {/* 공지 슬라이더 */}
        <div className="mb-5">
          <AnnouncementSlider />
        </div>

        {/* 스토리 만들기 버튼 */}
        {user && (
          <div className="flex justify-end mb-3">
            <a href="/creator/new?type=story"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand/10 text-brand hover:bg-brand/20 text-sm font-medium transition-all">
              <Plus className="w-4 h-4" />
              스토리 만들기
            </a>
          </div>
        )}

        {/* 탭 + 선호장르 버튼 */}
        <div className="flex items-center gap-1.5 mb-0 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar flex-1 min-w-0">
            {visibleTabs.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={cn(
                  'flex-shrink-0 px-4 py-1.5 rounded-full text-[13px] font-semibold transition-all whitespace-nowrap',
                  activeTab === key ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative flex-shrink-0 ml-2" ref={panelRef}>
            <button
              onClick={() => setGenrePanelOpen(v => !v)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[13px] font-medium transition-all whitespace-nowrap',
                preferredGenres.length > 0
                  ? 'border-brand text-brand bg-brand/5'
                  : 'border-gray-300 text-gray-600 hover:border-gray-400'
              )}
            >
              선호장르
              <Heart className={cn('w-3.5 h-3.5', preferredGenres.length > 0 ? 'fill-brand text-brand' : '')} />
            </button>

            <AnimatePresence>
              {genrePanelOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                >
                  <GenrePreferencePanel
                    current={preferredGenres}
                    onSave={handleSaveGenres}
                    onClose={() => setGenrePanelOpen(false)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
