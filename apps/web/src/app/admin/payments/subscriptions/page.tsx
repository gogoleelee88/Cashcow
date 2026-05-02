'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '../../../../lib/admin-api';
import { Badge } from '../../../../components/admin/common/Badge';
import { Pagination } from '../../../../components/admin/common/Pagination';

interface Subscription {
  id: string;
  tier: string;
  provider: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  cancelledAt: string | null;
  createdAt: string;
  user: { id: string; email: string | null; username: string; displayName: string };
}

const TIER_VARIANT: Record<string, 'info' | 'warning' | 'success'> = {
  FREE: 'info', BASIC: 'warning', PREMIUM: 'success',
};
const STATUS_VARIANT: Record<string, 'success' | 'danger' | 'warning' | 'gray' | 'info'> = {
  COMPLETED: 'success', FAILED: 'danger', REFUNDED: 'warning', PENDING: 'info', CANCELLED: 'gray',
};
const STATUS_LABEL: Record<string, string> = {
  COMPLETED: '활성', FAILED: '실패', REFUNDED: '환불됨', PENDING: '대기', CANCELLED: '취소됨',
};

export default function SubscriptionsPage() {
  const router = useRouter();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '25' });
      if (statusFilter) params.set('status', statusFilter);
      if (tierFilter) params.set('tier', tierFilter);
      const res = await adminApi.get(`/payments/subscriptions?${params}`);
      const d = res.data.data;
      setSubs(d.subscriptions);
      setTotal(d.total);
      setTotalPages(d.totalPages);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [statusFilter, tierFilter]);

  useEffect(() => { load(page); }, [page]);
  useEffect(() => { setPage(1); load(1); }, [statusFilter, tierFilter]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">
          구독 관리 <span className="text-sm font-normal text-gray-500">({total}명)</span>
        </h2>
      </div>

      <div className="flex gap-3">
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"
        >
          <option value="">전체 티어</option>
          <option value="BASIC">BASIC</option>
          <option value="PREMIUM">PREMIUM</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"
        >
          <option value="">전체 상태</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">사용자</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">티어</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">결제사</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">상태</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">구독 기간</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">시작일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 6 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                ))}</tr>
              ))
            ) : subs.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-gray-400 py-12">구독 내역이 없습니다</td></tr>
            ) : subs.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <button className="text-left" onClick={() => router.push(`/admin/users/${s.user.id}`)}>
                    <p className="font-medium text-gray-900 hover:text-blue-600 text-sm">{s.user.displayName}</p>
                    <p className="text-xs text-gray-400">{s.user.email ?? `@${s.user.username}`}</p>
                  </button>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={TIER_VARIANT[s.tier] ?? 'gray'}>{s.tier}</Badge>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{s.provider}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    <Badge variant={STATUS_VARIANT[s.status] ?? 'gray'}>{STATUS_LABEL[s.status] ?? s.status}</Badge>
                    {s.cancelAtPeriodEnd && (
                      <span className="text-xs text-orange-500">기간 만료시 해지</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {new Date(s.currentPeriodStart).toLocaleDateString('ko-KR')} ~{' '}
                  {new Date(s.currentPeriodEnd).toLocaleDateString('ko-KR')}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {new Date(s.createdAt).toLocaleDateString('ko-KR')}
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
