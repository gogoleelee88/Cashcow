'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Flag, CreditCard,
  Star, ChevronRight, LogOut, Zap,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../stores/auth.store';
import { useRouter } from 'next/navigation';

const NAV = [
  {
    label: '대시보드',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: '사용자 관리',
    href: '/admin/users',
    icon: Users,
  },
  {
    label: '신고 처리',
    href: '/admin/moderation/reports',
    icon: Flag,
  },
  {
    label: '결제 & 정산',
    href: '/admin/payments/transactions',
    icon: CreditCard,
  },
  {
    label: '공식 콘텐츠',
    href: '/admin/official/characters',
    icon: Star,
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <aside className="w-60 h-screen bg-gray-900 flex flex-col flex-shrink-0 fixed left-0 top-0 z-20">
      {/* 로고 */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-gray-800">
        <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-sm">CharacterVerse</p>
          <p className="text-gray-500 text-[10px] uppercase tracking-widest">Admin</p>
        </div>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ label, href, icon: Icon }) => {
          const active = (pathname ?? '').startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group',
                active
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="w-3 h-3 opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* 로그아웃 */}
      <div className="px-3 py-4 border-t border-gray-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          로그아웃
        </button>
      </div>
    </aside>
  );
}
