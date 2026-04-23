'use client';

import { useState, useCallback } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useProfileStore } from '../../stores/profile.store';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  MessageCircle,
  Heart,
  Star,
  Crown,
  ChevronDown,
  LogIn,
  UserPlus,
  Flame,
  Sparkles,
  Users,
  BookOpen,
  TrendingUp,
  Clock,
  BarChart2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { formatCount, getCharacterAvatarUrl, CATEGORY_LABELS } from '@characterverse/utils';
import type { CharacterListItem } from '@characterverse/types';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
type TabKey = 'recommended' | 'new-ranking' | 'male-popular' | 'female-popular' | 'fan-creation';
type RankingPeriod = 'daily' | 'weekly' | 'monthly';
type SortOption = 'chats' | 'likes' | 'newest';

interface Tab {
  key: TabKey;
  label: string;
  icon: React.FC<{ className?: string }>;
}

const TABS: Tab[] = [
  { key: 'recommended',    label: '추천',      icon: Sparkles },
  { key: 'new-ranking',    label: '신작 랭킹',  icon: TrendingUp },
  { key: 'male-popular',   label: '남성 인기',  icon: BarChart2 },
  { key: 'female-popular', label: '여성 인기',  icon: Heart },
  { key: 'fan-creation',   label: '2차 창작',  icon: BookOpen },
];

const PERIOD_LABELS: Record<RankingPeriod, string> = {
  daily: '일간',
  weekly: '주간',
  monthly: '월간',
};

const SORT_LABELS: Record<SortOption, string> = {
  chats: '대화 많은 순',
  likes: '좋아요 순',
  newest: '최신 순',
};

