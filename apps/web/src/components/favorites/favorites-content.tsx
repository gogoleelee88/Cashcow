'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Heart, Star, BookmarkX } from 'lucide-react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { CharacterCard } from '../characters/character-card';
import { useAuthStore } from '../../stores/auth.store';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function FavoritesContent() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'favorites' | 'liked'>('favorites');

  const { data: favoritesData, isLoading: favLoading } = useQuery({
    queryKey: ['my-favorites'],
    queryFn: () => api.characters.getList({ sort: 'popular', limit: 50, favorited: true }),
    enabled: isAuthenticated,
  });

  const { data: likedData, isLoading: likedLoading } = useQuery({
    queryKey: ['my-liked'],
    queryFn: () => api.characters.getList({ sort: 'popular', limit: 50, liked: true }),
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <Star className="w-12 h-12 text-text-muted mb-4" />
        <h2 className="text-text-primary font-bold text-xl mb-2">로그인이 필요해요</h2>
        <p className="text-text-muted mb-5">즐겨찾기를 보려면 로그인하세요.</p>
        <Link href="/login" className="btn-primary">로그인</Link>
      </div>
    );
  }

  const characters = activeTab === 'favorites'
    ? favoritesData?.data?.items ?? []
    : likedData?.data?.items ?? [];
  const isLoading = activeTab === 'favorites' ? favLoading : likedLoading;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Star className="w-6 h-6 text-amber-400" />
        <h1 className="text-text-primary font-bold text-2xl">즐겨찾기</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-surface-DEFAULT p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('favorites')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'favorites'
              ? 'bg-brand text-white'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          <Star className="w-4 h-4 inline mr-1.5" />
          즐겨찾기
        </button>
        <button
          onClick={() => setActiveTab('liked')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'liked'
              ? 'bg-brand text-white'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          <Heart className="w-4 h-4 inline mr-1.5" />
          좋아요
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="skeleton rounded-2xl aspect-[3/4]" />
          ))}
        </div>
      ) : characters.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BookmarkX className="w-12 h-12 text-text-muted mb-4" />
          <h2 className="text-text-primary font-semibold text-lg mb-2">
            {activeTab === 'favorites' ? '즐겨찾기한 캐릭터가 없어요' : '좋아요한 캐릭터가 없어요'}
          </h2>
          <p className="text-text-muted mb-5 text-sm">마음에 드는 캐릭터를 찾아보세요!</p>
          <Link href="/" className="btn-primary">캐릭터 탐색하기</Link>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
        >
          {characters.map((character: any) => (
            <CharacterCard key={character.id} character={character} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
