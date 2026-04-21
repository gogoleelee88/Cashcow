'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { adminApi } from '../../../lib/admin-api';
import { StatsGrid } from '../../../components/admin/dashboard/StatsGrid';
import { ActivityChart } from '../../../components/admin/dashboard/ActivityChart';
import { TopCharactersTable } from '../../../components/admin/dashboard/TopCharactersTable';

interface Stats {
  users: { total: number; todayNew: number; weeklyActive: number };
  content: { characters: number; stories: number; todayChats: number };
  revenue: { today: number; thisMonth: number; total: number };
  moderation: { pendingReports: number; bannedUsers: number };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [userChart, setUserChart] = useState<{ date: string; count: number }[]>([]);
  const [chatChart, setChatChart] = useState<{ date: string; count: number }[]>([]);
  const [revenueChart, setRevenueChart] = useState<{ date: string; amount: number }[]>([]);
  const [topChars, setTopChars] = useState<{ id: string; name: string; avatarUrl: string | null; chatCount: number; creatorName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, uc, cc, rc, tc] = await Promise.all([
        adminApi.get('/dashboard/stats').then((r) => r.data),
        adminApi.get('/dashboard/chart/users').then((r) => r.data),
        adminApi.get('/dashboard/chart/chats').then((r) => r.data),
        adminApi.get('/dashboard/chart/revenue').then((r) => r.data),
        adminApi.get('/dashboard/top-characters').then((r) => r.data),
      ]);
      setStats(s);
      setUserChart(uc);
      setChatChart(cc);
      setRevenueChart(rc);
      setTopChars(tc);
      setLastUpdated(new Date());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      if (!document.hidden) load();
    }, 30000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-52 bg-gray-200 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        데이터를 불러올 수 없습니다.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* 상단 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">대시보드</h2>
          {lastUpdated && (
            <p className="text-xs text-gray-400 mt-0.5">
              마지막 업데이트: {lastUpdated.toLocaleTimeString('ko-KR')}
            </p>
          )}
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          새로고침
        </button>
      </div>

      {/* 미처리 신고 배너 */}
      {stats.moderation.pendingReports > 0 && (
        <Link
          href="/admin/moderation/reports"
          className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-4 py-2.5 text-sm text-orange-700 hover:bg-orange-100 transition-colors"
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          미처리 신고 <strong>{stats.moderation.pendingReports}건</strong> 이 있습니다 → 바로가기
        </Link>
      )}

      {/* 통계 카드 */}
      <StatsGrid stats={stats} />

      {/* 차트 3개 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ActivityChart data={userChart} dataKey="count" title="신규 가입 (30일)" color="#6366f1" />
        <ActivityChart data={chatChart} dataKey="count" title="채팅 수 (30일)" color="#8b5cf6" />
        <ActivityChart
          data={revenueChart}
          dataKey="amount"
          title="수익 (30일)"
          color="#f59e0b"
          formatter={(v) => `₩${(v / 1000).toFixed(0)}K`}
        />
      </div>

      {/* 하단 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <TopCharactersTable characters={topChars} />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">빠른 링크</h3>
          {[
            { label: '미처리 신고 처리', href: '/admin/moderation/reports', badge: stats.moderation.pendingReports },
            { label: '사용자 관리', href: '/admin/users' },
            { label: '결제 내역', href: '/admin/payments/transactions' },
            { label: '정산 관리', href: '/admin/payments/settlements' },
            { label: '공식 캐릭터 관리', href: '/admin/official/characters' },
          ].map(({ label, href, badge }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 text-sm text-gray-700 transition-colors"
            >
              <span>{label}</span>
              {badge !== undefined && badge > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
