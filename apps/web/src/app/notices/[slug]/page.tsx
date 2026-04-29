'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Eye, Calendar, Pin } from 'lucide-react';
import { MainLayout } from '../../../components/layout/main-layout';
import { RichContent } from '../../../components/editor/RichContent';

const CATEGORY_LABELS: Record<string, string> = {
  NOTICE: '공지', UPDATE: '업데이트', EVENT: '이벤트', MAINTENANCE: '점검',
};
const CATEGORY_COLORS: Record<string, string> = {
  NOTICE: 'bg-blue-100 text-blue-700',
  UPDATE: 'bg-green-100 text-green-700',
  EVENT: 'bg-purple-100 text-purple-700',
  MAINTENANCE: 'bg-orange-100 text-orange-700',
};

export default function NoticeDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const router = useRouter();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
    fetch(`${base}/api/posts/${slug}`)
      .then(r => r.json())
      .then(data => {
        if (!data.success) { setNotFound(true); return; }
        setPost(data.data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return (
    <MainLayout showSearch={false}>
      <div className="max-w-3xl mx-auto px-4 py-16 space-y-4">
        <div className="skeleton h-12 w-3/4 rounded-xl" />
        <div className="skeleton h-80 rounded-2xl" />
        <div className="skeleton h-6 rounded w-full" />
        <div className="skeleton h-6 rounded w-5/6" />
      </div>
    </MainLayout>
  );

  if (notFound) return (
    <MainLayout showSearch={false}>
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-text-muted text-lg">게시글을 찾을 수 없습니다</p>
        <button onClick={() => router.push('/notices')} className="mt-4 text-brand hover:underline text-sm">← 공지 목록으로</button>
      </div>
    </MainLayout>
  );

  return (
    <MainLayout showSearch={false}>
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* 뒤로가기 */}
        <button onClick={() => router.push('/notices')}
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          공지 목록으로
        </button>

        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            {post.isPinned && <Pin className="w-4 h-4 text-orange-500" />}
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${CATEGORY_COLORS[post.category] ?? 'bg-gray-100 text-gray-600'}`}>
              {CATEGORY_LABELS[post.category] ?? post.category}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-text-primary leading-tight">{post.title}</h1>
          {post.subtitle && (
            <p className="text-lg text-text-muted mt-3">{post.subtitle}</p>
          )}
          <div className="flex items-center gap-4 mt-4 text-sm text-text-muted">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {new Date(post.publishedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
            <span className="flex items-center gap-1.5">
              <Eye className="w-4 h-4" />
              {post.viewCount.toLocaleString()}회
            </span>
          </div>
        </div>

        {/* 배너 이미지 */}
        {post.bannerImageUrl && (
          <div className="relative w-full h-72 rounded-2xl overflow-hidden mb-8 shadow-lg">
            <Image src={post.bannerImageUrl} alt={post.title} fill className="object-cover" />
          </div>
        )}

        {/* 본문 */}
        <div className="bg-white rounded-2xl border border-border p-8">
          <RichContent content={post.content} />
        </div>

        {/* 하단 */}
        <div className="mt-10 pt-6 border-t border-border text-center">
          <button onClick={() => router.push('/notices')}
            className="text-sm text-text-muted hover:text-text-primary transition-colors">
            ← 전체 공지 보기
          </button>
        </div>
      </div>
    </MainLayout>
  );
}
