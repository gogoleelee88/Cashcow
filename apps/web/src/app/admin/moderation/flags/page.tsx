'use client';

import { useEffect, useState, useCallback } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { adminApi } from '../../../../lib/admin-api';
import { Badge } from '../../../../components/admin/common/Badge';
import { Pagination } from '../../../../components/admin/common/Pagination';

interface Flag {
  id: string;
  category: string;
  confidence: number;
  status: string;
  autoHidden: boolean;
  createdAt: string;
  message: {
    id: string;
    content: string;
    isHidden: boolean;
    conversation: {
      id: string;
      character: { id: string; name: string };
      user: { id: string; username: string };
    };
  };
}

const STATUS_TABS = ['PENDING', 'REVIEWED', 'DISMISSED', 'ALL'] as const;

const CATEGORY_LABELS: Record<string, string> = {
  HATE: '혐오',
  SEXUAL: '성적',
  VIOLENCE: '폭력',
  SELF_HARM: '자해',
  HARASSMENT: '괴롭힘',
  ILLEGAL: '불법',
};

function confidenceColor(c: number) {
  if (c >= 0.9) return 'bg-red-100 text-red-700 border border-red-300';
  if (c >= 0.7) return 'bg-orange-100 text-orange-700 border border-orange-300';
  return 'bg-yellow-100 text-yellow-700 border border-yellow-300';
}

export default function FlagsPage() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [tab, setTab] = useState<typeof STATUS_TABS[number]>('PENDING');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const fetchFlags = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(limit),
        status: tab,
      };
      const res = await adminApi.get('/moderation/flags', { params });
      setFlags(res.data.data.flags);
      setTotalPages(res.data.data.totalPages);
      setTotal(res.data.data.total);
    } finally {
      setLoading(false);
    }
  }, [page, tab, limit]);

  useEffect(() => { fetchFlags(); }, [fetchFlags]);

  const handleConfirm = async (id: string) => {
    setActing(id);
    try {
      await adminApi.post(`/moderation/flags/${id}/confirm`);
      fetchFlags();
    } finally {
      setActing(null);
    }
  };

  const handleDismiss = async (id: string) => {
    setActing(id);
    try {
      await adminApi.post(`/moderation/flags/${id}/dismiss`);
      fetchFlags();
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">자동 플래그</h1>
        <p className="text-sm text-gray-500 mt-1">AI가 자동 감지한 유해 콘텐츠를 검토하고 처리합니다</p>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {STATUS_TABS.map((t) => (
          <button key={t} onClick={() => { setTab(t); setPage(1); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'PENDING' ? '미처리' : t === 'REVIEWED' ? '처리됨' : t === 'DISMISSED' ? '무해 판정' : '전체'}
          </button>
        ))}
      </div>

      {/* 플래그 목록 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">로딩 중...</div>
        ) : flags.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">플래그가 없습니다</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">카테고리 / 신뢰도</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">메시지 내용</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">캐릭터 / 유저</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">상태</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">시간</th>
                {tab === 'PENDING' && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {flags.map((flag) => (
                <tr key={flag.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-gray-700">
                        {CATEGORY_LABELS[flag.category] ?? flag.category}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full w-fit ${confidenceColor(flag.confidence)}`}>
                        {Math.round(flag.confidence * 100)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className={`text-sm line-clamp-2 ${flag.message.isHidden ? 'text-gray-400 italic' : 'text-gray-700'}`}>
                      {flag.message.isHidden ? '[숨김 처리됨]' : flag.message.content}
                    </p>
                    {flag.autoHidden && (
                      <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded mt-1 inline-block">자동 숨김</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 text-xs">{flag.message.conversation.character.name}</p>
                    <p className="text-xs text-gray-400">@{flag.message.conversation.user.username}</p>
                  </td>
                  <td className="px-4 py-3">
                    {flag.status === 'PENDING'
                      ? <Badge variant="warning">미처리</Badge>
                      : flag.status === 'REVIEWED'
                        ? <Badge variant="danger">유해 확정</Badge>
                        : <Badge variant="success">무해 판정</Badge>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {new Date(flag.createdAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  {tab === 'PENDING' && (
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => handleConfirm(flag.id)}
                          disabled={acting === flag.id}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-lg transition-colors"
                          title="유해 확정 → 숨김 처리"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          유해 확정
                        </button>
                        <button
                          onClick={() => handleDismiss(flag.id)}
                          disabled={acting === flag.id}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded-lg transition-colors"
                          title="무해 판정 → 플래그 해제"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          무해
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
    </div>
  );
}
