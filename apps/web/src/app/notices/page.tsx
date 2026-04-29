'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Pin, Eye, Calendar, ChevronRight } from 'lucide-react';
import { apiClient } from '../../lib/api';
import { MainLayout } from '../../components/layout/main-layout';

interface Post {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  bannerImageUrl: string | null;
  category: string;
  isPinned: boolean;
  viewCount: number;
  publishedAt: string;
}

const CATEGORIES = ['ALL', 'NOTICE', 'UPDATE', 'EVENT', 'MAINTENANCE'] as const;
const CATEGORY_LABELS: Record<string, string> = {
  ALL: '전체', NOTICE: '공지', UPDATE: '업데이트', EVENT: '이벤트', MAINTENANCE: '점검',
};
const CATEGORY_COLORS: Record<string, string> = {
  NOTICE: 'bg-blue-100 text-blue-700',
  UPDATE: 'bg-green-100 text-green-700',
  EVENT: 'bg-purple-100 text-purple-700',
  MAINTENANCE: 'bg-orange-100 text-orange-700',
};

export default function NoticesPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [category, setCategory] = useState<typeof CATEGORIES[number]>('ALL');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const p = reset ? 1 : page;
      const res = await apiClient.get('/api/posts', { params: { page: String(p), limit: '12', category } });
      const data = res.data?.data;
      const newPosts = data?.posts ?? [];
      const totalPages = data?.totalPages ?? 1;

      setPosts(reset ? newPosts : prev => [...prev, ...newPosts]);
      setHasMore(p < totalPages);
      if (!reset) setPage(p + 1);
    } finally {
      setLoading(false);
    }
  }, [page, category]);

  useEffect(() => {
    setPage(1);
    setPosts([]);
    fetchPosts(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  return (
    <MainLayout showSearch={false}>
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary">공지사항</h1>
          <p className="text-text-muted mt-2">CharacterVerse의 새로운 소식을 확인하세요</p>
        </div>

        {/* 카테고리 필터 */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-1">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategory(c)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                category === c
                  ? 'bg-gray-900 text-white'
                  : 'bg-surface text-text-muted hover:bg-surface-hover hover:text-text-primary border border-border'
              }`}>
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>

        {/* 포스트 목록 */}
        {loading && posts.length === 0 ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-28 rounded-2xl" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 text-text-muted">
            <p className="text-lg font-medium">게시글이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <Link key={post.id} href={`/notices/${post.slug}`}
                className="group flex gap-4 p-5 bg-white rounded-2xl border border-border hover:border-brand/30 hover:shadow-md transition-all">
                {/* 배너 썸네일 */}
                {post.bannerImageUrl && (
                  <div className="w-28 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-surface">
                    <Image src={post.bannerImageUrl} alt={post.title} width={112} height={80} className="object-cover w-full h-full" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    {post.isPinned && <Pin className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />}
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[post.category] ?? 'bg-gray-100 text-gray-600'}`}>
                      {CATEGORY_LABELS[post.category] ?? post.category}
                    </span>
                  </div>
                  <h3 className="font-semibold text-text-primary group-hover:text-brand transition-colors line-clamp-1">{post.title}</h3>
                  {post.subtitle && <p className="text-sm text-text-muted mt-0.5 line-clamp-1">{post.subtitle}</p>}
                  <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />
                      {new Date(post.publishedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                    <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{post.viewCount.toLocaleString()}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-brand self-center flex-shrink-0 transition-colors" />
              </Link>
            ))}
          </div>
        )}

        {hasMore && !loading && (
          <div className="text-center mt-8">
            <button onClick={() => fetchPosts()}
              className="px-6 py-2.5 text-sm font-medium text-text-secondary border border-border rounded-xl hover:bg-surface transition-colors">
              더 보기
            </button>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
