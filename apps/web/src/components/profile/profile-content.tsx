'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { MessageCircle, Heart, Users, Crown, Globe, UserPlus, UserMinus, Calendar, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { CharacterCard } from '../characters/character-card';
import { useAuthStore } from '../../stores/auth.store';
import { formatCount, formatDate } from '@characterverse/utils';
import { cn } from '../../lib/utils';
import { useState } from 'react';

export function ProfileContent({ username }: { username: string }) {
  const { isAuthenticated, user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'characters' | 'stats'>('characters');

  const { data, isLoading, error } = useQuery({
    queryKey: ['profile', username],
    queryFn: () => api.get(`/users/${username}/profile`),
  });

  const followMutation = useMutation({
    mutationFn: () => api.post(`/users/${username}/follow`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile', username] }),
  });

  const unfollowMutation = useMutation({
    mutationFn: () => api.delete(`/users/${username}/follow`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile', username] }),
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="skeleton rounded-3xl h-48 mb-6" />
        <div className="flex gap-6">
          <div className="skeleton rounded-full w-24 h-24 flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="skeleton rounded-lg h-6 w-48" />
            <div className="skeleton rounded-lg h-4 w-64" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !(data as any)?.data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <AlertCircle className="w-12 h-12 text-text-muted mb-4" />
        <h2 className="text-text-primary font-bold text-xl mb-2">사용자를 찾을 수 없어요</h2>
        <Link href="/" className="btn-primary">홈으로</Link>
      </div>
    );
  }

  const profile = (data as any).data;
  const isOwnProfile = currentUser?.username === username;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Cover */}
      <div className="h-40 rounded-3xl bg-gradient-to-br from-brand/30 via-purple-600/20 to-brand-light/20 border border-border mb-0 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(124,92,252,0.3),transparent_70%)]" />
      </div>

      {/* Profile header */}
      <div className="px-6 pb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 -mt-12">
          <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-background flex-shrink-0 bg-brand/20">
            {profile.avatarUrl ? (
              <Image src={profile.avatarUrl} alt={profile.displayName} width={96} height={96} className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-brand font-bold text-3xl">
                {profile.displayName[0]}
              </div>
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-text-primary font-bold text-2xl">{profile.displayName}</h1>
              {profile.subscription && (
                <Crown className="w-5 h-5 text-amber-400" />
              )}
            </div>
            <p className="text-text-muted text-sm">@{profile.username}</p>
          </div>
          {isAuthenticated && !isOwnProfile && (
            <button
              onClick={() => profile.isFollowing ? unfollowMutation.mutate() : followMutation.mutate()}
              disabled={followMutation.isPending || unfollowMutation.isPending}
              className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                profile.isFollowing
                  ? 'btn-secondary text-text-muted'
                  : 'btn-primary'
              )}
            >
              {profile.isFollowing ? <><UserMinus className="w-4 h-4" />팔로잉</> : <><UserPlus className="w-4 h-4" />팔로우</>}
            </button>
          )}
          {isOwnProfile && (
            <Link href="/settings" className="btn-secondary text-sm">프로필 수정</Link>
          )}
        </div>

        {profile.bio && (
          <p className="text-text-secondary text-sm mt-4 leading-relaxed">{profile.bio}</p>
        )}

        {/* Stats */}
        <div className="flex flex-wrap gap-5 mt-5">
          <div className="flex items-center gap-1.5 text-sm text-text-muted">
            <Crown className="w-4 h-4 text-brand" />
            <span className="text-text-primary font-semibold">{formatCount(profile.characterCount ?? 0)}</span>캐릭터
          </div>
          <div className="flex items-center gap-1.5 text-sm text-text-muted">
            <MessageCircle className="w-4 h-4" />
            <span className="text-text-primary font-semibold">{formatCount(profile.totalChatCount ?? 0)}</span>총 대화
          </div>
          <div className="flex items-center gap-1.5 text-sm text-text-muted">
            <Users className="w-4 h-4" />
            <span className="text-text-primary font-semibold">{formatCount(profile.followerCount ?? 0)}</span>팔로워
          </div>
          <div className="flex items-center gap-1.5 text-sm text-text-muted">
            <Calendar className="w-4 h-4" />
            {formatDate(profile.createdAt)} 가입
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border px-6">
        {(['characters', 'stats'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn('px-4 py-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab
                ? 'border-brand text-brand'
                : 'border-transparent text-text-muted hover:text-text-primary'
            )}
          >
            {tab === 'characters' ? '만든 캐릭터' : '통계'}
          </button>
        ))}
      </div>

      <div className="px-6">
        {activeTab === 'characters' && (
          <div>
            {(profile.characters ?? []).length === 0 ? (
              <div className="text-center py-16 text-text-muted">
                <Crown className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>아직 만든 캐릭터가 없어요.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {profile.characters.map((character: any) => (
                  <CharacterCard key={character.id} character={character} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: '총 대화 수', value: formatCount(profile.totalChatCount ?? 0), icon: MessageCircle, color: 'text-blue-400' },
              { label: '총 좋아요', value: formatCount(profile.totalLikeCount ?? 0), icon: Heart, color: 'text-rose-400' },
              { label: '만든 캐릭터', value: formatCount(profile.characterCount ?? 0), icon: Crown, color: 'text-brand' },
              { label: '팔로워', value: formatCount(profile.followerCount ?? 0), icon: Users, color: 'text-emerald-400' },
            ].map((stat) => (
              <div key={stat.label} className="card p-5">
                <stat.icon className={cn('w-6 h-6 mb-3', stat.color)} />
                <p className="text-text-primary font-bold text-2xl">{stat.value}</p>
                <p className="text-text-muted text-sm mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
