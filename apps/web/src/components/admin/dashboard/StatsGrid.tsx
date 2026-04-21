'use client';

import { Users, MessageSquare, DollarSign, Flag, TrendingUp, Shield } from 'lucide-react';
import { StatCard } from '../common/StatCard';

interface DashboardStats {
  users: { total: number; todayNew: number; weeklyActive: number };
  content: { characters: number; stories: number; todayChats: number };
  revenue: { today: number; thisMonth: number; total: number };
  moderation: { pendingReports: number; bannedUsers: number };
}

function fmt(n: number) {
  return n.toLocaleString('ko-KR');
}

function krw(n: number) {
  return `₩${n.toLocaleString('ko-KR')}`;
}

export function StatsGrid({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      <StatCard icon={Users} title="전체 사용자" value={fmt(stats.users.total)} iconColor="text-blue-500" />
      <StatCard icon={TrendingUp} title="주간 활성 유저" value={fmt(stats.users.weeklyActive)} iconColor="text-green-500" />
      <StatCard icon={MessageSquare} title="오늘 채팅" value={fmt(stats.content.todayChats)} iconColor="text-purple-500" />
      <StatCard icon={DollarSign} title="오늘 수익" value={krw(stats.revenue.today)} iconColor="text-yellow-500" />
      <StatCard
        icon={Flag}
        title="미처리 신고"
        value={fmt(stats.moderation.pendingReports)}
        iconColor={stats.moderation.pendingReports > 0 ? 'text-red-500' : 'text-gray-400'}
      />
      <StatCard icon={Shield} title="정지 계정" value={fmt(stats.moderation.bannedUsers)} iconColor="text-gray-500" />
    </div>
  );
}
