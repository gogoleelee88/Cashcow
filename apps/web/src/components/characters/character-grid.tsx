'use client';

import { useInView } from 'react-intersection-observer';
import { useEffect } from 'react';
import { CharacterCard, CharacterCardSkeleton } from './character-card';
import type { CharacterListItem } from '@characterverse/types';

interface CharacterGridProps {
  characters: CharacterListItem[];
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  skeletonCount?: number;
  columns?: 'auto' | 2 | 3 | 4 | 5;
}

const COLUMN_CLASSES = {
  auto: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5',
  2: 'grid-cols-2',
  3: 'grid-cols-2 md:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5',
};

export function CharacterGrid({
  characters,
  isLoading = false,
  hasMore = false,
  onLoadMore,
  skeletonCount = 10,
  columns = 'auto',
}: CharacterGridProps) {
  const { ref, inView } = useInView({ threshold: 0.1 });

  useEffect(() => {
    if (inView && hasMore && onLoadMore && !isLoading) {
      onLoadMore();
    }
  }, [inView, hasMore, onLoadMore, isLoading]);

  const colClass = COLUMN_CLASSES[columns];

  return (
    <div>
      <div className={`grid ${colClass} gap-3 md:gap-4`}>
        {characters.map((character, index) => (
          <CharacterCard key={character.id} character={character} index={index} />
        ))}
        {isLoading &&
          Array.from({ length: skeletonCount }).map((_, i) => (
            <CharacterCardSkeleton key={`skeleton-${i}`} />
          ))}
      </div>

      {/* Infinite scroll sentinel */}
      {hasMore && <div ref={ref} className="h-10 mt-4" />}

      {/* Empty state */}
      {!isLoading && characters.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-4">
            <span className="text-3xl">🔍</span>
          </div>
          <p className="text-text-secondary font-medium mb-1">캐릭터를 찾을 수 없어요</p>
          <p className="text-text-muted text-sm">다른 검색어나 카테고리를 시도해보세요</p>
        </div>
      )}
    </div>
  );
}
