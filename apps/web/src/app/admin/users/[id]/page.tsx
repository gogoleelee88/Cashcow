'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Ban, Unlock, Coins, ChevronDown } from 'lucide-react';
import { adminApi } from '../../../../lib/admin-api';
import { Badge } from '../../../../components/admin/common/Badge';
import { ConfirmModal } from '../../../../components/admin/common/ConfirmModal';

interface UserDetail {
  id: string; email: string | null; username: string; displayName: string;
  avatarUrl: string | null; bio: string | null; role: string;
  subscriptionTier: string; creditBalance: number; isBanned: boolean;
  banReason: string | null; bannedUntil: string | null; isActive: boolean;
  isVerified: boolean; ageVerified: boolean; ageVerifiedAt: string | null;
  lastLoginAt: string | null; createdAt: string; updatedAt: string;
  oauthAccounts: { provider: string; createdAt: string }[];
  characters: { id: string; name: string; chatCount: number; isActive: boolean }[];
  transactions: { id: string; type: string; amount: number; credits: number; status: string; description: string; createdAt: string }[];
  reports: { id: string; reason: string; status: string; createdAt: string; reported: { id: string; username: string } }[];
  reportedContent: { id: string; reason: string; status: string; createdAt: string; reporter: { id: string; username: string } }[];
}

const roleVariant: Record<string, 'purple' | 'info' | 'default'> = {
  ADMIN: 'purple', CREATOR: 'info', USER: 'default',
};

