'use client';

import { useEffect, useState, useCallback } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { adminApi } from '../../../../lib/admin-api';
import { Badge } from '../../../../components/admin/common/Badge';
import { Pagination } from '../../../../components/admin/common/Pagination';

interface Appeal {
  id: string;
  type: string;
  targetId: string;
  reason: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  user: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
}

const STATUS_TABS = ['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const;

const TYPE_LABELS: Record<string, string> = {
  MESSAGE_HIDDEN: '메시지 숨김',
  CHARACTER_HIDDEN: '캐릭터 숨김',
  USER_BANNED: '계정 정지',
};

export default function AppealsPage() {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [tab, setTab] = useState<typeof STATUS_TABS[number]>('PENDING');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [acting, setActing] = useState<string | null>(null);

  const fetchAppeals = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(limit), status: tab };
      const res = await adminApi.get('/moderation/appeals', { params });
      setAppeals(res.data.data.appeals);
      setTotalPages(res.data.data.totalPages);
      setTotal(res.data.data.total);
    } finally {
      setLoading(false);
    }
  }, [page, tab, limit]);

  useEffect(() => { fetchAppeals(); }, [fetchAppeals]);

  const handleApprove = async (id: string) => {
    setActing(id);
    try {
      await adminApi.post(`/moderation/appeals/${id}/approve`);
      fetchAppeals();
    } finally {
      setActing(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal || !rejectNote.trim()) return;
    setActing(rejectModal.id);
    try {
      await adminApi.post(`/moderation/appeals/${rejectModal.id}/reject`, { note: rejectNote });
      setRejectModal(null);
      setRejectNote('');
      fetchAppeals();
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">이의신청 처리</h1>
        <p className="text-sm text-gray-500 mt-1">유저가 제출한 이의신청을 검토하고 승인 또는 기각합니다</p>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {STATUS_TABS.map((t) => (
          <button key={t} onClick={() => { setTab(t); setPage(1); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'PENDING' ? '미처리' : t === 'APPROVED' ? '승인됨' : t === 'REJECTED' ? '기각됨' : '전체'}
          </button>
        ))}
      </div>

      {/* 이의신청 목록 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">로딩 중...</div>
        ) : appeals.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">이의신청이 없습니다</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">신청자</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">유형</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">소명 내용</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">상태</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">신청일</th>
                {tab === 'PENDING' && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {appeals.map((appeal) => (
                <tr key={appeal.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{appeal.user.displayName || appeal.user.username}</p>
                    <p className="text-xs text-gray-400">@{appeal.user.username}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      {TYPE_LABELS[appeal.type] ?? appeal.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-sm">
                    <p className="text-sm text-gray-700 line-clamp-3">{appeal.reason}</p>
                    {appeal.adminNote && (
                      <p className="text-xs text-gray-400 mt-1 italic">관리자 메모: {appeal.adminNote}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {appeal.status === 'PENDING'
                      ? <Badge variant="warning">미처리</Badge>
                      : appeal.status === 'APPROVED'
                        ? <Badge variant="success">승인</Badge>
                        : <Badge variant="danger">기각</Badge>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {new Date(appeal.createdAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  {tab === 'PENDING' && (
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => handleApprove(appeal.id)}
                          disabled={acting === appeal.id}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 rounded-lg transition-colors"
                          title="승인 → 숨김 해제 / 밴 해제"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          승인
                        </button>
                        <button
                          onClick={() => { setRejectModal({ id: appeal.id }); setRejectNote(''); }}
                          disabled={acting === appeal.id}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-lg transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          기각
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} limit={limit}
        onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} />

      {/* 기각 사유 모달 */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
            <h3 className="font-semibold text-gray-900 mb-4">이의신청 기각</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">기각 사유 *</label>
              <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                rows={3} placeholder="기각 사유를 입력하세요" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRejectModal(null)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                취소
              </button>
              <button onClick={handleReject} disabled={!rejectNote.trim() || acting !== null}
                className="px-4 py-2 text-sm text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-lg transition-colors">
                기각 처리
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
