'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, Bell, X, Menu, ChevronDown, BookOpen, Users, Image as ImageIcon, Bookmark, Plus, LogOut, Settings, User } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../stores/auth.store';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

interface MainLayoutProps {
  children: React.ReactNode;
  showSearch?: boolean;
}

const NAV_ITEMS = [
  { href: '/story', label: '스토리', icon: BookOpen },
  { href: '/', label: '캐릭터', icon: Users },
  { href: '/creator', label: '내 작품', icon: Bookmark },
  { href: '/images', label: '이미지', icon: ImageIcon },
];

export function MainLayout({ children, showSearch = true }: MainLayoutProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, logout, accessToken } = useAuthStore();
  const userMenuRef = useRef<HTMLDivElement>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/explore?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchFocused(false);
    }
  };

  const handleLogout = async () => {
    try {
      const { api } = await import('../../lib/api');
      const token = useAuthStore.getState().refreshToken;
      if (token) await api.auth.logout(token);
    } catch {}
    logout();
    router.push('/');
    setUserMenuOpen(false);
  };

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isNavActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href.split('?')[0]);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ─── TOP NAVIGATION ─── */}
      <header className="sticky top-0 z-40 bg-white border-b border-border shadow-nav">
        <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center gap-4">

          {/* Logo */}
          <Link href="/" className="flex-shrink-0 flex items-center gap-2 mr-2">
            <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center">
              <span className="text-white font-black text-sm">C</span>
            </div>
            <span className="font-black text-lg text-text-primary tracking-tight hidden sm:block">
              crack<span className="text-brand">.</span>
            </span>
          </Link>

          {/* Desktop nav tabs */}
          <nav className="hidden md:flex items-stretch h-14 gap-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 px-4 text-sm font-medium transition-all duration-150 relative',
                  'hover:text-text-primary',
                  isNavActive(href)
                    ? 'text-brand font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-brand after:rounded-t'
                    : 'text-text-secondary'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </nav>

          {/* Search bar */}
          {showSearch && (
            <form onSubmit={handleSearch} className="flex-1 max-w-sm mx-auto">
              <div className="relative">
                <Search className={cn(
                  'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors',
                  searchFocused ? 'text-brand' : 'text-text-muted'
                )} />
                <input
                  type="text"
                  placeholder="캐릭터, 스토리 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  className={cn(
                    'w-full pl-9 pr-4 py-2 bg-surface border rounded-xl text-sm',
                    'text-text-primary placeholder-text-muted',
                    'focus:outline-none transition-all duration-200',
                    searchFocused
                      ? 'border-brand/50 ring-2 ring-brand/15 bg-white'
                      : 'border-border hover:border-border-strong'
                  )}
                />
              </div>
            </form>
          )}

          {/* Right side actions */}
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            {isAuthenticated && user ? (
              <>
                {/* Create button */}
                <Link
                  href="/creator/new"
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand/10 text-brand hover:bg-brand/20 text-sm font-medium transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden lg:block">만들기</span>
                </Link>

                {/* Notifications */}
                <Link
                  href="/notifications"
                  className="relative p-2 rounded-xl hover:bg-surface text-text-muted hover:text-text-primary transition-all"
                >
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-brand" />
                </Link>

                {/* User avatar + dropdown */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen((v) => !v)}
                    className="flex items-center gap-1.5 p-1 rounded-xl hover:bg-surface transition-all"
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-border hover:ring-brand/30 transition-all flex-shrink-0">
                      {user.avatarUrl ? (
                        <Image src={user.avatarUrl} alt={user.displayName} width={32} height={32} className="object-cover" />
                      ) : (
                        <div className="w-full h-full bg-brand/15 flex items-center justify-center text-brand text-sm font-bold">
                          {user.displayName[0]?.toUpperCase() ?? 'U'}
                        </div>
                      )}
                    </div>
                    <ChevronDown className={cn('w-3.5 h-3.5 text-text-muted transition-transform hidden sm:block', userMenuOpen && 'rotate-180')} />
                  </button>

                  <AnimatePresence>
                    {userMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl border border-border shadow-card-hover py-2 z-50"
                      >
                        <div className="px-4 py-3 border-b border-border mb-1">
                          <p className="text-text-primary font-semibold text-sm truncate">{user.displayName}</p>
                          <p className="text-text-muted text-xs truncate">@{(user as any).username}</p>
                        </div>
                        <Link href={`/profile/${(user as any).username}`} onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-surface transition-all">
                          <User className="w-4 h-4" />프로필
                        </Link>
                        <Link href="/settings" onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-surface transition-all">
                          <Settings className="w-4 h-4" />설정
                        </Link>
                        <Link href="/settings/credits" onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-surface transition-all">
                          <span className="w-4 h-4 text-center text-xs font-bold text-amber-500">₩</span>
                          크레딧 충전
                        </Link>
                        <div className="border-t border-border mt-1 pt-1">
                          <button onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-all">
                            <LogOut className="w-4 h-4" />로그아웃
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors px-3 py-2">
                  로그인
                </Link>
                <Link href="/login" className="btn-primary text-sm py-2 px-4">
                  시작하기
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-xl hover:bg-surface text-text-muted hover:text-text-primary transition-all ml-1"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-50 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="fixed right-0 top-0 bottom-0 w-72 bg-white z-50 shadow-card-hover md:hidden flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <span className="font-black text-lg text-text-primary">crack<span className="text-brand">.</span></span>
                <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-xl hover:bg-surface">
                  <X className="w-5 h-5 text-text-muted" />
                </button>
              </div>
              <nav className="p-4 flex flex-col gap-1">
                {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                      isNavActive(href)
                        ? 'bg-brand/10 text-brand font-semibold'
                        : 'text-text-secondary hover:bg-surface hover:text-text-primary'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    {label}
                  </Link>
                ))}
              </nav>
              {isAuthenticated && user && (
                <div className="mt-auto p-4 border-t border-border">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-brand/15 flex items-center justify-center flex-shrink-0">
                      {user.avatarUrl ? (
                        <Image src={user.avatarUrl} alt={user.displayName} width={40} height={40} className="object-cover" />
                      ) : (
                        <span className="text-brand font-bold">{user.displayName[0]?.toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <p className="text-text-primary font-semibold text-sm">{user.displayName}</p>
                      <p className="text-text-muted text-xs">@{(user as any).username}</p>
                    </div>
                  </div>
                  <button onClick={handleLogout} className="w-full flex items-center gap-2 text-sm text-red-500 py-2 px-3 rounded-xl hover:bg-red-50">
                    <LogOut className="w-4 h-4" /> 로그아웃
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Page content */}
      <main className="flex-1 bg-background">
        {children}
      </main>
    </div>
  );
}
