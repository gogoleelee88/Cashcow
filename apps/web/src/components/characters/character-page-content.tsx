'use client';

import { useState, useCallback, createContext, useContext, useRef, useEffect } from 'react';
import { useQuery, useInfiniteQuery, useQueries } from '@tanstack/react-query';
import { useProfileStore } from '../../stores/profile.store';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { CharacterPreviewModal } from './character-preview-modal';
import { AnnouncementSlider } from '../home/AnnouncementSlider';
import {
  MessageCircle, Heart, ChevronDown, MoreVertical,
  Pencil, Info, BookOpen, X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { formatCount, getCharacterAvatarUrl } from '@characterverse/utils';
import type { CharacterListItem } from '@characterverse/types';

// ── Context ────────────────────────────────────────────────────────
const PreviewContext = createContext<(id: string) => void>(() => {});
const usePreview = () => useContext(PreviewContext);

// ── Tab 정의 ───────────────────────────────────────────────────────
type TabKey =
  | 'recommended'
  | 'new-ranking'
  | 'all-ranking'
  | 'today-new'
  | 'female-popular'
  | 'romance'
  | 'rofan'
  | 'sf-fantasy'
  | 'martial'
  | 'bl'
  | 'simulation';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'recommended',   label: '추천' },
  { key: 'new-ranking',   label: '신규 랭킹' },
  { key: 'all-ranking',   label: '전체 랭킹' },
  { key: 'today-new',     label: '오늘 신작' },
  { key: 'female-popular',label: '여성 인기' },
  { key: 'romance',       label: '로맨스' },
  { key: 'rofan',         label: '로판' },
  { key: 'sf-fantasy',    label: 'SF/판타지' },
  { key: 'martial',       label: '무협' },
  { key: 'bl',            label: 'BL' },
  { key: 'simulation',    label: '시뮬레이션' },
];

type Period = 'daily' | 'weekly' | 'monthly';
type SortOpt = 'popular' | 'newest' | 'chats';

const PERIOD_LABELS: Record<Period, string> = { daily: '일간', weekly: '주간', monthly: '월간' };
const SORT_LABELS: Record<SortOpt, string> = { popular: '추천 인기순', newest: '최신순', chats: '대화 많은 순' };

// ── 선호장르 ──────────────────────────────────────────────────────
const GENRE_OPTIONS: { key: TabKey; label: string; category: string }[] = [
  { key: 'romance',    label: '로맨스',     category: 'ROMANCE' },
  { key: 'rofan',      label: '로판',       category: 'ROFAN' },
  { key: 'sf-fantasy', label: 'SF/판타지',  category: 'SF_FANTASY' },
  { key: 'martial',    label: '무협',       category: 'MARTIAL' },
  { key: 'bl',         label: 'BL',         category: 'BL' },
  { key: 'simulation', label: '시뮬레이션', category: 'SIMULATION' },
];

const LS_KEY = 'crack_preferred_genres';

function usePreferredGenres() {
  const { isAuthenticated } = useAuthStore();
  const [genres, setGenres] = useState<TabKey[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]'); } catch { return []; }
  });
  const [syncing, setSyncing] = useState(false);

  // 로그인 시 서버 값으로 동기화
  useEffect(() => {
    if (!isAuthenticated) return;
    api.users.getPreferences()
      .then((res) => {
        const serverGenres: TabKey[] = res?.data?.preferredGenres ?? [];
        setGenres(serverGenres);
        localStorage.setItem(LS_KEY, JSON.stringify(serverGenres));
      })
      .catch(() => {}); // 실패 시 localStorage 값 유지
  }, [isAuthenticated]);

  const save = async (next: TabKey[]) => {
    // 즉각 UI 반영 (optimistic)
    setGenres(next);
    localStorage.setItem(LS_KEY, JSON.stringify(next));

    if (!isAuthenticated) return; // 비로그인: localStorage만

    setSyncing(true);
    try {
      await api.users.updatePreferences(next);
    } catch {
      // 서버 저장 실패 시 롤백
      const prev: TabKey[] = (() => {
        try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]'); } catch { return []; }
      })();
      setGenres(prev);
    } finally {
      setSyncing(false);
    }
  };

  return { genres, save, syncing };
}

