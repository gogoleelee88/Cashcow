'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { X, ChevronRight, AlertTriangle } from 'lucide-react';
import { adminApi } from '../../../../lib/admin-api';
import { Badge } from '../../../../components/admin/common/Badge';
import { ConfirmModal } from '../../../../components/admin/common/ConfirmModal';
import { Pagination } from '../../../../components/admin/common/Pagination';

interface Report {
  id: string;
  reason: string;
  description: string | null;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  resolveNote: string | null;
  reporter: { id: string; username: string; displayName: string; avatarUrl: string | null };
  reported: { id: string; username: string; displayName: string; avatarUrl: string | null; isBanned?: boolean };
  character: { id: string; name: string; avatarUrl: string | null; isActive?: boolean } | null;
}

const STATUS_TABS = ['ALL', 'PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED'] as const;

const statusVariant: Record<string, 'warning' | 'info' | 'success' | 'gray' | 'danger'> = {
  PENDING: 'danger', REVIEWING: 'warning', RESOLVED: 'success', DISMISSED: 'gray',
};

const statusLabel: Record<string, string> = {
  PENDING: '미처리', REVIEWING: '검토중', RESOLVED: '처리완료', DISMISSED: '기각',
};

export default function ReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusTab, setStatusTab] = useState<string>('ALL');
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Report | null>(null);
  const [panelHistory, setPanelHistory] = useState<{ id: string; reason: string; status: string; createdAt: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [dismissReason, setDismissReason] = useState('');
  const [resolveAction, setResolveAction] = useState('NO_ACTION');
  const [resolveNote, setResolveNote] = useState('');

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '25', ...(statusTab !== 'ALL' && { status: statusTab }) });
      const res = await adminApi.get(`/moderation/reports?${params}`);
      const d = res.data.data;
      setReports(d.reports);
      setTotal(d.total);
      setTotalPages(d.totalPages);
      setStatusCounts(d.statusCounts ?? {});
    } catch { /* silent */ } finally { setLoading(false); }
  }, [statusTab]);

  useEffect(() => { setPage(1); load(1); }, [statusTab]);
  useEffect(() => { load(page); }, [page]);

  async function openPanel(report: Report) {
    setSelected(report);
    try {
      const res = await adminApi.get(`/moderation/reports/${report.id}`);
      setPanelHistory(res.data.data.history ?? []);
    } catch { /* silent */ }
  }

  async function handleReview() {
    if (!selected) return;
    setSaving(true);
    try {
      await adminApi.patch(`/moderation/reports/${selected.id}/review`);
      setSelected({ ...selected, status: 'REVIEWING' });
      await load(page);
    } catch { /* silent */ } finally { setSaving(false); }
  }

  async function handleDismiss() {
    if (!selected) return;
    setSaving(true);
    try {
      await adminApi.post(`/moderation/reports/${selected.id}/dismiss`, { reason: dismissReason });
      setDismissOpen(false);
      setSelected({ ...selected, status: 'DISMISSED' });
      await load(page);
    } catch { /* silent */ } finally { setSaving(false); }
  }

  async function handleResolve() {
    if (!selected) return;
    setSaving(true);
    try {
      await adminApi.post(`/moderation/reports/${selected.id}/resolve`, { action: resolveAction, note: resolveNote });
      setResolveOpen(false);
      setSelected({ ...selected, status: 'RESOLVED' });
      await load(page);
    } catch { /* silent */ } finally { setSaving(false); }
  }

  const pendingCount = statusCounts['PENDING'] ?? 0;

  return (
    <div className="p-6 flex gap-4 h-full">
      {/* 좌측 목록 */}
      <div className={`flex flex-col gap-4 ${selected ? 'flex-1' : 'w-full'}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            신고 처리
            {pendingCount > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">{pendingCount}</span>
            )}
          </h2>
        </div>

        {/* 상태 탭 */}
        <div className="flex gap-1 border-b border-gray-200">
          {STATUS_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setStatusTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                statusTab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'ALL' ? '전체' : statusLabel[t]}
              {t !== 'ALL' && statusCounts[t] ? (
                <span className={`ml-1.5 text-xs rounded-full px-1.5 py-0.5 ${t === 'PENDING' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                  {statusCounts[t]}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* 테이블 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm flex-1">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">신고 유형</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">신고자</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">피신고자</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">날짜</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">상태</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                    ))}
                    <td />
                  </tr>
                ))
              ) : reports.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-gray-400 py-12">신고 내역이 없습니다</td></tr>
              ) : reports.map((r) => (
                <tr
                  key={r.id}
                  className={`hover:bg-gray-50 cursor-pointer transition-colors ${selected?.id === r.id ? 'bg-blue-50' : ''}`}
                  onClick={() => openPanel(r)}
                >
                  <td className="px-4 py-3 font-medium text-gray-800">{r.reason}</td>
                  <td className="px-4 py-3 text-gray-600">@{r.reporter.username}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {r.character ? `${r.character.name} (캐릭터)` : `@${r.reported.username}`}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(r.createdAt).toLocaleDateString('ko-KR')}</td>
                  <td className="px-4 py-3"><Badge variant={statusVariant[r.status] ?? 'gray'}>{statusLabel[r.status] ?? r.status}</Badge></td>
                  <td className="px-4 py-3 text-gray-400"><ChevronRight className="w-4 h-4" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination page={page} totalPages={totalPages} limit={25} total={total} onPageChange={setPage} onLimitChange={() => {}} />
      </div>

      {/* 우측 상세 패널 */}
      {selected && (
        <div className="w-80 flex-shrink-0 flex flex-col gap-3">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 text-sm">신고 상세</h3>
              <button onClick={() => setSelected(null)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>

            <Badge variant={statusVariant[selected.status] ?? 'gray'} className="self-start">
              {statusLabel[selected.status] ?? selected.status}
            </Badge>

            <div className="space-y-2 text-sm">
              <div>
                <p className="text-xs text-gray-500">신고 유형</p>
                <p className="font-medium text-gray-800">{selected.reason}</p>
              </div>
              {selected.description && (
                <div>
                  <p className="text-xs text-gray-500">상세 내용</p>
                  <p className="text-gray-700 text-xs leading-relaxed">{selected.description}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500">신고자</p>
                <button
                  className="text-blue-600 hover:underline text-xs"
                  onClick={() => router.push(`/admin/users/${selected.reporter.id}`)}
                >
                  @{selected.reporter.username}
                </button>
              </div>
              <div>
                <p className="text-xs text-gray-500">피신고자</p>
                <button
                  className="text-blue-600 hover:underline text-xs"
                  onClick={() => router.push(`/admin/users/${selected.reported.id}`)}
                >
                  @{selected.reported.username}
                  {selected.reported.isBanned && <span className="ml-1 text-red-500">(정지됨)</span>}
                </button>
              </div>
              {selected.character && (
                <div>
                  <p className="text-xs text-gray-500">대상 캐릭터</p>
                  <p className="text-gray-800 text-xs">{selected.character.name}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500">신고일</p>
                <p className="text-gray-700 text-xs">{new Date(selected.createdAt).toLocaleString('ko-KR')}</p>
              </div>
              {selected.resolveNote && (
                <div>
                  <p className="text-xs text-gray-500">처리 메모</p>
                  <p className="text-gray-700 text-xs">{selected.resolveNote}</p>
                </div>
              )}
            </div>

            {/* 이전 이력 */}
            {panelHistory.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">동일 피신고자 이전 이력</p>
                <div className="space-y-1">
                  {panelHistory.map((h) => (
                    <div key={h.id} className="flex items-center justify-between text-xs text-gray-500">
                      <span>{h.reason}</span>
                      <Badge variant={statusVariant[h.status] ?? 'gray'}>{statusLabel[h.status] ?? h.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 액션 버튼 */}
            {(selected.status === 'PENDING' || selected.status === 'REVIEWING') && (
              <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
                {selected.status === 'PENDING' && (
                  <button
                    onClick={handleReview}
                    disabled={saving}
                    className="w-full py-2 text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                  >
                    검토 시작
                  </button>
                )}
                <button
                  onClick={() => setResolveOpen(true)}
                  className="w-full py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                  처리하기
                </button>
                <button
                  onClick={() => setDismissOpen(true)}
                  className="w-full py-2 text-sm font-medium bg-gray-50 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  기각하기
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 기각 모달 */}
      <ConfirmModal
        open={dismissOpen}
        title="신고 기각"
        description=""
        confirmLabel="기각하기"
        isLoading={saving}
        onConfirm={handleDismiss}
        onCancel={() => setDismissOpen(false)}
      >
        <div className="mt-2">
          <label className="text-xs font-medium text-gray-600">기각 사유</label>
          <textarea
            value={dismissReason}
            onChange={(e) => setDismissReason(e.target.value)}
            rows={3}
            className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none resize-none"
            placeholder="기각 사유를 입력하세요"
          />
        </div>
      </ConfirmModal>

      {/* 처리 모달 */}
      <ConfirmModal
        open={resolveOpen}
        title="신고 처리"
        description=""
        confirmLabel="처리하기"
        isLoading={saving}
        onConfirm={handleResolve}
        onCancel={() => setResolveOpen(false)}
      >
        <div className="space-y-3 mt-2">
          <div>
            <label className="text-xs font-medium text-gray-600">처리 유형</label>
            <div className="space-y-1 mt-1">
              {[
                { value: 'NO_ACTION', label: '조치 없음' },
                { value: 'HIDE_CONTENT', label: '콘텐츠 숨김' },
                { value: 'BAN_USER', label: '계정 정지' },
              ].map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="resolveAction"
                    value={opt.value}
                    checked={resolveAction === opt.value}
                    onChange={(e) => setResolveAction(e.target.value)}
                    className="accent-gray-900"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">처리 메모</label>
            <textarea
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              rows={2}
              className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none resize-none"
              placeholder="처리 내용을 기록하세요"
            />
          </div>
        </div>
      </ConfirmModal>
    </div>
  );
}
