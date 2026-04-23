'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { MessageCircle, Heart, Star, Zap, Crown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatCount, getCharacterAvatarUrl, CATEGORY_LABELS } from '@characterverse/utils';
import type { CharacterListItem } from '@characterverse/types';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface CharacterCardProps {
  character: CharacterListItem;
  variant?: 'default' | 'compact' | 'wide';
  index?: number;
}

export function CharacterCard({ character, variant = 'default', index = 0 }: CharacterCardProps) {
  const [isLiked, setIsLiked] = useState(character.isLiked ?? false);
  const [likeCount, setLikeCount] = useState(character.likeCount);
  const [imageError, setImageError] = useState(false);
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();

  const likeMutation = useMutation({
    mutationFn: () => api.characters.like(character.id),
    onMutate: () => {
      setIsLiked((prev) => !prev);
      setLikeCount((prev) => (isLiked ? prev - 1 : prev + 1));
    },
    onError: () => {
      setIsLiked((prev) => !prev);
      setLikeCount((prev) => (isLiked ? prev + 1 : prev - 1));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['characters'] });
    },
  });

  const handleLike = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    likeMutation.mutate();
  };

  const handleChat = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    router.push(`/chat?characterId=${character.id}`);
  };

  const avatarSrc = imageError ? null : character.avatarUrl;
  const fallbackSrc = getCharacterAvatarUrl(null, character.name);

  if (variant === 'compact') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: index * 0.03 }}
      >
        <Link href={`/characters/${character.id}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface transition-all duration-150 group">
          <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 ring-1 ring-border group-hover:ring-brand/30 transition-all">
            <Image
              src={avatarSrc || fallbackSrc}
              alt={character.name}
              width={48}
              height={48}
              className="object-cover w-full h-full"
              onError={() => setImageError(true)}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-text-primary text-sm font-medium truncate">{character.name}</p>
            <p className="text-text-muted text-xs truncate">{character.description}</p>
          </div>
          <button
            onClick={handleChat}
            className="flex-shrink-0 p-2 rounded-xl bg-brand/10 hover:bg-brand text-brand-light hover:text-white transition-all duration-200"
          >
            <MessageCircle className="w-4 h-4" />
          </button>
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      whileHover={{ y: -4 }}
      className="character-card group"
    >
      <Link href={`/characters/${character.id}`} className="block">
        {/* Image area */}
        <div className="relative aspect-[3/4] overflow-hidden">
          {/* Background gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10" />

          {/* Character image */}
          <Image
            src={avatarSrc || fallbackSrc}
            alt={character.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImageError(true)}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />

          {/* Top badges */}
          <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5">
            {character.isOfficial && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-white border border-blue-400/50">
                <Star className="w-3 h-3 fill-current" />
                공식
              </span>
            )}
            {(character as any).isFeatured && (
              <span className="badge-featured">
                <Crown className="w-3 h-3" />
                추천
              </span>
            )}
            {character.model === 'claude-sonnet-4' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-accent-purple/20 text-white border border-white/30">
                <Zap className="w-3 h-3" />
                PRO
              </span>
            )}
          </div>

          {/* Like button */}
          <button
            onClick={handleLike}
            className={cn(
              'absolute top-2.5 right-2.5 z-20 p-2 rounded-full transition-all duration-200',
              'bg-black/40 backdrop-blur-sm hover:bg-black/60',
              'opacity-0 group-hover:opacity-100',
              isLiked && 'opacity-100'
            )}
          >
            <Heart
              className={cn(
                'w-4 h-4 transition-all duration-200',
                isLiked ? 'fill-rose-500 text-rose-500 scale-110' : 'text-white/80'
              )}
            />
          </button>

          {/* Category tag */}
          <div className="absolute bottom-2.5 left-2.5 z-20">
            <span className="tag text-xs">
              {CATEGORY_LABELS[character.category]}
            </span>
          </div>
        </div>

        {/* Info area */}
        <div className="p-3">
          <h3 className="text-text-primary font-semibold text-sm mb-1 truncate">{character.name}</h3>
          <p className="text-text-muted text-xs line-clamp-2 mb-3 leading-relaxed">{character.description}</p>

          {/* Stats + Chat button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-text-muted text-xs">
              <span className="flex items-center gap-1">
                <MessageCircle className="w-3.5 h-3.5" />
                {formatCount(character.chatCount)}
              </span>
              <span className="flex items-center gap-1">
                <Heart className={cn('w-3.5 h-3.5', isLiked && 'text-rose-400')} />
                {formatCount(likeCount)}
              </span>
            </div>

            <button
              onClick={handleChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                         bg-brand/15 hover:bg-brand text-brand-light hover:text-white
                         text-xs font-medium transition-all duration-200 hover:shadow-brand"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              대화
            </button>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────
export function CharacterCardSkeleton() {
  return (
    <div className="character-card overflow-hidden">
      <div className="aspect-[3/4] skeleton" />
      <div className="p-3 space-y-2">
        <div className="h-4 skeleton rounded-lg w-3/4" />
        <div className="h-3 skeleton rounded-lg w-full" />
        <div className="h-3 skeleton rounded-lg w-2/3" />
        <div className="flex items-center justify-between mt-3">
          <div className="h-3 skeleton rounded-lg w-20" />
          <div className="h-7 skeleton rounded-lg w-14" />
        </div>
      </div>
    </div>
  );
}
