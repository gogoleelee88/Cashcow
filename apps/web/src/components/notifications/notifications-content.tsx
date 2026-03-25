'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Bell, BellOff, Check, CheckCheck, Heart, MessageCircle, Star, UserPlus, Crown } from 'lucide-react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { formatRelativeTime } from '@characterverse/utils';
import { cn } from '../../lib/utils';

const NOTIFICATION_ICONS: Record<string, any> = {
  LIKE: Heart,
  COMMENT: MessageCircle,
  FOLLOW: UserPlus,
  FAVORITE: Star,
  CHAT: MessageCircle,
  SYSTEM: Bell,
  ACHIEVEMENT: Crown,
};

const NOTIFICATION_COLORS: Record<string, string> = {
  LIKE: 'text-rose-400 bg-rose-500/10',
  COMMENT: 'text-blue-400 bg-blue-500/10',
  FOLLOW: 'text-brand bg-brand/10',
  FAVORITE: 'text-amber-400 bg-amber-500/10',
  CHAT: 'text-emerald-400 bg-emerald-500/10',
  SYSTEM: 'text-text-muted bg-surface',
  ACHIEVEMENT: 'text-purple-400 bg-purple-500/10',
};

export function NotificationsContent() {
  const { isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications'),
    enabled: isAuthenticated,
    refetchInterval: 30_000,
  });

  const readAllMutation = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const readMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <Bell className="w-12 h-12 text-text-muted mb-4" />
        <h2 className="text-text-primary font-bold text-xl mb-2">로그인이 필요해요</h2>
        <Link href="/login" className="btn-primary">로그인</Link>
      </div>
    );
  }

  const notifications = (data as any)?.data?.notifications ?? [];
  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell className="w-6 h-6 text-brand" />
          <h1 className="text-text-primary font-bold text-2xl">알림</h1>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 bg-brand rounded-full text-white text-xs font-bold">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => readAllMutation.mutate()}
            disabled={readAllMutation.isPending}
            className="flex items-center gap-1.5 text-sm text-text-muted hover:text-brand transition-colors"
          >
            <CheckCheck className="w-4 h-4" />
            모두 읽음
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton rounded-xl h-20" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BellOff className="w-12 h-12 text-text-muted mb-4" />
          <h2 className="text-text-primary font-semibold text-lg mb-2">알림이 없어요</h2>
          <p className="text-text-muted text-sm">새로운 소식이 생기면 알려드릴게요.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification: any, i: number) => {
            const Icon = NOTIFICATION_ICONS[notification.type] ?? Bell;
            const colorClass = NOTIFICATION_COLORS[notification.type] ?? NOTIFICATION_COLORS.SYSTEM;

            return (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => !notification.isRead && readMutation.mutate(notification.id)}
                className={cn(
                  'flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer',
                  notification.isRead
                    ? 'border-border bg-transparent hover:bg-surface/50'
                    : 'border-brand/20 bg-brand/5 hover:bg-brand/10'
                )}
              >
                <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', colorClass)}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm leading-relaxed', notification.isRead ? 'text-text-secondary' : 'text-text-primary font-medium')}>
                    {notification.message}
                  </p>
                  <p className="text-text-muted text-xs mt-1">{formatRelativeTime(notification.createdAt)}</p>
                </div>
                {!notification.isRead && (
                  <div className="w-2 h-2 rounded-full bg-brand flex-shrink-0 mt-2" />
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
