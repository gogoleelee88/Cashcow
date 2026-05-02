'use client';

import { useEffect, useState, useCallback } from 'react';
import { CheckCircle, XCircle, User, EyeOff, Eye, Flag } from 'lucide-react';
import Image from 'next/image';
import { adminApi } from '../../../../lib/admin-api';
import { Badge } from '../../../../components/admin/common/Badge';
import { Pagination } from '../../../../components/admin/common/Pagination';

interface Character {
  id: string;
  name: string;
  description: string;
  avatarUrl: string | null;
  category: string;
  ageRating: string;
  reviewStatus: string;
  reviewNote: string | null;
  isActive: boolean;
  createdAt: string;
  creator: { id: string; username: string; displayName: string | null };
}

const STATUS_TABS = ['NEEDS_REVIEW', 'APPROVED', 'AUTO_APPROVED', 'REJECTED', 'ALL'] as const;

const AGE_RATING_LABELS: Record<string, string> = {
  ALL: '전체이용가',
  TEEN: '청소년',
  ADULT: '성인',
};

export default function CharacterReviewsPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [tab, setTab] = useState<typeof STATUS_TABS[number]>('NEEDS_REVIEW');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState<{ id: string; name: string; mode: 'reject' | 'deactivate' } | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [acting, setActing] = useState<string | null>(null);

  const fetchCharacters = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(limit), status: tab };
      const res = await adminApi.get('/moderation/character-reviews', { params });
      setCharacters(res.data.data.characters);
      setTotalPages(res.data.data.totalPages);
      setTotal(res.data.data.total);
    } finally {
      setLoading(false);
    }
  }, [page, tab, limit]);

  useEffect(() => { fetchCharacters(); }, [fetchCharacters]);

  const act = async (id: string, fn: () => Promise<void>) => {
    setActing(id);
    try { await fn(); fetchCharacters(); } finally { setActing(null); }
  };

  const handleApprove = (id: string) =>
    act(id, () => adminApi.post(`/moderation/character-reviews/${id}/approve`));

  const handleFlag = (id: string) =>
    act(id, () => adminApi.post(`/moderation/character-reviews/${id}/flag`));

  const handleReactivate = (id: string) =>
    act(id, () => adminApi.post(`/moderation/character-reviews/${id}/reactivate`));

  const handleModalSubmit = async () => {
    if (!rejectModal) return;
    if (rejectModal.mode !== 'deactivate' && !rejectNote.trim()) return;
    setActing(rejectModal.id);
    try {
      if (rejectModal.mode === 'reject') {
        await adminApi.post(`/moderation/character-reviews/${rejectModal.id}/reject`, { note: rejectNote });
      } else {
        await adminApi.post(`/moderation/character-reviews/${rejectModal.id}/deactivate`, { note: rejectNote || undefined });
      }
      setRejectModal(null);
      setRejectNote('');
      fetchCharacters();
    } finally {
      setActing(null);
    }
  };

  const isReviewing = tab === 'NEEDS_REVIEW';
  const isLive = tab === 'APPROVED' || tab === 'AUTO_APPROVED' || tab === 'ALL';
  const isDeactivated = tab === 'REJECTED';

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">캐릭터 검수</h1>
        <p className="text-sm text-gray-500 mt-1">캐릭터를 승인하거나 비활성화합니다. 라이브 중인 캐릭터도 모니터링 후 조치할 수 있습니다.</p>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {STATUS_TABS.map((t) => (
          <button key={t} onClick={() => { setTab(t); setPage(1); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'NEEDS_REVIEW' ? '검수 대기' : t === 'APPROVED' ? '수동 승인' : t === 'AUTO_APPROVED' ? '자동 승인' : t === 'REJECTED' ? '비활성화' : '전체'}
          </button>
        ))}
      </div>

      {/* 캐릭터 목록 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">로딩 중...</div>
        ) : characters.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">캐릭터가 없습니다</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">캐릭터</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">설명</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">카테고리 / 등급</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">AI 검수 메모</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">상태</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">생성일</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {characters.map((char) => (
                <tr key={char.id} className={`hover:bg-gray-50 ${!char.isActive ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {char.avatarUrl ? (
                          <Image src={char.avatarUrl} alt={char.name} width={40} height={40} className="object-cover" />
                        ) : (
                          <User className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{char.name}</p>
                        <p className="text-xs text-gray-400">@{char.creator.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="text-sm text-gray-600 line-clamp-2">{char.description}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-gray-700 font-medium">{char.category}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{AGE_RATING_LABELS[char.ageRating] ?? char.ageRating}</p>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    {char.reviewNote ? (
                      <p className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded line-clamp-2">{char.reviewNote}</p>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {char.reviewStatus === 'NEEDS_REVIEW'
                      ? <Badge variant="warning">검수 대기</Badge>
                      : char.reviewStatus === 'APPROVED'
                        ? <Badge variant="success">승인</Badge>
                        : char.reviewStatus === 'AUTO_APPROVED'
                          ? <Badge variant="success">자동 승인</Badge>
                          : <Badge variant="danger">비활성화</Badge>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {new Date(char.createdAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end flex-wrap">
                      {/* 검수 대기: 승인 / 거절 */}
                      {isReviewing && (
                        <>
                          <button onClick={() => handleApprove(char.id)} disabled={acting === char.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 rounded-lg transition-colors">
                            <CheckCircle className="w-3.5 h-3.5" /> 승인
                          </button>
                          <button onClick={() => { setRejectModal({ id: char.id, name: char.name, mode: 'reject' }); setRejectNote(''); }}
                            disabled={acting === char.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-lg transition-colors">
                            <XCircle className="w-3.5 h-3.5" /> 거절
                          </button>
                        </>
                      )}
                      {/* 라이브 중: 검수 요청 / 비활성화 */}
                      {(isLive || (!isReviewing && !isDeactivated)) && char.isActive && (
                        <>
                          <button onClick={() => handleFlag(char.id)} disabled={acting === char.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 disabled:opacity-50 rounded-lg transition-colors"
                            title="검수 대기로 이동">
                            <Flag className="w-3.5 h-3.5" /> 재검수
                          </button>
                          <button onClick={() => { setRejectModal({ id: char.id, name: char.name, mode: 'deactivate' }); setRejectNote(''); }}
                            disabled={acting === char.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50 rounded-lg transition-colors"
                            title="캐릭터 비활성화">
                            <EyeOff className="w-3.5 h-3.5" /> 비활성화
                          </button>
                        </>
                      )}
                      {/* 비활성화됨: 재활성화 */}
                      {(isDeactivated || !char.isActive) && (
                        <button onClick={() => handleReactivate(char.id)} disabled={acting === char.id}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 rounded-lg transition-colors">
                          <Eye className="w-3.5 h-3.5" /> 재활성화
                        </button>
                      )}
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

      {/* 거절/비활성화 모달 */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
            <h3 className="font-semibold text-gray-900 mb-1">
              {rejectModal.mode === 'reject' ? '캐릭터 거절' : '캐릭터 비활성화'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">"{rejectModal.name}"</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {rejectModal.mode === 'reject' ? '거절 사유 *' : '사유 (선택)'}
              </label>
              <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                rows={3} placeholder={rejectModal.mode === 'reject' ? '거절 사유를 입력하세요' : '비활성화 사유 (미입력 시 기본 사유 적용)'} />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRejectModal(null)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                취소
              </button>
              <button onClick={handleModalSubmit}
                disabled={(rejectModal.mode === 'reject' && !rejectNote.trim()) || acting !== null}
                className="px-4 py-2 text-sm text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-lg transition-colors">
                {rejectModal.mode === 'reject' ? '거절 처리' : '비활성화'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
