'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Crown, TrendingUp, MessageCircle, Heart,
  Settings, BarChart3, ArrowRight, Coins, Calendar,
  ChevronRight, CheckCircle2, Clock, AlertCircle,
  Wallet, Users, Star, Zap,
} from 'lucide-react';
import { api } from '../../lib/api';
import { formatCount, formatRelativeTime, formatCurrency } from '@characterverse/utils';
import { useAuthStore } from '../../stores/auth.store';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { cn } from '../../lib/utils';

type Tab = 'characters' | 'earnings' | 'analytics';

const SETTLEMENT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: '정산 대기', color: 'text-amber-400 bg-amber-400/10' },
  PROCESSING: { label: '처리 중', color: 'text-blue-400 bg-blue-400/10' },
  COMPLETED: { label: '정산 완료', color: 'text-emerald-400 bg-emerald-400/10' },
  FAILED: { label: '정산 실패', color: 'text-red-400 bg-red-400/10' },
};

export function CreatorStudio() {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('characters');

  useEffect(() => {
    if (!isAuthenticated) router.push('/login?redirect=/creator');
  }, [isAuthenticated, router]);

  const { data: myCharsData, isLoading: charsLoading } = useQuery({
    queryKey: ['characters', 'my'],
    queryFn: () => api.characters.my({ limit: 50 }),
    enabled: isAuthenticated,
  });

  const { data: earningsData, isLoading: earningsLoading } = useQuery({
    queryKey: ['earnings'],
    queryFn: () => api.users.earnings(),
    enabled: isAuthenticated && activeTab === 'earnings',
  });

  const characters = myCharsData?.data ?? [];
  const totalChats = characters.reduce((sum: number, c: any) => sum + c.chatCount, 0);
  const totalLikes = characters.reduce((sum: number, c: any) => sum + c.likeCount, 0);
  const earnings = earningsData?.data;

  if (!isAuthenticated) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Crown className="w-5 h-5 text-amber-400" />
            <h1 className="text-text-primary font-bold text-2xl">크리에이터 스튜디오</h1>
          </div>
          <p className="text-text-muted text-sm">캐릭터를 만들고, 수익을 확인하세요</p>
        </div>
        <Link href="/creator/new" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          새 캐릭터
        </Link>
      </div>

      {/* ── SUMMARY STATS ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: '내 캐릭터', value: characters.length, icon: Crown, color: 'text-amber-400', bg: 'bg-amber-400/10' },
          { label: '총 대화수', value: totalChats, icon: MessageCircle, color: 'text-blue-400', bg: 'bg-blue-400/10' },
          { label: '총 좋아요', value: totalLikes, icon: Heart, color: 'text-rose-400', bg: 'bg-rose-400/10' },
          { label: '미정산 수익', value: earnings?.pendingEarnings ?? 0, icon: Wallet, color: 'text-brand-light', bg: 'bg-brand/10', isCurrency: true },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="card p-4"
          >
            <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center mb-3', stat.bg)}>
              <stat.icon className={cn('w-4 h-4', stat.color)} />
            </div>
            <p className="text-text-primary font-bold text-xl">
              {stat.isCurrency ? formatCurrency(stat.value) : formatCount(stat.value)}
            </p>
            <p className="text-text-muted text-xs mt-0.5">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* ── TABS ── */}
      <div className="flex items-center gap-1 mb-5 border-b border-border">
        {([
          { id: 'characters', label: '내 캐릭터', icon: Crown },
          { id: 'earnings', label: '수익 현황', icon: Coins },
          { id: 'analytics', label: '분석', icon: BarChart3 },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 -mb-px',
              activeTab === id
                ? 'border-brand text-brand-light'
                : 'border-transparent text-text-muted hover:text-text-primary'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: CHARACTERS ── */}
      <AnimatePresence mode="wait">
        {activeTab === 'characters' && (
          <motion.div key="characters" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {charsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="card p-4 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl skeleton flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 skeleton rounded w-1/3" />
                      <div className="h-3 skeleton rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : characters.length === 0 ? (
              <EmptyCreatorState />
            ) : (
              <div className="space-y-3">
                {characters.map((char: any, i: number) => (
                  <CharacterRow key={char.id} char={char} index={i} />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ── TAB: EARNINGS ── */}
        {activeTab === 'earnings' && (
          <motion.div key="earnings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {earningsLoading ? (
              <EarningsSkeleton />
            ) : (
              <EarningsDashboard earnings={earnings} />
            )}
          </motion.div>
        )}

        {/* ── TAB: ANALYTICS ── */}
        {activeTab === 'analytics' && (
          <motion.div key="analytics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <AnalyticsDashboard characters={characters} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── CHARACTER ROW ───────────────────────────
function CharacterRow({ char, index }: { char: any; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="card p-4 flex items-center gap-4 hover:border-brand/30 transition-all group"
    >
      <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 ring-1 ring-border group-hover:ring-brand/30 transition-all">
        <Image
          src={char.avatarUrl || `https://api.dicebear.com/8.x/personas/svg?seed=${char.name}&backgroundColor=1a1a2e`}
          alt={char.name}
          width={56}
          height={56}
          className="object-cover w-full h-full"
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-text-primary font-semibold text-sm">{char.name}</h3>
          <span className={cn(
            'text-xs px-2 py-0.5 rounded-full font-medium',
            char.visibility === 'PUBLIC' ? 'bg-emerald-500/15 text-emerald-400' :
              char.visibility === 'UNLISTED' ? 'bg-amber-500/15 text-amber-400' :
                'bg-border text-text-muted'
          )}>
            {char.visibility === 'PUBLIC' ? '공개' : char.visibility === 'UNLISTED' ? '링크 공유' : '비공개'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-text-muted text-xs">
          <span className="flex items-center gap-1">
            <MessageCircle className="w-3 h-3" />{formatCount(char.chatCount)}회 대화
          </span>
          <span className="flex items-center gap-1">
            <Heart className="w-3 h-3" />{formatCount(char.likeCount)}
          </span>
          <span>{formatRelativeTime(char.createdAt)}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Link
          href={`/creator/edit/${char.id}`}
          className="p-2 rounded-xl hover:bg-surface-DEFAULT text-text-muted hover:text-text-primary transition-all"
          title="수정"
        >
          <Settings className="w-4 h-4" />
        </Link>
        <Link
          href={`/characters/${char.id}`}
          className="p-2 rounded-xl hover:bg-surface-DEFAULT text-text-muted hover:text-text-primary transition-all"
          title="캐릭터 페이지"
        >
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </motion.div>
  );
}

// ─── EARNINGS DASHBOARD ──────────────────────
function EarningsDashboard({ earnings }: { earnings: any }) {
  if (!earnings) return <EmptyEarnings />;

  const settlements: any[] = earnings.settlements ?? [];
  const topChars: any[] = earnings.topCharacters ?? [];

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1 text-text-muted text-xs">
            <Coins className="w-3.5 h-3.5" />이번 달 예상 수익
          </div>
          <p className="text-text-primary font-bold text-2xl">
            {formatCurrency(earnings.estimatedCurrentMonthEarnings ?? 0)}
          </p>
          <p className="text-text-muted text-xs mt-1">
            {formatCount(earnings.currentMonthChats ?? 0)}회 대화 기준
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1 text-text-muted text-xs">
            <Clock className="w-3.5 h-3.5" />미정산 수익
          </div>
          <p className="text-text-primary font-bold text-2xl text-amber-400">
            {formatCurrency(earnings.pendingEarnings ?? 0)}
          </p>
          <p className="text-text-muted text-xs mt-1">매월 1일 자동 정산</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1 text-text-muted text-xs">
            <CheckCircle2 className="w-3.5 h-3.5" />총 누적 수익
          </div>
          <p className="text-text-primary font-bold text-2xl text-emerald-400">
            {formatCurrency(earnings.totalEarnings ?? 0)}
          </p>
          <p className="text-text-muted text-xs mt-1">플랫폼 수수료 30% 제외</p>
        </div>
      </div>

      {/* Earnings info */}
      <div className="card p-4 border border-brand/20 bg-brand/5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-brand/15 flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-brand-light" />
          </div>
          <div>
            <p className="text-text-primary text-sm font-semibold mb-1">수익 계산 방식</p>
            <ul className="text-text-muted text-xs space-y-1">
              <li>• 캐릭터와의 대화 1회 = <span className="text-brand-light font-medium">10 크레딧 가치</span></li>
              <li>• 크리에이터 수익 비율: <span className="text-brand-light font-medium">70%</span> (플랫폼 30% 수수료)</li>
              <li>• 정산 주기: 매월 1일 (전월 1일~말일 기간)</li>
              <li>• 최소 정산 금액: 10,000원 (미달 시 이월)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Top characters */}
      {topChars.length > 0 && (
        <div>
          <h3 className="text-text-primary font-semibold mb-3 flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400" />
            인기 캐릭터 TOP {Math.min(topChars.length, 5)}
          </h3>
          <div className="space-y-2">
            {topChars.slice(0, 5).map((char: any, i: number) => (
              <div key={char.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-DEFAULT">
                <span className="text-text-muted text-sm font-bold w-5 text-center">{i + 1}</span>
                <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0">
                  <Image
                    src={char.avatarUrl || `https://api.dicebear.com/8.x/personas/svg?seed=${char.name}`}
                    alt={char.name}
                    width={36}
                    height={36}
                    className="object-cover w-full h-full"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-text-primary text-sm font-medium truncate">{char.name}</p>
                  <p className="text-text-muted text-xs">{formatCount(char.chatCount)}회 대화</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-emerald-400 text-sm font-semibold">
                    {formatCurrency(Math.floor(char.chatCount * 0.7 * 10))}
                  </p>
                  <p className="text-text-muted text-xs">누적 수익</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settlement history */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-text-primary font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-text-muted" />
            정산 내역
          </h3>
        </div>

        {settlements.length === 0 ? (
          <div className="card p-8 text-center">
            <Clock className="w-10 h-10 text-text-muted mx-auto mb-3" />
            <p className="text-text-secondary font-medium mb-1">아직 정산 내역이 없어요</p>
            <p className="text-text-muted text-sm">캐릭터에 대화가 쌓이면 매월 1일 자동으로 정산됩니다</p>
          </div>
        ) : (
          <div className="space-y-2">
            {settlements.map((s: any) => {
              const status = SETTLEMENT_STATUS_LABELS[s.status] ?? { label: s.status, color: 'text-text-muted bg-border' };
              return (
                <div key={s.id} className="card p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', status.color)}>
                        {status.label}
                      </span>
                      <span className="text-text-muted text-xs">
                        {new Date(s.periodStart).toLocaleDateString('ko-KR')} ~{' '}
                        {new Date(s.periodEnd).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-text-muted text-xs">
                      <span>{formatCount(s.totalChats)}회 대화</span>
                      <span>총액 {formatCurrency(s.grossAmount)}</span>
                      <span>수수료 {formatCurrency(s.platformFee)}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-text-primary font-bold text-lg">{formatCurrency(s.netAmount)}</p>
                    <p className="text-text-muted text-xs">실수령액</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ANALYTICS TAB ───────────────────────────
function AnalyticsDashboard({ characters }: { characters: any[] }) {
  const totalChats = characters.reduce((s: number, c: any) => s + c.chatCount, 0);
  const totalLikes = characters.reduce((s: number, c: any) => s + c.likeCount, 0);
  const publicCount = characters.filter((c: any) => c.visibility === 'PUBLIC').length;

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: '공개 캐릭터', value: publicCount, sub: `전체 ${characters.length}개 중`, icon: Users, color: 'text-blue-400' },
          { label: '평균 대화수', value: characters.length ? Math.floor(totalChats / characters.length) : 0, sub: '캐릭터당', icon: MessageCircle, color: 'text-purple-400' },
          { label: '좋아요/대화 비율', value: totalChats ? `${((totalLikes / totalChats) * 100).toFixed(1)}%` : '0%', sub: '참여율', icon: TrendingUp, color: 'text-emerald-400' },
        ].map((item) => (
          <div key={item.label} className="card p-4">
            <item.icon className={cn('w-5 h-5 mb-2', item.color)} />
            <p className="text-text-primary font-bold text-2xl">{item.value}</p>
            <p className="text-text-muted text-xs">{item.sub}</p>
            <p className="text-text-secondary text-sm font-medium mt-1">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Character performance table */}
      {characters.length > 0 && (
        <div>
          <h3 className="text-text-primary font-semibold mb-3">캐릭터별 성과</h3>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-text-muted font-medium px-4 py-3">캐릭터</th>
                    <th className="text-right text-text-muted font-medium px-4 py-3">대화수</th>
                    <th className="text-right text-text-muted font-medium px-4 py-3">좋아요</th>
                    <th className="text-right text-text-muted font-medium px-4 py-3 hidden md:table-cell">예상 수익</th>
                  </tr>
                </thead>
                <tbody>
                  {characters.slice(0, 10).map((char: any, i: number) => (
                    <tr key={char.id} className="border-b border-border/50 hover:bg-surface-DEFAULT/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-text-muted text-xs w-4">{i + 1}</span>
                          <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0">
                            <Image
                              src={char.avatarUrl || `https://api.dicebear.com/8.x/personas/svg?seed=${char.name}`}
                              alt={char.name}
                              width={28}
                              height={28}
                              className="object-cover w-full h-full"
                            />
                          </div>
                          <span className="text-text-primary font-medium truncate max-w-[140px]">{char.name}</span>
                        </div>
                      </td>
                      <td className="text-right px-4 py-3 text-text-secondary font-medium">
                        {formatCount(char.chatCount)}
                      </td>
                      <td className="text-right px-4 py-3 text-text-secondary">
                        {formatCount(char.likeCount)}
                      </td>
                      <td className="text-right px-4 py-3 text-emerald-400 font-medium hidden md:table-cell">
                        {formatCurrency(Math.floor(char.chatCount * 0.7 * 10))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EMPTY STATES ─────────────────────────────
function EmptyCreatorState() {
  return (
    <div className="card p-12 text-center">
      <Crown className="w-12 h-12 text-text-muted mx-auto mb-4" />
      <h3 className="text-text-primary font-semibold mb-2">첫 캐릭터를 만들어보세요</h3>
      <p className="text-text-muted text-sm mb-5">
        AI 캐릭터를 만들고 전 세계 사용자들과 공유하세요.<br />
        대화가 쌓이면 수익도 발생해요!
      </p>
      <Link href="/creator/new" className="btn-primary inline-flex items-center gap-2">
        <Plus className="w-4 h-4" /> 캐릭터 만들기
      </Link>
    </div>
  );
}

function EmptyEarnings() {
  return (
    <div className="card p-12 text-center">
      <Coins className="w-12 h-12 text-text-muted mx-auto mb-4" />
      <h3 className="text-text-primary font-semibold mb-2">아직 수익이 없어요</h3>
      <p className="text-text-muted text-sm mb-5">
        캐릭터를 만들고 공개하면 사용자들이 대화할 때마다 수익이 발생해요
      </p>
      <Link href="/creator/new" className="btn-primary inline-flex items-center gap-2">
        <Plus className="w-4 h-4" /> 캐릭터 만들기
      </Link>
    </div>
  );
}

function EarningsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card p-5">
            <div className="h-3 skeleton rounded w-2/3 mb-3" />
            <div className="h-7 skeleton rounded w-1/2" />
          </div>
        ))}
      </div>
      <div className="card p-4 h-24 skeleton" />
    </div>
  );
}
