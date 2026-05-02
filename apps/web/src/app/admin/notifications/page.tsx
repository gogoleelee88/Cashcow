'use client';

import { useEffect, useState, useCallback } from 'react';
import { Send, Users, User, Layers } from 'lucide-react';
import { adminApi } from '../../../lib/admin-api';
import { Pagination } from '../../../components/admin/common/Pagination';

interface Broadcast {
  id: string;
  title: string;
  body: string;
  targetType: string;
  targetValue: string | null;
  sentCount: number;
  sentBy: string;
  createdAt: string;
}

const TARGET_TYPES = [
  { value: 'ALL', label: '전체 유저', icon: Users },
  { value: 'TIER', label: '특정 티어', icon: Layers },
  { value: 'USER', label: '특정 유저', icon: User },
] as const;

const TIERS = ['FREE', 'BASIC', 'PREMIUM', 'VIP'];

const TARGET_TYPE_LABELS: Record<string, string> = {
  ALL: '전체',
  TIER: '티어',
  USER: '특정유저',
};

export default function NotificationsPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetType, setTargetType] = useState<'ALL' | 'TIER' | 'USER'>('ALL');
  const [targetValue, setTargetValue] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sentCount: number } | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const [history, setHistory] = useState<Broadcast[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(25);
  const [historyLoading, setHistoryLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await adminApi.get('/notifications/history', {
        params: { page: String(page), limit: String(limit) },
      });
      setHistory(res.data.data.broadcasts);
      setTotalPages(res.data.data.totalPages);
      setTotal(res.data.data.total);
    } finally {
      setHistoryLoading(false);
    }
  }, [page, limit]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    setSendResult(null);
    setSendError(null);
    try {
      const res = await adminApi.post('/notifications/broadcast', {
        title,
        body,
        targetType,
        targetValue: targetValue.trim() || undefined,
      });
      setSendResult({ sentCount: res.data.data.sentCount });
      setTitle('');
      setBody('');
      setTargetValue('');
      fetchHistory();
    } catch (err: any) {
      setSendError(err.response?.data?.error ?? '발송에 실패했습니다');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">알림 & 공지</h1>
        <p className="text-sm text-gray-500 mt-1">유저에게 공지사항 및 알림을 발송합니다</p>
      </div>

      {/* 발송 폼 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="font-semibold text-gray-900">공지 작성</h2>

        {/* 발송 대상 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">발송 대상</label>
          <div className="flex gap-2">
            {TARGET_TYPES.map(({ value, label, icon: Icon }) => (
              <button key={value} onClick={() => { setTargetType(value); setTargetValue(''); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  targetType === value
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}>
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
          {targetType === 'TIER' && (
            <div className="mt-3">
              <select value={targetValue} onChange={e => setTargetValue(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 w-48">
                <option value="">티어 선택</option>
                {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}
          {targetType === 'USER' && (
            <div className="mt-3">
              <input
                type="text"
                value={targetValue}
                onChange={e => setTargetValue(e.target.value)}
                placeholder="유저 ID 입력"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 w-72"
              />
            </div>
          )}
        </div>

        {/* 제목 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">제목 *</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="알림 제목"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
        </div>

        {/* 내용 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">내용 *</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="알림 내용"
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none"
          />
        </div>

        {/* 미리보기 */}
        {(title || body) && (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-xs text-gray-500 mb-2">미리보기</p>
            <div className="bg-white rounded-lg px-4 py-3 border border-gray-200 shadow-sm max-w-sm">
              <p className="font-semibold text-sm text-gray-900">{title || '(제목 없음)'}</p>
              <p className="text-xs text-gray-500 mt-1 whitespace-pre-line">{body || '(내용 없음)'}</p>
            </div>
          </div>
        )}

        {/* 결과 메시지 */}
        {sendResult && (
          <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg">
            ✓ {sendResult.sentCount.toLocaleString()}명에게 알림을 발송했습니다
          </div>
        )}
        {sendError && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">{sendError}</div>
        )}

        {/* 발송 버튼 */}
        <div className="flex justify-end">
          <button
            onClick={handleSend}
            disabled={sending || !title.trim() || !body.trim() || ((targetType === 'TIER' || targetType === 'USER') && !targetValue.trim())}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
            {sending ? '발송 중...' : '공지 발송'}
          </button>
        </div>
      </div>

      {/* 발송 이력 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">발송 이력</h2>
        </div>
        {historyLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">로딩 중...</div>
        ) : history.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">발송 이력이 없습니다</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">제목</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">내용</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">대상</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">발송 수</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">발송일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-xs">
                    <p className="line-clamp-1">{b.title}</p>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="text-sm text-gray-600 line-clamp-2">{b.body}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded font-medium">
                      {TARGET_TYPE_LABELS[b.targetType] ?? b.targetType}
                      {b.targetValue ? ` (${b.targetValue})` : ''}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                    {b.sentCount.toLocaleString()}명
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {new Date(b.createdAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="px-4">
          <Pagination page={page} totalPages={totalPages} total={total} limit={limit}
            onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} />
        </div>
      </div>
    </div>
  );
}
