'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, RefreshCw } from 'lucide-react';
import { adminApi } from '../../../../lib/admin-api';
import { Badge } from '../../../../components/admin/common/Badge';
import { ConfirmModal } from '../../../../components/admin/common/ConfirmModal';
import { Pagination } from '../../../../components/admin/common/Pagination';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  credits: number;
  status: string;
  provider: string | null;
  providerOrderId: string | null;
  description: string;
  refundedAt: string | null;
  createdAt: string;
  user: { id: string; email: string | null; username: string; displayName: string; avatarUrl: string | null };
}

const TYPE_LABELS: Record<string, string> = {
  PURCHASE: '구매', USAGE: '사용', REFUND: '환불', BONUS: '지급', SETTLEMENT: '정산',
};
const STATUS_VARIANT: Record<string, 'success' | 'danger' | 'warning' | 'gray' | 'info'> = {
  COMPLETED: 'success', FAILED: 'danger', REFUNDED: 'warning', PENDING: 'info', CANCELLED: 'gray',
};
const STATUS_LABEL: Record<string, string> = {
  COMPLETED: '완료', FAILED: '실패', REFUNDED: '환불됨', PENDING: '대기', CANCELLED: '취소',
};

export default function TransactionsPage() {
  const router = useRouter();
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ totalRevenue: 0, todayRevenue: 0 });
  const [refundTarget, setRefundTarget] = useState<Transaction | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '25' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('type', typeFilter);
      const res = await adminApi.get(`/payments/transactions?${params}`);
      const d = res.data.data;
      setTxs(d.transactions);
      setTotal(d.total);
      setTotalPages(d.totalPages);
      setSummary(d.summary);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [search, statusFilter, typeFilter]);

  useEffect(() => { load(page); }, [page]);
  useEffect(() => { setPage(1); load(1); }, [statusFilter, typeFilter]);

  async function handleRefund() {
    if (!refundTarget) return;
    setSaving(true);
    try {
      await adminApi.post(`/payments/transactions/${refundTarget.id}/refund`, { reason: refundReason });
      setRefundTarget(null);
      setRefundReason('');
      await load(page);
    } catch { /* silent */ } finally { setSaving(false); }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">결제 내역</h2>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500">오늘 수익</p>
          <p className="text-xl font-bold text-gray-900 mt-1">₩{summary.todayRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500">누적 수익</p>
          <p className="text-xl font-bold text-gray-900 mt-1">₩{summary.totalRevenue.toLocaleString()}</p>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 w-64"
            placeholder="이메일, 주문번호 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); load(1); } }}
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"
        >
          <option value="">전체 유형</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
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
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">유형</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">금액</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">크레딧</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">상태</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">날짜</th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 6 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                ))}<td /></tr>
              ))
            ) : txs.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-gray-400 py-12">결제 내역이 없습니다</td></tr>
            ) : txs.map((tx) => (
              <tr key={tx.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <button
                    className="text-left"
                    onClick={() => router.push(`/admin/users/${tx.user.id}`)}
                  >
                    <p className="font-medium text-gray-900 hover:text-blue-600 text-sm">{tx.user.displayName}</p>
                    <p className="text-xs text-gray-400">{tx.user.email ?? `@${tx.user.username}`}</p>
                  </button>
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">{TYPE_LABELS[tx.type] ?? tx.type}</td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {tx.amount !== 0 ? `₩${Math.abs(tx.amount).toLocaleString()}` : '—'}
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">
                  {tx.credits !== 0 ? `${tx.credits > 0 ? '+' : ''}${tx.credits.toLocaleString()}` : '—'}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANT[tx.status] ?? 'gray'}>{STATUS_LABEL[tx.status] ?? tx.status}</Badge>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {new Date(tx.createdAt).toLocaleDateString('ko-KR')}
                </td>
                <td className="px-4 py-3">
                  {tx.status === 'COMPLETED' && tx.type === 'PURCHASE' && (
                    <button
                      onClick={() => setRefundTarget(tx)}
                      className="text-xs bg-orange-50 text-orange-700 border border-orange-200 rounded-lg px-3 py-1.5 hover:bg-orange-100 transition-colors flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> 환불
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} limit={25} total={total} onPageChange={setPage} onLimitChange={() => {}} />

      <ConfirmModal
        open={!!refundTarget}
        title="결제 환불"
        description={`${refundTarget?.user.displayName} 님의 결제 ₩${refundTarget?.amount.toLocaleString()}을 환불합니다.`}
        confirmLabel="환불하기"
        isLoading={saving}
        onConfirm={handleRefund}
        onCancel={() => { setRefundTarget(null); setRefundReason(''); }}
      >
        <div className="mt-2">
          <label className="text-xs font-medium text-gray-600">환불 사유</label>
          <textarea
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            rows={2}
            className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none resize-none"
            placeholder="환불 사유를 입력하세요"
          />
        </div>
      </ConfirmModal>
    </div>
  );
}
