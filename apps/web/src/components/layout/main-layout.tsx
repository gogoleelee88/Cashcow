'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Bell, X, Menu, ChevronDown, BookOpen, Users, Image as ImageIcon, Bookmark, Plus, LogOut, Settings, User, ShieldCheck, Baby, Clock } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../stores/auth.store';
import { useProfileStore } from '../../stores/profile.store';
import { api } from '../../lib/api';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

const HISTORY_KEY = 'zacoo_search_history';
const MAX_HISTORY = 10;

function loadHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]'); } catch { return []; }
}
function saveHistory(h: string[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
}

interface MainLayoutProps {
  children: React.ReactNode;
  showSearch?: boolean;
}

const NAV_ITEMS_DEFAULT = [
  { href: '/story', label: '스토리', icon: BookOpen },
  { href: '/characters', label: '캐릭터', icon: Users },
  { href: '/creator', label: '내 작품', icon: Bookmark },
  { href: '/images', label: '포토카드', icon: ImageIcon },
];

const NAV_ITEMS_KIDS = [
  { href: '/story', label: '스토리', icon: BookOpen },
  { href: '/characters', label: '캐릭터', icon: Users },
];

export function MainLayout({ children, showSearch = true }: MainLayoutProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, logout, accessToken } = useAuthStore();
  const { activeProfile, clearProfile } = useProfileStore();
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearchHistory(loadHistory());
  }, []);

  const openMobileSearch = () => {
    setMobileSearchOpen(true);
    setTimeout(() => mobileSearchInputRef.current?.focus(), 80);
  };

  const addHistory = useCallback((q: string) => {
    setSearchHistory(prev => {
      const next = [q, ...prev.filter(h => h !== q)].slice(0, MAX_HISTORY);
      saveHistory(next);
      return next;
    });
  }, []);

  const removeHistory = useCallback((idx: number) => {
    setSearchHistory(prev => {
      const next = prev.filter((_, i) => i !== idx);
      saveHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    saveHistory([]);
  }, []);

  const isKids = activeProfile?.isKids ?? false;
  const NAV_ITEMS = isKids ? NAV_ITEMS_KIDS : NAV_ITEMS_DEFAULT;

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.users.notifications(),
    enabled: isAuthenticated,
    refetchInterval: 60_000,
  });
  const unreadCount = (notifData as any)?.meta?.unreadCount ?? 0;

  // 키즈 모드 body 클래스
  useEffect(() => {
    if (isKids) {
      document.documentElement.classList.add('kids-mode');
    } else {
      document.documentElement.classList.remove('kids-mode');
    }
    return () => document.documentElement.classList.remove('kids-mode');
  }, [isKids]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      addHistory(q);
      router.push(`/explore?q=${encodeURIComponent(q)}`);
      setSearchFocused(false);
    }
  };

  const handleMobileSearch = (q: string) => {
    if (!q.trim()) return;
    addHistory(q.trim());
    setMobileSearchOpen(false);
    setSearchQuery('');
    router.push(`/explore?q=${encodeURIComponent(q.trim())}`);
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
      {/* 키즈 모드 배너 */}
      {isKids && (
        <div className="kids-mode-banner flex items-center justify-center gap-2 sticky top-0 z-50">
          <Baby className="w-3.5 h-3.5" />
          키즈 모드 — 전체 이용가 콘텐츠만 표시됩니다
          <button
            onClick={() => { clearProfile(); router.push('/profiles'); }}
            className="ml-3 underline underline-offset-2 opacity-80 hover:opacity-100"
          >
            프로필 변경
          </button>
        </div>
      )}

      {/* ─── TOP NAVIGATION ─── */}
      <header className="sticky top-0 z-40 bg-white border-b border-border shadow-nav">
        <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center gap-4">

          {/* Logo */}
          <Link href="/" className="flex-shrink-0 flex items-center gap-2 mr-2">
            <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center">
              <span className="text-white font-black text-sm">Z</span>
            </div>
            <div className="hidden sm:flex items-baseline gap-1.5">
              <span className="font-black text-lg text-text-primary tracking-tight">
                Zac<span className="text-xl">∞</span>
              </span>
              {isKids && (
                <span className="text-xs font-bold text-sky-500 tracking-tight">
                  키즈&amp;패밀리
                </span>
              )}
            </div>
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

          {/* Search — 데스크탑: full bar / 모바일: 아이콘만 */}
          {showSearch && (
            <>
              {/* md 이상: 전체 검색 바 */}
              <form onSubmit={handleSearch} className="hidden md:block flex-1 max-w-sm mx-auto">
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

              {/* md 미만: 돋보기 아이콘 */}
              <button
                onClick={openMobileSearch}
                className="md:hidden p-2 rounded-xl hover:bg-surface text-text-muted hover:text-brand transition-all"
              >
                <Search className="w-5 h-5" />
              </button>
            </>
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

                {/* Notifications — 데스크탑(md+)에서만 */}
                <Link
                  href="/notifications"
                  className="relative hidden md:flex p-2 rounded-xl hover:bg-surface text-text-muted hover:text-text-primary transition-all"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-brand" />
                  )}
                </Link>

                {/* User avatar + dropdown — 데스크탑(md+)에서만 */}
                <div className="relative hidden md:block" ref={userMenuRef}>
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
                    <ChevronDown className={cn('w-3.5 h-3.5 text-text-muted transition-transform', userMenuOpen && 'rotate-180')} />
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
                          {activeProfile && (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <span className="text-base">{activeProfile.avatarEmoji}</span>
                              <span className="text-xs text-text-muted">{activeProfile.name}</span>
                              {activeProfile.isKids && <Baby className="w-3 h-3 text-sky-400" />}
                            </div>
                          )}
                        </div>
                        <button onClick={() => { setUserMenuOpen(false); clearProfile(); router.push('/profiles'); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-surface transition-all">
                          <span className="text-base">{activeProfile?.avatarEmoji ?? '👤'}</span>프로필 전환
                        </button>
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
                        {(user as any).role === 'ADMIN' && (
                          <Link href="/admin" onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-amber-500 hover:bg-amber-50 transition-all font-medium">
                            <ShieldCheck className="w-4 h-4" />관리자 패널
                          </Link>
                        )}
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
              <Link href="/login" className="btn-primary text-sm py-2 px-4">
                시작하기
              </Link>
            )}

            {/* Mobile menu button — 알림 배지 포함 */}
            <button
              className="md:hidden relative p-2 rounded-xl hover:bg-surface text-text-muted hover:text-text-primary transition-all ml-1"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 rounded-full bg-green-500 text-white text-[10px] font-bold flex items-center justify-center px-0.5 leading-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
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
                <span className="font-black text-lg text-text-primary">Zac<span className="text-xl">∞</span></span>
                <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-xl hover:bg-surface">
                  <X className="w-5 h-5 text-text-muted" />
                </button>
              </div>
              <nav className="p-4 flex flex-col gap-1 flex-1 overflow-y-auto">
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

                {/* 알림 */}
                {isAuthenticated && (
                  <Link
                    href="/notifications"
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                      isNavActive('/notifications')
                        ? 'bg-brand/10 text-brand font-semibold'
                        : 'text-text-secondary hover:bg-surface hover:text-text-primary'
                    )}
                  >
                    <Bell className="w-5 h-5" />
                    알림
                    {unreadCount > 0 && (
                      <span className="ml-auto min-w-[20px] h-5 rounded-full bg-green-500 text-white text-[11px] font-bold flex items-center justify-center px-1 leading-none">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </Link>
                )}

                {/* 프로필/설정/크레딧 — 구분선 */}
                {isAuthenticated && user && (
                  <>
                    <div className="my-2 border-t border-border" />
                    <button
                      onClick={() => { setMobileMenuOpen(false); clearProfile(); router.push('/profiles'); }}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-text-secondary hover:bg-surface hover:text-text-primary transition-all"
                    >
                      <span className="text-base w-5 h-5 flex items-center justify-center">{activeProfile?.avatarEmoji ?? '👤'}</span>
                      프로필 전환
                    </button>
                    <Link
                      href={`/profile/${(user as any).username}`}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-text-secondary hover:bg-surface hover:text-text-primary transition-all"
                    >
                      <User className="w-5 h-5" />프로필
                    </Link>
                    <Link
                      href="/settings"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-text-secondary hover:bg-surface hover:text-text-primary transition-all"
                    >
                      <Settings className="w-5 h-5" />설정
                    </Link>
                    <Link
                      href="/settings/credits"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-text-secondary hover:bg-surface hover:text-text-primary transition-all"
                    >
                      <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-amber-500">₩</span>
                      크레딧 충전
                    </Link>
                  </>
                )}
              </nav>

              {isAuthenticated && user && (
                <div className="p-4 border-t border-border flex-shrink-0">
                  {/* 유저 정보 */}
                  <div className="flex items-center gap-3 mb-3 px-1">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-brand/15 flex items-center justify-center flex-shrink-0">
                      {user.avatarUrl ? (
                        <Image src={user.avatarUrl} alt={user.displayName} width={40} height={40} className="object-cover" />
                      ) : (
                        <span className="text-brand font-bold">{user.displayName[0]?.toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-text-primary font-semibold text-sm truncate">{user.displayName}</p>
                      <p className="text-text-muted text-xs truncate">@{(user as any).username}</p>
                    </div>
                  </div>
                  {(user as any).role === 'ADMIN' && (
                    <Link href="/admin" onClick={() => setMobileMenuOpen(false)}
                      className="w-full flex items-center gap-2 text-sm text-amber-500 py-2.5 px-3 rounded-xl hover:bg-amber-50 font-medium mb-1 transition-all">
                      <ShieldCheck className="w-4 h-4" /> 관리자 패널
                    </Link>
                  )}
                  <button onClick={handleLogout} className="w-full flex items-center gap-2 text-sm text-red-500 py-2.5 px-3 rounded-xl hover:bg-red-50 transition-all">
                    <LogOut className="w-4 h-4" /> 로그아웃
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── 모바일 검색 패널 ── */}
      <AnimatePresence>
        {mobileSearchOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-white flex flex-col md:hidden"
          >
            {/* 상단 입력 바 */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-white">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand pointer-events-none" />
                <input
                  ref={mobileSearchInputRef}
                  type="text"
                  placeholder="캐릭터, 스토리 검색..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleMobileSearch(searchQuery); }}
                  className="w-full pl-9 pr-4 py-2.5 bg-surface border border-brand/40 ring-2 ring-brand/10 rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                onClick={() => { setMobileSearchOpen(false); setSearchQuery(''); }}
                className="flex-shrink-0 text-sm font-medium text-text-secondary hover:text-brand transition-colors px-1"
              >
                취소
              </button>
            </div>

            {/* 검색 기록 */}
            <div className="flex-1 overflow-y-auto">
              {searchHistory.length > 0 ? (
                <>
                  <div className="flex items-center justify-between px-5 pt-5 pb-2">
                    <span className="text-xs font-bold text-text-muted tracking-wide uppercase">최근 검색</span>
                    <button
                      onClick={clearHistory}
                      className="text-xs text-brand hover:text-brand/70 font-medium transition-colors"
                    >
                      전체 삭제
                    </button>
                  </div>
                  <ul className="px-3 pb-4">
                    {searchHistory.map((q, i) => (
                      <li key={i}>
                        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface transition-colors group">
                          <Clock className="w-4 h-4 text-text-muted flex-shrink-0" />
                          <button
                            className="flex-1 text-left text-sm text-text-primary truncate"
                            onClick={() => { setSearchQuery(q); handleMobileSearch(q); }}
                          >
                            {q}
                          </button>
                          <button
                            onClick={() => removeHistory(i)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-text-primary"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-text-muted">
                  <div className="w-12 h-12 rounded-2xl bg-surface flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </div>
                  <p className="text-sm">최근 검색 기록이 없어요</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page content */}
      <main className="flex-1 bg-background">
        {children}
      </main>
    </div>
  );
}
