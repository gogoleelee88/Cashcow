'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, Compass, Heart, MessageCircle, PlusCircle,
  Settings, Crown, ChevronRight, Zap, Star,
  Gamepad2, Film, Book, Sparkles, Music, History, Globe, TvMinimal,
  CreditCard, Bell, LogOut, User, ShieldCheck
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import { formatCount } from '@characterverse/utils';
import type { CharacterCategory } from '@characterverse/types';

const MAIN_NAV = [
  { href: '/', icon: Home, label: '홈' },
  { href: '/explore', icon: Compass, label: '탐색' },
  { href: '/chat', icon: MessageCircle, label: '대화' },
  { href: '/favorites', icon: Heart, label: '즐겨찾기' },
];

const CATEGORIES: Array<{ category: CharacterCategory; icon: React.ElementType; label: string; color: string }> = [
  { category: 'ANIME', icon: Star, label: '애니메이션', color: 'text-pink-400' },
  { category: 'GAME', icon: Gamepad2, label: '게임', color: 'text-blue-400' },
  { category: 'MOVIE', icon: Film, label: '영화/드라마', color: 'text-amber-400' },
  { category: 'BOOK', icon: Book, label: '책/소설', color: 'text-emerald-400' },
  { category: 'ORIGINAL', icon: Sparkles, label: '오리지널', color: 'text-purple-400' },
  { category: 'CELEBRITY', icon: Music, label: '셀럽', color: 'text-rose-400' },
  { category: 'HISTORICAL', icon: History, label: '역사', color: 'text-orange-400' },
  { category: 'VTUBER', icon: TvMinimal, label: 'VTuber', color: 'text-cyan-400' },
  { category: 'OTHER', icon: Globe, label: '기타', color: 'text-gray-400' },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout, refreshToken } = useAuthStore();

  const handleLogout = async () => {
    if (refreshToken) {
      await api.auth.logout(refreshToken).catch(() => {});
    }
    logout();
    router.push('/');
  };

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        className={cn(
          'fixed left-0 top-0 h-full w-[240px] z-50',
          'bg-gradient-to-b from-background-secondary to-background',
          'border-r border-border flex flex-col',
          'lg:translate-x-0 transition-transform duration-300',
          !isOpen && '-translate-x-full lg:translate-x-0'
        )}
        initial={false}
      >
        {/* Logo */}
        <div className="p-5 border-b border-border">
          <Link href="/" className="flex items-center gap-2.5" onClick={onClose}>
            <div className="w-8 h-8 rounded-xl bg-brand-gradient flex items-center justify-center shadow-brand">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg gradient-text">CharacterVerse</span>
          </Link>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto py-4 hide-scrollbar">
          {/* Main navigation */}
          <nav className="px-3 mb-6">
            <p className="text-text-muted text-xs font-semibold uppercase tracking-wider px-3 mb-2">
              메인
            </p>
            {MAIN_NAV.map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn(
                  'sidebar-item',
                  (href === '/' ? pathname === '/' : pathname?.startsWith(href)) && 'sidebar-item-active'
                )}
              >
                <Icon className="w-4.5 h-4.5 flex-shrink-0" />
                <span>{label}</span>
                {href === '/chat' && isAuthenticated && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-brand animate-pulse" />
                )}
              </Link>
            ))}
          </nav>

          {/* Create character CTA */}
          <div className="px-3 mb-6">
            <Link
              href="/creator/new"
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl
                         bg-brand/10 hover:bg-brand/15 border border-brand/20 hover:border-brand/40
                         text-brand-light text-sm font-medium transition-all duration-200"
            >
              <PlusCircle className="w-4.5 h-4.5" />
              <span>캐릭터 만들기</span>
              <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-60" />
            </Link>
          </div>

          {/* Categories */}
          <nav className="px-3 mb-6">
            <p className="text-text-muted text-xs font-semibold uppercase tracking-wider px-3 mb-2">
              카테고리
            </p>
            {CATEGORIES.map(({ category, icon: Icon, label, color }) => (
              <Link
                key={category}
                href={`/explore?category=${category}`}
                onClick={onClose}
                className={cn(
                  'sidebar-item',
                  pathname === '/explore' && new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('category') === category && 'sidebar-item-active'
                )}
              >
                <Icon className={cn('w-4.5 h-4.5 flex-shrink-0', color)} />
                <span>{label}</span>
              </Link>
            ))}
          </nav>

          {/* Creator section */}
          {isAuthenticated && (
            <div className="px-3 mb-6">
              <p className="text-text-muted text-xs font-semibold uppercase tracking-wider px-3 mb-2">
                크리에이터
              </p>
              <Link
                href="/creator"
                onClick={onClose}
                className={cn('sidebar-item', pathname?.startsWith('/creator') && 'sidebar-item-active')}
              >
                <Crown className="w-4.5 h-4.5 text-amber-400 flex-shrink-0" />
                <span>크리에이터 스튜디오</span>
              </Link>
            </div>
          )}
        </div>

        {/* Bottom — User section */}
        <div className="border-t border-border p-3">
          {isAuthenticated && user ? (
            <>
              {/* Credits */}
              <Link
                href="/settings/credits"
                className="flex items-center gap-2 px-3 py-2 rounded-xl
                           bg-brand/10 hover:bg-brand/15 border border-brand/20
                           text-brand-light text-sm mb-2 transition-all duration-200"
              >
                <CreditCard className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-xs">크레딧</span>
                <span className="font-bold text-sm">{formatCount(user.creditBalance)}</span>
              </Link>

              {/* User info */}
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-surface cursor-pointer transition-all duration-150 group"
                   onClick={() => { router.push('/profile'); onClose?.(); }}>
                <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-border group-hover:ring-brand/40 transition-all flex-shrink-0">
                  {user.avatarUrl ? (
                    <Image src={user.avatarUrl} alt={user.displayName} width={32} height={32} className="object-cover" />
                  ) : (
                    <div className="w-full h-full bg-brand/30 flex items-center justify-center text-brand text-sm font-bold">
                      {user.displayName[0].toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-text-primary text-sm font-medium truncate">{user.displayName}</p>
                  <p className="text-text-muted text-xs truncate">@{user.username}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Link href="/settings" onClick={(e) => e.stopPropagation()}>
                    <Settings className="w-4 h-4 text-text-muted hover:text-text-primary transition-colors" />
                  </Link>
                </div>
              </div>

              {user.role === 'ADMIN' && (
                <Link
                  href="/admin"
                  onClick={() => onClose?.()}
                  className="mt-1 w-full flex items-center gap-2.5 px-3 py-2 rounded-xl
                             text-amber-400 hover:text-amber-300 hover:bg-amber-500/10
                             text-sm transition-all duration-150"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>관리자 패널</span>
                </Link>
              )}

              <button
                onClick={handleLogout}
                className="mt-1 w-full flex items-center gap-2.5 px-3 py-2 rounded-xl
                           text-text-muted hover:text-red-400 hover:bg-red-500/10
                           text-sm transition-all duration-150"
              >
                <LogOut className="w-4 h-4" />
                <span>로그아웃</span>
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <User className="w-4 h-4" />
              시작하기
            </Link>
          )}
        </div>
      </motion.aside>
    </>
  );
}