// ─────────────────────────────────────────────
// FEATURED HERO CARD  (추천 탭 상단 대형 카드)
// ─────────────────────────────────────────────
function FeaturedHeroCard({ character, index }: { character: CharacterListItem; index: number }) {
  const [imgError, setImgError] = useState(false);
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const src = imgError ? getCharacterAvatarUrl(null, character.name) : character.avatarUrl;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08 }}
      className="group relative rounded-2xl overflow-hidden cursor-pointer"
      style={{ aspectRatio: '2/3' }}
      onClick={() => router.push(`/characters/${character.id}`)}
    >
      {/* Image */}
      <Image
        src={src || getCharacterAvatarUrl(null, character.name)}
        alt={character.name}
        fill
        className="object-cover transition-transform duration-500 group-hover:scale-105"
        onError={() => setImgError(true)}
        sizes="(max-width: 640px) 100vw, 33vw"
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* ★2025 ribbon badge */}
      <div className="absolute top-0 right-0 z-20">
        <div className="relative">
          <div className="bg-brand text-white text-[10px] font-bold px-2.5 py-1 rounded-bl-xl flex items-center gap-0.5 shadow-lg">
            <Star className="w-2.5 h-2.5 fill-white" />
            2025
          </div>
        </div>
      </div>

      {/* Top badges */}
      <div className="absolute top-2 left-2 z-20 flex flex-col gap-1">
        {(character as any).isOfficial && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/80 text-white shadow">
            <Star className="w-2.5 h-2.5 fill-white" />
            공식
          </span>
        )}
        {(character as any).isFeatured && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/90 text-amber-900 shadow">
            <Crown className="w-2.5 h-2.5" />
            추천
          </span>
        )}
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-3">
        <h3 className="text-white font-bold text-sm leading-tight mb-0.5 truncate">{character.name}</h3>
        <p className="text-white/70 text-[11px] line-clamp-2 mb-2 leading-relaxed">{character.description}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-white/60 text-[10px]">
            <MessageCircle className="w-3 h-3" />
            <span>{formatCount(character.chatCount)}</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isAuthenticated) { router.push('/login'); return; }
              router.push(`/chat?characterId=${character.id}`);
            }}
            className="px-2.5 py-1 rounded-lg bg-brand text-white text-[10px] font-semibold hover:bg-brand-hover transition-colors"
          >
            대화하기
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// RANKING CARD  (신작 랭킹 등 탭)
// ─────────────────────────────────────────────
function RankingCard({ character, rank, index }: { character: CharacterListItem; rank: number; index: number }) {
  const [imgError, setImgError] = useState(false);
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const src = imgError ? getCharacterAvatarUrl(null, character.name) : character.avatarUrl;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className="flex items-center gap-3 p-3 rounded-xl hover:bg-background-secondary transition-all group cursor-pointer"
      onClick={() => router.push(`/characters/${character.id}`)}
    >
      {/* Rank number */}
      <div className={cn(
        'w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-lg text-sm font-bold',
        rank === 1 ? 'bg-amber-400 text-white' :
        rank === 2 ? 'bg-gray-300 text-gray-700' :
        rank === 3 ? 'bg-amber-600/80 text-white' :
        'bg-background-tertiary text-text-muted'
      )}>
        {rank}
      </div>

      {/* Avatar */}
      <div className="relative w-12 h-12 flex-shrink-0 rounded-xl overflow-hidden ring-1 ring-border">
        <Image
          src={src || getCharacterAvatarUrl(null, character.name)}
          alt={character.name}
          fill
          className="object-cover"
          onError={() => setImgError(true)}
        />
        {/* ★2025 mini ribbon */}
        <div className="absolute top-0 right-0 bg-brand text-white text-[8px] font-bold px-1 py-0.5 rounded-bl-md flex items-center gap-0.5">
          <Star className="w-2 h-2 fill-white" />
          25
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <h3 className="text-text-primary font-semibold text-sm truncate">{character.name}</h3>
          {(character as any).isFeatured && (
            <Crown className="w-3 h-3 text-amber-400 flex-shrink-0" />
          )}
        </div>
        <p className="text-text-muted text-xs truncate">{character.description}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-text-muted text-[10px] flex items-center gap-0.5">
            <MessageCircle className="w-2.5 h-2.5" />
            {formatCount(character.chatCount)}
          </span>
          {character.creator && (
            <span className="text-text-muted text-[10px] truncate">
              @{character.creator.username}
            </span>
          )}
        </div>
      </div>

      {/* Chat button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!isAuthenticated) { router.push('/login'); return; }
          router.push(`/chat?characterId=${character.id}`);
        }}
        className="flex-shrink-0 p-2 rounded-xl bg-brand/10 hover:bg-brand text-brand hover:text-white transition-all duration-200 opacity-0 group-hover:opacity-100"
      >
        <MessageCircle className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// GRID CHARACTER CARD  (기본 그리드 카드)
// ─────────────────────────────────────────────
function GridCharacterCard({ character, index }: { character: CharacterListItem; index: number }) {
  const [imgError, setImgError] = useState(false);
  const [liked, setLiked] = useState(character.isLiked ?? false);
  const [likeCount, setLikeCount] = useState(character.likeCount);
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const src = imgError ? getCharacterAvatarUrl(null, character.name) : character.avatarUrl;

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) { router.push('/login'); return; }
    setLiked(p => !p);
    setLikeCount(p => liked ? p - 1 : p + 1);
    try { await api.characters.like(character.id); } catch {
      setLiked(p => !p);
      setLikeCount(p => liked ? p + 1 : p - 1);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, delay: index * 0.03 }}
      whileHover={{ y: -4 }}
      className="character-card group"
    >
      <Link href={`/characters/${character.id}`} className="block">
        {/* Image */}
        <div className="relative aspect-[3/4] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10" />
          <Image
            src={src || getCharacterAvatarUrl(null, character.name)}
            alt={character.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgError(true)}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
          />

          {/* ★2025 ribbon */}
          <div className="absolute top-0 right-0 z-20">
            <div className="bg-brand text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg flex items-center gap-0.5">
              <Star className="w-2 h-2 fill-white" />
              2025
            </div>
          </div>

          {/* Chat count overlay bottom */}
          <div className="absolute bottom-2 right-2 z-20 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5 text-white text-[10px] font-medium">
            <MessageCircle className="w-2.5 h-2.5" />
            {formatCount(character.chatCount)}
          </div>

          {/* Like btn */}
          <button
            onClick={handleLike}
            className={cn(
              'absolute top-2.5 left-2.5 z-20 p-1.5 rounded-full backdrop-blur-sm transition-all duration-200',
              'bg-black/40 hover:bg-black/60',
              'opacity-0 group-hover:opacity-100',
              liked && 'opacity-100'
            )}
          >
            <Heart className={cn('w-3.5 h-3.5', liked ? 'fill-rose-500 text-rose-500' : 'text-white/80')} />
          </button>
        </div>

        {/* Info */}
        <div className="p-3">
          <h3 className="text-text-primary font-semibold text-sm mb-0.5 truncate">{character.name}</h3>
          <p className="text-text-muted text-xs line-clamp-2 mb-2 leading-relaxed min-h-[2rem]">{character.description}</p>

          {/* Author */}
          {character.creator && (
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-4 h-4 rounded-full bg-background-tertiary overflow-hidden flex-shrink-0">
                {character.creator.avatarUrl ? (
                  <Image
                    src={character.creator.avatarUrl}
                    alt={character.creator.displayName}
                    width={16}
                    height={16}
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-brand/20 flex items-center justify-center">
                    <span className="text-[8px] text-brand font-bold">
                      {character.creator.displayName[0]}
                    </span>
                  </div>
                )}
              </div>
              <span className="text-text-muted text-[11px] truncate">@{character.creator.username}</span>
              <span className="w-1 h-1 rounded-full bg-brand flex-shrink-0" title="verified" />
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-text-muted text-xs">
              <span className="flex items-center gap-0.5">
                <Heart className={cn('w-3 h-3', liked && 'text-rose-400')} />
                {formatCount(likeCount)}
              </span>
            </div>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isAuthenticated) { router.push('/login'); return; }
                router.push(`/chat?characterId=${character.id}`);
              }}
              className="px-2.5 py-1 rounded-lg bg-brand/10 hover:bg-brand text-brand hover:text-white text-[11px] font-semibold transition-all duration-200"
            >
              대화하기
            </button>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// SKELETON LOADERS
