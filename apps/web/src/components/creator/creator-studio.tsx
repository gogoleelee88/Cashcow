'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Plus, Crown, TrendingUp, MessageCircle, Heart, Eye, Settings, BarChart3, ArrowRight } from 'lucide-react';
import { api } from '../../lib/api';
import { formatCount, formatRelativeTime } from '@characterverse/utils';
import { useAuthStore } from '../../stores/auth.store';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { cn } from '../../lib/utils';

export function CreatorStudio() {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) router.push('/login?redirect=/creator');
  }, [isAuthenticated, router]);

  const { data: myCharsData, isLoading } = useQuery({
    queryKey: ['characters', 'my'],
    queryFn: () => api.characters.my({ limit: 50 }),
    enabled: isAuthenticated,
  });

  const characters = myCharsData?.data ?? [];
  const totalChats = characters.reduce((sum: number, c: any) => sum + c.chatCount, 0);
  const totalLikes = characters.reduce((sum: number, c: any) => sum + c.likeCount, 0);

  if (!isAuthenticated) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Crown className="w-5 h-5 text-amber-400" />
            <h1 className="text-text-primary font-bold text-2xl">크리에이터 스튜디오</h1>
          </div>
          <p className="text-text-muted text-sm">캐릭터를 만들고 관리하세요</p>
        </div>
        <Link href="/creator/new" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          새 캐릭터
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          { label: '내 캐릭터', value: characters.length, icon: Crown, color: 'text-amber-400' },
          { label: '총 대화수', value: totalChats, icon: MessageCircle, color: 'text-blue-400' },
          { label: '총 좋아요', value: totalLikes, icon: Heart, color: 'text-rose-400' },
          { label: '크레딧 잔액', value: user?.creditBalance || 0, icon: BarChart3, color: 'text-brand-light' },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={cn('w-4 h-4', stat.color)} />
              <span className="text-text-muted text-xs">{stat.label}</span>
            </div>
            <p className="text-text-primary font-bold text-2xl">{formatCount(stat.value)}</p>
          </motion.div>
        ))}
      </div>

      {/* Characters list */}
      <div>
        <h2 className="text-text-primary font-semibold text-lg mb-4">내 캐릭터</h2>

        {isLoading ? (
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
          <div className="card p-12 text-center">
            <Crown className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <h3 className="text-text-primary font-semibold mb-2">첫 캐릭터를 만들어보세요</h3>
            <p className="text-text-muted text-sm mb-5">AI 캐릭터를 만들고 전 세계 사용자들과 공유하세요</p>
            <Link href="/creator/new" className="btn-primary inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> 캐릭터 만들기
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {characters.map((char: any, i: number) => (
              <motion.div
                key={char.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card p-4 flex items-center gap-4 hover:border-brand/30 transition-all"
              >
                <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0">
                  <Image
                    src={char.avatarUrl || `https://api.dicebear.com/8.x/personas/svg?seed=${char.name}`}
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
                      'text-xs px-2 py-0.5 rounded-full',
                      char.visibility === 'PUBLIC' ? 'bg-emerald-500/15 text-emerald-400' :
                        char.visibility === 'UNLISTED' ? 'bg-amber-500/15 text-amber-400' :
                          'bg-border text-text-muted'
                    )}>
                      {char.visibility === 'PUBLIC' ? '공개' : char.visibility === 'UNLISTED' ? '링크 공유' : '비공개'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-text-muted text-xs">
                    <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{formatCount(char.chatCount)}</span>
                    <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{formatCount(char.likeCount)}</span>
                    <span>{formatRelativeTime(char.createdAt)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link
                    href={`/creator/edit/${char.id}`}
                    className="p-2 rounded-xl hover:bg-surface text-text-muted hover:text-text-primary transition-all"
                  >
                    <Settings className="w-4 h-4" />
                  </Link>
                  <Link
                    href={`/characters/${char.id}`}
                    className="p-2 rounded-xl hover:bg-surface text-text-muted hover:text-text-primary transition-all"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
