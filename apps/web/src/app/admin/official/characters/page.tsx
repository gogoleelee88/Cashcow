'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Star, EyeOff, Eye, Plus, Pencil } from 'lucide-react';
import { adminApi } from '../../../../lib/admin-api';
import { Badge } from '../../../../components/admin/common/Badge';
import { Pagination } from '../../../../components/admin/common/Pagination';

interface Character {
  id: string;
  name: string;
  avatarUrl: string | null;
  category: string;
  chatCount: number;
  likeCount: number;
  isFeatured: boolean;
  isActive: boolean;
  visibility: string;
  ageRating: string;
  createdAt: string;
  creator: { id: string; username: string; displayName: string };
}

export default function OfficialCharactersPage() {
  const router = useRouter();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [featuredFilter, setFeaturedFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '25' });
      if (search) params.set('search', search);
      if (featuredFilter) params.set('featured', featuredFilter);
      const res = await adminApi.get(`/official/characters?${params}`);
      const d = res.data.data;
      setCharacters(d.characters);
      setTotal(d.total);
      setTotalPages(d.totalPages);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [search, featuredFilter]);

  useEffect(() => { load(page); }, [page]);
  useEffect(() => { setPage(1); load(1); }, [featuredFilter]);

  async function toggleFeatured(c: Character) {
    try {
      await adminApi.patch(`/official/characters/${c.id}/featured`, { isFeatured: !c.isFeatured });
      setCharacters(prev => prev.map(ch => ch.id === c.id ? { ...ch, isFeatured: !ch.isFeatured } : ch));
    } catch { /* silent */ }
  }

  async function toggleActive(c: Character) {
    try {
      await adminApi.patch(`/official/characters/${c.id}/active`, { isActive: !c.isActive });
      setCharacters(prev => prev.map(ch => ch.id === c.id ? { ...ch, isActive: !ch.isActive } : ch));
    } catch { /* silent */ }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-800">
          전체 캐릭터 <span className="text-sm font-normal text-gray-500">({total}개)</span>
        </h3>
        <button
          onClick={() => router.push('/admin/official/characters/new')}
          className="flex items-center gap-1.5 text-sm bg-gray-900 text-white rounded-lg px-3 py-2 hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" /> 새 캐릭터
        </button>
      </div>

      <div className="flex gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none w-64"
            placeholder="캐릭터명, 크리에이터 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); load(1); } }}
          />
        </div>
        <select
          value={featuredFilter}
          onChange={(e) => setFeaturedFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"
        >
          <option value="">전체</option>
          <option value="true">추천 캐릭터만</option>
          <option value="false">비추천만</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">캐릭터</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">크리에이터</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">카테고리</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">채팅</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">좋아요</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">상태</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">추천</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">노출</th>
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
            ) : characters.length === 0 ? (
              <tr><td colSpan={8} className="text-center text-gray-400 py-12">캐릭터가 없습니다</td></tr>
            ) : characters.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden">
                      {c.avatarUrl ? (
                        <img src={c.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-500">
                          {c.name[0]}
                        </div>
                      )}
                    </div>
                    <span className="font-medium text-gray-900 text-sm">{c.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button
                    className="text-blue-600 hover:underline text-xs"
                    onClick={() => router.push(`/admin/users/${c.creator.id}`)}
                  >
                    @{c.creator.username}
                  </button>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{c.category}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">{c.chatCount.toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">{c.likeCount.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <Badge variant={c.isActive ? 'success' : 'gray'}>{c.isActive ? '활성' : '비활성'}</Badge>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleFeatured(c)}
                    className={`p-1.5 rounded-lg transition-colors ${c.isFeatured ? 'text-yellow-500 bg-yellow-50 hover:bg-yellow-100' : 'text-gray-300 hover:text-yellow-400 hover:bg-yellow-50'}`}
                    title={c.isFeatured ? '추천 해제' : '추천 설정'}
                  >
                    {c.isFeatured ? <Star className="w-4 h-4 fill-current" /> : <Star className="w-4 h-4" />}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleActive(c)}
                    className={`p-1.5 rounded-lg transition-colors ${c.isActive ? 'text-gray-400 hover:text-red-500 hover:bg-red-50' : 'text-red-400 hover:text-gray-400 hover:bg-gray-50'}`}
                    title={c.isActive ? '비활성화' : '활성화'}
                  >
                    {c.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => router.push(`/admin/official/characters/${c.id}/edit`)}
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
