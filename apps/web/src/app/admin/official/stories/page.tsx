'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Star, Plus, Pencil } from 'lucide-react';
import { adminApi } from '../../../../lib/admin-api';
import { Badge } from '../../../../components/admin/common/Badge';
import { Pagination } from '../../../../components/admin/common/Pagination';

interface Story {
  id: string;
  title: string;
  coverUrl: string | null;
  status: string;
  chatCount: number;
  likeCount: number;
  isFeatured: boolean;
  createdAt: string;
  author: { id: string; username: string; displayName: string };
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'gray' | 'danger'> = {
  PUBLISHED: 'success', DRAFT: 'warning', HIDDEN: 'gray', DELETED: 'danger', ONGOING: 'success', COMPLETED: 'info' as 'success',
};
const STATUS_LABEL: Record<string, string> = {
  PUBLISHED: '게시됨', DRAFT: '초안', HIDDEN: '숨김', DELETED: '삭제됨', ONGOING: '연재중', COMPLETED: '완결',
};

export default function OfficialStoriesPage() {
  const router = useRouter();
  const [stories, setStories] = useState<Story[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '25' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const res = await adminApi.get(`/official/stories?${params}`);
      const d = res.data.data;
      setStories(d.stories);
      setTotal(d.total);
      setTotalPages(d.totalPages);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { load(page); }, [page]);
  useEffect(() => { setPage(1); load(1); }, [statusFilter]);

  async function toggleFeatured(s: Story) {
    try {
      await adminApi.patch(`/official/stories/${s.id}/featured`, { isFeatured: !s.isFeatured });
      setStories(prev => prev.map(st => st.id === s.id ? { ...st, isFeatured: !st.isFeatured } : st));
    } catch { /* silent */ }
  }

  async function updateStatus(s: Story, status: string) {
    try {
      await adminApi.patch(`/official/stories/${s.id}/status`, { status });
      setStories(prev => prev.map(st => st.id === s.id ? { ...st, status } : st));
    } catch { /* silent */ }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-800">
          전체 스토리 <span className="text-sm font-normal text-gray-500">({total}개)</span>
        </h3>
        <button
          onClick={() => router.push('/admin/official/stories/new')}
          className="flex items-center gap-1.5 text-sm bg-gray-900 text-white rounded-lg px-3 py-2 hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" /> 새 스토리
        </button>
      </div>

      <div className="flex gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none w-64"
            placeholder="제목, 작가 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); load(1); } }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"
        >
          <option value="">전체 상태</option>
          <option value="ONGOING">연재중</option>
          <option value="COMPLETED">완결</option>
          <option value="DRAFT">초안</option>
          <option value="HIDDEN">숨김</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">스토리</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">작가</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">상태</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">채팅</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">좋아요</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">등록일</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">추천</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">노출 변경</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 8 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                ))}</tr>
              ))
            ) : stories.length === 0 ? (
              <tr><td colSpan={8} className="text-center text-gray-400 py-12">스토리가 없습니다</td></tr>
            ) : stories.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-10 rounded bg-gray-200 flex-shrink-0 overflow-hidden">
                      {s.coverUrl ? (
                        <img src={s.coverUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-300 to-gray-400" />
                      )}
                    </div>
                    <span className="font-medium text-gray-900 text-sm line-clamp-1 max-w-48">{s.title}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button
                    className="text-blue-600 hover:underline text-xs"
                    onClick={() => router.push(`/admin/users/${s.author.id}`)}
                  >
                    @{s.author.username}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={(STATUS_VARIANT[s.status] as 'success' | 'warning' | 'gray' | 'danger') ?? 'gray'}>
                    {STATUS_LABEL[s.status] ?? s.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">{s.chatCount.toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">{s.likeCount.toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{new Date(s.createdAt).toLocaleDateString('ko-KR')}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleFeatured(s)}
                    className={`p-1.5 rounded-lg transition-colors ${s.isFeatured ? 'text-yellow-500 bg-yellow-50 hover:bg-yellow-100' : 'text-gray-300 hover:text-yellow-400 hover:bg-yellow-50'}`}
                  >
                    <Star className={`w-4 h-4 ${s.isFeatured ? 'fill-current' : ''}`} />
                  </button>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={s.status}
                    onChange={(e) => updateStatus(s, e.target.value)}
                    className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none"
                  >
                    <option value="ONGOING">연재중</option>
                    <option value="COMPLETED">완결</option>
                    <option value="HIDDEN">숨김</option>
                    <option value="DRAFT">초안</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => router.push(`/admin/official/stories/${s.id}/edit`)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title="수정"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} limit={25} total={total} onPageChange={setPage} onLimitChange={() => {}} />
    </div>
  );
}
