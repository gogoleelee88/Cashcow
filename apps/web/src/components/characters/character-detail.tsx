'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  MessageCircle, Heart, Star, Share2, ChevronLeft,
  Crown, Globe, Lock, Users, Sparkles, Tag, AlertCircle
} from 'lucide-react';
import { api } from '../../lib/api';
import { formatCount, formatDate, CATEGORY_LABELS, getCharacterAvatarUrl } from '@characterverse/utils';
import { useAuthStore } from '../../stores/auth.store';
import { cn } from '../../lib/utils';
import { useState } from 'react';
import { toast } from '../ui/toaster';

export function CharacterDetailContent({ characterId }: { characterId: string }) {
  const [imageError, setImageError] = useState(false);
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();

  const { data, isLoading, error } = useQuery({
    queryKey: ['character', characterId],
    queryFn: () => api.characters.get(characterId),
  });

  const startChatMutation = useMutation({
    mutationFn: () => api.chat.createConversation(characterId),
    onSuccess: (res) => {
      router.push(`/chat?conversationId=${res.data.id}`);
    },
    onError: (err: any) => {
      const code = err.response?.data?.error?.code;
      if (code === 'AGE_VERIFICATION_REQUIRED') {
        toast.error('성인 인증 필요', '이 캐릭터는 성인 인증이 필요합니다.');
      } else if (code === 'INSUFFICIENT_CREDITS') {
        toast.error('크레딧 부족', '크레딧을 충전해주세요.');
        router.push('/settings/credits');
      } else {
        toast.error('오류', '대화를 시작할 수 없습니다.');
      }
    },
  });

  const likeMutation = useMutation({
    mutationFn: () => api.characters.like(characterId),
  });

  const handleStartChat = () => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=/characters/${characterId}`);
      return;
    }
    startChatMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex gap-8">
          <div className="w-64 h-80 rounded-2xl skeleton flex-shrink-0" />
          <div className="flex-1 space-y-4">
            <div className="h-8 skeleton rounded-xl w-1/2" />
            <div className="h-4 skeleton rounded-lg w-full" />
            <div className="h-4 skeleton rounded-lg w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <AlertCircle className="w-12 h-12 text-text-muted mb-4" />
        <h2 className="text-text-primary font-bold text-xl mb-2">캐릭터를 찾을 수 없어요</h2>
        <p className="text-text-muted mb-5">삭제되었거나 비공개 캐릭터입니다.</p>
        <Link href="/" className="btn-primary">홈으로 돌아가기</Link>
      </div>
    );
  }

  const character = data.data;
  const avatarSrc = imageError ? null : character.avatarUrl;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back button */}
      <Link href="/" className="inline-flex items-center gap-2 text-text-muted hover:text-text-primary text-sm mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" />
        뒤로가기
      </Link>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Avatar */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full md:w-72 flex-shrink-0"
        >
          <div className="relative aspect-square rounded-2xl overflow-hidden shadow-card border border-border">
            <Image
              src={avatarSrc || getCharacterAvatarUrl(null, character.name)}
              alt={character.name}
              fill
              className="object-cover"
              onError={() => setImageError(true)}
              priority
            />
            {character.isFeatured && (
              <div className="absolute top-3 left-3 badge-featured">
                <Crown className="w-3.5 h-3.5" />
                추천
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="mt-4 space-y-2.5">
            <button
              onClick={handleStartChat}
              disabled={startChatMutation.isPending}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base"
            >
              <MessageCircle className="w-5 h-5" />
              {startChatMutation.isPending ? '시작 중...' : '대화 시작'}
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  if (!isAuthenticated) { router.push('/login'); return; }
                  likeMutation.mutate();
                }}
                className={cn('btn-secondary flex items-center justify-center gap-2',
                  data.data.isLiked && 'border-rose-500/30 text-rose-400')}
              >
                <Heart className={cn('w-4 h-4', data.data.isLiked && 'fill-rose-400')} />
                {formatCount(character.likeCount)}
              </button>
              <button
                onClick={() => {
                  navigator.share?.({
                    title: character.name,
                    text: character.description,
                    url: window.location.href,
                  }) || navigator.clipboard.writeText(window.location.href).then(() => toast.success('링크 복사됨'));
                }}
                className="btn-secondary flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                공유
              </button>
            </div>
          </div>
        </motion.div>

        {/* Info */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex-1 min-w-0"
        >
          <div className="flex items-start gap-3 mb-3">
            <h1 className="text-text-primary font-bold text-3xl">{character.name}</h1>
            {character.model === 'claude-sonnet-4' && (
              <span className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                <Sparkles className="w-3 h-3" />PRO
              </span>
            )}
          </div>

          <p className="text-text-secondary text-base leading-relaxed mb-5">{character.description}</p>

          {/* Stats row */}
          <div className="flex items-center gap-5 mb-6 text-sm">
            <span className="flex items-center gap-1.5 text-text-muted">
              <MessageCircle className="w-4 h-4" />
              {formatCount(character.chatCount)} 대화
            </span>
            <span className="flex items-center gap-1.5 text-text-muted">
              <Heart className="w-4 h-4" />
              {formatCount(character.likeCount)} 좋아요
            </span>
            <span className="flex items-center gap-1.5 text-text-muted">
              {character.visibility === 'PUBLIC' ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              {character.visibility === 'PUBLIC' ? '공개' : '비공개'}
            </span>
          </div>

          {/* Tags */}
          {character.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {character.tags.map((tag: string) => (
                <Link key={tag} href={`/explore?q=${encodeURIComponent(tag)}`}>
                  <span className="tag hover:bg-brand/25 transition-colors cursor-pointer">
                    <Tag className="w-3 h-3 mr-0.5" />#{tag}
                  </span>
                </Link>
              ))}
            </div>
          )}

          {/* Category */}
          <div className="card p-4 mb-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-text-muted block mb-0.5 text-xs">카테고리</span>
                <span className="text-text-primary font-medium">{CATEGORY_LABELS[character.category]}</span>
              </div>
              <div>
                <span className="text-text-muted block mb-0.5 text-xs">연령 등급</span>
                <span className={cn('font-medium',
                  character.ageRating === 'MATURE' ? 'text-red-400' :
                    character.ageRating === 'TEEN' ? 'text-amber-400' : 'text-emerald-400'
                )}>
                  {character.ageRating === 'ALL' ? '전체이용가' : character.ageRating === 'TEEN' ? '청소년 이용가' : '성인'}
                </span>
              </div>
              <div>
                <span className="text-text-muted block mb-0.5 text-xs">언어</span>
                <span className="text-text-primary font-medium">{character.language === 'ko' ? '한국어' : character.language}</span>
              </div>
              <div>
                <span className="text-text-muted block mb-0.5 text-xs">등록일</span>
                <span className="text-text-primary font-medium">{formatDate(character.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Creator */}
          {character.creator && (
            <Link href={`/profile/${character.creator.username}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-DEFAULT transition-all border border-border">
              <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-border flex-shrink-0">
                {character.creator.avatarUrl ? (
                  <Image src={character.creator.avatarUrl} alt={character.creator.displayName} width={36} height={36} className="object-cover" />
                ) : (
                  <div className="w-full h-full bg-brand/20 flex items-center justify-center text-brand font-bold text-sm">
                    {character.creator.displayName[0]}
                  </div>
                )}
              </div>
              <div>
                <p className="text-text-primary text-sm font-medium">{character.creator.displayName}</p>
                <p className="text-text-muted text-xs">@{character.creator.username}</p>
              </div>
              <Crown className="w-4 h-4 text-amber-400 ml-auto" />
            </Link>
          )}

          {/* Greeting preview */}
          {character.greeting && (
            <div className="mt-4">
              <p className="text-text-muted text-xs mb-2 font-semibold uppercase tracking-wide">첫 인사말</p>
              <div className="card p-4 border-l-4 border-brand/40">
                <p className="text-text-secondary text-sm leading-relaxed italic">"{character.greeting}"</p>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