// ── Ranking 그리드 카드 (스크린샷 디자인) ─────────────────────────
function RankingGridCard({ character, rank, index, showRank = true }: { character: CharacterListItem; rank: number; index: number; showRank?: boolean }) {
  const [imgError, setImgError] = useState(false);
  const openPreview = usePreview();
  const src = imgError ? getCharacterAvatarUrl(null, character.name) : character.avatarUrl;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.025, 0.4) }}
      className="cursor-pointer group"
      onClick={() => openPreview(character.id)}
    >
      {/* 이미지 영역 */}
      <div className="relative rounded-lg overflow-hidden bg-gray-100" style={{ aspectRatio: '3/4' }}>
        <Image
          src={src || getCharacterAvatarUrl(null, character.name)}
          alt={character.name}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          onError={() => setImgError(true)}
          sizes="(max-width: 640px) 50vw, 20vw"
        />
        {/* ORIGINAL 배지 */}
        {(character as any).isOfficial && (
          <div className="absolute top-0 left-0 bg-brand text-white text-[9px] font-bold px-1.5 py-0.5 rounded-br-md">
            ORIGINAL
          </div>
        )}
        {/* 랭킹 번호 */}
        {showRank && (
          <div className="absolute bottom-1.5 left-2 z-10">
            <span className="text-white font-black leading-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
              style={{ fontSize: rank <= 9 ? '32px' : '26px', textShadow: '0 2px 6px rgba(0,0,0,0.7)' }}>
              {rank}
            </span>
          </div>
        )}
        {/* 북마크 아이콘 */}
        <div className="absolute bottom-2 right-2 z-10 w-6 h-6 rounded-sm bg-black/40 flex items-center justify-center">
          <BookOpen className="w-3.5 h-3.5 text-white/90" strokeWidth={1.5} />
        </div>
      </div>

      {/* 카드 아래 텍스트 */}
      <div className="mt-1.5 px-0.5">
        <h3 className="text-[13px] font-bold text-gray-900 leading-snug line-clamp-2 mb-0.5">
          {character.name}
        </h3>
        <div className="flex items-center gap-1 text-[11px] text-gray-500">
          <span>{formatCount(character.chatCount)}</span>
          {character.creator && (
            <>
              <span className="text-gray-300">·</span>
              <span className="truncate">{character.creator.displayName ?? character.creator.username}</span>
              <span className="w-2 h-2 rounded-full bg-brand flex-shrink-0" />
            </>
          )}
        </div>
      </div>
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

// 장르 탭 key 목록
const GENRE_TAB_KEYS: TabKey[] = ['romance', 'rofan', 'sf-fantasy', 'martial', 'bl', 'simulation'];

const GENRE_CATEGORY_MAP: Partial<Record<TabKey, string>> = {
  romance: 'ROMANCE', rofan: 'ROFAN', 'sf-fantasy': 'SF_FANTASY',
  martial: 'MARTIAL', bl: 'BL', simulation: 'SIMULATION',
};

