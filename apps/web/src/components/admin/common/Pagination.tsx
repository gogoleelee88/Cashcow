'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface PaginationProps {
  page: number;
  totalPages: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}

export function Pagination({ page, totalPages, limit, total, onPageChange, onLimitChange }: PaginationProps) {
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between px-1 py-3">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span>{total > 0 ? `${from}–${to} / 전체 ${total.toLocaleString()}건` : '결과 없음'}</span>
        <select
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
          className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700 bg-white"
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>{n}개씩</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className={cn('w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 transition-colors', page <= 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-50')}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let p: number;
          if (totalPages <= 5) p = i + 1;
          else if (page <= 3) p = i + 1;
          else if (page >= totalPages - 2) p = totalPages - 4 + i;
          else p = page - 2 + i;
          return (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={cn('w-8 h-8 text-sm rounded-lg border transition-colors', p === page ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-700 hover:bg-gray-50')}
            >
              {p}
            </button>
          );
        })}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className={cn('w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 transition-colors', page >= totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-50')}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
