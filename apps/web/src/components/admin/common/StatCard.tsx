import { cn } from '../../../lib/utils';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: number; // 전일 대비 % (양수=증가, 음수=감소)
  iconColor?: string;
  className?: string;
}

export function StatCard({ title, value, icon: Icon, change, iconColor = 'text-blue-500', className }: StatCardProps) {
  return (
    <div className={cn('bg-white rounded-xl border border-gray-200 p-5 shadow-sm', className)}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-500">{title}</span>
        <div className={cn('w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center', iconColor)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {change !== undefined && (
          <span className={cn('text-xs font-medium mb-0.5', change >= 0 ? 'text-emerald-600' : 'text-red-500')}>
            {change >= 0 ? '▲' : '▼'} {Math.abs(change)}%
          </span>
        )}
      </div>
    </div>
  );
}
