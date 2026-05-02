'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { api } from '../../lib/api';
import {
  Heart, Download, ZoomIn, ImageOff, Sparkles,
  X, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ImageItem {
  id: string;
  urls: string[];
  prompt: string;
  style?: string | null;
  ratio: string;
  type: 'GENERATE' | 'TRANSFORM';
  isLiked: boolean;
  creditsUsed: number;
  createdAt: string;
}

interface LibraryTabProps {
  mode: 'library' | 'liked';
  onNavigateToNew?: () => void;
  refreshKey?: number;
}

// ── 메인 탭 컴포넌트 ──────────────────────────────────────────────────────────
export function ImageLibraryTab({ mode, onNavigateToNew, refreshKey = 0 }: LibraryTabProps) {
  const [items, setItems]             = useState<ImageItem[]>([]);
  const [loading, setLoading]         = useState(false);
  const [hasMore, setHasMore]         = useState(true);
  const [lightbox, setLightbox]       = useState<{ urls: string[]; idx: number } | null>(null);

  const sentinelRef    = useRef<HTMLDivElement>(null);
  const loadingRef     = useRef(false);
  const nextCursorRef  = useRef<string | null>(null);
  const hasMoreRef     = useRef(true);
  const mountedRef     = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadItems = useCallback(async (cursor?: string) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const params: { limit: number; cursor?: string } = { limit: 24 };
      if (cursor) params.cursor = cursor;

      const res = mode === 'library'
        ? await api.images.getLibrary(params)
        : await api.images.getLiked(params);

      if (!mountedRef.current) return;
      const { items: newItems, nextCursor: nc } = res.data;

      setItems(prev => cursor ? [...prev, ...newItems] : newItems);
      nextCursorRef.current = nc ?? null;
      hasMoreRef.current    = !!nc;
      setHasMore(!!nc);
    } catch {
      /* silent */
    } finally {
      if (mountedRef.current) setLoading(false);
      loadingRef.current = false;
    }
  }, [mode]);

  // mode 또는 refreshKey 변경 시 리셋 후 재로드
  useEffect(() => {
    setItems([]);
    nextCursorRef.current = null;
    hasMoreRef.current    = true;
    setHasMore(true);
    loadItems();
  }, [mode, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // 무한 스크롤 - IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMoreRef.current && !loadingRef.current) {
          loadItems(nextCursorRef.current ?? undefined);
        }
      },
      { rootMargin: '400px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadItems]);

  // 낙관적 좋아요 토글
  const handleLike = async (id: string) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, isLiked: !item.isLiked } : item,
    ));
    try {
      await api.images.toggleLike(id);
      if (mode === 'liked') {
        // 좋아요 탭에서 취소하면 카드 제거 (애니메이션 후)
        setTimeout(() => {
          setItems(prev => prev.filter(item => item.id !== id));
        }, 250);
      }
    } catch {
      setItems(prev => prev.map(item =>
        item.id === id ? { ...item, isLiked: !item.isLiked } : item,
      ));
    }
  };

  const handleDownload = useCallback(async (url: string) => {
    try {
      const r = await fetch(url, { mode: 'cors' });
      const blob = await r.blob();
      const obj = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = obj; a.download = `photocard-${Date.now()}.png`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(obj);
    } catch {
      window.open(url, '_blank');
    }
  }, []);

  // ── 빈 상태 ──
  if (!loading && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-72 gap-5">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
          <ImageOff className="w-7 h-7 text-gray-300" />
        </div>
        <div className="text-center">
          <p className="text-gray-700 font-bold text-sm mb-1">
            {mode === 'library' ? '생성된 포토카드가 없어요' : '좋아요한 포토카드가 없어요'}
          </p>
          <p className="text-gray-400 text-xs leading-relaxed">
            {mode === 'library'
              ? '신규 생성 탭에서 포토카드를 만들어보세요'
              : '라이브러리에서 마음에 드는 포토카드에 좋아요를 눌러보세요'}
          </p>
        </div>
        {mode === 'library' && onNavigateToNew && (
          <button
            onClick={onNavigateToNew}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-brand text-white text-sm font-bold hover:brightness-110 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            포토카드 생성하기
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Masonry 그리드 */}
      <div className="columns-2 lg:columns-3 xl:columns-4 gap-3">
        {items.map(item => (
          <ImageCard
            key={item.id}
            item={item}
            onLike={handleLike}
            onDownload={handleDownload}
            onZoom={(urls, idx) => setLightbox({ urls, idx })}
          />
        ))}

        {/* 로딩 스켈레톤 */}
        {loading && Array.from({ length: 8 }).map((_, i) => (
          <div
            key={`sk-${i}`}
            className="break-inside-avoid mb-3 rounded-2xl bg-gray-100 animate-pulse"
            style={{ height: 160 + (i % 5) * 44 }}
          />
        ))}
      </div>

      {/* 무한 스크롤 트리거 */}
      <div ref={sentinelRef} className="h-8" />

      {/* 라이트박스 */}
      <AnimatePresence>
        {lightbox && (
          <Lightbox
            urls={lightbox.urls}
            initialIdx={lightbox.idx}
            onClose={() => setLightbox(null)}
            onDownload={handleDownload}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ── 이미지 카드 ───────────────────────────────────────────────────────────────
function ImageCard({ item, onLike, onDownload, onZoom }: {
  item: ImageItem;
  onLike: (id: string) => void;
  onDownload: (url: string) => void;
  onZoom: (urls: string[], idx: number) => void;
}) {
  const hasMultiple = item.urls.length > 1;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="break-inside-avoid mb-3 rounded-2xl overflow-hidden relative group shadow-sm hover:shadow-xl transition-shadow duration-300 bg-gray-100 cursor-pointer"
      onClick={() => onZoom(item.urls, 0)}
    >
      {hasMultiple ? (
        <div className="grid grid-cols-2 gap-0.5">
          {item.urls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={url} alt="" className="w-full aspect-square object-cover" loading="lazy" />
          ))}
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.urls[0]} alt={item.prompt} className="w-full block" loading="lazy" />
      )}

      {/* 호버 오버레이 */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/25 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-3 pointer-events-none group-hover:pointer-events-auto">
        {/* 상단 액션 버튼 */}
        <div className="flex justify-end gap-1.5">
          <button
            onClick={e => { e.stopPropagation(); onZoom(item.urls, 0); }}
            className="w-8 h-8 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/75 transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); item.urls.forEach(url => onDownload(url)); }}
            className="w-8 h-8 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/75 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onLike(item.id); }}
            className={cn(
              'w-8 h-8 rounded-full backdrop-blur-sm flex items-center justify-center transition-all duration-200',
              item.isLiked
                ? 'bg-brand text-white scale-110'
                : 'bg-black/55 text-white hover:bg-brand/80',
            )}
          >
            <Heart className={cn('w-3.5 h-3.5 transition-all', item.isLiked && 'fill-white')} />
          </button>
        </div>

        {/* 하단 정보 */}
        <div>
          {item.style && (
            <span className="inline-block text-[10px] bg-white/20 backdrop-blur-sm text-white px-2 py-0.5 rounded-full font-semibold mb-1.5">
              {item.style}
            </span>
          )}
          <p className="text-white/90 text-xs line-clamp-2 leading-relaxed">{item.prompt}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ── 라이트박스 ────────────────────────────────────────────────────────────────
function Lightbox({ urls, initialIdx, onClose, onDownload }: {
  urls: string[];
  initialIdx: number;
  onClose: () => void;
  onDownload: (url: string) => void;
}) {
  const [idx, setIdx] = useState(initialIdx);
  const prev = () => setIdx(i => Math.max(0, i - 1));
  const next = () => setIdx(i => Math.min(urls.length - 1, i + 1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/88 z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div className="relative flex items-center gap-4" onClick={e => e.stopPropagation()}>
        {urls.length > 1 && (
          <button
            onClick={prev} disabled={idx === 0}
            className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white disabled:opacity-25 transition-all flex-shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        <motion.div key={idx} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={urls[idx]} alt=""
            className="max-w-[78vw] max-h-[82vh] rounded-2xl shadow-2xl object-contain"
          />
          <div className="absolute top-3 right-3 flex gap-2">
            <button
              onClick={() => onDownload(urls[idx])}
              className="w-9 h-9 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/75 transition-colors"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/75 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 인디케이터 */}
          {urls.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {urls.map((_, i) => (
                <button
                  key={i} onClick={() => setIdx(i)}
                  className={cn('h-1.5 rounded-full transition-all duration-200', i === idx ? 'bg-white w-5' : 'bg-white/40 w-1.5')}
                />
              ))}
            </div>
          )}
        </motion.div>

        {urls.length > 1 && (
          <button
            onClick={next} disabled={idx === urls.length - 1}
            className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white disabled:opacity-25 transition-all flex-shrink-0"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
