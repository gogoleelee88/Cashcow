'use client';

import { useState } from 'react';
import { Menu, Search, Bell, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sidebar } from './sidebar';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../stores/auth.store';
import Image from 'next/image';
import Link from 'next/link';

interface MainLayoutProps {
  children: React.ReactNode;
  showSearch?: boolean;
  title?: string;
}

export function MainLayout({ children, showSearch = true, title }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/explore?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content area — shifted right on desktop */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-[240px]">
        {/* Top nav bar */}
        <header className="sticky top-0 z-30 h-14 bg-background/80 backdrop-blur-xl border-b border-border flex items-center px-4 gap-3">
          {/* Mobile menu button */}
          <button
            className="lg:hidden p-2 rounded-xl hover:bg-surface text-text-secondary hover:text-text-primary transition-all"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          {title && (
            <h1 className="text-text-primary font-semibold text-base hidden sm:block">{title}</h1>
          )}

          {/* Search bar */}
          {showSearch && (
            <form onSubmit={handleSearch} className="flex-1 max-w-lg mx-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                <input
                  type="text"
                  placeholder="캐릭터 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-surface border border-border rounded-xl
                             text-text-primary placeholder-text-muted text-sm
                             focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/50
                             transition-all duration-200"
                />
              </div>
            </form>
          )}

          {/* Right side */}
          <div className="ml-auto flex items-center gap-2">
            {isAuthenticated && user ? (
              <>
                <Link href="/notifications"
                  className="p-2 rounded-xl hover:bg-surface text-text-secondary hover:text-text-primary transition-all relative">
                  <Bell className="w-5 h-5" />
                  {/* Notification dot */}
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand" />
                </Link>
                <Link href="/profile"
                  className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-border hover:ring-brand/40 transition-all flex-shrink-0">
                  {user.avatarUrl ? (
                    <Image src={user.avatarUrl} alt={user.displayName} width={32} height={32} className="object-cover" />
                  ) : (
                    <div className="w-full h-full bg-brand/30 flex items-center justify-center text-brand text-sm font-bold">
                      {user.displayName[0].toUpperCase()}
                    </div>
                  )}
                </Link>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className="btn-ghost text-sm py-1.5">로그인</Link>
                <Link href="/register" className="btn-primary text-sm py-1.5 px-4">시작하기</Link>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
