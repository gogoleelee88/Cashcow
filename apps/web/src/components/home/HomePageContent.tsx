'use client';

import { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { BookOpen, MessageCircle, TrendingUp, Flame } from 'lucide-react';
import { AnnouncementSlider } from './AnnouncementSlider';
import { ChatHistorySidebar } from '../layout/ChatHistorySidebar';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import { formatCount, getCharacterAvatarUrl } from '@characterverse/utils';

type FilterKey = 'all' | 'character' | 'story';
type PeriodKey = 'trending' | 'popular' | 'newest';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'character', label: '캐릭터' },
  { key: 'story', label: '스토리' },
];

const PERIODS: { key: PeriodKey; label: string; icon: React.ElementType }[] = [
  { key: 'trending', label: '트렌딩', icon: Flame },
  { key: 'popular',  label: '인기',   icon: TrendingUp },
  { key: 'newest',   label: '최신',   icon: MessageCircle },
];

interface RankingItem {
  id: string;
  type: 'character' | 'story';
  title: string;
  imageUrl: string | null;
  chatCount: number;
  creatorName: string | null;
  href: string;
  isOfficial?: boolean;
}

function RankingCard({ item, rank, index }: { item: RankingItem; rank: number; index: number }) {
  const [imgErr, setImgErr] = useState(false);
  const src = imgErr
    ? getCharacterAvatarUrl(null, item.title)
    : (item.imageUrl ?? getCharacterAvatarUrl(null, item.title));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.025, 0.4) }}
      className="group cursor-pointer"
    >
      <Link href={item.href}>
        <div className="relative rounded-lg overflow-hidden bg-gray-100" style={{ aspectRatio: '3/4' }}>
          <Image
            src={src}
            alt={item.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImgErr(true)}
            sizes="(max-width: 640px) 50vw, 20vw"
          />

          {/* 타입 배지 */}
          <div className={cn(
            'absolute top-0 left-0 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-br-md',
            item.type === 'character' ? 'bg-brand' : 'bg-violet-500'
          )}>
            {item.type === 'character' ? '캐릭터' : '스토리'}
          </div>

          {/* ORIGINAL 배지 */}
          {item.isOfficial && (
            <div className="absolute top-0 right-0 bg-amber-400 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-bl-md">
              ORIGINAL
            </div>
          )}

          {/* 랭킹 번호 */}
          <div className="absolute bottom-1.5 left-2 z-10">
            <span
              className="text-white font-black leading-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
              style={{ fontSize: rank <= 9 ? '32px' : '26px', textShadow: '0 2px 6px rgba(0,0,0,0.7)' }}
            >
              {rank}
            </span>
          </div>

          {/* 스토리 아이콘 */}
          {item.type === 'story' && (
            <div className="absolute bottom-2 right-2 z-10 w-6 h-6 rounded-sm bg-black/40 flex items-center justify-center">
              <BookOpen className="w-3.5 h-3.5 text-white/90" strokeWidth={1.5} />
            </div>
          )}
        </div>

        <div className="mt-1.5 px-0.5">
          <h3 className="text-[13px] font-bold text-gray-900 leading-snug line-clamp-2 mb-0.5">
            {item.title}
          </h3>
          <div className="flex items-center gap-1 text-[11px] text-gray-500">
            <span>{formatCount(item.chatCount)}</span>
            {item.creatorName && (
              <>
                <span className="text-gray-300">·</span>
                <span className="truncate">{item.creatorName}</span>
              </>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function CardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="rounded-lg overflow-hidden aspect-[3/4] bg-gray-100" />
      <div className="mt-1.5 space-y-1 px-0.5">
        <div className="h-3.5 bg-gray-100 rounded w-4/5" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
      </div>
    </div>
  );
}

export function HomePageContent() {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [period, setPeriod] = useState<PeriodKey>('trending');

  const results = useQueries({
    queries: [
      {
        queryKey: ['home-ranking', 'characters', period],
        queryFn: () => api.characters.list({ sort: period === 'newest' ? 'newest' : 'trending', limit: 50 }),
        staleTime: 3 * 60 * 1000,
      },
      {
        queryKey: ['home-ranking', 'stories', period],
        queryFn: () => api.stories.list({ sort: period === 'newest' ? 'newest' : period, limit: 50 }),
        staleTime: 3 * 60 * 1000,
      },
    ],
  });

  const [charResult, storyResult] = results;
  const isLoading = charResult.isLoading || storyResult.isLoading;

  const characters: RankingItem[] = (charResult.data?.data ?? []).map((c: any) => ({
    id: c.id,
    type: 'character',
    title: c.name,
    imageUrl: c.avatarUrl ?? null,
    chatCount: c.chatCount ?? 0,
    creatorName: c.creator?.displayName ?? c.creator?.username ?? null,
    href: `/chat?characterId=${c.id}`,
    isOfficial: c.isOfficial ?? false,
  }));

  const stories: RankingItem[] = (storyResult.data?.data ?? []).map((s: any) => ({
    id: s.id,
    type: 'story',
    title: s.title,
    imageUrl: s.coverUrl ?? null,
    chatCount: s.chatCount ?? 0,
    creatorName: s.author?.displayName ?? null,
    href: `/story/${s.id}`,
    isOfficial: false,
  }));

  const combined: RankingItem[] = (() => {
    if (filter === 'character') return characters;
    if (filter === 'story') return stories;
    return [...characters, ...stories].sort((a, b) => b.chatCount - a.chatCount);
  })();

  return (
    <div className="flex min-h-[calc(100vh-56px)] bg-white">
      <ChatHistorySidebar />

      <main className="flex-1 min-w-0 px-6 py-4">
        {/* 공지 슬라이더 */}
        <div className="mb-6">
          <AnnouncementSlider />
        </div>

        {/* 통합 랭킹 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand" />
            <h2 className="text-gray-900 font-bold text-lg">통합 랭킹</h2>
          </div>

          {/* 기간 탭 */}
          <div className="flex items-center gap-0.5 border border-gray-100 rounded-xl p-0.5 bg-gray-50">
            {PERIODS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={cn(
                  'flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all',
                  period === key
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 필터 pills */}
        <div className="flex gap-2 mb-5">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                'px-4 py-1.5 rounded-full text-[13px] font-semibold transition-all',
                filter === key
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 랭킹 그리드 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-x-3 gap-y-5">
          {isLoading
            ? Array.from({ length: 20 }).map((_, i) => <CardSkeleton key={i} />)
            : combined.map((item, i) => (
                <RankingCard key={`${item.type}-${item.id}`} item={item} rank={i + 1} index={i} />
              ))
          }
          {!isLoading && combined.length === 0 && (
            <p className="col-span-5 text-center text-gray-400 text-sm py-16">콘텐츠가 없습니다.</p>
          )}
        </div>
      </main>
    </div>
  );
}
