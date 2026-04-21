'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ChevronDown } from 'lucide-react';
import { adminApi } from '../../../lib/admin-api';
import { Badge } from '../../../components/admin/common/Badge';
import { Pagination } from '../../../components/admin/common/Pagination';

interface User {
  id: string;
  email: string | null;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  subscriptionTier: string;
  creditBalance: number;
  isBanned: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

const roleVariant: Record<string, 'purple' | 'info' | 'warning' | 'default'> = {
  ADMIN: 'purple', CREATOR: 'info', USER: 'default',
};

const tierVariant: Record<string, 'success' | 'warning' | 'purple' | 'gray'> = {
  ENTERPRISE: 'purple', PRO: 'warning', BASIC: 'success', FREE: 'gray',
};

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [isBanned, setIsBanned] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (p = page, q = search) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p), limit: String(limit),
        ...(q && { search: q }),
        ...(role && { role }),
        ...(isBanned && { isBanned }),
      });
      const res = await adminApi.get(`/users?${params}`);
      const d = res.data.data;
      setUsers(d.users);
      setTotal(d.total);
      setTotalPages(d.totalPages);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page, limit, role, isBanned, search]);

  useEffect(() => { load(1, search); setPage(1); }, [role, isBanned, limit]);

  useEffect(() => { load(page, search); }, [page]);

  function handleSearch(v: string) {
    setSearch(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setPage(1); load(1, v); }, 300);
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">사용자 관리 <span className="text-sm font-normal text-gray-500">({total.toLocaleString()}명)</span></h2>
      </div>

      {/* 필터 바 */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300"
            placeholder="이메일, 이름, username 검색"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <select
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="">전체 역할</option>
          <option value="USER">USER</option>
          <option value="CREATOR">CREATOR</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <select
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"
          value={isBanned}
          onChange={(e) => setIsBanned(e.target.value)}
        >
          <option value="">전체 상태</option>
          <option value="false">활성</option>
          <option value="true">정지</option>
        </select>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">사용자</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">역할</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">구독</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">크레딧</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">상태</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">가입일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-gray-400 py-12">사용자가 없습니다</td>
              </tr>
            ) : users.map((u) => (
              <tr
                key={u.id}
                className="hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => router.push(`/admin/users/${u.id}`)}
              >
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
                      <p className="font-medium text-gray-900 leading-tight">{u.displayName}</p>
                      <p className="text-xs text-gray-400">{u.email ?? `@${u.username}`}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={roleVariant[u.role] ?? 'default'}>{u.role}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={tierVariant[u.subscriptionTier] ?? 'gray'}>{u.subscriptionTier}</Badge>
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-700">
                  {u.creditBalance.toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  {u.isBanned ? (
                    <Badge variant="danger">정지</Badge>
                  ) : (
                    <Badge variant="success">활성</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {new Date(u.createdAt).toLocaleDateString('ko-KR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        limit={limit}
        total={total}
        onPageChange={setPage}
        onLimitChange={(v) => { setLimit(v); setPage(1); }}
      />
    </div>
  );
}