type Tab = 'overview' | 'transactions' | 'reports' | 'characters';

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const router = useRouter();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');
  const [saving, setSaving] = useState(false);

  // ban modal
  const [banOpen, setBanOpen] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [banDuration, setBanDuration] = useState<string>('7');

  // unban modal
  const [unbanOpen, setUnbanOpen] = useState(false);

  // credit modal
  const [creditOpen, setCreditOpen] = useState(false);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');
  const [creditType, setCreditType] = useState<'+' | '-'>('+');

  async function load() {
    setLoading(true);
    try {
      const res = await adminApi.get(`/users/${id}`);
      setUser(res.data.data.user);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function handleRoleChange(role: string) {
    if (!user) return;
    setSaving(true);
    try {
      await adminApi.patch(`/users/${id}/role`, { role });
      setUser({ ...user, role });
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  async function handleBan() {
    setSaving(true);
    try {
      await adminApi.post(`/users/${id}/ban`, {
        reason: banReason,
        duration: banDuration === 'permanent' ? null : parseInt(banDuration),
      });
      setBanOpen(false);
      setBanReason('');
      await load();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  async function handleUnban() {
    setSaving(true);
    try {
      await adminApi.post(`/users/${id}/unban`);
      setUnbanOpen(false);
      await load();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  async function handleCredit() {
    if (!creditAmount || !creditReason) return;
    setSaving(true);
    try {
      const amount = parseInt(creditAmount) * (creditType === '-' ? -1 : 1);
      await adminApi.post(`/users/${id}/credits`, { amount, reason: creditReason });
      setCreditOpen(false);
      setCreditAmount('');
      setCreditReason('');
      await load();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-32 bg-gray-200 rounded-xl" />
        <div className="h-64 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        사용자를 찾을 수 없습니다.
      </div>
    );
  }

  const previewBalance = creditAmount
    ? user.creditBalance + parseInt(creditAmount || '0') * (creditType === '-' ? -1 : 1)
    : null;

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      {/* 뒤로가기 */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="w-4 h-4" /> 사용자 목록
      </button>

      {/* 프로필 카드 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl font-bold text-gray-500">
                {user.displayName[0]?.toUpperCase()}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-gray-900">{user.displayName}</h2>
              <Badge variant={roleVariant[user.role] ?? 'default'}>{user.role}</Badge>
              {user.isBanned && <Badge variant="danger">정지됨</Badge>}
            </div>
            <p className="text-sm text-gray-500">@{user.username} · {user.email}</p>
            {user.isBanned && user.banReason && (
              <p className="text-xs text-red-600 mt-1">
                정지 사유: {user.banReason}
                {user.bannedUntil && ` · ~${new Date(user.bannedUntil).toLocaleDateString('ko-KR')}`}
              </p>
            )}
          </div>

          {/* 액션 버튼 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* 역할 변경 */}
            <div className="relative">
              <select
                value={user.role}
                onChange={(e) => handleRoleChange(e.target.value)}
                disabled={saving}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 pr-7 appearance-none focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
              >
                <option value="USER">USER</option>
                <option value="CREATOR">CREATOR</option>
                <option value="ADMIN">ADMIN</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>

            <button
              onClick={() => setCreditOpen(true)}
              className="flex items-center gap-1.5 text-sm bg-amber-50 text-amber-700 border border-amber-200 rounded-lg px-3 py-1.5 hover:bg-amber-100 transition-colors"
            >
              <Coins className="w-4 h-4" /> 크레딧
            </button>

            {user.isBanned ? (
              <button
                onClick={() => setUnbanOpen(true)}
                className="flex items-center gap-1.5 text-sm bg-green-50 text-green-700 border border-green-200 rounded-lg px-3 py-1.5 hover:bg-green-100 transition-colors"
              >
                <Unlock className="w-4 h-4" /> 해제
              </button>
            ) : (
              <button
                onClick={() => setBanOpen(true)}
                className="flex items-center gap-1.5 text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-100 transition-colors"
              >
                <Ban className="w-4 h-4" /> 정지
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1">
          {(['overview', 'transactions', 'reports', 'characters'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {{ overview: '개요', transactions: '거래이력', reports: '신고이력', characters: '캐릭터' }[t]}
            </button>
          ))}
        </div>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        {tab === 'overview' && (
          <dl className="grid grid-cols-2 gap-4">
            {[
              ['가입일', new Date(user.createdAt).toLocaleString('ko-KR')],
              ['마지막 로그인', user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('ko-KR') : '없음'],
              ['크레딧 잔액', user.creditBalance.toLocaleString()],
              ['구독 플랜', user.subscriptionTier],
              ['이메일 인증', user.isVerified ? '완료' : '미완료'],
              ['성인 인증', user.ageVerified ? `완료 (${new Date(user.ageVerifiedAt!).toLocaleDateString('ko-KR')})` : '미완료'],
              ['OAuth 연동', user.oauthAccounts.map((o) => o.provider).join(', ') || '없음'],
              ['캐릭터 수', user.characters.length],
            ].map(([k, v]) => (
              <div key={String(k)}>
                <dt className="text-xs font-medium text-gray-500">{k}</dt>
                <dd className="text-sm text-gray-900 mt-0.5">{v}</dd>
              </div>
            ))}
          </dl>
        )}

        {tab === 'transactions' && (
          <div className="space-y-1">
            {user.transactions.length === 0 && <p className="text-sm text-gray-400">거래 내역 없음</p>}
            {user.transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-sm text-gray-800">{t.description}</p>
                  <p className="text-xs text-gray-400">{new Date(t.createdAt).toLocaleString('ko-KR')} · {t.type}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {t.amount > 0 ? `₩${t.amount.toLocaleString()}` : ''}
                    {t.credits !== 0 ? ` ${t.credits > 0 ? '+' : ''}${t.credits} 크레딧` : ''}
                  </p>
                  <Badge variant={t.status === 'COMPLETED' ? 'success' : t.status === 'FAILED' ? 'danger' : 'warning'}>{t.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'reports' && (
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">신고한 내역 ({user.reports.length})</h4>
              {user.reports.length === 0 && <p className="text-sm text-gray-400">없음</p>}
              {user.reports.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div>
                    <p className="text-sm text-gray-800">피신고: @{r.reported.username}</p>
                    <p className="text-xs text-gray-400">{r.reason} · {new Date(r.createdAt).toLocaleDateString('ko-KR')}</p>
                  </div>
                  <Badge variant={r.status === 'RESOLVED' ? 'success' : r.status === 'PENDING' ? 'warning' : 'gray'}>{r.status}</Badge>
                </div>
              ))}
            </div>
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">신고당한 내역 ({user.reportedContent.length})</h4>
              {user.reportedContent.length === 0 && <p className="text-sm text-gray-400">없음</p>}
              {user.reportedContent.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div>
                    <p className="text-sm text-gray-800">신고자: @{r.reporter.username}</p>
                    <p className="text-xs text-gray-400">{r.reason} · {new Date(r.createdAt).toLocaleDateString('ko-KR')}</p>
                  </div>
                  <Badge variant={r.status === 'RESOLVED' ? 'success' : r.status === 'PENDING' ? 'danger' : 'gray'}>{r.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'characters' && (
          <div className="space-y-1">
            {user.characters.length === 0 && <p className="text-sm text-gray-400">캐릭터 없음</p>}
            {user.characters.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <p className="text-sm text-gray-800">{c.name}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{c.chatCount.toLocaleString()} 채팅</span>
                  <Badge variant={c.isActive ? 'success' : 'gray'}>{c.isActive ? '활성' : '비활성'}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ban Modal */}
      <ConfirmModal
        open={banOpen}
        title="계정 정지"
        description=""
        confirmLabel="정지하기"
        isDestructive
        isLoading={saving}
        onConfirm={handleBan}
        onCancel={() => setBanOpen(false)}
      >
        <div className="space-y-3 mt-2">
          <div>
            <label className="text-xs font-medium text-gray-600">정지 기간</label>
            <select
              value={banDuration}
              onChange={(e) => setBanDuration(e.target.value)}
              className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"
            >
              <option value="7">7일</option>
              <option value="30">30일</option>
              <option value="90">90일</option>
              <option value="permanent">영구</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">정지 사유 <span className="text-red-500">*</span></label>
            <textarea
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              rows={3}
              className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none resize-none"
              placeholder="정지 사유를 입력하세요 (5자 이상)"
            />
          </div>
        </div>
      </ConfirmModal>

      {/* Unban Modal */}
      <ConfirmModal
        open={unbanOpen}
        title="정지 해제"
        description={`${user.displayName} 님의 계정 정지를 해제합니다.`}
        confirmLabel="해제하기"
        isLoading={saving}
        onConfirm={handleUnban}
        onCancel={() => setUnbanOpen(false)}
      />

      {/* Credit Modal */}
      <ConfirmModal
        open={creditOpen}
        title="크레딧 지급/차감"
        description=""
        confirmLabel="처리하기"
        isLoading={saving}
        onConfirm={handleCredit}
        onCancel={() => setCreditOpen(false)}
      >
        <div className="space-y-3 mt-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {(['+', '-'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setCreditType(t)}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  creditType === t ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {t === '+' ? '지급' : '차감'}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">금액</label>
            <input
              type="number"
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"
              placeholder="크레딧 수"
              min={1} max={100000}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">사유</label>
            <input
              value={creditReason}
              onChange={(e) => setCreditReason(e.target.value)}
              className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"
              placeholder="처리 사유"
            />
          </div>
          {previewBalance !== null && (
            <p className="text-xs text-gray-500">
              처리 후 잔액: <strong className="text-gray-900">{previewBalance.toLocaleString()} 크레딧</strong>
            </p>
          )}
        </div>
      </ConfirmModal>
    </div>
  );
}
