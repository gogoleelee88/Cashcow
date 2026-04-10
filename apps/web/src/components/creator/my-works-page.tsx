'use client';

import { useState, useMemo, useRef, useEffect as useEffectHook } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ChevronDown, X, Settings, ArrowRight, MessageCircle, Heart,
  Eye, EyeOff, Lock, AlertTriangle, MoreVertical, Trash2, Pencil, ExternalLink,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { useEffect } from 'react';
import { cn } from '../../lib/utils';
import { formatCount, formatRelativeTime } from '@characterverse/utils';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
type ContentFilter = 'all' | 'story' | 'character';
type VisibilityFilter = 'all' | 'PUBLIC' | 'PRIVATE' | 'UNLISTED';

// ─────────────────────────────────────────────
// 작품 만들기 MODAL
// ─────────────────────────────────────────────
function CreateWorkModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-8 left-16 w-28 h-36 bg-gray-200/60 rounded-2xl flex items-end p-2 opacity-70">
            <div className="w-full h-3/4 bg-gray-300/80 rounded-xl" />
          </div>
          <div className="absolute top-6 right-16 w-28 h-36 bg-gray-200/60 rounded-2xl opacity-70" />
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-6xl opacity-40">🩷</div>
          <div className="absolute bottom-12 left-8 text-5xl opacity-30">😊</div>
          <div className="absolute bottom-8 right-12 text-4xl opacity-30">⭐</div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="relative z-10 bg-white rounded-2xl shadow-2xl w-[700px] max-w-[calc(100vw-2rem)] mx-4 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-gray-900 font-bold text-lg">작품 만들기</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 grid grid-cols-2 gap-4">
            {/* 스토리 카드 */}
            <button
              onClick={() => { onClose(); router.push('/creator/story/new'); }}
              className="group rounded-xl overflow-hidden border border-gray-200 hover:border-gray-400 hover:shadow-md transition-all text-left"
            >
              <div className="relative h-44 overflow-hidden bg-gray-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/story-cover.jpg"
                  alt="스토리"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-white text-[11px] font-medium leading-relaxed drop-shadow-md">
                    순식간에 도달하는 이세계는<br />
                    역경도 설렘도 불안도 공포도 즐길 수 있었다
                  </p>
                </div>
              </div>
              <div className="p-4">
                <h3 className="text-gray-900 font-bold text-base mb-1.5">스토리</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  한 편의 이야기를 설계해 보세요.<br />
                  완성된 작품은 스토리 홈에 공유돼요.
                </p>
              </div>
            </button>

            {/* 캐릭터 카드 */}
            <button
              onClick={() => { onClose(); router.push('/creator/new'); }}
              className="group rounded-xl overflow-hidden border border-gray-200 hover:border-gray-400 hover:shadow-md transition-all text-left"
            >
              <div className="relative h-44 overflow-hidden bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/character-cover.jpg"
                  alt="캐릭터"
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                <div className="absolute bottom-3 right-3 flex flex-col items-end gap-1.5">
                  <div className="bg-white/95 shadow-md rounded-2xl rounded-br-sm px-3 py-2 max-w-[120px]">
                    <p className="text-gray-800 text-[11px] font-medium leading-relaxed">너랑 같은 조가 되었어 😊</p>
                  </div>
                  <div className="bg-white/95 shadow-md rounded-2xl rounded-br-sm px-3 py-2 max-w-[110px]">
                    <p className="text-gray-800 text-[11px] font-medium leading-relaxed">오늘부터 잘 부탁해 🩷</p>
                  </div>
                  <p className="text-white/70 text-[9px] mr-1">오후 3:24</p>
                </div>
              </div>
              <div className="p-4">
                <h3 className="text-gray-900 font-bold text-base mb-1.5">캐릭터</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  빠르게 나만의 캐릭터를 만들어요.<br />
                  완성된 캐릭터는 캐릭터 홈에 공유돼요.
                </p>
              </div>
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────
// DELETE CONFIRM MODAL
// ─────────────────────────────────────────────
function DeleteConfirmModal({
  title,
  onConfirm,
  onCancel,
  loading,
  error,
}: {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  error?: string | null;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 bg-white rounded-2xl shadow-2xl w-[360px] mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-5 h-5 text-red-500" />
        </div>
        <h3 className="text-gray-900 font-bold text-base text-center mb-1">작품을 삭제할까요?</h3>
        <p className="text-gray-400 text-sm text-center mb-1 leading-relaxed">
          <span className="font-medium text-gray-600">"{title}"</span>
        </p>
        <p className="text-gray-400 text-sm text-center mb-4">삭제하면 되돌릴 수 없어요.</p>
        {error && (
          <p className="text-red-500 text-xs text-center mb-4 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-60"
          >
            {loading ? '삭제 중...' : '삭제'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────
// KEBAB MENU
// ─────────────────────────────────────────────
function KebabMenu({
  editHref,
  viewHref,
  onDelete,
}: {
  editHref: string;
  viewHref?: string;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffectHook(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((p) => !p); }}
        className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden min-w-[140px]"
            onClick={(e) => e.stopPropagation()}
          >
            <Link
              href={editHref}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={() => setOpen(false)}
            >
              <Pencil className="w-3.5 h-3.5 text-gray-400" />
              수정하기
            </Link>
            {viewHref && (
              <Link
                href={viewHref}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={() => setOpen(false)}
                target="_blank"
              >
                <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                미리보기
              </Link>
            )}
            <div className="h-px bg-gray-100 mx-2" />
            <button
              onClick={() => { setOpen(false); onDelete(); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              삭제하기
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────
// VISIBILITY DROPDOWN
// ─────────────────────────────────────────────
function VisibilityDropdown({
  value,
  onChange,
}: {
  value: VisibilityFilter;
  onChange: (v: VisibilityFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const labels: Record<VisibilityFilter, string> = {
    all: '공개 여부',
    PUBLIC: '공개',
    PRIVATE: '비공개',
    UNLISTED: '링크 공유',
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        className={cn(
          'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all',
          value !== 'all'
            ? 'bg-gray-900 text-white border-gray-900'
            : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
        )}
      >
        {labels[value]}
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full mt-1 left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden min-w-[120px]"
          >
            {(['all', 'PUBLIC', 'PRIVATE', 'UNLISTED'] as VisibilityFilter[]).map((opt) => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                className={cn(
                  'w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors',
                  opt === value ? 'text-gray-900 font-semibold' : 'text-gray-600'
                )}
              >
                {labels[opt]}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────
function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-6xl mb-6 select-none">🧙</div>
      <h3 className="text-gray-900 font-bold text-xl mb-2">나만의 작품을 만들어 보세요</h3>
      <p className="text-gray-400 text-sm mb-8 leading-relaxed">
        내가 만든 작품을<br />
        자유롭게 플레이 할 수 있어요
      </p>
      <button
        onClick={onCreateClick}
        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors shadow-sm"
      >
        + 작품 만들기
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// WORK ITEM ROW (story & character 통합)
// ─────────────────────────────────────────────
function WorkItem({
  item,
  index,
  onDeleteRequest,
}: {
  item: any;
  index: number;
  onDeleteRequest: (item: any) => void;
}) {
  const isStory = item._type === 'story';

  const visIcon = item.visibility === 'PUBLIC'
    ? <Eye className="w-3 h-3 text-emerald-500" />
    : item.visibility === 'UNLISTED'
    ? <EyeOff className="w-3 h-3 text-amber-500" />
    : <Lock className="w-3 h-3 text-gray-400" />;

  const visLabel = item.visibility === 'PUBLIC' ? '공개'
    : item.visibility === 'UNLISTED' ? '링크 공유'
    : '비공개';

  const editHref = isStory
    ? `/creator/story/${item.id}/edit`
    : `/creator/edit/${item.id}`;

  const viewHref = isStory && item.status !== 'DRAFT'
    ? `/story/${item.id}`
    : !isStory
    ? `/characters/${item.id}`
    : undefined;

  const avatarSrc = isStory
    ? (item.coverUrl || `https://api.dicebear.com/8.x/shapes/svg?seed=${item.id}`)
    : (item.avatarUrl || `https://api.dicebear.com/8.x/personas/svg?seed=${item.name}&backgroundColor=f0f0f3`);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ delay: index * 0.04 }}
      className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50/50 transition-all group"
    >
      {/* Thumbnail */}
      <Link href={editHref} className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 ring-1 ring-gray-200 block">
        <Image
          src={avatarSrc}
          alt={item.title || item.name || ''}
          width={56}
          height={56}
          className="object-cover w-full h-full"
        />
      </Link>

      {/* Info */}
      <Link href={editHref} className="flex-1 min-w-0 block">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h3 className="text-gray-900 font-semibold text-sm truncate">
            {(isStory ? item.title?.trim() : item.name) || '제목 없음'}
          </h3>

          {/* 타입 배지 */}
          <span className={cn(
            'text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0',
            isStory ? 'bg-purple-50 text-purple-500' : 'bg-blue-50 text-blue-500'
          )}>
            {isStory ? '스토리' : '캐릭터'}
          </span>

          {/* 스토리 상태 배지 */}
          {isStory && (
            item.status === 'DRAFT' ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium flex-shrink-0">임시저장</span>
            ) : item.status === 'COMPLETED' ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium flex-shrink-0">완결</span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 font-medium flex-shrink-0">연재중</span>
            )
          )}
        </div>

        <div className="flex items-center gap-3 text-gray-400 text-xs">
          <div className="flex items-center gap-1">
            {visIcon}
            <span>{visLabel}</span>
          </div>
          <span className="text-gray-200">·</span>
          <span className="flex items-center gap-1">
            <MessageCircle className="w-3 h-3" />
            {formatCount(item.chatCount ?? 0)}
          </span>
          <span className="flex items-center gap-1">
            <Heart className="w-3 h-3" />
            {formatCount(item.likeCount ?? 0)}
          </span>
          <span className="text-gray-200">·</span>
          <span>{formatRelativeTime(item.createdAt)}</span>
        </div>
      </Link>

      {/* Kebab menu — 항상 표시 */}
      <KebabMenu
        editHref={editHref}
        viewHref={viewHref}
        onDelete={() => onDeleteRequest(item)}
      />
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export function MyWorksPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [contentFilter, setContentFilter] = useState<ContentFilter>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login?redirect=/creator');
  }, [isAuthenticated, authLoading, router]);

  const { data: charsData, isLoading: charsLoading } = useQuery({
    queryKey: ['characters', 'my'],
    queryFn: () => api.characters.my({ limit: 100 }),
    enabled: isAuthenticated,
  });

  const { data: storiesData, isLoading: storiesLoading } = useQuery({
    queryKey: ['stories', 'my'],
    queryFn: () => api.stories.my({ limit: 100 }),
    enabled: isAuthenticated,
  });

  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteStoryMut = useMutation({
    mutationFn: (id: string) => api.stories.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories', 'my'] });
      setDeleteTarget(null);
      setDeleteError(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.error || err?.message || '삭제에 실패했어요.';
      console.error('[삭제 오류]', err?.response?.status, msg);
      setDeleteError(String(msg));
    },
  });

  const deleteCharMut = useMutation({
    mutationFn: (id: string) => api.characters.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['characters', 'my'] });
      setDeleteTarget(null);
      setDeleteError(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.error || err?.message || '삭제에 실패했어요.';
      console.error('[삭제 오류]', err?.response?.status, msg);
      setDeleteError(String(msg));
    },
  });

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    if (deleteTarget._type === 'story') deleteStoryMut.mutate(deleteTarget.id);
    else deleteCharMut.mutate(deleteTarget.id);
  };

  const characters: any[] = charsData?.data ?? [];
  const stories: any[] = storiesData?.data ?? [];

  const allWorks = [
    ...characters.map((c: any) => ({ ...c, _type: 'character' })),
    ...stories.map((s: any) => ({ ...s, _type: 'story' })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filtered = allWorks.filter((item) => {
    if (contentFilter === 'character' && item._type !== 'character') return false;
    if (contentFilter === 'story' && item._type !== 'story') return false;
    if (visibilityFilter !== 'all' && item.visibility !== visibilityFilter) return false;
    return true;
  });

  const unregistered = allWorks.filter((item) => item.visibility === 'PRIVATE' || item.isDraft);
  const isLoading = charsLoading || storiesLoading;
  const isDeleting = deleteStoryMut.isPending || deleteCharMut.isPending;

  if (authLoading) return null;
  if (!isAuthenticated) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-gray-900 font-bold text-2xl">내 작품</h1>
          {allWorks.length > 0 && (
            <p className="text-gray-400 text-sm mt-0.5">총 {allWorks.length}개</p>
          )}
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors"
        >
          + 만들기
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {[
          { key: 'all', label: '전체' },
          { key: 'story', label: '스토리' },
          { key: 'character', label: '캐릭터' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setContentFilter(key as ContentFilter)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium border transition-all',
              contentFilter === key
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
            )}
          >
            {label}
          </button>
        ))}

        <VisibilityDropdown value={visibilityFilter} onChange={setVisibilityFilter} />

        {unregistered.length > 0 && (
          <button
            onClick={() => setVisibilityFilter('PRIVATE')}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium border transition-all',
              visibilityFilter === 'PRIVATE'
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
            )}
          >
            미등록
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100">
              <div className="w-14 h-14 rounded-xl bg-gray-100 animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-100 rounded animate-pulse w-1/3" />
                <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState onCreateClick={() => setShowModal(true)} />
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-2">
            {filtered.map((item, i) => (
              <WorkItem
                key={item.id}
                item={item}
                index={i}
                onDeleteRequest={setDeleteTarget}
              />
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* 만들기 모달 */}
      {showModal && <CreateWorkModal onClose={() => setShowModal(false)} />}

      {/* 삭제 확인 모달 */}
      {deleteTarget && (
        <DeleteConfirmModal
          title={deleteTarget.title?.trim() || deleteTarget.name || '제목 없음'}
          onConfirm={handleDeleteConfirm}
          onCancel={() => { setDeleteTarget(null); setDeleteError(null); }}
          loading={isDeleting}
          error={deleteError}
        />
      )}
    </div>
  );
}
