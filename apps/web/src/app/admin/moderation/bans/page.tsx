'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { adminApi } from '../../../../lib/admin-api';
import { ConfirmModal } from '../../../../components/admin/common/ConfirmModal';
import { Pagination } from '../../../../components/admin/common/Pagination';

interface BannedUser {
  id: string;
  email: string | null;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  banReason: string | null;
  bannedUntil: string | null;
  updatedAt: string;
}

export default function BansPage() {
  const router = useRouter();
  const [users, setUsers] = useState<BannedUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [unbanTarget, setUnbanTarget] = useState<BannedUser | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (p = 1, q = search) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '25', ...(q && { search: q }) });
      const res = await adminApi.get(`/moderation/bans?${params}`);
      const d = res.data.data;
      setUsers(d.users);
      setTotal(d.total);
      setTotalPages(d.totalPages);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(1); }, []);
  useEffect(() => { load(page); }, [page]);

  async function handleUnban() {
    if (!unbanTarget) return;
    setSaving(true);
    try {
      await adminApi.post(`/moderation/bans/${unbanTarget.id}/unban`);
      setUnbanTarget(null);
      await load(page);
    } catch { /* silent */ } finally { setSaving(false); }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">
          차단 관리 <span className="text-sm font-normal text-gray-500">({total}명)</span>
        </h2>
      </div>

      <div className="relative max-w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300"
          placeholder="이메일, username 검색"
          value={search}
          onChange={(e) => { setSearch(e.target.value); load(1, e.target.value); }}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">사용자</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">정지 사유</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">정지일</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">해제일</th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 4 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                ))}<td /></tr>
              ))
            ) : users.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-gray-400 py-12">정지된 사용자가 없습니다</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden">
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-500">
                          {u.displayName[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div>
                      <button
                        className="font-medium text-gray-900 hover:text-blue-600 text-sm"
                        onClick={() => router.push(`/admin/users/${u.id}`)}
                      >
                        {u.displayName}
                      </button>
                      <p className="text-xs text-gray-400">{u.email ?? `@${u.username}`}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs max-w-48">
                  <p className="truncate">{u.banReason ?? '—'}</p>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {new Date(u.updatedAt).toLocaleDateString('ko-KR')}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {u.bannedUntil
                    ? new Date(u.bannedUntil).toLocaleDateString('ko-KR')
                    : <span className="text-red-500 font-medium">영구</span>
                  }
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setUnbanTarget(u)}
                    className="text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg px-3 py-1.5 hover:bg-green-100 transition-colors"
                  >
                    정지 해제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} limit={25} total={total} onPageChange={setPage} onLimitChange={() => {}} />

      <ConfirmModal
        open={!!unbanTarget}
        title="정지 해제"
        description={`${unbanTarget?.displayName} 님의 계정 정지를 해제합니다.`}
        confirmLabel="해제하기"
        isLoading={saving}
        onConfirm={handleUnban}
        onCancel={() => setUnbanTarget(null)}
      />
    </div>
  );
}
