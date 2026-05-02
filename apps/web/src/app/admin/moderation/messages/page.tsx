'use client';

import { useEffect, useState, useCallback } from 'react';
import { Eye, EyeOff, MessageSquare, X } from 'lucide-react';
import { adminApi } from '../../../../lib/admin-api';
import { Badge } from '../../../../components/admin/common/Badge';
import { Pagination } from '../../../../components/admin/common/Pagination';

interface Message {
  id: string;
  content: string;
  isHidden: boolean;
  hiddenReason: string | null;
  hiddenAt: string | null;
  isFiltered: boolean;
  createdAt: string;
  flags: { id: string; category: string; confidence: number; status: string }[];
  conversation: {
    id: string;
    character: { id: string; name: string; avatarUrl: string | null };
    user: { id: string; username: string };
  };
}

interface Stats {
  totalMessages: number;
  hiddenMessages: number;
  pendingFlags: number;
  pendingReports: number;
}

interface ConvMessage {
  id: string;
  role: string;
  content: string;
  isHidden: boolean;
  hiddenReason: string | null;
  createdAt: string;
  flags: { category: string; confidence: number; status: string }[];
}

const FILTER_TABS = ['ALL', 'FLAGGED', 'HIDDEN'] as const;

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [tab, setTab] = useState<typeof FILTER_TABS[number]>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [selectedConv, setSelectedConv] = useState<{ id: string; messages: ConvMessage[] } | null>(null);
  const [hideModal, setHideModal] = useState<{ messageId: string; isHidden: boolean } | null>(null);
  const [hideReason, setHideReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(limit) };
      if (tab === 'FLAGGED') params.flagged = 'true';
      if (tab === 'HIDDEN') params.hidden = 'true';
      const res = await adminApi.get('/moderation/messages', { params });
      setMessages(res.data.data.messages);
      setTotalPages(res.data.data.totalPages);
      setTotal(res.data.data.total ?? res.data.data.messages.length);
    } finally {
      setLoading(false);
    }
  }, [page, tab, limit]);

  const fetchStats = useCallback(async () => {
    const res = await adminApi.get('/moderation/stats');
    setStats(res.data.data);
  }, []);

  useEffect(() => { fetchMessages(); fetchStats(); }, [fetchMessages, fetchStats]);

  const openConversation = async (convId: string) => {
    const res = await adminApi.get(`/moderation/conversations/${convId}`);
    setSelectedConv({ id: convId, messages: res.data.data.messages });
  };

  const handleToggleHide = async () => {
    if (!hideModal) return;
    setSubmitting(true);
    try {
      if (hideModal.isHidden) {
        await adminApi.patch(`/moderation/messages/${hideModal.messageId}/unhide`);
      } else {
        await adminApi.patch(`/moderation/messages/${hideModal.messageId}/hide`, { reason: hideReason });
      }
      setHideModal(null);
      setHideReason('');
      fetchMessages();
      fetchStats();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI 응답 모니터링</h1>
        <p className="text-sm text-gray-500 mt-1">AI가 생성한 응답을 모니터링하고 유해 메시지를 처리합니다</p>
      </div>

      {/* 통계 */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: '오늘 메시지', value: stats.totalMessages, color: 'bg-blue-50 text-blue-700' },
            { label: '숨김 처리', value: stats.hiddenMessages, color: 'bg-orange-50 text-orange-700' },
            { label: '미처리 플래그', value: stats.pendingFlags, color: 'bg-red-50 text-red-700' },
            { label: '미처리 신고', value: stats.pendingReports, color: 'bg-yellow-50 text-yellow-700' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500">{label}</p>
              <p className={`text-2xl font-bold mt-1 ${color.split(' ')[1]}`}>{value.toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      {/* 필터 탭 */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {FILTER_TABS.map((t) => (
          <button key={t} onClick={() => { setTab(t); setPage(1); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'ALL' ? '전체' : t === 'FLAGGED' ? '플래그됨' : '숨김'}
          </button>
        ))}
      </div>

      {/* 메시지 목록 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">로딩 중...</div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">메시지가 없습니다</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">캐릭터 / 유저</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">메시지</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">상태</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">시간</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {messages.map((msg) => (
                <tr key={msg.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{msg.conversation.character.name}</p>
                    <p className="text-xs text-gray-400">@{msg.conversation.user.username}</p>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className={`text-sm line-clamp-2 ${msg.isHidden ? 'text-gray-400 italic' : 'text-gray-700'}`}>
                      {msg.isHidden ? `[숨김] ${msg.hiddenReason ?? ''}` : msg.content}
                    </p>
                    {msg.flags.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {msg.flags.map((f, i) => (
                          <span key={i} className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium">
                            {f.category} {Math.round(f.confidence * 100)}%
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {msg.isHidden
                      ? <Badge variant="danger">숨김</Badge>
                      : msg.flags.some(f => f.status === 'PENDING')
                        ? <Badge variant="warning">플래그</Badge>
                        : <Badge variant="success">정상</Badge>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {new Date(msg.createdAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openConversation(msg.conversation.id)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="대화 보기">
                        <MessageSquare className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setHideModal({ messageId: msg.id, isHidden: msg.isHidden }); setHideReason(''); }}
                        className={`p-1.5 rounded transition-colors ${msg.isHidden ? 'text-orange-400 hover:text-orange-600 hover:bg-orange-50' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'}`}
                        title={msg.isHidden ? '숨김 해제' : '숨김 처리'}>
                        {msg.isHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
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

      {/* 대화 슬라이드 패널 */}
      {selectedConv && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setSelectedConv(null)} />
          <div className="w-[480px] bg-white h-full flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">대화 내용</h3>
              <button onClick={() => setSelectedConv(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {selectedConv.messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'USER' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                    m.role === 'USER' ? 'bg-blue-500 text-white' :
                    m.isHidden ? 'bg-red-50 text-red-400 border border-red-200 italic' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {m.isHidden ? `[숨김] ${m.hiddenReason ?? ''}` : m.content}
                    {m.flags.length > 0 && (
                      <div className="mt-1 flex gap-1">
                        {m.flags.map((f, i) => (
                          <span key={i} className="text-[10px] bg-red-100 text-red-600 px-1 rounded">
                            {f.category}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 숨김 처리 모달 */}
      {hideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
            <h3 className="font-semibold text-gray-900 mb-4">
              {hideModal.isHidden ? '숨김 해제' : '메시지 숨김 처리'}
            </h3>
            {!hideModal.isHidden && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">숨김 사유 *</label>
                <textarea value={hideReason} onChange={e => setHideReason(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                  rows={3} placeholder="사유를 입력하세요" />
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setHideModal(null)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                취소
              </button>
              <button onClick={handleToggleHide} disabled={submitting || (!hideModal.isHidden && !hideReason.trim())}
                className="px-4 py-2 text-sm text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-lg transition-colors">
                {submitting ? '처리 중...' : hideModal.isHidden ? '숨김 해제' : '숨김 처리'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