// ─────────────────────────────────────────────
function HeroCardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ aspectRatio: '2/3' }}>
      <div className="w-full h-full skeleton" />
    </div>
  );
}

function RankingCardSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3">
      <div className="w-7 h-7 skeleton rounded-lg flex-shrink-0" />
      <div className="w-12 h-12 skeleton rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 skeleton rounded w-2/3" />
        <div className="h-3 skeleton rounded w-full" />
        <div className="h-2.5 skeleton rounded w-1/2" />
      </div>
    </div>
  );
}

function GridCardSkeleton() {
  return (
    <div className="character-card overflow-hidden">
      <div className="aspect-[3/4] skeleton" />
      <div className="p-3 space-y-2">
        <div className="h-4 skeleton rounded-lg w-3/4" />
        <div className="h-3 skeleton rounded-lg w-full" />
        <div className="h-3 skeleton rounded-lg w-2/3" />
        <div className="h-3 skeleton rounded-lg w-1/2 mt-2" />
        <div className="flex items-center justify-between mt-2">
          <div className="h-3 skeleton rounded w-12" />
          <div className="h-7 skeleton rounded-lg w-16" />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// LEFT SIDEBAR  (로그인 패널)
// ─────────────────────────────────────────────
function LoginSidebar() {
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();

  if (isAuthenticated && user) {
    return (
      <aside className="hidden lg:flex flex-col w-60 xl:w-64 flex-shrink-0">
        <div className="sticky top-20 space-y-3">
          {/* User info card */}
          <div className="rounded-2xl border border-border bg-background p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-background-tertiary flex-shrink-0">
                {user.avatarUrl ? (
                  <Image src={user.avatarUrl} alt={user.displayName} width={40} height={40} className="object-cover" />
                ) : (
                  <div className="w-full h-full bg-brand/20 flex items-center justify-center">
                    <span className="text-brand font-bold text-sm">{user.displayName[0]}</span>
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-text-primary font-semibold text-sm truncate">{user.displayName}</p>
                <p className="text-text-muted text-xs truncate">@{user.username}</p>
              </div>
            </div>
            <Link
              href="/chat"
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand-hover transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              내 대화 보기
            </Link>
          </div>

          {/* Quick nav */}
          <div className="rounded-2xl border border-border bg-background p-3 space-y-1">
            <SidebarNavLink href="/" label="캐릭터 홈" icon={Users} />
            <SidebarNavLink href="/story" label="스토리" icon={BookOpen} />
            <SidebarNavLink href="/creator" label="내 작품" icon={Crown} />
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden lg:flex flex-col w-60 xl:w-64 flex-shrink-0">
      <div className="sticky top-20 space-y-3">
        {/* Login prompt card */}
        <div className="rounded-2xl border border-border bg-background overflow-hidden">
          {/* Brand top bar */}
          <div className="bg-brand px-4 py-3">
            <p className="text-white font-bold text-sm">CharacterVerse</p>
            <p className="text-white/80 text-[11px]">AI 캐릭터와 대화하세요</p>
          </div>

          <div className="p-4 space-y-3">
            <p className="text-text-secondary text-xs leading-relaxed">
              로그인하면 좋아하는 캐릭터와 무제한 대화하고, 나만의 캐릭터를 만들 수 있어요.
            </p>
            <button
              onClick={() => router.push('/login')}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand-hover transition-colors"
            >
              <LogIn className="w-4 h-4" />
              로그인
            </button>
            <button
              onClick={() => router.push('/register')}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-brand text-brand text-sm font-semibold hover:bg-brand/5 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              회원가입
            </button>
          </div>
        </div>

        {/* Stats teaser */}
        <div className="rounded-2xl border border-border bg-background p-4">
          <p className="text-text-muted text-[11px] mb-3 font-medium uppercase tracking-wider">플랫폼 현황</p>
          <div className="space-y-2">
            {[
              { label: '등록된 캐릭터', value: '12,400+', icon: Users },
              { label: '총 대화 수', value: '2.3M+', icon: MessageCircle },
              { label: '활성 창작자', value: '48,000+', icon: Flame },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-text-muted text-xs">
                  <Icon className="w-3 h-3" />
                  {label}
                </div>
                <span className="text-text-primary text-xs font-bold">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

function SidebarNavLink({ href, label, icon: Icon }: { href: string; label: string; icon: React.FC<{ className?: string }> }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-background-secondary text-text-secondary hover:text-text-primary transition-all text-sm"
    >
      <Icon className="w-4 h-4 text-brand" />
      {label}
    </Link>
  );
}

// ─────────────────────────────────────────────
// DROPDOWN SELECTOR
// ─────────────────────────────────────────────
function Dropdown<T extends string>({
  value,
  options,
  labels,
  onChange,
}: {
  value: T;
  options: T[];
  labels: Record<T, string>;
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-background hover:border-brand/50 text-text-secondary text-sm transition-all"
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
            className="absolute top-full mt-1 right-0 z-50 bg-background border border-border rounded-xl shadow-lg overflow-hidden min-w-[120px]"
          >
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm hover:bg-background-secondary transition-colors',
                  opt === value ? 'text-brand font-semibold' : 'text-text-secondary'
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

// ─────────────────────────────────────────────
// TAB PANELS
// ─────────────────────────────────────────────

// 추천 탭
function RecommendedTab() {
  const { activeProfile } = useProfileStore();
  const kidsFilter = activeProfile?.isKids ? { ageRating: 'ALL' } : {};

  const { data: featured, isLoading: featuredLoading } = useQuery({
    queryKey: ['characters', 'featured', activeProfile?.isKids],
    queryFn: () => api.characters.list({ limit: 3, sort: 'trending', ...kidsFilter }),
    staleTime: 5 * 60 * 1000,
  });

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['characters', 'recommended', activeProfile?.isKids],
    queryFn: ({ pageParam = 1 }) => api.characters.list({ page: pageParam, limit: 20, sort: 'trending', ...kidsFilter }),
    getNextPageParam: (last) => last?.meta?.hasMore ? (last.meta.page + 1) : undefined,
    initialPageParam: 1,
    staleTime: 2 * 60 * 1000,
  });

  const featuredChars: CharacterListItem[] = featured?.data?.slice(0, 3) ?? [];
  const allChars: CharacterListItem[] = data?.pages.flatMap((p: any) => p.data ?? []) ?? [];

  return (
    <div className="space-y-8">
      {/* Hero section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Crown className="w-4 h-4 text-amber-400" />
          <h2 className="text-text-primary font-bold text-base">에디터 추천</h2>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {featuredLoading
            ? Array.from({ length: 3 }).map((_, i) => <HeroCardSkeleton key={i} />)
            : featuredChars.map((c, i) => <FeaturedHeroCard key={c.id} character={c} index={i} />)
          }
        </div>
      </section>

      {/* Main grid */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-brand" />
          <h2 className="text-text-primary font-bold text-base">모든 캐릭터</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
          {isLoading
            ? Array.from({ length: 20 }).map((_, i) => <GridCardSkeleton key={i} />)
            : allChars.map((c, i) => <GridCharacterCard key={c.id} character={c} index={i} />)
          }
        </div>
        {hasNextPage && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="px-8 py-3 rounded-2xl bg-background-secondary hover:bg-background-tertiary border border-border text-text-secondary text-sm font-medium transition-all disabled:opacity-50"
            >
              {isFetchingNextPage ? '불러오는 중...' : '더 보기'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

// 신작 랭킹 탭
function NewRankingTab() {
  const [period, setPeriod] = useState<RankingPeriod>('weekly');
  const [sort, setSort] = useState<SortOption>('chats');

  const { data, isLoading } = useQuery({
    queryKey: ['characters', 'rankings', period, sort],
    queryFn: () => api.characters.rankings({ period, sort, limit: 50 }),
    staleTime: 3 * 60 * 1000,
  });

  const characters: CharacterListItem[] = data?.data ?? [];

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1.5">
          {(['daily', 'weekly', 'monthly'] as RankingPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-sm font-medium transition-all',
                period === p
                  ? 'bg-brand text-white shadow-sm'
                  : 'bg-background-secondary text-text-muted hover:text-text-primary'
              )}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        <Dropdown value={sort} options={['chats', 'likes', 'newest']} labels={SORT_LABELS} onChange={setSort} />
      </div>

      {/* Ranking list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
        {isLoading
          ? Array.from({ length: 20 }).map((_, i) => <RankingCardSkeleton key={i} />)
          : characters.map((c, i) => <RankingCard key={c.id} character={c} rank={i + 1} index={i} />)
        }
        {!isLoading && characters.length === 0 && (
          <p className="col-span-2 text-text-muted text-sm text-center py-16">아직 랭킹 데이터가 없습니다.</p>
        )}
      </div>
    </div>
  );
}

// 남성/여성 인기 탭 (공통)
function AudienceTab({ target }: { target: 'MALE_ORIENTED' | 'FEMALE_ORIENTED' }) {
  const [sort, setSort] = useState<SortOption>('chats');

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['characters', 'audience', target, sort],
    queryFn: ({ pageParam = 1 }) =>
      api.characters.list({ page: pageParam, limit: 24, audienceTarget: target, sort }),
    getNextPageParam: (last) => last?.meta?.hasMore ? (last.meta.page + 1) : undefined,
    initialPageParam: 1,
    staleTime: 3 * 60 * 1000,
  });

  const characters: CharacterListItem[] = data?.pages.flatMap((p: any) => p.data ?? []) ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-text-muted text-sm">
          {target === 'MALE_ORIENTED' ? '남성향 인기' : '여성향 인기'} 캐릭터
        </p>
        <Dropdown value={sort} options={['chats', 'likes', 'newest']} labels={SORT_LABELS} onChange={setSort} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
        {isLoading
          ? Array.from({ length: 20 }).map((_, i) => <GridCardSkeleton key={i} />)
          : characters.map((c, i) => <GridCharacterCard key={c.id} character={c} index={i} />)
        }
      </div>
      {!isLoading && characters.length === 0 && (
        <p className="text-text-muted text-sm text-center py-16">아직 해당 카테고리의 캐릭터가 없습니다.</p>
      )}
      {hasNextPage && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-8 py-3 rounded-2xl bg-background-secondary hover:bg-background-tertiary border border-border text-text-secondary text-sm font-medium transition-all disabled:opacity-50"
          >
            {isFetchingNextPage ? '불러오는 중...' : '더 보기'}
          </button>
        </div>
      )}
    </div>
  );
}

// 2차 창작 탭
function FanCreationTab() {
  const [sort, setSort] = useState<SortOption>('chats');

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['characters', 'fan-creation', sort],
    queryFn: ({ pageParam = 1 }) =>
      api.characters.list({ page: pageParam, limit: 24, isFanCreation: 'true', sort }),
    getNextPageParam: (last) => last?.meta?.hasMore ? (last.meta.page + 1) : undefined,
    initialPageParam: 1,
    staleTime: 3 * 60 * 1000,
  });

  const characters: CharacterListItem[] = data?.pages.flatMap((p: any) => p.data ?? []) ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-text-muted text-sm">팬이 만든 2차 창작 캐릭터</p>
        <Dropdown value={sort} options={['chats', 'likes', 'newest']} labels={SORT_LABELS} onChange={setSort} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
        {isLoading
          ? Array.from({ length: 20 }).map((_, i) => <GridCardSkeleton key={i} />)
          : characters.map((c, i) => <GridCharacterCard key={c.id} character={c} index={i} />)
        }
      </div>
      {!isLoading && characters.length === 0 && (
        <p className="text-text-muted text-sm text-center py-16">아직 2차 창작 캐릭터가 없습니다.</p>
      )}
      {hasNextPage && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-8 py-3 rounded-2xl bg-background-secondary hover:bg-background-tertiary border border-border text-text-secondary text-sm font-medium transition-all disabled:opacity-50"
          >
            {isFetchingNextPage ? '불러오는 중...' : '더 보기'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN CHARACTER PAGE CONTENT
// ─────────────────────────────────────────────
export function CharacterPageContent() {
  const [activeTab, setActiveTab] = useState<TabKey>('recommended');

  const renderTab = useCallback(() => {
    switch (activeTab) {
      case 'recommended':    return <RecommendedTab />;
      case 'new-ranking':    return <NewRankingTab />;
      case 'male-popular':   return <AudienceTab target="MALE_ORIENTED" />;
      case 'female-popular': return <AudienceTab target="FEMALE_ORIENTED" />;
      case 'fan-creation':   return <FanCreationTab />;
    }
  }, [activeTab]);

  return (
    <div className="flex gap-6 min-h-[calc(100vh-4rem)] px-4 md:px-6 lg:px-8 max-w-[1400px] mx-auto py-6">
      {/* Left sidebar */}
      <LoginSidebar />

      {/* Main content */}
      <main className="flex-1 min-w-0">
        {/* Tab navigation */}
        <div className="flex items-center gap-1 border-b border-border mb-6 overflow-x-auto scrollbar-hide">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-all border-b-2 -mb-px',
                activeTab === key
                  ? 'text-brand border-brand'
                  : 'text-text-muted border-transparent hover:text-text-primary hover:border-border'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {renderTab()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