// ── 탭별 콘텐츠 ───────────────────────────────────────────────────
function RankingTabContent({ tabKey, preferredGenres }: { tabKey: TabKey; preferredGenres: TabKey[] }) {
  const { activeProfile } = useProfileStore();
  const kidsFilter = activeProfile?.isKids ? { ageRating: 'ALL' } : {};
  const [period, setPeriod] = useState<Period>('daily');
  const [sort, setSort] = useState<SortOpt>('popular');

  const isRankingTab = tabKey === 'new-ranking' || tabKey === 'all-ranking';
  const isGenreTab = GENRE_TAB_KEYS.includes(tabKey);

  // 비장르 탭에서 선호장르가 설정된 경우 → 선호장르 병렬 쿼리로 필터링
  const usePreferredFilter = preferredGenres.length > 0 && !isGenreTab;

  const baseParams = (category?: string): Record<string, unknown> => {
    const base: Record<string, unknown> = { limit: 50, ...kidsFilter };
    if (category) base.category = category;
    if (tabKey === 'today-new') base.sort = 'newest';
    else if (tabKey === 'female-popular') { base.audienceTarget = 'FEMALE_ORIENTED'; base.sort = 'trending'; }
    else base.sort = sort === 'newest' ? 'newest' : 'trending';
    return base;
  };

  // 선호장르 병렬 쿼리 (비장르 탭 + 선호장르 설정 시)
  const preferredResults = useQueries({
    queries: usePreferredFilter
      ? preferredGenres.map((g) => ({
          queryKey: ['characters', tabKey, 'preferred', g, period, sort, activeProfile?.isKids],
          queryFn: () => api.characters.list({ ...baseParams(GENRE_CATEGORY_MAP[g]), page: 1 }),
          staleTime: 3 * 60 * 1000,
        }))
      : [],
  });

  // 일반 랭킹 쿼리 (랭킹 탭 + 선호장르 없을 때)
  const rankQuery = useQuery({
    queryKey: ['characters', 'rankings', tabKey, period, sort],
    queryFn: () => api.characters.rankings({ period, sort: sort === 'chats' ? 'chats' : sort === 'newest' ? 'newest' : 'chats', limit: 50 }),
    enabled: isRankingTab && !usePreferredFilter,
    staleTime: 3 * 60 * 1000,
  });

  // 일반 리스트 쿼리 (장르 탭 or 선호장르 없는 비장르 탭)
  const listQuery = useInfiniteQuery({
    queryKey: ['characters', tabKey, period, sort, activeProfile?.isKids],
    queryFn: ({ pageParam = 1 }) => api.characters.list({
      ...baseParams(GENRE_CATEGORY_MAP[tabKey]),
      page: pageParam,
    }),
    getNextPageParam: (last: any) => last?.meta?.hasMore ? (last.meta.page + 1) : undefined,
    initialPageParam: 1,
    enabled: !usePreferredFilter && !(isRankingTab),
    staleTime: 3 * 60 * 1000,
  });

  // 최종 캐릭터 목록 결정
  let characters: CharacterListItem[] = [];
  let isLoading = false;
  let hasNextPage = false;
  let isFetchingNextPage = false;

  if (usePreferredFilter) {
    isLoading = preferredResults.some((r) => r.isLoading);
    characters = preferredResults
      .flatMap((r: any) => r.data?.data ?? [])
      .filter((c: CharacterListItem, i: number, arr: CharacterListItem[]) => arr.findIndex((x) => x.id === c.id) === i)
      .sort((a: CharacterListItem, b: CharacterListItem) => (b.chatCount ?? 0) - (a.chatCount ?? 0));
  } else if (isRankingTab) {
    isLoading = rankQuery.isLoading;
    characters = rankQuery.data?.data ?? [];
  } else {
    isLoading = listQuery.isLoading;
    characters = listQuery.data?.pages.flatMap((p: any) => p.data ?? []) ?? [];
    hasNextPage = !!listQuery.hasNextPage;
    isFetchingNextPage = listQuery.isFetchingNextPage;
  }

  return (
    <div>
      {/* 서브 필터 */}
      <div className="flex items-center justify-between mb-4 py-2 border-b border-gray-100">
        <div className="flex items-center gap-0.5">
          {isRankingTab && (
            <SimpleDropdown value={period} options={['daily', 'weekly', 'monthly']} labels={PERIOD_LABELS} onChange={setPeriod} />
          )}
          <SimpleDropdown value={sort} options={['popular', 'newest', 'chats']} labels={SORT_LABELS} onChange={setSort} />
        </div>
        <button className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors">
          <Info className="w-4 h-4" />
        </button>
      </div>

      {/* 그리드 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-x-3 gap-y-5">
        {isLoading
          ? Array.from({ length: 20 }).map((_, i) => <GridCardSkeleton key={i} />)
          : characters.map((c, i) => (
              <RankingGridCard key={c.id} character={c} rank={i + 1} index={i} showRank={isRankingTab && !usePreferredFilter} />
            ))
        }
        {!isLoading && characters.length === 0 && (
          <p className="col-span-5 text-center text-gray-400 text-sm py-16">아직 콘텐츠가 없습니다.</p>
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

// ── 선호장르 팝업 패널 ────────────────────────────────────────────
function GenrePreferencePanel({
  current,
  onSave,
  onClose,
}: {
  current: TabKey[];
  onSave: (genres: TabKey[]) => Promise<void>;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<TabKey[]>(current);

  const toggle = (key: TabKey) =>
    setSelected((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);

  return (
    <div className="absolute right-0 top-full mt-2 z-50 w-[300px] bg-white rounded-2xl border border-gray-200 shadow-2xl p-4">
      <p className="text-[14px] font-bold text-gray-800 mb-3">선호장르 설정</p>

      {/* 장르 토글 pills */}
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
        선호장르를 설정하시면 여러 장르가 혼합된 화면에서 원하는 장르의 캐릭터만 필터링하여 보실 수 있습니다.
      </p>

      {/* 하단 버튼 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setSelected([])}
          className="px-3 py-2 text-[12px] text-gray-500 hover:text-gray-700 transition-colors"
        >
          초기화
        </button>
        <button
          onClick={async () => { await onSave(selected); onClose(); }}
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

// ── 채팅 내역 사이드바 ────────────────────────────────────────────
function ChatHistorySidebar() {
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const [sidebarTab, setSidebarTab] = useState<'episode' | 'party'>('episode');

  const { data: convData } = useQuery({
    queryKey: ['conversations', 'recent'],
    queryFn: () => api.chat.conversations({ limit: 20 }),
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });

  const conversations: any[] = convData?.data ?? [];

  return (
    <aside className="hidden lg:flex flex-col w-[215px] flex-shrink-0 border-r border-gray-200 bg-white">
      {/* 에피소드 / 파티챗 탭 */}
      <div className="flex border-b border-gray-200">
        {(['episode', 'party'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setSidebarTab(t)}
            className={cn(
              'flex-1 py-3 text-[13px] font-semibold transition-colors relative',
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

      {/* 채팅 내역 헤더 */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="text-[12px] font-semibold text-gray-700">채팅 내역</span>
        {isAuthenticated && (
          <button className="flex items-center gap-0.5 text-[12px] text-gray-500 hover:text-gray-700 transition-colors">
            <Pencil className="w-3 h-3" />
            편집
          </button>
        )}
      </div>

      {/* 채팅 목록 */}
      <div className="flex-1 overflow-y-auto hide-scrollbar">
        {!isAuthenticated ? (
          <div className="px-3 py-6 text-center">
            <p className="text-[12px] text-gray-400 mb-3">로그인하면 채팅 내역을 볼 수 있어요</p>
            <button
              onClick={() => router.push('/login')}
              className="w-full py-2 rounded-lg bg-brand text-white text-[12px] font-semibold hover:bg-brand-hover transition-colors"
            >
              로그인
            </button>
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <MessageCircle className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-[12px] text-gray-400">아직 채팅 내역이 없어요</p>
          </div>
        ) : (
          conversations.map((conv) => (
            <ConvItem key={conv.id} conv={conv} />
          ))
        )}
      </div>
    </aside>
  );
}

function ConvItem({ conv }: { conv: any }) {
  const [imgErr, setImgErr] = useState(false);
  const router = useRouter();
  const character = conv.character;
  const src = imgErr ? getCharacterAvatarUrl(null, character?.name ?? '?') : character?.avatarUrl;

  const formatRelativeTime = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    return `${Math.floor(hours / 24)}일 전`;
  };

  return (
    <div
      className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-gray-50 cursor-pointer group transition-colors"
      onClick={() => router.push(`/chat?conversationId=${conv.id}`)}
    >
      {/* 아바타 */}
      <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-gray-100">
        {src
          ? <Image src={src} alt={character?.name ?? ''} width={36} height={36} className="object-cover" onError={() => setImgErr(true)} />
          : <div className="w-full h-full bg-brand/10 flex items-center justify-center text-brand text-xs font-bold">
              {character?.name?.[0] ?? '?'}
            </div>
        }
      </div>

      {/* 텍스트 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <p className="text-[12px] font-semibold text-gray-800 truncate pr-1">{character?.name ?? '알 수 없음'}</p>
          <span className="text-[10px] text-gray-400 flex-shrink-0">{formatRelativeTime(conv.updatedAt)}</span>
        </div>
        <p className="text-[11px] text-gray-400 truncate leading-snug">
          {conv.lastMessage?.content ?? '대화를 시작해보세요'}
        </p>
      </div>

      {/* 더보기 */}
      <button
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-gray-400 hover:text-gray-600"
        onClick={(e) => e.stopPropagation()}
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────
export function CharacterPageContent() {
  const [activeTab, setActiveTab] = useState<TabKey>('new-ranking');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [genrePanelOpen, setGenrePanelOpen] = useState(false);
  const { genres: preferredGenres, save: saveGenres } = usePreferredGenres();
  const panelRef = useRef<HTMLDivElement>(null);

  // 패널 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setGenrePanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSaveGenres = async (next: TabKey[]) => {
    await saveGenres(next);
    // 현재 탭이 장르 탭인데 선호장르에서 빠졌으면 기본 탭으로
    if (GENRE_TAB_KEYS.includes(activeTab) && next.length > 0 && !next.includes(activeTab)) {
      setActiveTab('new-ranking');
    }
  };

  // 표시할 탭: 선호장르 설정 시 → 장르 탭은 선호장르만 표시
  const visibleTabs = preferredGenres.length > 0
    ? TABS.filter((t) => !GENRE_TAB_KEYS.includes(t.key) || preferredGenres.includes(t.key))
    : TABS;

  const renderContent = useCallback(() => (
    <RankingTabContent key={activeTab} tabKey={activeTab} preferredGenres={preferredGenres} />
  ), [activeTab, preferredGenres]);

  return (
    <PreviewContext.Provider value={setPreviewId}>
      <CharacterPreviewModal characterId={previewId} onClose={() => setPreviewId(null)} />

      <div className="flex min-h-[calc(100vh-56px)] bg-white">
        <ChatHistorySidebar />

        <main className="flex-1 min-w-0 px-6 py-4">
          {/* 공지 슬라이더 */}
          <div className="mb-5">
            <AnnouncementSlider />
          </div>

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

            {/* 선호장르 설정 버튼 */}
            <div className="relative flex-shrink-0 ml-2" ref={panelRef}>
              <button
                onClick={() => setGenrePanelOpen((v) => !v)}
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
    </PreviewContext.Provider>
  );
}
