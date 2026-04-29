'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface FeaturedPost {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  bannerImageUrl: string | null;
  category: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  NOTICE: '공지', UPDATE: '업데이트', EVENT: '이벤트', MAINTENANCE: '점검',
};

const INTERVAL = 4000;

export function AnnouncementSlider() {
  const [posts, setPosts] = useState<FeaturedPost[]>([]);
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
    fetch(`${base}/api/posts/featured`)
      .then(r => r.json())
      .then(d => { if (d.success) setPosts(d.data); })
      .catch(() => {});
  }, []);

  const next = useCallback(() => setCurrent(c => (c + 1) % posts.length), [posts.length]);
  const prev = useCallback(() => setCurrent(c => (c - 1 + posts.length) % posts.length), [posts.length]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(next, INTERVAL);
  }, [next]);

  useEffect(() => {
    if (posts.length <= 1) return;
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [posts.length, resetTimer]);

  if (posts.length === 0) return null;

  const post = posts[current];

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-gray-900 select-none"
      style={{ aspectRatio: '16/5' }}>

      {/* 배경 이미지 */}
      {post.bannerImageUrl ? (
        <Image
          key={post.id}
          src={post.bannerImageUrl}
          alt={post.title}
          fill
          className="object-cover transition-opacity duration-700"
          priority
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900" />
      )}

      {/* 어두운 그라디언트 오버레이 */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

      {/* 콘텐츠 — 하단 컨트롤 바 높이만큼 pb 확보 */}
      <Link
        href={`/notices/${post.slug}`}
        className={`absolute inset-0 flex flex-col justify-end px-6 pt-6 ${posts.length > 1 ? 'pb-11' : 'pb-6'}`}
      >
        <div className="max-w-2xl">
          <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-full bg-white/20 text-white/90 backdrop-blur-sm mb-2">
            {CATEGORY_LABELS[post.category] ?? post.category}
          </span>
          <h2 className="text-white font-bold text-xl md:text-2xl leading-snug line-clamp-2">{post.title}</h2>
          {post.subtitle && (
            <p className="text-white/70 text-sm mt-1 line-clamp-1">{post.subtitle}</p>
          )}
        </div>
      </Link>

      {/* 하단 컨트롤 바 — 이전/다음 + 점 인디케이터 + 페이지 번호 */}
      {posts.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center gap-2 px-4 py-2.5">
          {/* 이전 */}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); prev(); resetTimer(); }}
            className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white transition-colors backdrop-blur-sm flex-shrink-0"
            aria-label="이전"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* 점 인디케이터 */}
          <div className="flex items-center gap-1.5 flex-1 justify-center">
            {posts.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrent(i); resetTimer(); }}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === current ? 'w-5 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/60'}`}
                aria-label={`${i + 1}번째 슬라이드`}
              />
            ))}
          </div>

          {/* 페이지 번호 */}
          <span className="text-xs text-white/60 font-medium tabular-nums flex-shrink-0">
            {current + 1}/{posts.length}
          </span>

          {/* 다음 */}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); next(); resetTimer(); }}
            className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white transition-colors backdrop-blur-sm flex-shrink-0"
            aria-label="다음"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
