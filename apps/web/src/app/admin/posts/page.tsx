'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Edit2, Trash2, Eye, Pin, Star } from 'lucide-react';
import { adminApi } from '../../../lib/admin-api';
import { Badge } from '../../../components/admin/common/Badge';
import { Pagination } from '../../../components/admin/common/Pagination';

interface Post {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  bannerImageUrl: string | null;
  category: string;
  status: string;
  isPinned: boolean;
  isFeatured: boolean;
  viewCount: number;
  publishedAt: string | null;
  createdAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  NOTICE: '공지', UPDATE: '업데이트', EVENT: '이벤트', MAINTENANCE: '점검',
};
const CATEGORY_COLORS: Record<string, string> = {
  NOTICE: 'bg-blue-50 text-blue-600',
  UPDATE: 'bg-green-50 text-green-600',
  EVENT: 'bg-purple-50 text-purple-600',
  MAINTENANCE: 'bg-orange-50 text-orange-600',
};

export default function AdminPostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.get('/posts', { params: { page: String(page), limit: String(limit) } });
      setPosts(res.data.data.posts);
      setTotalPages(res.data.data.totalPages);
      setTotal(res.data.data.total);
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    setDeleting(id);
    try {
      await adminApi.delete(`/posts/${id}`);
      fetchPosts();
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">공지 & 블로그</h1>
          <p className="text-sm text-gray-500 mt-1">공지사항, 업데이트, 이벤트 글을 관리합니다</p>
        </div>
        <Link href="/admin/posts/new"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          새 글 작성
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">로딩 중...</div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <p className="text-gray-400 text-sm">작성된 글이 없습니다</p>
            <Link href="/admin/posts/new" className="text-sm text-blue-600 hover:underline">첫 글 작성하기 →</Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">제목</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">카테고리</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">상태</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">조회수</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">발행일</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {posts.map((post) => (
                <tr key={post.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 max-w-xs">
                    <div className="flex items-center gap-2">
                      {post.isPinned && <Pin className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />}
                      {post.isFeatured && <Star className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />}
                      <div>
                        <p className="font-medium text-gray-900 line-clamp-1">{post.title}</p>
                        {post.subtitle && <p className="text-xs text-gray-400 line-clamp-1">{post.subtitle}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${CATEGORY_COLORS[post.category] ?? 'bg-gray-50 text-gray-600'}`}>
                      {CATEGORY_LABELS[post.category] ?? post.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {post.status === 'PUBLISHED'
                      ? <Badge variant="success">발행됨</Badge>
                      : <Badge variant="default">임시저장</Badge>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5 text-gray-400" />{post.viewCount.toLocaleString()}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {post.publishedAt
                      ? new Date(post.publishedAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <a href={`/notices/${post.slug}`} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="미리보기">
                        <Eye className="w-4 h-4" />
                      </a>
                      <Link href={`/admin/posts/${post.id}/edit`}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors" title="수정">
                        <Edit2 className="w-4 h-4" />
                      </Link>
                      <button onClick={() => handleDelete(post.id)} disabled={deleting === post.id}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50" title="삭제">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} limit={limit}
        onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} />
    </div>
  );
}
