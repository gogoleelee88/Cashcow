'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { adminApi } from '../../../../lib/admin-api';
import { Badge } from '../../../../components/admin/common/Badge';
import { ConfirmModal } from '../../../../components/admin/common/ConfirmModal';
import { Pagination } from '../../../../components/admin/common/Pagination';

interface SettlementItem {
  id: string;
  characterName: string;
  chatCount: number;
  creditsEarned: number;
  amount: number;
}

interface Settlement {
  id: string;
  periodStart: string;
  periodEnd: string;
  totalChats: number;
  grossAmount: number;
  platformFeeRate: number;
  platformFee: number;
  netAmount: number;
  status: string;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  creator: { id: string; email: string | null; username: string; displayName: string };
  items: SettlementItem[];
}

const STATUS_VARIANT: Record<string, 'info' | 'warning' | 'success' | 'danger' | 'gray'> = {
  PENDING: 'info', PROCESSING: 'warning', COMPLETED: 'success', FAILED: 'danger',
};
const STATUS_LABEL: Record<string, string> = {
  PENDING: '대기중', PROCESSING: '처리중', COMPLETED: '완료', FAILED: '실패',
};

export default function SettlementsPage() {
  const router = useRouter();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ totalPaid: 0, totalGross: 0 });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [statusTarget, setStatusTarget] = useState<Settlement | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '25' });
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);
      const res = await adminApi.get(`/payments/settlements?${params}`);
      const d = res.data.data;
      setSettlements(d.settlements);
      setTotal(d.total);
      setTotalPages(d.totalPages);
      setSummary(d.summary);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [statusFilter, search]);

  useEffect(() => { load(page); }, [page]);
  useEffect(() => { setPage(1); load(1); }, [statusFilter]);

  async function handleStatusChange() {
    if (!statusTarget) return;
    setSaving(true);
    try {
      await adminApi.patch(`/payments/settlements/${statusTarget.id}/status`, { status: newStatus, notes });
      setStatusTarget(null);
      await load(page);
    } catch { /* silent */ } finally { setSaving(false); }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">크리에이터 정산</h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500">총 정산 완료</p>
          <p className="text-xl font-bold text-gray-900 mt-1">₩{summary.totalPaid.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500">총 매출액 (정산 완료)</p>
          <p className="text-xl font-bold text-gray-900 mt-1">₩{summary.totalGross.toLocaleString()}</p>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none w-64"
            placeholder="이메일, username 검색"
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
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="w-8" />
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">크리에이터</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">정산 기간</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">총 채팅</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">매출</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">정산액</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">상태</th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 7 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                ))}<td /></tr>
              ))
            ) : settlements.length === 0 ? (
              <tr><td colSpan={8} className="text-center text-gray-400 py-12">정산 내역이 없습니다</td></tr>
            ) : settlements.map((s) => (
              <>
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="pl-4 py-3">
                    <button
                      onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {expanded === s.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      className="text-left"
                      onClick={() => router.push(`/admin/users/${s.creator.id}`)}
                    >
                      <p className="font-medium text-gray-900 hover:text-blue-600 text-sm">{s.creator.displayName}</p>
                      <p className="text-xs text-gray-400">{s.creator.email ?? `@${s.creator.username}`}</p>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(s.periodStart).toLocaleDateString('ko-KR')} ~ {new Date(s.periodEnd).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{s.totalChats.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-900 text-sm">₩{s.grossAmount.toLocaleString()}</td>
                  <td className="px-4 py-3 font-medium text-green-700 text-sm">₩{s.netAmount.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[s.status] ?? 'gray'}>{STATUS_LABEL[s.status] ?? s.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {s.status !== 'COMPLETED' && (
                      <button
                        onClick={() => { setStatusTarget(s); setNewStatus('COMPLETED'); setNotes(''); }}
                        className="text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg px-3 py-1.5 hover:bg-green-100 transition-colors"
                      >
                        정산 완료
                      </button>
                    )}
                  </td>
                </tr>
                {expanded === s.id && s.items.length > 0 && (
                  <tr key={`${s.id}-items`} className="bg-gray-50">
                    <td colSpan={8} className="px-8 py-3">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-500">
                            <th className="text-left pb-1">캐릭터</th>
                            <th className="text-left pb-1">채팅수</th>
                            <th className="text-left pb-1">크레딧</th>
                            <th className="text-left pb-1">금액</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {s.items.map((item) => (
                            <tr key={item.id}>
                              <td className="py-1 text-gray-700">{item.characterName}</td>
                              <td className="py-1 text-gray-600">{item.chatCount.toLocaleString()}</td>
                              <td className="py-1 text-gray-600">{item.creditsEarned.toLocaleString()}</td>
                              <td className="py-1 text-gray-800">₩{item.amount.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} limit={25} total={total} onPageChange={setPage} onLimitChange={() => {}} />

      <ConfirmModal
        open={!!statusTarget}
        title="정산 완료 처리"
        description={`${statusTarget?.creator.displayName} 님의 ₩${statusTarget?.netAmount.toLocaleString()} 정산을 완료 처리합니다.`}
        confirmLabel="완료 처리"
        isLoading={saving}
        onConfirm={handleStatusChange}
        onCancel={() => setStatusTarget(null)}
      >
        <div className="mt-2">
          <label className="text-xs font-medium text-gray-600">메모 (선택)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none resize-none"
            placeholder="메모를 입력하세요"
          />
        </div>
      </ConfirmModal>
    </div>
  );
}
