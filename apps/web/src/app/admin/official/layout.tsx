'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '../../../lib/utils';

const TABS = [
  { label: '캐릭터 관리', href: '/admin/official/characters' },
  { label: '스토리 관리', href: '/admin/official/stories' },
];

export default function OfficialLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 border-b border-gray-200 bg-white">
        <h2 className="text-lg font-bold text-gray-900 mb-3">공식 콘텐츠</h2>
        <div className="flex gap-1">
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                pathname === t.href
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
