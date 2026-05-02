'use client';

import { usePathname } from 'next/navigation';
import { useAuthStore } from '../../stores/auth.store';

const PAGE_TITLES: Record<string, string> = {
  '/admin/dashboard': '대시보드',
  '/admin/users': '사용자 관리',
  '/admin/moderation/reports': '신고 처리',
  '/admin/moderation/bans': '차단 관리',
  '/admin/payments/transactions': '거래 내역',
  '/admin/payments/settlements': '정산 관리',
  '/admin/payments/subscriptions': '구독 현황',
  '/admin/official/characters': '공식 캐릭터',
  '/admin/official/stories': '공식 스토리',
};

function getTitle(pathname: string): string {
  for (const [prefix, title] of Object.entries(PAGE_TITLES)) {
    if (pathname.startsWith(prefix)) return title;
  }
  return '어드민';
}

export function AdminHeader() {
  const pathname = usePathname();
  const { user } = useAuthStore();

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 fixed top-0 left-60 right-0 z-10">
      <h1 className="text-[15px] font-semibold text-gray-900">{getTitle(pathname ?? '')}</h1>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
          {user?.displayName?.[0]?.toUpperCase() ?? 'A'}
        </div>
        <span className="text-sm text-gray-600 hidden sm:block">{user?.email ?? ''}</span>
      </div>
    </header>
  );
}
