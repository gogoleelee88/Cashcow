'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import {
  ArrowLeft, HelpCircle, History, AlertCircle,
  Loader2, Sparkles, X, ChevronRight, Upload, CheckCircle2,
  Pencil, Trash2, ImagePlus, Send, Check, BookOpen,
  ChevronUp, GripVertical,
} from 'lucide-react';
import { api, streamPreviewChat } from '../../lib/api';
import { apiClient } from '../../lib/api';
import { cn } from '../../lib/utils';
import { toast } from '../ui/toaster';
import { useAuthStore } from '../../stores/auth.store';
import { ImageCropModal } from '../ui/image-crop-modal';

// ─────────────────────────────────────────────
// TABS
// ─────────────────────────────────────────────
type CharacterTab = 'settings' | 'intro' | 'prompt' | 'advanced' | 'detail';

const TABS: { key: CharacterTab; label: string; required?: boolean }[] = [
  { key: 'settings', label: '캐릭터 설정', required: true },
  { key: 'intro',    label: '인트로',      required: true },
  { key: 'prompt',   label: '프롬프트',    required: true },
  { key: 'advanced', label: '고급 기능' },
  { key: 'detail',   label: '캐릭터 상세', required: true },
];

// ─────────────────────────────────────────────
// POPULAR CHARACTER CARD
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// STORY SELECT MODAL
// ─────────────────────────────────────────────
const STORY_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  ONGOING:   { label: '연재중',  color: 'bg-green-100 text-green-700' },
  COMPLETED: { label: '완결',    color: 'bg-blue-100 text-blue-700'  },
  DRAFT:     { label: '준비중',  color: 'bg-gray-100 text-gray-500'  },
  HIATUS:    { label: '휴재',    color: 'bg-yellow-100 text-yellow-700' },
};
const STORY_VIS_LABEL: Record<string, { label: string }> = {
  PUBLIC:   { label: '공개'     },
  PRIVATE:  { label: '비공개'   },
  UNLISTED: { label: '링크 공개' },
};

interface Story {
  id: string;
  title: string;
  coverUrl?: string | null;
  category?: string;
  status?: string;
  visibility?: string;
  chatCount?: number;
  likeCount?: number;
}

function StorySelectModal({
  open,
  onClose,
  onConfirm,
  initialSelected,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (stories: Story[]) => void;
  initialSelected: Story[];
}) {
  const [selected, setSelected] = useState<Story[]>(initialSelected);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['my-stories-for-character'],
    queryFn: () => api.stories.my({ limit: 50 }) as Promise<{ data: Story[] }>,
    enabled: open,
    staleTime: 1000 * 30,
  });

  // ESC 닫기
  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [open, onClose]);

  // 모달 열릴 때 선택 상태 동기화
  useEffect(() => {
    if (open) setSelected(initialSelected);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const stories: Story[] = data?.data ?? [];
  const filtered = search.trim()
    ? stories.filter((s) => s.title.toLowerCase().includes(search.trim().toLowerCase()))
    : stories;

  const toggle = (story: Story) => {
    setSelected((prev) =>
      prev.some((s) => s.id === story.id)
        ? prev.filter((s) => s.id !== story.id)
        : [...prev, story],
    );
  };

  const isChecked = (id: string) => selected.some((s) => s.id === id);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 반투명 배경 */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* 모달 본체 */}
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-[480px] mx-4 flex flex-col"
        style={{ maxHeight: '80vh' }}>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
          <h2 className="text-gray-900 font-bold text-lg">스토리 선택</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* 서브타이틀 */}
        <p className="px-6 text-gray-500 text-sm pb-3 flex-shrink-0">해당되는 스토리를 선택해보세요</p>

        {/* 검색 */}
        <div className="px-6 pb-3 flex-shrink-0">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="작품 검색"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-gray-400 transition-colors"
            />
          </div>
        </div>

        {/* 선택된 개수 표시 */}
        {selected.length > 0 && (
          <div className="px-6 pb-2 flex-shrink-0">
            <p className="text-xs text-brand font-semibold">{selected.length}개 선택됨</p>
          </div>
        )}

        {/* 스토리 목록 */}
        <div className="flex-1 overflow-y-auto px-6 pb-2 min-h-0">
          {isLoading ? (
            /* 로딩 스켈레톤 */
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 animate-pulse">
                  <div className="w-14 h-14 rounded-lg bg-gray-100 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-100 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            /* 빈 상태 */
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
                <BookOpen className="w-8 h-8 text-gray-300" />
              </div>
              {search.trim() ? (
                <>
                  <p className="text-gray-500 font-semibold text-sm">검색 결과가 없어요</p>
                  <p className="text-gray-400 text-xs mt-1">다른 키워드로 검색해보세요</p>
                </>
              ) : (
                <>
                  <p className="text-gray-500 font-semibold text-sm">아직 작성한 스토리가 없어요</p>
                  <p className="text-gray-400 text-xs mt-1">스토리를 만들고 캐릭터를 연결해보세요</p>
                </>
              )}
            </div>
          ) : (
            /* 스토리 카드 목록 */
            <div className="space-y-2">
              {filtered.map((story) => {
                const checked = isChecked(story.id);
                const statusInfo = STORY_STATUS_LABEL[story.status ?? ''] ?? { label: '준비중', color: 'bg-gray-100 text-gray-500' };
                return (
                  <button
                    key={story.id}
                    type="button"
                    onClick={() => toggle(story)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-150',
                      checked
                        ? 'border-brand bg-brand/5 shadow-sm'
                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50',
                    )}
                  >
                    {/* 커버 이미지 */}
                    <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-gradient-to-br from-sky-100 to-sky-200 relative">
                      {story.coverUrl ? (
                        <Image src={story.coverUrl} alt={story.title} fill className="object-cover" unoptimized />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-sky-400" />
                        </div>
                      )}
                    </div>

                    {/* 텍스트 */}
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-semibold truncate', checked ? 'text-brand' : 'text-gray-900')}>
                        {story.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-md', statusInfo.color)}>
                          {statusInfo.label}
                        </span>
                        {story.visibility && (
                          <span className="text-[10px] text-gray-400">
                            {STORY_VIS_LABEL[story.visibility]?.label ?? story.visibility}
                          </span>
                        )}
                        {(story.chatCount ?? 0) > 0 && (
                          <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                            {(story.chatCount ?? 0).toLocaleString()}
                          </span>
                        )}
                        {(story.likeCount ?? 0) > 0 && (
                          <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>
                            {(story.likeCount ?? 0).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 체크박스 */}
                    <div className={cn(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                      checked ? 'bg-brand border-brand' : 'border-gray-300',
                    )}>
                      {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="flex gap-3 px-6 py-5 border-t border-gray-100 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => { onConfirm(selected); onClose(); }}
            disabled={selected.length === 0}
            className="flex-1 py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            선택{selected.length > 0 ? ` (${selected.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
function PopularCharacterCard({ character }: { character: any }) {
  return (
    <div className="cursor-pointer group">
      <div className="relative rounded-xl overflow-hidden aspect-square mb-2">
        {character.avatarUrl ? (
          <Image src={character.avatarUrl} alt={character.name} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full bg-sky-200 flex items-center justify-center">
            <span className="text-4xl">·-·</span>
          </div>
        )}
        <div className="absolute bottom-2 right-2 flex items-center gap-0.5 bg-black/50 rounded-full px-1.5 py-0.5">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-white text-[10px]">{character.chatCount ?? 0}</span>
        </div>
      </div>
      <p className="text-gray-900 font-semibold text-sm truncate">{character.name}</p>
      <p className="text-gray-400 text-xs leading-relaxed line-clamp-2 mt-0.5">{character.description}</p>
      <div className="flex items-center justify-between mt-1">
        <span className="text-gray-400 text-xs">@ {character.author?.username ?? '익명'}</span>
        <button className="text-gray-300 hover:text-red-400 transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// LIVE PREVIEW CARD (first slot — current character being created)
// ─────────────────────────────────────────────
function LivePreviewCard({ imageUrl, name, desc }: { imageUrl: string | null; name: string; desc: string }) {
  const hasImage = !!imageUrl;
  const hasName = name.trim().length > 0;
  const hasDesc = desc.trim().length > 0;

  return (
    <div className="cursor-default group relative">
      {/* 내 캐릭터 뱃지 */}
      <div className="absolute -top-2 -left-2 z-10 flex items-center gap-1 bg-brand text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md">
        <span>미리보기</span>
      </div>

      <div className={cn(
        'relative rounded-xl overflow-hidden aspect-square mb-2 transition-all duration-300',
        hasImage ? 'ring-2 ring-brand ring-offset-1' : 'bg-gradient-to-br from-sky-100 to-sky-200',
      )}>
        {hasImage ? (
          <Image src={imageUrl!} alt="preview" fill className="object-cover" unoptimized />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1">
            <span className="text-5xl opacity-40">·-·</span>
            <span className="text-sky-400 text-[10px] font-medium">이미지를 추가해보세요</span>
          </div>
        )}
        <div className="absolute bottom-2 right-2 flex items-center gap-0.5 bg-black/50 rounded-full px-1.5 py-0.5">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-white text-[10px]">0</span>
        </div>
      </div>

      <p className={cn(
        'font-semibold text-sm truncate transition-colors',
        hasName ? 'text-gray-900' : 'text-gray-300 italic',
      )}>
        {hasName ? name : '캐릭터 이름'}
      </p>
      <p className={cn(
        'text-xs leading-relaxed line-clamp-2 mt-0.5 transition-colors',
        hasDesc ? 'text-gray-400' : 'text-gray-200 italic',
      )}>
        {hasDesc ? desc : '한 줄 소개를 입력해 보세요'}
      </p>
      <div className="flex items-center justify-between mt-1">
        <span className="text-brand text-xs font-medium">@ 나</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PLACEHOLDER CARD (when no real characters)
// ─────────────────────────────────────────────
function PlaceholderCharacterCard({ name, desc, author }: { name: string; desc: string; author: string }) {
  return (
    <div className="cursor-pointer group">
      <div className="relative rounded-xl overflow-hidden aspect-square mb-2 bg-sky-200 flex items-center justify-center">
        <span className="text-5xl">·-·</span>
        <div className="absolute bottom-2 right-2 flex items-center gap-0.5 bg-black/50 rounded-full px-1.5 py-0.5">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-white text-[10px]">0</span>
        </div>
      </div>
      <p className="text-gray-900 font-semibold text-sm truncate">{name}</p>
      <p className="text-gray-400 text-xs leading-relaxed line-clamp-2 mt-0.5">{desc}</p>
      <div className="flex items-center justify-between mt-1">
        <span className="text-gray-400 text-xs">@ {author}</span>
        <button className="text-gray-300 hover:text-red-400 transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// PLAY GUIDE CARD (미리보기에 표시되는 카드)
// ─────────────────────────────────────────────
function PlayGuideCard({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <div className="mx-2 rounded-xl border border-brand/30 bg-brand/5 px-4 py-3">
      <p className="text-brand text-xs font-bold mb-1">플레이 가이드</p>
      <p className="text-brand/80 text-sm whitespace-pre-wrap leading-relaxed">{text}</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// MOBILE PREVIEW BOTTOM SHEET
// ─────────────────────────────────────────────
function MobilePreviewSheet({
  onClose,
  previewImage,
  username,
  detailDescription,
  introMsgs,
  commentDisabled,
}: {
  onClose: () => void;
  previewImage: string | null;
  username: string;
  detailDescription: string;
  introMsgs: { id: string; role: 'character' | 'user'; content: string }[];
  commentDisabled: boolean;
}) {
  const [visible, setVisible] = useState(false);

  // 마운트 후 한 프레임 뒤에 visible=true로 바꿔 slide-up 트랜지션 시작
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 280); // 트랜지션 완료 후 언마운트
  };

  // ESC 닫기
  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end lg:hidden">
      {/* 반투명 배경 */}
      <div
        className={cn(
          'absolute inset-0 bg-black/50 transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0',
        )}
        onClick={handleClose}
      />

      {/* 슬라이드업 패널 */}
      <div
        className={cn(
          'relative z-10 bg-white rounded-t-3xl shadow-2xl flex flex-col transition-transform duration-300 ease-out',
          visible ? 'translate-y-0' : 'translate-y-full',
        )}
        style={{ maxHeight: '90vh' }}
      >
        {/* 드래그 핸들 */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
          <span className="text-gray-900 font-bold text-base">미리보기</span>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-8">
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden max-w-[360px] mx-auto">

            {/* 카드 헤더 */}
            <div className="px-4 pt-4 pb-3">
              <span className="text-gray-900 font-bold text-sm">미리보기</span>
            </div>

            {/* 캐릭터 이미지 */}
            <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-sky-200 via-sky-300 to-sky-400">
              {previewImage ? (
                <Image src={previewImage} alt="character preview" fill className="object-cover" unoptimized />
              ) : (
                <div className="w-full h-full relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-sky-200 to-sky-400" />
                  <div className="absolute top-0 right-0 w-2/3 h-2/3 bg-sky-100/60"
                    style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-5xl select-none" style={{ filter: 'opacity(0.7)' }}>·-·</span>
                  </div>
                </div>
              )}
              <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-white rounded-full px-2.5 py-1 shadow-md">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
                  <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" />
                  <path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
                </svg>
                <span className="text-gray-700 text-xs font-semibold">1.6K</span>
              </div>
            </div>

            {/* 유저명 + 통계 */}
            <div className="px-4 pt-3 pb-3 border-b border-gray-100">
              <p className="text-brand text-sm mb-2">@{username}</p>
              <div className="flex items-center gap-3 text-gray-400 text-xs">
                <span className="flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  20.2K
                </span>
                <span className="flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>
                  10.2K
                </span>
                <span className="flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                  100
                </span>
              </div>
            </div>

            {/* 상세 설명 */}
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-gray-900 font-bold text-sm mb-2">상세 설명</p>
              {detailDescription.trim() ? (
                <p className="text-gray-500 text-xs leading-relaxed whitespace-pre-wrap">{detailDescription}</p>
              ) : (
                <p className="text-gray-300 text-xs italic">상세 설명을 입력해 주세요</p>
              )}
            </div>

            {/* 인트로 미리보기 */}
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-gray-900 font-bold text-sm mb-2">인트로 미리보기</p>
              {introMsgs.length > 0 ? (
                <div className="space-y-1.5">
                  {introMsgs.slice(0, 2).map((m) => (
                    <div key={m.id} className={cn(
                      'rounded-xl px-3 py-2 text-xs leading-relaxed',
                      m.role === 'character' ? 'bg-gray-100 text-gray-700' : 'bg-brand/10 text-brand ml-6',
                    )}>
                      {m.content}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-300 text-xs italic">인트로 탭에서 대화를 추가해 주세요</p>
              )}
            </div>

            {/* 댓글 */}
            {commentDisabled ? (
              <div className="px-4 py-3">
                <p className="text-gray-900 font-bold text-sm mb-2">댓글</p>
                <div className="rounded-xl bg-gray-50 px-4 py-3">
                  <p className="text-gray-400 text-xs text-center">댓글 기능이 닫혀있어요</p>
                </div>
              </div>
            ) : (
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-gray-900 font-bold text-sm">댓글 1,000건</span>
                  <button type="button" className="text-gray-400 text-xs hover:text-gray-600 transition-colors">전체보기</button>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-300 to-pink-300 flex-shrink-0 flex items-center justify-center">
                    <span className="text-white text-[10px] font-bold">나</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-500 text-[10px] mb-0.5">{username}님</p>
                    <p className="text-gray-700 text-xs leading-relaxed">너무 재있어요~~!!!</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MOBILE SETTINGS PREVIEW BOTTOM SHEET (캐릭터 설정 탭)
// ─────────────────────────────────────────────
function MobileSettingsPreviewSheet({
  onClose,
  previewImage,
  name,
  description,
  popularCharacters,
}: {
  onClose: () => void;
  previewImage: string | null;
  name: string;
  description: string;
  popularCharacters: any[];
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 280);
  };

  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end lg:hidden">
      {/* 반투명 배경 */}
      <div
        className={cn(
          'absolute inset-0 bg-black/50 transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0',
        )}
        onClick={handleClose}
      />

      {/* 슬라이드업 패널 */}
      <div
        className={cn(
          'relative z-10 bg-white rounded-t-3xl shadow-2xl flex flex-col transition-transform duration-300 ease-out',
          visible ? 'translate-y-0' : 'translate-y-full',
        )}
        style={{ maxHeight: '90vh' }}
      >
        {/* 드래그 핸들 */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
          <span className="text-gray-900 font-bold text-base">미리보기</span>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-8">
          <p className="text-gray-400 text-xs mb-3 px-1">인기 캐릭터 모아보기</p>
          <div className="grid grid-cols-2 gap-4">
            <LivePreviewCard imageUrl={previewImage} name={name} desc={description} />
            {popularCharacters.length > 0
              ? popularCharacters.slice(0, 3).map((char: any) => (
                  <PopularCharacterCard key={char.id} character={char} />
                ))
              : (
                <>
                  <PlaceholderCharacterCard name="모험가 루나" desc="어둠 속에서 빛을 찾는 여행자" author="creator1" />
                  <PlaceholderCharacterCard name="현자 오렌" desc="고대 지식의 수호자" author="creator2" />
                  <PlaceholderCharacterCard name="용사 카이" desc="전설의 검을 가진 영웅" author="creator3" />
                </>
              )
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MOBILE CHAT PREVIEW BOTTOM SHEET (인트로 / 프롬프트 / 고급기능 탭 공용)
// ─────────────────────────────────────────────
function MobileChatPreviewSheet({
  onClose,
  title,
  previewImage,
  characterName,
  messages,
}: {
  onClose: () => void;
  title: string;
  previewImage: string | null;
  characterName: string;
  messages: { id: string; role: string; content: string }[];
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 280);
  };

  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isUser = (role: string) => role === 'user';

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end lg:hidden">
      {/* 반투명 배경 */}
      <div
        className={cn(
          'absolute inset-0 bg-black/50 transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0',
        )}
        onClick={handleClose}
      />

      {/* 슬라이드업 패널 */}
      <div
        className={cn(
          'relative z-10 bg-white rounded-t-3xl shadow-2xl flex flex-col transition-transform duration-300 ease-out',
          visible ? 'translate-y-0' : 'translate-y-full',
        )}
        style={{ maxHeight: '90vh' }}
      >
        {/* 드래그 핸들 */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0 border-b border-gray-100">
          <span className="text-gray-900 font-bold text-base">{title} 미리보기</span>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* 채팅 영역 */}
        <div className="flex-1 overflow-y-auto min-h-0 px-4 py-5">
          {messages.length > 0 ? (
            <div className="space-y-3 max-w-[360px] mx-auto">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn('flex gap-2', isUser(msg.role) ? 'flex-row-reverse' : 'items-start')}
                >
                  {!isUser(msg.role) && (
                    <div className="w-8 h-8 rounded-full bg-teal-400 flex-shrink-0 overflow-hidden">
                      {previewImage
                        ? <Image src={previewImage} alt="avatar" width={32} height={32} unoptimized className="object-cover w-full h-full" />
                        : <div className="w-full h-full flex items-center justify-center text-white text-xs">·-·</div>
                      }
                    </div>
                  )}
                  <div className={cn('flex flex-col max-w-[75%]', isUser(msg.role) ? 'items-end' : 'items-start')}>
                    {!isUser(msg.role) && (
                      <p className="text-gray-500 text-xs mb-1">{characterName || '캐릭터 이름'}</p>
                    )}
                    <div className={cn(
                      'px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed',
                      isUser(msg.role)
                        ? 'bg-gray-700 rounded-tr-sm text-white'
                        : 'bg-white border border-gray-200 rounded-tl-sm text-gray-800',
                    )}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-300">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
              <p className="text-xs">대화 내용이 없습니다</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// MAIN FORM
// ─────────────────────────────────────────────
export function CharacterCreateForm() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const [activeTab, setActiveTab] = useState<CharacterTab>('settings');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadDone, setUploadDone] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [rawAvatarSrc, setRawAvatarSrc] = useState<string | null>(null);
  const [showAvatarCropper, setShowAvatarCropper] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<{ abort: () => void } | null>(null);
  const introInputRef = useRef<HTMLTextAreaElement>(null);
  const detailScrollRef = useRef<HTMLDivElement>(null);
  const [linkedStories, setLinkedStories] = useState<Story[]>([]);
  const [showStoryModal, setShowStoryModal] = useState(false);
  const [showMobilePreview, setShowMobilePreview] = useState(false);       // 캐릭터 상세 탭 모바일 미리보기
  const [showMobileSettingsPreview, setShowMobileSettingsPreview] = useState(false); // 캐릭터 설정 탭 모바일 미리보기
  const [showMobileIntroPreview, setShowMobileIntroPreview] = useState(false);       // 인트로 탭 모바일 미리보기
  const [showMobilePromptPreview, setShowMobilePromptPreview] = useState(false);     // 프롬프트 탭 모바일 미리보기
  const [showMobileAdvancedPreview, setShowMobileAdvancedPreview] = useState(false); // 고급 기능 탭 모바일 미리보기
  // ── 대화 미리보기 (프롬프트/고급기능 탭) state ──
  const [previewMessages, setPreviewMessages] = useState<{ id: string; role: 'user' | 'assistant'; content: string }[]>([]);
  const [previewInput, setPreviewInput] = useState('');
  const [isPreviewStreaming, setIsPreviewStreaming] = useState(false);
  const previewAbortRef = useRef<AbortController | null>(null);
  const previewInputRef = useRef<HTMLTextAreaElement>(null);
  const previewBottomRef = useRef<HTMLDivElement>(null);
  // ── 뒤로가기 / 초안 복원 state ──
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showRestoreDraftDialog, setShowRestoreDraftDialog] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // ── 인트로 탭 전용 state ──
  const [systemContext, setSystemContext] = useState('');
  const [systemContextDraft, setSystemContextDraft] = useState('');
  const [editingContext, setEditingContext] = useState(false);
  const [showIntroSetup, setShowIntroSetup] = useState(false);
  // ── 고급 기능 탭 전용 state ──
  const [situationImages, setSituationImages] = useState<{ id: string; url: string; name: string; situation: string; hint: string; collapsed: boolean }[]>([]);
  const situationImageInputRef = useRef<HTMLInputElement>(null);
  const [changingSituationImageId, setChangingSituationImageId] = useState<string | null>(null);
  const [deleteConfirmSituationId, setDeleteConfirmSituationId] = useState<string | null>(null);
  // ── 상황별 이미지 추가 모달 state ──
  const [showSituationImageModal, setShowSituationImageModal] = useState(false);
  const [showGoToAdvancedDialog, setShowGoToAdvancedDialog] = useState(false);
  const [selectedSituationImageId, setSelectedSituationImageId] = useState<string | null>(null);
  // ── 이미지 업로드 모달 state ──
  const [showImageUploadModal, setShowImageUploadModal] = useState(false);
  const [imageUploadContext, setImageUploadContext] = useState<'profile' | 'situation'>('situation');
  // ── 라이브러리 모달 state ──
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [libraryImages, setLibraryImages] = useState<{ id: string; urls: string[]; prompt: string }[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | null>(null);
  const [introMsgs, setIntroMsgs] = useState<{ id: string; role: 'character' | 'user'; content: string }[]>([]);
  const [introSpeaker, setIntroSpeaker] = useState<'character' | 'user'>('character');
  const [introInput, setIntroInput] = useState('');
  const [examples, setExamples] = useState<{
    id: string;
    messages: { id: string; role: 'character' | 'user'; content: string }[];
  }[]>([
    { id: 'ex1', messages: [] },
    { id: 'ex2', messages: [] },
  ]);
  const [activeExampleId, setActiveExampleId] = useState<string | null>(null);
  const [exampleInput, setExampleInput] = useState('');
  const [exampleSpeaker, setExampleSpeaker] = useState<'character' | 'user'>('character');
  const [editingExMsgId, setEditingExMsgId] = useState<string | null>(null);
  const [editingExMsgContent, setEditingExMsgContent] = useState('');
  const [isAutoCompleting, setIsAutoCompleting] = useState(false);
  const [playGuide, setPlayGuide] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    concept: '',
    systemPrompt: '',
    greeting: '',
    category: 'ORIGINAL' as string,
    tags: [] as string[],
    tagInput: '',
    visibility: 'PRIVATE' as 'PUBLIC' | 'PRIVATE' | 'UNLISTED',
    ageRating: 'ALL' as 'ALL' | 'TEEN' | 'MATURE',
    audienceTarget: 'ALL' as 'ALL' | 'MALE_ORIENTED' | 'FEMALE_ORIENTED',
    detailDescription: '',
    commentDisabled: false,
    language: 'ko',
    model: 'claude-haiku-3' as string,
    temperature: 0.8,
    maxTokens: 1024,
  });

  const update = useCallback((patch: Partial<typeof formData>) => {
    setFormData((prev) => ({ ...prev, ...patch }));
  }, []);

  // ── 폼에 입력된 내용이 있는지 확인 ──
  const isDirty = formData.name.trim().length > 0
    || formData.description.trim().length > 0
    || formData.systemPrompt.trim().length > 0
    || !!previewImage;

  // ── 페이지 진입 시 초안 확인 ──
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const checkedDraftRef = useRef(false);
  useEffect(() => {
    if (!user || checkedDraftRef.current) return;
    checkedDraftRef.current = true;
    api.characters.getDraft()
      .then((res: any) => {
        if (res?.data?.data) {
          setHasDraft(true);
          setShowRestoreDraftDialog(true);
        }
      })
      .catch(() => {}); // 초안 없으면 404 — 무시
  }, [user]);

  // ── 초안 저장 함수 ──
  const saveDraft = useCallback(async () => {
    if (!user) return;
    setIsSavingDraft(true);
    try {
      await api.characters.saveDraft({
        formData,
        systemContext,
        introMsgs,
        examples,
        playGuide,
        previewImage,
        imageKey,
      });
      toast.success('임시저장 되었습니다');
    } catch {
      toast.error('임시저장에 실패했습니다');
    } finally {
      setIsSavingDraft(false);
    }
  }, [formData, systemContext, introMsgs, examples, playGuide, previewImage, imageKey, user]);

  // ── 초안 복원 함수 ──
  const restoreDraft = useCallback(async () => {
    try {
      const res = await api.characters.getDraft() as any;
      const d = res?.data?.data;
      if (!d) return;
      if (d.formData) setFormData(d.formData);
      if (d.systemContext) setSystemContext(d.systemContext);
      if (d.introMsgs) setIntroMsgs(d.introMsgs);
      if (d.examples) setExamples(d.examples);
      if (d.playGuide) setPlayGuide(d.playGuide);
      if (d.previewImage) setPreviewImage(d.previewImage);
      if (d.imageKey) setImageKey(d.imageKey);
    } catch { /* 무시 */ }
  }, []);

  // 인기 캐릭터
  const { data: popularData } = useQuery({
    queryKey: ['characters-trending'],
    queryFn: () => api.characters.trending(),
    staleTime: 1000 * 60 * 5,
  });
  const popularCharacters: any[] = popularData?.data ?? popularData?.characters ?? [];

  // AI Generate
  const handleAIGenerate = async () => {
    if (!formData.name.trim() || !formData.concept.trim()) {
      toast.error('이름과 캐릭터 컨셉을 먼저 입력해주세요');
      return;
    }
    setIsGenerating(true);
    try {
      const res = await apiClient.post('/api/characters/generate', {
        name: formData.name,
        concept: formData.concept,
        category: formData.category,
        language: formData.language,
      }).then((r: any) => r.data);
      if (res.success) {
        const { systemPrompt, greeting, description, tags } = res.data;
        update({ systemPrompt, greeting, description: description || formData.description, tags: tags || formData.tags });
        toast.success('AI가 캐릭터를 생성했어요!', '내용을 확인하고 수정해보세요');
      }
    } catch {
      toast.error('AI 생성 실패', '직접 입력해주세요');
    } finally {
      setIsGenerating(false);
    }
  };

  // Image Upload — axios (자동 토큰 갱신) + 진행률 추적
  const handleImageUpload = useCallback((file: File) => {
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!ALLOWED.includes(file.type)) {
      toast.error('JPG, PNG, WebP, GIF만 업로드할 수 있어요');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('5MB 이하의 파일만 업로드할 수 있어요');
      return;
    }

    // 이전 요청 취소
    xhrRef.current?.abort();

    setPreviewImage(URL.createObjectURL(file));
    setIsUploadingImage(true);
    setUploadProgress(0);
    setUploadDone(false);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'avatar');

    const controller = new AbortController();
    (xhrRef as any).current = { abort: () => controller.abort() };

    apiClient.post('/api/characters/upload', formData, {
      headers: { 'Content-Type': undefined },
      signal: controller.signal,
      onUploadProgress: (e) => {
        if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
      },
    })
      .then((res: any) => {
        const data = res.data;
        if (data?.success) {
          setImageKey(data.data.key);
          setPreviewImage(data.data.url);
          setUploadDone(true);
          setTimeout(() => setUploadDone(false), 2000);
          toast.success('이미지가 업로드되었어요');
        } else {
          throw new Error(data?.error?.message || '업로드 실패');
        }
      })
      .catch((err: any) => {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        const msg = err.response?.data?.error?.message || err.message || '다시 시도해 주세요';
        toast.error('이미지 업로드 실패', msg);
        // 로컬 미리보기는 유지 (blob URL로 계속 표시)
      })
      .finally(() => setIsUploadingImage(false));
  }, []);

  // Drag-and-drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
  }, []);
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
  }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setRawAvatarSrc(URL.createObjectURL(file));
      setShowAvatarCropper(true);
    }
  }, []);

  const handleAvatarCropConfirm = useCallback((_blobUrl: string, _dataUrl: string, blob: Blob) => {
    setShowAvatarCropper(false);
    setRawAvatarSrc(null);
    setPreviewImage(URL.createObjectURL(blob));
    const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
    handleImageUpload(file);
  }, [handleImageUpload]);

  // Tag handling
  const addTag = (tag: string) => {
    const t = tag.trim().replace(/,/g, '');
    if (!t || formData.tags.includes(t) || formData.tags.length >= 10) return;
    update({ tags: [...formData.tags, t], tagInput: '' });
  };
  const removeTag = (tag: string) => update({ tags: formData.tags.filter((t) => t !== tag) });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: () =>
      api.characters.create({
        name: formData.name,
        description: formData.description,
        detailDescription: formData.detailDescription || undefined,
        systemPrompt: formData.systemPrompt,
        greeting: formData.greeting,
        exampleDialogues: examples.filter(e => e.messages.length > 0),
        category: formData.category,
        tags: formData.tags,
        visibility: formData.visibility,
        ageRating: formData.ageRating,
        audienceTarget: formData.audienceTarget,
        commentDisabled: formData.commentDisabled,
        language: formData.language,
        model: formData.model,
        temperature: formData.temperature,
        maxTokens: formData.maxTokens,
      }),
    onSuccess: async (res) => {
      const characterId = res.data.id;
      // 선택된 스토리에 캐릭터 연결 (병렬 처리, 실패해도 무시)
      if (linkedStories.length > 0) {
        await Promise.allSettled(
          linkedStories.map((story) =>
            api.stories.addCharacter(story.id, { characterId, role: '등장인물' }).catch(() => {}),
          ),
        );
      }
      toast.success('캐릭터가 생성되었습니다!', '이제 대화해보세요');
      router.push(`/characters/${characterId}`);
    },
    onError: (err: any) => {
      toast.error('생성 실패', err.response?.data?.error?.message || '다시 시도해주세요');
    },
  });

  const TAB_ORDER: CharacterTab[] = ['settings', 'intro', 'prompt', 'advanced', 'detail'];
  const currentIdx = TAB_ORDER.indexOf(activeTab);
  const isLastTab = currentIdx === TAB_ORDER.length - 1;
  const isFirstTab = currentIdx === 0;

  const handleNext = () => {
    if (!isLastTab) setActiveTab(TAB_ORDER[currentIdx + 1]);
    else createMutation.mutate();
  };
  const handlePrev = () => {
    if (!isFirstTab) setActiveTab(TAB_ORDER[currentIdx - 1]);
  };

  // 인트로 메시지 전송
  const sendIntroMsg = () => {
    const text = introInput.trim();
    if (!text) return;
    const newMsg = { id: Date.now().toString(), role: introSpeaker, content: text };
    if (activeExampleId) {
      // 예시 모드: 해당 예시에 메시지 추가
      if (totalExampleLen + text.length > 2000) { toast.error('예시 대화는 최대 2,000자까지 입력할 수 있어요.'); return; }
      setExamples((prev) => prev.map((ex) =>
        ex.id === activeExampleId ? { ...ex, messages: [...ex.messages, newMsg as any] } : ex
      ));
      setIntroSpeaker((prev) => prev === 'character' ? 'user' : 'character');
    } else {
      // 인트로 모드: introMsgs에 추가
      setIntroMsgs((prev) => [...prev, newMsg]);
      if (introSpeaker === 'character' && !introMsgs.some((m) => m.role === 'character')) {
        update({ greeting: text });
      }
    }
    setIntroInput('');
  };

  const totalExampleLen = examples.reduce((s, e) => s + e.messages.reduce((ms, m) => ms + m.content.length, 0), 0);
  const introCharCount = introMsgs.filter(m => m.role === 'character').reduce((s, m) => s + m.content.length, 0) + (systemContext.length);

  // {user} → 실제 사용자 displayName으로 치환
  const resolveUser = (text: string) =>
    text.replace(/\{user\}/g, user?.displayName ?? '사용자');

  // 대화 미리보기 메시지 전송
  const sendPreviewMessage = useCallback(() => {
    const text = previewInput.trim();
    if (!text || isPreviewStreaming || !accessToken) return;

    const userMsg = { id: Date.now().toString(), role: 'user' as const, content: text };
    const assistantId = (Date.now() + 1).toString();
    setPreviewMessages((prev) => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '' }]);
    setPreviewInput('');
    setIsPreviewStreaming(true);

    const abort = new AbortController();
    previewAbortRef.current = abort;

    // 인트로 메시지를 history에 포함
    const history = previewMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: resolveUser(m.content),
    }));

    streamPreviewChat(
      {
        systemPrompt: formData.systemPrompt || `당신은 ${formData.name || 'AI 캐릭터'}입니다.`,
        history,
        userMessage: text,
        characterName: formData.name,
        exampleDialogues: examples.filter(e => e.messages.length > 0),
      },
      accessToken,
      {
        signal: abort.signal,
        onDelta: (chunk) => {
          setPreviewMessages((prev) =>
            prev.map((m) => m.id === assistantId ? { ...m, content: m.content + chunk } : m)
          );
          previewBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        },
        onDone: () => setIsPreviewStreaming(false),
        onError: () => {
          setIsPreviewStreaming(false);
          setPreviewMessages((prev) => prev.filter((m) => m.id !== assistantId));
          toast.error('AI 응답 오류가 발생했습니다.');
        },
      }
    );
  }, [previewInput, isPreviewStreaming, accessToken, previewMessages, formData, resolveUser]);

  // ── 예시 메시지 추가 ──
  const addExampleMsg = useCallback(() => {
    const text = exampleInput.trim();
    if (!text || !activeExampleId) return;
    if (totalExampleLen + text.length > 2000) { toast.error('예시 대화는 최대 2,000자까지 입력할 수 있어요.'); return; }
    setExamples((prev) => prev.map((ex) =>
      ex.id === activeExampleId
        ? { ...ex, messages: [...ex.messages, { id: Date.now().toString() + Math.random(), role: exampleSpeaker, content: text }] }
        : ex
    ));
    setExampleInput('');
    setExampleSpeaker((prev) => prev === 'character' ? 'user' : 'character');
  }, [exampleInput, activeExampleId, exampleSpeaker, totalExampleLen]);

  // ── 예시 자동 완성 ──
  const autoCompleteExample = useCallback(async () => {
    if (!activeExampleId || isAutoCompleting || !accessToken) return;
    const systemP = formData.systemPrompt.trim();
    if (!systemP && !formData.name.trim()) { toast.error('캐릭터 설정(프롬프트 또는 이름)을 먼저 입력해주세요.'); return; }
    setIsAutoCompleting(true);
    const abort = new AbortController();
    let turnCount = 0;
    const maxTurns = 4;
    let currentRole: 'character' | 'user' = 'character';
    const generated: { id: string; role: 'character' | 'user'; content: string }[] = [];
    const runTurn = () => {
      if (turnCount >= maxTurns) { setIsAutoCompleting(false); return; }
      const userMsg = currentRole === 'user'
        ? (generated.length > 0 ? `${generated[generated.length - 1].content}에 자연스럽게 반응해줘` : '안녕하세요')
        : '자연스러운 첫 인사를 해줘';
      const newId = Date.now().toString() + Math.random();
      if (currentRole === 'character') {
        streamPreviewChat(
          { systemPrompt: systemP || `당신은 ${formData.name}입니다.`, history: [], userMessage: userMsg, characterName: formData.name },
          accessToken,
          {
            signal: abort.signal,
            onDelta: (text) => {
              setExamples((prev) => prev.map((ex) => {
                if (ex.id !== activeExampleId) return ex;
                const existing = ex.messages.find(m => m.id === newId);
                if (existing) return { ...ex, messages: ex.messages.map(m => m.id === newId ? { ...m, content: m.content + text } : m) };
                return { ...ex, messages: [...ex.messages, { id: newId, role: 'character', content: text }] };
              }));
            },
            onDone: () => {
              turnCount++;
              currentRole = 'user';
              // 사용자 응답 생성
              const charMsg = (document.querySelector(`[data-example-msg="${newId}"]`) as HTMLElement)?.textContent ?? '...';
              const userNewId = Date.now().toString() + Math.random();
              streamPreviewChat(
                {
                  systemPrompt: `당신은 사용자입니다. "${formData.name}" 캐릭터와 자연스럽게 대화 중입니다. 짧고 자연스럽게 반응해주세요.`,
                  history: [],
                  userMessage: charMsg,
                  characterName: '사용자',
                },
                accessToken,
                {
                  signal: abort.signal,
                  onDelta: (text) => {
                    setExamples((prev) => prev.map((ex) => {
                      if (ex.id !== activeExampleId) return ex;
                      const existing = ex.messages.find(m => m.id === userNewId);
                      if (existing) return { ...ex, messages: ex.messages.map(m => m.id === userNewId ? { ...m, content: m.content + text } : m) };
                      return { ...ex, messages: [...ex.messages, { id: userNewId, role: 'user', content: text }] };
                    }));
                  },
                  onDone: () => {
                    turnCount++;
                    currentRole = 'character';
                    if (turnCount < maxTurns) runTurn();
                    else setIsAutoCompleting(false);
                  },
                  onError: () => setIsAutoCompleting(false),
                }
              );
            },
            onError: () => setIsAutoCompleting(false),
          }
        );
      }
    };
    runTurn();
  }, [activeExampleId, isAutoCompleting, accessToken, formData]);

  const openLibraryModal = useCallback(async () => {
    setShowImageUploadModal(false);
    setShowLibraryModal(true);
    setSelectedLibraryId(null);
    setIsLoadingLibrary(true);
    try {
      const res = await api.images.getLibrary({ limit: 50 });
      setLibraryImages(res.data?.items ?? []);
    } catch {
      toast.error('라이브러리를 불러오지 못했어요.');
    } finally {
      setIsLoadingLibrary(false);
    }
  }, []);

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">

      {/* ── 스토리 선택 모달 ── */}
      <StorySelectModal
        open={showStoryModal}
        onClose={() => setShowStoryModal(false)}
        onConfirm={(stories) => setLinkedStories(stories)}
        initialSelected={linkedStories}
      />

      {/* ── 이미지 업로드 모달 ── */}
      {showImageUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-[500px] overflow-hidden">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <span className="text-gray-900 font-bold text-lg">이미지 업로드</span>
              <button onClick={() => setShowImageUploadModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* 옵션 카드 2개 */}
            <div className="flex gap-3 px-6 pb-5">
              {/* 기기에서 가져오기 */}
              <button
                onClick={() => {
                  const ctx = imageUploadContext;
                  setShowImageUploadModal(false);
                  setTimeout(() => {
                    if (ctx === 'profile') fileInputRef.current?.click();
                    else situationImageInputRef.current?.click();
                  }, 50);
                }}
                className="flex-1 flex flex-col items-start gap-3 border border-gray-200 rounded-2xl p-5 hover:border-brand hover:bg-brand/5 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
                <div>
                  <p className="text-gray-900 font-semibold text-sm mb-1">기기에서 가져오기</p>
                  <p className="text-gray-400 text-xs leading-relaxed">내 기기에 있는 이미지를 선택해요,<br/>최대 5MB까지 업로드할 수 있어요.</p>
                </div>
              </button>
              {/* 라이브러리에서 가져오기 */}
              <button
                onClick={openLibraryModal}
                className="flex-1 flex flex-col items-start gap-3 border border-gray-200 rounded-2xl p-5 hover:border-brand hover:bg-brand/5 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-gray-900 font-semibold text-sm mb-1">라이브러리에서 가져오기</p>
                  <p className="text-gray-400 text-xs leading-relaxed">내 라이브러리에 저장된<br/>생성 이미지를 업로드할 수 있어요.</p>
                </div>
              </button>
            </div>
            {/* 취소 버튼 */}
            <div className="px-6 pb-6">
              <button
                onClick={() => setShowImageUploadModal(false)}
                className="w-full py-3.5 rounded-2xl bg-gray-900 text-white font-semibold text-sm hover:bg-gray-800 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 라이브러리 이미지 선택 모달 ── */}
      {showLibraryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-[560px] max-h-[640px] flex flex-col overflow-hidden">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
              <span className="text-gray-900 font-bold text-lg">라이브러리에서 가져오기</span>
              <button onClick={() => setShowLibraryModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* 이미지 그리드 */}
            <div className="flex-1 overflow-y-auto px-6 pb-4">
              {isLoadingLibrary ? (
                <div className="flex items-center justify-center py-16 text-gray-400 text-sm">불러오는 중...</div>
              ) : libraryImages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 3h18M3 21h18" />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-sm font-medium">생성된 이미지가 없어요</p>
                  <p className="text-gray-400 text-xs">이미지 생성 페이지에서 이미지를 만들어보세요</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 py-2">
                  {libraryImages.map((img) => (
                    <button
                      key={img.id}
                      onClick={() => setSelectedLibraryId(img.id === selectedLibraryId ? null : img.id)}
                      className={cn(
                        'relative aspect-square rounded-xl overflow-hidden border-2 transition-all',
                        selectedLibraryId === img.id ? 'border-brand ring-2 ring-brand/30' : 'border-transparent hover:border-gray-300'
                      )}
                    >
                      <Image src={img.urls[0]} alt={img.prompt} fill className="object-cover" unoptimized />
                      {selectedLibraryId === img.id && (
                        <div className="absolute inset-0 bg-brand/20 flex items-center justify-center">
                          <div className="w-7 h-7 rounded-full bg-brand flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* 하단 버튼 */}
            <div className="flex gap-3 px-6 pb-6 flex-shrink-0 border-t border-gray-100 pt-4">
              <button
                onClick={() => setShowLibraryModal(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  const selected = libraryImages.find((img) => img.id === selectedLibraryId);
                  if (!selected) return;
                  if (imageUploadContext === 'profile') {
                    setPreviewImage(selected.urls[0]);
                  } else {
                    if (situationImages.length >= 50) { toast.error('최대 50개까지 추가할 수 있어요.'); return; }
                    setSituationImages((prev) => [...prev, { id: selected.id, url: selected.urls[0], name: selected.prompt || '라이브러리 이미지' }]);
                  }
                  setShowLibraryModal(false);
                  setSelectedLibraryId(null);
                }}
                disabled={!selectedLibraryId}
                className="flex-1 py-3 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 disabled:opacity-40 transition-colors"
              >
                추가하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 상황 이미지 선택 모달 (이미지 있을 때) ── */}
      {showSituationImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-[480px] max-h-[600px] flex flex-col overflow-hidden">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <span className="text-gray-900 font-bold text-base">상황 이미지 추가</span>
              <button
                onClick={() => setShowSituationImageModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 이미지 그리드 */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-3 gap-3">
                {situationImages.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedSituationImageId(img.id === selectedSituationImageId ? null : img.id)}
                    className={cn(
                      'relative aspect-square rounded-xl overflow-hidden border-2 transition-all',
                      selectedSituationImageId === img.id
                        ? 'border-brand ring-2 ring-brand/30'
                        : 'border-gray-100 hover:border-gray-300'
                    )}
                  >
                    <Image src={img.url} alt={img.name} fill className="object-cover" unoptimized />
                    {selectedSituationImageId === img.id && (
                      <div className="absolute inset-0 bg-brand/20 flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6 text-brand" />
                      </div>
                    )}
                  </button>
                ))}
                {/* 상황 이미지 추가 셀 → 이동 확인 다이얼로그 */}
                <button
                  onClick={() => setShowGoToAdvancedDialog(true)}
                  className="aspect-square rounded-xl border-2 border-dashed border-gray-200 hover:border-gray-400 flex flex-col items-center justify-center gap-1 text-gray-300 hover:text-gray-500 transition-all"
                >
                  <ImagePlus className="w-6 h-6" />
                  <span className="text-[11px]">상황 이미지 추가</span>
                </button>
              </div>
            </div>

            {/* 모달 하단 버튼 */}
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setShowSituationImageModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  // TODO: 선택한 이미지를 메시지에 첨부
                  setShowSituationImageModal(false);
                }}
                disabled={!selectedSituationImageId}
                className="flex-1 py-2.5 rounded-xl bg-gray-700 text-white text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-40"
              >
                선택
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 고급 기능 탭 이동 확인 다이얼로그 ── */}
      {showGoToAdvancedDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl w-[320px] p-6">
            <h3 className="text-gray-900 font-bold text-base text-center mb-2">상황별 이미지 설정으로 이동할까요?</h3>
            <p className="text-gray-400 text-sm text-center mb-6">이미지를 추가해<br />캐릭터를 더욱 풍부하게 만들어보세요</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowGoToAdvancedDialog(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => { setShowGoToAdvancedDialog(false); setShowSituationImageModal(false); setActiveTab('advanced'); }}
                className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 상황 이미지 삭제 확인 다이얼로그 ── */}
      {deleteConfirmSituationId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-[320px] p-6 text-center">
            <h3 className="text-gray-900 font-bold text-base mb-2">이미지를 삭제하시겠어요?</h3>
            <p className="text-gray-400 text-sm mb-6">
              입력하신 내용과 이미지가 모두 삭제되며<br />
              <span className="text-red-500 font-semibold">삭제는 되돌릴 수 없어요</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmSituationId(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  setSituationImages((prev) => prev.filter((i) => i.id !== deleteConfirmSituationId));
                  setDeleteConfirmSituationId(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 뒤로가기 확인 다이얼로그 ── */}
      {showLeaveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="relative bg-white rounded-2xl shadow-2xl w-[340px] p-7">
            <button
              onClick={() => setShowLeaveDialog(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-gray-900 font-bold text-base text-center mb-2">지금 나가면 내용이 사라져요</h3>
            <p className="text-gray-400 text-sm text-center mb-6">임시저장하면 나중에 이어서<br />캐릭터를 만들 수 있어요</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={async () => {
                  await saveDraft();
                  setShowLeaveDialog(false);
                  router.back();
                }}
                disabled={isSavingDraft}
                className="w-full py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {isSavingDraft ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                임시저장 후 나가기
              </button>
              <button
                onClick={() => { setShowLeaveDialog(false); router.back(); }}
                className="w-full py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                그냥 나가기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 초안 복원 다이얼로그 (페이지 재진입 시) ── */}
      {showRestoreDraftDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-[320px] p-6">
            <h3 className="text-gray-900 font-bold text-base text-center mb-2">임시저장된 내용이 있어요</h3>
            <p className="text-gray-400 text-sm text-center mb-6">이전에 작성하다 저장한 내용을<br />이어서 작성하시겠어요?</p>
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  setShowRestoreDraftDialog(false);
                  await api.characters.deleteDraft().catch(() => {});
                  setHasDraft(false);
                }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                새로 시작
              </button>
              <button
                onClick={async () => {
                  await restoreDraft();
                  setShowRestoreDraftDialog(false);
                  setHasDraft(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors"
              >
                이어서 작성
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 h-14 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { if (isDirty) setShowLeaveDialog(true); else router.back(); }}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-gray-900 font-bold text-base">캐릭터 만들기</span>
          <button className="p-1 text-gray-300 hover:text-gray-500 transition-colors">
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={saveDraft}
            disabled={isSavingDraft}
            className="px-4 py-1.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            {isSavingDraft && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            임시저장
          </button>
          <button className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:bg-gray-50 transition-colors">
            <History className="w-4 h-4" />
          </button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="px-5 py-1.5 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition-colors disabled:opacity-40"
          >
            등록하기
          </button>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex flex-1 min-h-0">
        {/* LEFT PANEL */}
        <div className="flex flex-col w-full lg:w-[680px] flex-shrink-0 lg:border-r border-gray-100">
          {/* Tab nav */}
          <div className="flex-shrink-0 flex items-center gap-0 px-6 border-b border-gray-100 overflow-x-auto scrollbar-hide">
            {TABS.map(({ key, label, required }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={cn(
                  'flex items-center gap-0.5 px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-all',
                  activeTab === key
                    ? 'border-brand text-gray-900 font-semibold'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                )}
              >
                {label}
                {required && <span className="text-brand text-xs font-bold">*</span>}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
            {/* ── 캐릭터 설정 탭 ── */}
            {activeTab === 'settings' && (
              <div>
                <div className="flex items-start justify-between mb-1">
                  <h2 className="text-gray-900 font-bold text-lg">캐릭터 설정</h2>
                  <button
                    type="button"
                    onClick={() => setShowMobileSettingsPreview(true)}
                    className="lg:hidden flex-shrink-0 text-brand text-xs font-semibold border border-brand/30 rounded-lg px-2.5 py-1 hover:bg-brand/5 transition-colors"
                  >
                    미리보기
                  </button>
                </div>
                <p className="text-gray-400 text-sm mb-6">캐릭터가 어떻게 보일지 결정하는 단계예요. 자유롭게 매력을 표현해 주세요.</p>

                <div className="border border-gray-200 rounded-2xl overflow-hidden">
                  {/* 캐릭터 이미지 */}
                  <div className="p-6">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-gray-900 font-semibold text-sm">캐릭터 이미지</span>
                      <span className="text-brand font-bold text-sm">*</span>
                    </div>
                    <p className="text-gray-400 text-xs mb-4">이미지를 등록해 주세요. 부적절한 이미지는 제한될 수 있어요</p>

                    <div className="flex items-start gap-4">
                      {/* 드래그앤드롭 + 미리보기 */}
                      <div
                        onClick={() => { if (!isUploadingImage) { setImageUploadContext('profile'); setShowImageUploadModal(true); } }}
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        className={cn(
                          'relative w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 cursor-pointer transition-all duration-200 group',
                          previewImage ? 'ring-2 ring-brand ring-offset-2' : 'border-2 border-dashed',
                          isDragging ? 'border-brand bg-brand/5 scale-105' : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100',
                        )}
                      >
                        {previewImage ? (
                          <>
                            <Image
                              src={previewImage}
                              alt="preview"
                              fill
                              unoptimized
                              className={cn('object-cover transition-opacity duration-200', isUploadingImage ? 'opacity-50' : 'opacity-100')}
                            />
                            {/* 호버 오버레이 */}
                            {!isUploadingImage && (
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Upload className="w-5 h-5 text-white" />
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                            <Upload className={cn('w-5 h-5 transition-colors', isDragging ? 'text-brand' : 'text-gray-300')} />
                            <span className="text-[10px] text-gray-300 font-medium">업로드</span>
                          </div>
                        )}

                        {/* 업로드 진행 오버레이 */}
                        {isUploadingImage && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
                            <Loader2 className="w-5 h-5 animate-spin text-brand mb-1" />
                            <span className="text-[10px] font-semibold text-brand">{uploadProgress}%</span>
                          </div>
                        )}

                        {/* 완료 애니메이션 */}
                        {uploadDone && !isUploadingImage && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <CheckCircle2 className="w-8 h-8 text-white" />
                          </div>
                        )}

                        {/* 삭제 버튼 */}
                        {previewImage && !isUploadingImage && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setPreviewImage(null); setImageKey(null); setUploadProgress(0); }}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 hover:bg-black/80 transition-colors flex items-center justify-center"
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                        )}
                      </div>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) { setRawAvatarSrc(URL.createObjectURL(f)); setShowAvatarCropper(true); e.target.value = ''; } }}
                      />

                      {/* 우측 설명 + 버튼 */}
                      <div className="flex flex-col gap-2 flex-1">
                        {/* 업로드 진행률 바 */}
                        {isUploadingImage && (
                          <div className="w-full">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-400">업로드 중...</span>
                              <span className="text-brand font-semibold">{uploadProgress}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-brand rounded-full transition-all duration-150"
                                style={{ width: `${uploadProgress}%` }}
                              />
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => router.push('/images')}
                            disabled={isUploadingImage}
                            className="px-4 py-1.5 rounded-lg border border-brand text-brand text-sm font-medium hover:bg-brand/5 transition-colors disabled:opacity-40"
                          >
                            이미지 생성
                          </button>
                          <button
                            onClick={() => { setImageUploadContext('profile'); setShowImageUploadModal(true); }}
                            disabled={isUploadingImage}
                            className="px-4 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-40"
                          >
                            {isUploadingImage ? '업로드 중...' : '파일 선택'}
                          </button>
                        </div>

                        <p className="text-gray-300 text-xs leading-relaxed">
                          PNG, JPG, WebP, GIF · 5MB 이하<br />
                          1:1 비율 권장 · 드래그앤드롭 가능
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-100" />

                  {/* 캐릭터 이름 */}
                  <div className="p-6">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-gray-900 font-semibold text-sm">캐릭터 이름</span>
                      <span className="text-brand font-bold text-sm">*</span>
                    </div>
                    <p className="text-gray-400 text-xs mb-3">2~30자 이내로 입력해 주세요 (특수문자, 이모지 제외)</p>
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => update({ name: e.target.value.slice(0, 30) })}
                        placeholder="사용자는 당신의 캐릭터를 이렇게 부를 거예요"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400 transition-colors pr-16"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 text-xs">
                        {formData.name.length} / 30
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-gray-100" />

                  {/* 한 줄 소개 */}
                  <div className="p-6">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-gray-900 font-semibold text-sm">한 줄 소개</span>
                      <span className="text-brand font-bold text-sm">*</span>
                    </div>
                    <p className="text-gray-400 text-xs mb-3">30자 이내로 입력해 주세요</p>
                    <div className="relative">
                      <textarea
                        value={formData.description}
                        onChange={(e) => update({ description: e.target.value.slice(0, 30) })}
                        placeholder="어떤 캐릭터인지 설명할 수 있는 간단한 소개를 입력해 주세요"
                        rows={3}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400 transition-colors resize-none"
                      />
                      <span className="absolute right-4 bottom-3 text-gray-300 text-xs">
                        {formData.description.length} / 30
                      </span>
                    </div>
                  </div>
                </div>

                {/* 경고 */}
                <div className="flex items-start gap-2 text-gray-400 text-xs mt-4">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <p>폭력, 혐오, 성적묘사 등의 표현 및 이미지는 규정에 따라 영구적으로 제재될 수 있어요</p>
                </div>
              </div>
            )}

            {/* ── 인트로 탭 ── */}
            {activeTab === 'intro' && (
              <div>
                <div className="flex items-start justify-between mb-1">
                  <h2 className="text-gray-900 font-bold text-lg">인트로 및 예시 대화</h2>
                  <button
                    type="button"
                    onClick={() => setShowMobileIntroPreview(true)}
                    className="lg:hidden flex-shrink-0 text-brand text-xs font-semibold border border-brand/30 rounded-lg px-2.5 py-1 hover:bg-brand/5 transition-colors"
                  >
                    미리보기
                  </button>
                </div>
                <p className="text-gray-400 text-sm mb-6">캐릭터의 말투와 성격을 보여줄 수 있는 대화를 작성해 보세요</p>

                <div className="border border-gray-200 rounded-2xl overflow-hidden">
                  {/* 인트로 섹션 */}
                  <div className="p-6">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-gray-900 font-semibold text-sm">인트로</span>
                      <span className="text-brand font-bold text-sm">*</span>
                    </div>
                    <p className="text-gray-400 text-xs mb-1">캐릭터와 사용자의 첫 대화를 설정해 보세요.</p>
                    <p className="text-gray-400 text-xs mb-4">
                      사용자는 인트로를 보고 현재 상황과{' '}
                      <span className="text-blue-400">캐릭터의 성격에</span> 대해 힌트를 얻을 수 있어요.
                    </p>
                    <button
                      onClick={() => setShowIntroSetup((prev) => !prev)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      {showIntroSetup ? '인트로 설정하지 않기' : '인트로 설정'}
                    </button>
                  </div>

                  <div className="border-t border-gray-100" />

                  {/* 예시 섹션 */}
                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-gray-900 font-semibold text-sm">예시</span>
                      <span className="text-gray-400 text-xs">{totalExampleLen}/2,000자</span>
                    </div>
                    <p className="text-gray-400 text-xs mb-1">캐릭터의 말투나 성격을 드러낼 수 있는 예시를 추가해 보세요.</p>
                    <p className="text-gray-400 text-xs mb-4">
                      여러 상황에 대해 예시 대화를 작성하면 캐릭터가 더{' '}
                      <span className="text-blue-400">다양한 대화</span>를 할 수 있어요.
                    </p>
                    <div className="space-y-2 mb-3">
                      {examples.map((ex, idx) => (
                        <button
                          key={ex.id}
                          onClick={() => setActiveExampleId(activeExampleId === ex.id ? null : ex.id)}
                          className={cn(
                            'w-full flex items-center gap-2 px-4 py-3 rounded-xl border transition-all text-left',
                            activeExampleId === ex.id
                              ? 'border-gray-900 bg-white'
                              : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                          )}
                        >
                          <span className="text-gray-700 text-sm flex-1 font-medium">예시 {idx + 1}</span>
                          {ex.messages.length > 0 && (
                            <span className="text-gray-400 text-xs">{ex.messages.reduce((s, m) => s + m.content.length, 0)}자</span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (activeExampleId === ex.id) setActiveExampleId(null);
                              setExamples((prev) => prev.filter((e) => e.id !== ex.id));
                            }}
                            className="text-gray-300 hover:text-red-400 transition-colors ml-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        const newId = Date.now().toString();
                        setExamples((prev) => [...prev, { id: newId, messages: [] }]);
                        setActiveExampleId(newId);
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl text-gray-600 text-sm font-medium transition-colors"
                    >
                      + 예시 대화 추가
                    </button>
                  </div>

                  <div className="border-t border-gray-100" />

                  {/* 플레이 가이드 섹션 */}
                  <div className="p-6">
                    <span className="text-gray-900 font-semibold text-sm block mb-1">플레이 가이드</span>
                    <p className="text-gray-400 text-xs mb-3">
                      AI가 기억하지 않는, 사용자에게만 보이는{' '}
                      <span className="text-blue-400">가이드 메시지</span>를 추가해 플레이 방법을 안내해 보세요.
                    </p>
                    <div className="relative">
                      <textarea
                        value={playGuide}
                        onChange={(e) => setPlayGuide(e.target.value.slice(0, 1000))}
                        placeholder="사용자를 위한 가이드를 작성해주세요"
                        rows={4}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400 resize-none"
                      />
                      <span className="absolute right-4 bottom-3 text-gray-300 text-xs">
                        {playGuide.length} / 1000
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── 프롬프트 탭 ── */}
            {activeTab === 'prompt' && (
              <div>
                <div className="flex items-start justify-between mb-1">
                  <h2 className="text-gray-900 font-bold text-lg">프롬프트</h2>
                  <button
                    type="button"
                    onClick={() => setShowMobilePromptPreview(true)}
                    className="lg:hidden flex-shrink-0 text-brand text-xs font-semibold border border-brand/30 rounded-lg px-2.5 py-1 hover:bg-brand/5 transition-colors"
                  >
                    미리보기
                  </button>
                </div>
                <p className="text-gray-400 text-sm mb-6">캐릭터의 성격, 말투, 외모 등 대화에 반영되어야 하는 지시 사항을 작성해 주세요</p>
                <div className="border border-gray-200 rounded-2xl p-6">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-gray-900 font-semibold text-sm">캐릭터 프롬프트</span>
                    <span className="text-brand font-bold text-sm">*</span>
                  </div>
                  <p className="text-gray-400 text-xs mb-3">미리보기에서 직접 대화를 나눌 수 있어요</p>
                  <div className="relative">
                    <textarea
                      value={formData.systemPrompt}
                      onChange={(e) => update({ systemPrompt: e.target.value.slice(0, 2000) })}
                      placeholder="인트로와 예시 대화를 설정하면 적절한 프롬프트를 작성해 드려요"
                      rows={16}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400 resize-none"
                    />
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-gray-300 text-xs">{formData.systemPrompt.length} / 2000</span>
                      <button
                        onClick={handleAIGenerate}
                        disabled={isGenerating || !formData.name.trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand/10 text-brand text-xs font-semibold hover:bg-brand/20 transition-colors disabled:opacity-50"
                      >
                        {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        자동 완성
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── 고급 기능 탭 ── */}
            {activeTab === 'advanced' && (
              <div>
                <div className="flex items-start justify-between mb-1">
                  <h2 className="text-gray-900 font-bold text-lg">고급 기능</h2>
                  <button
                    type="button"
                    onClick={() => setShowMobileAdvancedPreview(true)}
                    className="lg:hidden flex-shrink-0 text-brand text-xs font-semibold border border-brand/30 rounded-lg px-2.5 py-1 hover:bg-brand/5 transition-colors"
                  >
                    미리보기
                  </button>
                </div>
                <p className="text-gray-400 text-sm mb-6">캐릭터에 이미지를 등록해서 대화를 더 풍성하게 만들어 보세요</p>
                <div className="border border-gray-200 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-900 font-semibold text-sm">상황 이미지</span>
                    <button
                      onClick={() => router.push('/images')}
                      className="px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:bg-gray-800 transition-colors"
                    >
                      이미지 생성
                    </button>
                  </div>
                  <p className="text-gray-400 text-xs mb-4">
                    상황에 어울리는 인물, 배경 등의 이미지를 등록해 보세요{' '}
                    <span className="text-gray-400">(최대 50개)</span>
                  </p>

                  {/* 이미지 카드 목록 */}
                  {situationImages.length > 0 && (
                    <div className="flex flex-col gap-3 mb-3">
                      {situationImages.map((img, idx) => (
                        <div key={img.id} className="border border-gray-200 rounded-2xl overflow-hidden">
                          {/* 카드 헤더 */}
                          <div className="flex items-center gap-3 px-4 py-3">
                            <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0 cursor-grab" />
                            <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 relative bg-gray-100">
                              <Image src={img.url} alt={img.name} fill className="object-cover" unoptimized />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-gray-900 font-semibold text-sm mb-1.5">{idx + 1}</div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => { setChangingSituationImageId(img.id); situationImageInputRef.current?.click(); }}
                                  className="text-gray-400 text-xs hover:text-gray-600 transition-colors"
                                >
                                  이미지 변경
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(`{image:${idx + 1}}`);
                                    toast.success('코드가 복사됐어요');
                                  }}
                                  className="px-2.5 py-0.5 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:bg-gray-700 transition-colors"
                                >
                                  코드 복사
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => { setChangingSituationImageId(img.id); situationImageInputRef.current?.click(); }}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmSituationId(img.id)}
                                className="text-gray-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setSituationImages((prev) => prev.map((i) => i.id === img.id ? { ...i, collapsed: !i.collapsed } : i))}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                              >
                                <ChevronUp className={cn('w-4 h-4 transition-transform', img.collapsed && 'rotate-180')} />
                              </button>
                            </div>
                          </div>

                          {/* 상황 / 이미지 힌트 필드 */}
                          {!img.collapsed && (
                            <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
                              {/* 상황 */}
                              <div>
                                <div className="flex items-center gap-0.5 mb-1">
                                  <span className="text-gray-900 font-semibold text-sm">상황</span>
                                  <span className="text-red-500 text-sm">*</span>
                                </div>
                                <p className="text-gray-400 text-xs mb-2">작성하신 상황이 되면 AI가 자동으로 이미지를 띄워드려요</p>
                                <div className="relative border border-gray-200 rounded-xl focus-within:border-gray-400 transition-colors">
                                  <textarea
                                    value={img.situation}
                                    onChange={(e) => {
                                      if (e.target.value.length <= 50)
                                        setSituationImages((prev) => prev.map((i) => i.id === img.id ? { ...i, situation: e.target.value } : i));
                                    }}
                                    placeholder="예) 고양이 미뉴가 놀라는 상황"
                                    rows={2}
                                    className="w-full px-4 pt-3 pb-6 text-sm text-gray-900 placeholder:text-gray-300 bg-transparent resize-none focus:outline-none rounded-xl"
                                  />
                                  <span className="absolute bottom-2 right-3 text-xs text-gray-300 pointer-events-none">
                                    {img.situation.length} / 50
                                  </span>
                                </div>
                              </div>

                              {/* 이미지 힌트 */}
                              <div>
                                <p className="text-gray-900 font-semibold text-sm mb-1">이미지 힌트</p>
                                <p className="text-gray-400 text-xs mb-2">유저에게 보여질 이미지 해금 힌트를 작성해주세요</p>
                                <div className="relative border border-gray-200 rounded-xl focus-within:border-gray-400 transition-colors">
                                  <textarea
                                    value={img.hint}
                                    onChange={(e) => {
                                      if (e.target.value.length <= 20)
                                        setSituationImages((prev) => prev.map((i) => i.id === img.id ? { ...i, hint: e.target.value } : i));
                                    }}
                                    placeholder="예) 뭐... 뭐냥?!"
                                    rows={2}
                                    className="w-full px-4 pt-3 pb-6 text-sm text-gray-900 placeholder:text-gray-300 bg-transparent resize-none focus:outline-none rounded-xl"
                                  />
                                  <span className="absolute bottom-2 right-3 text-xs text-gray-300 pointer-events-none">
                                    {img.hint.length} / 20
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* + 이미지 추가 버튼 */}
                  <button
                    onClick={() => { setImageUploadContext('situation'); setShowImageUploadModal(true); }}
                    disabled={situationImages.length >= 50}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl text-gray-600 text-sm font-medium transition-colors disabled:opacity-40"
                  >
                    + 이미지 추가
                  </button>
                  <input
                    ref={situationImageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      if (changingSituationImageId) {
                        const file = files[0];
                        if (file) {
                          const url = URL.createObjectURL(file);
                          setSituationImages((prev) => prev.map((i) => i.id === changingSituationImageId ? { ...i, url, name: file.name } : i));
                        }
                        setChangingSituationImageId(null);
                      } else {
                        const remaining = 50 - situationImages.length;
                        files.slice(0, remaining).forEach((file) => {
                          const url = URL.createObjectURL(file);
                          setSituationImages((prev) => [...prev, { id: Date.now().toString() + Math.random(), url, name: file.name, situation: '', hint: '', collapsed: false }]);
                        });
                      }
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>
            )}

            {/* ── 캐릭터 상세 탭 ── */}
            {activeTab === 'detail' && (
              <div ref={detailScrollRef} className="relative">
                <div className="flex items-start justify-between mb-1">
                  <h2 className="text-gray-900 font-bold text-lg">캐릭터 상세</h2>
                  {/* 모바일에서만 노출되는 미리보기 버튼 */}
                  <button
                    type="button"
                    onClick={() => setShowMobilePreview(true)}
                    className="lg:hidden flex-shrink-0 text-brand text-xs font-semibold border border-brand/30 rounded-lg px-2.5 py-1 hover:bg-brand/5 transition-colors"
                  >
                    미리보기
                  </button>
                </div>
                <p className="text-gray-500 text-sm mb-6">캐릭터 상세 설명을 작성하고 부가 정보들을 설정해 주세요</p>

                {/* ── 캐릭터 설명 ── */}
                <div className="mb-6">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-gray-900 font-semibold text-sm">캐릭터 설명</span>
                    <span className="text-red-500 text-sm">*</span>
                  </div>
                  <p className="text-gray-400 text-xs mb-2">캐릭터에 대한 구체적인 설명을 입력해 주세요</p>
                  <div className="relative rounded-xl border border-gray-200 focus-within:border-gray-400 transition-colors">
                    <textarea
                      value={formData.detailDescription}
                      onChange={(e) => {
                        if (e.target.value.length <= 1000) update({ detailDescription: e.target.value });
                      }}
                      placeholder="캐릭터의 성격이나 서사, 과거 사건 등 상세한 내용을 작성해 주세요"
                      rows={5}
                      className="w-full px-4 pt-3 pb-8 text-sm text-gray-900 placeholder:text-gray-300 bg-transparent resize-none focus:outline-none rounded-xl"
                    />
                    <span className="absolute bottom-3 right-4 text-xs text-gray-300 pointer-events-none">
                      {formData.detailDescription.length} / 1000
                    </span>
                  </div>
                </div>

                {/* ── 이 캐릭터가 등장하는 스토리 ── */}
                <div className="mb-6">
                  <p className="text-gray-900 font-semibold text-sm mb-1">이 캐릭터가 등장하는 스토리</p>
                  <p className="text-gray-400 text-xs mb-1">비공개, 링크 공개 스토리는 공개 전까지 노출되지 않아요</p>
                  <p className="text-gray-400 text-xs mb-3">아무 연관이 없는 스토리를 지정하면 운영자에 의해 수정될 수 있어요</p>
                  {linkedStories.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {linkedStories.map((s) => {
                        const statusInfo = STORY_STATUS_LABEL[s.status ?? ''];
                        return (
                          <span
                            key={s.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand/5 border border-brand/20 text-brand text-xs font-medium"
                          >
                            {statusInfo && (
                              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md', statusInfo.color)}>
                                {statusInfo.label}
                              </span>
                            )}
                            <span className="truncate max-w-[120px]">{s.title}</span>
                            <button
                              type="button"
                              onClick={() => setLinkedStories((prev) => prev.filter((x) => x.id !== s.id))}
                              className="text-brand/50 hover:text-red-400 transition-colors ml-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowStoryModal(true)}
                    className="w-full py-3 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-all"
                  >
                    작품 리스트 +
                  </button>
                </div>

                {/* ── 장르 ── */}
                <div className="mb-6">
                  <div className="flex items-center gap-1 mb-2">
                    <span className="text-gray-900 font-semibold text-sm">장르</span>
                    <span className="text-red-500 text-sm">*</span>
                  </div>
                  <p className="text-gray-400 text-xs mb-2">캐릭터에 맞는 장르를 선택해 주세요</p>
                  <div className="relative">
                    <select
                      value={formData.category}
                      onChange={(e) => update({ category: e.target.value })}
                      className="w-full px-4 py-3 pr-10 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:border-gray-400 appearance-none cursor-pointer"
                    >
                      <option value="" disabled>장르를 선택해주세요</option>
                      <option value="ANIME">애니메이션</option>
                      <option value="GAME">게임</option>
                      <option value="MOVIE">영화/드라마</option>
                      <option value="BOOK">소설/만화</option>
                      <option value="ORIGINAL">오리지널</option>
                      <option value="CELEBRITY">셀럽</option>
                      <option value="HISTORICAL">역사</option>
                      <option value="VTUBER">VTuber</option>
                      <option value="OTHER">기타</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* ── 타겟 ── */}
                <div className="mb-6">
                  <div className="flex items-center gap-1 mb-2">
                    <span className="text-gray-900 font-semibold text-sm">타겟</span>
                    <span className="text-red-500 text-sm">*</span>
                  </div>
                  <p className="text-gray-400 text-xs mb-1">캐릭터의 주 소비층을 선택해 주세요</p>
                  <p className="text-gray-400 text-xs mb-2">선택된 타겟에 따라 다른 사용자에게 추천돼요</p>
                  <div className="relative">
                    <select
                      value={formData.audienceTarget}
                      onChange={(e) => update({ audienceTarget: e.target.value as any })}
                      className="w-full px-4 py-3 pr-10 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:border-gray-400 appearance-none cursor-pointer"
                    >
                      <option value="" disabled>타겟을 선택해주세요</option>
                      <option value="ALL">전체</option>
                      <option value="MALE_ORIENTED">남성향</option>
                      <option value="FEMALE_ORIENTED">여성향</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* ── 해시태그 ── */}
                <div className="mb-6">
                  <span className="text-gray-900 font-semibold text-sm block mb-1">해시태그</span>
                  <p className="text-gray-400 text-xs mb-2">단어 입력 후 엔터를 눌러주세요. (최대 10개)</p>
                  {formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {formData.tags.map((tag) => (
                        <span key={tag} className="flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">
                          {tag}
                          <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-400 transition-colors">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="relative rounded-xl border border-gray-200 focus-within:border-gray-400 transition-colors">
                    <input
                      type="text"
                      value={formData.tagInput}
                      onChange={(e) => update({ tagInput: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(formData.tagInput); } }}
                      placeholder="단어 입력 후 엔터"
                      className="w-full px-4 py-3 pr-16 text-sm text-gray-900 placeholder:text-gray-300 bg-transparent focus:outline-none rounded-xl"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-300 pointer-events-none">
                      {formData.tags.length} / 10
                    </span>
                  </div>
                </div>

                {/* ── 공개 여부 ── */}
                <div className="mb-6">
                  <div className="flex items-center gap-1 mb-3">
                    <span className="text-gray-900 font-semibold text-sm">공개 여부</span>
                    <span className="text-red-500 text-sm">*</span>
                  </div>
                  <div className="space-y-2">
                    {([
                      { value: 'PUBLIC',   icon: '🔓', label: '공개',     desc: '누구나 이 캐릭터와 대화할 수 있어요' },
                      { value: 'PRIVATE',  icon: '🔒', label: '비공개',   desc: '나만 이 캐릭터와 대화할 수 있어요' },
                      { value: 'UNLISTED', icon: '🔗', label: '링크 공개', desc: '링크를 가진 사람들만 이 캐릭터와 대화할 수 있어요' },
                    ] as const).map((opt) => {
                      const isSelected = formData.visibility === opt.value;
                      return (
                        <label
                          key={opt.value}
                          className={cn(
                            'flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all',
                            isSelected
                              ? 'border-red-400 bg-white'
                              : 'border-gray-200 bg-white hover:bg-gray-50',
                          )}
                        >
                          <span className="text-base leading-none select-none">{opt.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className={cn('text-sm font-medium leading-tight', isSelected ? 'text-red-500' : 'text-gray-800')}>{opt.label}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                          </div>
                          <input
                            type="radio"
                            name="visibility"
                            value={opt.value}
                            checked={isSelected}
                            onChange={() => update({ visibility: opt.value })}
                            className="w-4 h-4 accent-red-500 shrink-0"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* ── 댓글 기능 닫기 ── */}
                <div className="mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-900 font-semibold text-sm">댓글 기능 닫기</p>
                      <p className="text-gray-400 text-xs mt-0.5">캐릭터 정보 상단 메뉴(...)에서도 설정을 변경할 수 있어요</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => update({ commentDisabled: !formData.commentDisabled })}
                      className={cn(
                        'relative inline-flex items-center h-6 w-11 rounded-full transition-colors duration-200 focus:outline-none shrink-0',
                        formData.commentDisabled ? 'bg-gray-900' : 'bg-gray-200',
                      )}
                      role="switch"
                      aria-checked={formData.commentDisabled}
                    >
                      <span
                        className={cn(
                          'inline-block w-5 h-5 transform bg-white rounded-full shadow transition-transform duration-200',
                          formData.commentDisabled ? 'translate-x-5' : 'translate-x-0.5',
                        )}
                      />
                    </button>
                  </div>
                </div>

                {/* ── 스크롤 탑 버튼 ── */}
                <div className="flex justify-end mb-4">
                  <button
                    type="button"
                    onClick={() => {
                      const container = detailScrollRef.current?.closest('[class*="overflow-y-auto"]') as HTMLElement | null;
                      container?.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 이전 / 다음 버튼 */}
          <div className="flex-shrink-0 flex items-center justify-between px-8 py-4 border-t border-gray-100">
            <button
              onClick={handlePrev}
              disabled={isFirstTab}
              className="px-8 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-0 disabled:pointer-events-none"
            >
              이전
            </button>
            <button
              onClick={handleNext}
              disabled={createMutation.isPending}
              className="px-12 py-2.5 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {createMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" />생성 중...</>
              ) : isLastTab ? (
                '등록'
              ) : (
                '다음'
              )}
            </button>
          </div>
        </div>

        {/* RIGHT PANEL */}
        {activeTab === 'intro' ? (
          /* ── 인트로 탭: 헤더/메시지만 컨텍스트에 따라 다름, 하단 입력 동일 ── */
          (() => {
            const activeEx = activeExampleId ? examples.find(e => e.id === activeExampleId) : null;
            const exIdx = activeExampleId ? examples.findIndex(e => e.id === activeExampleId) : -1;
            const exCharLen = activeEx?.messages.reduce((s, m) => s + m.content.length, 0) ?? 0;
            return (
          <div className="flex-1 min-w-0 flex flex-col border-l border-gray-100 min-h-0">
            {/* 헤더 — 인트로 or 예시 N */}
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                {activeEx ? (
                  <>
                    <span className="text-gray-900 font-semibold text-sm">예시 {exIdx + 1}</span>
                    <span className="text-gray-400 text-xs">{exCharLen}/2,000자</span>
                  </>
                ) : (
                  <>
                    <span className="text-gray-900 font-semibold text-sm">인트로</span>
                    <span className="text-gray-400 text-xs">{introCharCount}/1,500자</span>
                  </>
                )}
              </div>
              {activeEx ? (
                <button
                  onClick={autoCompleteExample}
                  disabled={isAutoCompleting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand/10 text-brand text-xs font-semibold hover:bg-brand/20 transition-colors disabled:opacity-50"
                >
                  {isAutoCompleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  자동 완성
                </button>
              ) : (
                <button className="px-3 py-1.5 rounded-lg bg-brand/10 text-brand text-xs font-semibold hover:bg-brand/20 transition-colors">
                  자동 완성
                </button>
              )}
            </div>

            {/* 채팅 영역 — 예시 or 인트로 */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">
              {activeEx ? (
                /* ── 예시 메시지 영역 ── */
                <div className="space-y-3">
                  {activeEx.messages.map((msg) => (
                    <div key={msg.id} data-example-msg={msg.id}
                      className={cn('flex gap-2', msg.role === 'user' ? 'flex-row-reverse' : 'items-start')}
                    >
                      {msg.role === 'character' && (
                        <div className="w-8 h-8 rounded-full bg-teal-400 flex-shrink-0 overflow-hidden">
                          {previewImage
                            ? <Image src={previewImage} alt="avatar" width={32} height={32} unoptimized className="object-cover w-full h-full" />
                            : <div className="w-full h-full flex items-center justify-center text-white text-xs">·-·</div>
                          }
                        </div>
                      )}
                      <div className={cn('group flex flex-col max-w-[70%]', msg.role === 'user' ? 'items-end' : 'items-start')}>
                        {msg.role === 'character' && (
                          <p className="text-gray-500 text-xs mb-1">{formData.name || '캐릭터 이름'}</p>
                        )}
                        {editingExMsgId === msg.id ? (
                          <div className="w-full">
                            <textarea
                              autoFocus
                              value={editingExMsgContent}
                              onChange={(e) => setEditingExMsgContent(e.target.value.slice(0, 500))}
                              rows={3}
                              className="w-full px-3 py-2 rounded-2xl border border-brand text-gray-800 text-sm focus:outline-none resize-none"
                            />
                            <div className="flex gap-2 mt-1 justify-end">
                              <button onClick={() => {
                                setExamples(prev => prev.map(ex => ex.id !== activeExampleId ? ex : {
                                  ...ex, messages: ex.messages.map(m => m.id === msg.id ? { ...m, content: editingExMsgContent } : m)
                                }));
                                setEditingExMsgId(null);
                              }} className="text-brand text-xs font-semibold">수정 완료</button>
                              <button onClick={() => setEditingExMsgId(null)} className="text-gray-400 text-xs">취소</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-1">
                            <div className={cn('px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap',
                              msg.role === 'character'
                                ? 'bg-white border border-gray-200 rounded-tl-sm text-gray-800'
                                : 'bg-gray-700 rounded-tr-sm text-white'
                            )}>
                              {msg.content}
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 flex flex-col gap-0.5 transition-opacity flex-shrink-0 mt-0.5">
                              <button onClick={() => { setEditingExMsgId(msg.id); setEditingExMsgContent(msg.content); }}
                                className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button onClick={() => setExamples(prev => prev.map(ex => ex.id !== activeExampleId ? ex : {
                                ...ex, messages: ex.messages.filter(m => m.id !== msg.id)
                              }))} className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {/* 현재 위치 구분선 */}
                  <div className="relative flex items-center gap-2 my-2">
                    <div className="flex-1 h-px bg-red-300" />
                    <span className="text-red-400 text-[10px] font-medium bg-white px-1 flex-shrink-0">현재 위치</span>
                  </div>
                </div>
              ) : (
                /* ── 인트로 영역 (기존 그대로) ── */
                <>
              {/* 시스템 컨텍스트 - 인트로 설정 토글 시에만 표시 */}
              {showIntroSetup && (
                <>
                  <div className="relative bg-gray-100 rounded-xl px-4 py-3 mx-2">
                    {editingContext ? (
                      <>
                        <textarea
                          autoFocus
                          value={systemContextDraft}
                          onChange={(e) => setSystemContextDraft(e.target.value.slice(0, 500))}
                          placeholder="사용자에게는 보이지 않지만 캐릭터는 알고 있어야 하는 상황 배경 등을 작성해 주세요"
                          rows={3}
                          className="w-full bg-transparent text-gray-700 text-sm placeholder:text-gray-400 focus:outline-none resize-none"
                        />
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => { setSystemContext(systemContextDraft); setEditingContext(false); }}
                              className="flex items-center gap-1 text-teal-500 text-xs font-semibold hover:text-teal-600 transition-colors"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> 수정 완료
                            </button>
                            <button
                              onClick={() => { setSystemContextDraft(systemContext); setEditingContext(false); }}
                              className="flex items-center gap-1 text-gray-400 text-xs hover:text-gray-500 transition-colors"
                            >
                              <X className="w-3 h-3" /> 취소
                            </button>
                          </div>
                          <span className="text-gray-400 text-xs">{systemContextDraft.length}/500</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <p
                          onClick={() => { setSystemContextDraft(systemContext); setEditingContext(true); }}
                          className={cn('text-sm cursor-text pr-6', systemContext ? 'text-gray-700' : 'text-gray-400')}
                        >
                          {systemContext || '사용자에게는 보이지 않지만 캐릭터는 알고 있어야 하는 상황 배경 등을 작성해 주세요'}
                        </p>
                        <button
                          onClick={() => { setSystemContextDraft(systemContext); setEditingContext(true); }}
                          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* 구분선 */}
                  <div className="flex items-center gap-3 mx-2">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-gray-400 text-[11px] whitespace-nowrap">이 선 위에 작성된 내용은 실제 사용자에게 보이지 않아요</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                </>
              )}

              {/* 메시지 목록 */}
              {introMsgs.length === 0 ? (
                <div className="space-y-3 px-2">
                  {/* 캐릭터 플레이스홀더 */}
                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 rounded-full bg-teal-400 flex-shrink-0 overflow-hidden">
                      {previewImage
                        ? <Image src={previewImage} alt="avatar" width={32} height={32} unoptimized className="object-cover w-full h-full" />
                        : <div className="w-full h-full flex items-center justify-center text-white text-xs">·-·</div>
                      }
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs mb-1">{formData.name || '캐릭터 이름'}</p>
                      <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-3 py-2 max-w-[280px]">
                        <p className="text-gray-400 text-sm">하단의 입력창에서 캐릭터를 선택하고 캐릭터의 발화를 전송해 보세요</p>
                      </div>
                    </div>
                  </div>
                  {/* 사용자 플레이스홀더 */}
                  <div className="flex justify-end px-2">
                    <div className="bg-gray-700 rounded-2xl rounded-tr-sm px-3 py-2 max-w-[280px]">
                      <p className="text-white text-sm">하단의 입력창에서 {user?.displayName ?? '사용자'}를 선택하고 발화를 전송해 보세요</p>
                    </div>
                  </div>
                  {/* 플레이 가이드 카드 — 플레이스홀더 바로 아래 */}
                  <PlayGuideCard text={playGuide} />
                </div>
              ) : (
                <div className="space-y-3 px-2">
                  {introMsgs.map((msg) =>
                    msg.role === 'character' ? (
                      <div key={msg.id} className="flex items-start gap-2">
                        <div className="w-8 h-8 rounded-full bg-teal-400 flex-shrink-0 overflow-hidden">
                          {previewImage
                            ? <Image src={previewImage} alt="avatar" width={32} height={32} unoptimized className="object-cover w-full h-full" />
                            : <div className="w-full h-full flex items-center justify-center text-white text-xs">·-·</div>
                          }
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs mb-1">{formData.name || '캐릭터 이름'}</p>
                          <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-3 py-2 max-w-[280px]">
                            <p className="text-gray-800 text-sm whitespace-pre-wrap">{resolveUser(msg.content)}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div key={msg.id} className="flex justify-end px-2">
                        <div className="bg-gray-700 rounded-2xl rounded-tr-sm px-3 py-2 max-w-[280px]">
                          <p className="text-white text-sm whitespace-pre-wrap">{resolveUser(msg.content)}</p>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
              </>
              )}
            </div>

            {/* 입력 영역 */}
            <div className="flex-shrink-0 border-t border-gray-100">
              {/* 발화자 선택 + 이미지 추가 */}
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIntroSpeaker('character')}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
                      introSpeaker === 'character'
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-500 hover:bg-gray-100'
                    )}
                  >
                    {formData.name || '캐릭터 이름'}
                  </button>
                  <button
                    onClick={() => setIntroSpeaker('user')}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
                      introSpeaker === 'user'
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-500 hover:bg-gray-100'
                    )}
                  >
                    {user?.displayName ?? '사용자'}
                  </button>
                </div>
                <button
                  onClick={() => {
                    setSelectedSituationImageId(null);
                    setShowSituationImageModal(true);
                  }}
                  className="flex items-center gap-1 text-gray-400 hover:text-gray-600 text-xs transition-colors"
                >
                  <ImagePlus className="w-4 h-4" />
                  상황별 이미지 추가
                </button>
              </div>

              {/* 텍스트 입력 */}
              <div className="px-4 pb-2">
                <textarea
                  ref={introInputRef}
                  value={introInput}
                  onChange={(e) => setIntroInput(e.target.value.slice(0, 150))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendIntroMsg();
                    }
                  }}
                  placeholder={introSpeaker === 'character'
                    ? `${formData.name || '캐릭터 이름'}의 대사를 입력해 주세요`
                    : '사용자의 대사를 입력해 주세요'
                  }
                  rows={2}
                  className="w-full text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none resize-none bg-transparent"
                />
              </div>

              {/* 하단 툴바 */}
              <div className="flex items-center justify-between px-4 pb-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const ta = introInputRef.current;
                      if (!ta) return;
                      const start = ta.selectionStart ?? introInput.length;
                      const before = introInput.slice(0, start);
                      const after = introInput.slice(start);
                      const newVal = (before + '**' + after).slice(0, 150);
                      setIntroInput(newVal);
                      // 두 * 사이에 커서 위치
                      requestAnimationFrame(() => {
                        ta.focus();
                        ta.setSelectionRange(before.length + 1, before.length + 1);
                      });
                    }}
                    className="text-blue-400 text-xs font-medium hover:text-blue-500 transition-colors"
                  >
                    * 상황 추가
                  </button>
                  <button
                    onClick={() => setIntroInput((p) => p + '{user}')}
                    className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-xs font-mono hover:bg-gray-200 transition-colors"
                    title={`미리보기에서 "${user?.displayName ?? '사용자'}"로 표시됩니다`}
                  >
                    {'{user}'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-300 text-xs">{introInput.length}/150</span>
                  <button
                    onClick={sendIntroMsg}
                    disabled={!introInput.trim()}
                    className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 disabled:opacity-40 flex items-center justify-center transition-colors"
                  >
                    <Send className="w-3.5 h-3.5 text-gray-600" />
                  </button>
                </div>
              </div>
            </div>
          </div>
            );
          })()
        ) : activeTab === 'prompt' || activeTab === 'advanced' ? (
          /* ── 프롬프트 / 고급 기능 탭: 실제 AI 대화 미리보기 ── */
          <div className="flex-1 min-w-0 flex flex-col border-l border-gray-100 min-h-0">
            {/* 헤더 */}
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-gray-100">
              <span className="text-gray-900 font-semibold text-sm">대화 미리보기</span>
              <div className="flex items-center gap-2">
                {previewMessages.length > 0 && (
                  <button
                    onClick={() => { previewAbortRef.current?.abort(); setPreviewMessages([]); }}
                    className="text-gray-400 hover:text-gray-600 text-xs transition-colors"
                  >
                    초기화
                  </button>
                )}
                <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors">
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                  Basic
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 메시지 영역 */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3">
              {/* 플레이 가이드 카드 */}
              <PlayGuideCard text={playGuide} />

              {/* 빈 상태 */}
              {previewMessages.length === 0 && !playGuide.trim() && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-300 text-sm">이 대화는 AI로 생성된 가상의 이야기입니다</p>
                </div>
              )}

              {/* 메시지 목록 */}
              {previewMessages.map((msg) =>
                msg.role === 'assistant' ? (
                  <div key={msg.id} className="flex items-start gap-2">
                    <div className="w-8 h-8 rounded-full bg-teal-400 flex-shrink-0 overflow-hidden">
                      {previewImage
                        ? <Image src={previewImage} alt="avatar" width={32} height={32} unoptimized className="object-cover w-full h-full" />
                        : <div className="w-full h-full flex items-center justify-center text-white text-xs">·-·</div>
                      }
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs mb-1">{formData.name || '캐릭터 이름'}</p>
                      <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-3 py-2 max-w-[280px]">
                        {msg.content
                          ? <p className="text-gray-800 text-sm whitespace-pre-wrap">{msg.content}</p>
                          : <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                        }
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={msg.id} className="flex justify-end">
                    <div className="bg-gray-700 rounded-2xl rounded-tr-sm px-3 py-2 max-w-[280px]">
                      <p className="text-white text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                )
              )}
              <div ref={previewBottomRef} />
            </div>

            {/* 입력 영역 */}
            <div className="flex-shrink-0 border-t border-gray-100 px-4 pt-3 pb-3">
              <textarea
                ref={previewInputRef}
                value={previewInput}
                onChange={(e) => setPreviewInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendPreviewMessage(); }
                }}
                placeholder={
                  !formData.systemPrompt.trim()
                    ? '[캐릭터 설정, 인트로, 프롬프트]를 입력해주세요'
                    : `${formData.name || '캐릭터'}에게 말을 걸어보세요`
                }
                rows={2}
                disabled={isPreviewStreaming}
                className="w-full text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none resize-none bg-transparent mb-2 disabled:opacity-50"
              />
              <div className="flex items-center justify-between">
                <button className="text-blue-400 text-xs font-medium hover:text-blue-500 transition-colors">
                  * 상황 추가
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-gray-300 text-xs">{previewInput.length}</span>
                  <button
                    onClick={sendPreviewMessage}
                    disabled={!previewInput.trim() || isPreviewStreaming || !formData.systemPrompt.trim()}
                    className="w-8 h-8 rounded-full bg-gray-900 hover:bg-gray-800 disabled:bg-gray-200 disabled:opacity-40 flex items-center justify-center transition-colors"
                  >
                    {isPreviewStreaming
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                      : <Send className="w-3.5 h-3.5 text-white" />
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'detail' ? (
          /* ── 캐릭터 상세 탭: 미리보기 패널 (데스크탑 전용 lg+) ── */
          <div className="hidden lg:flex flex-1 min-w-0 border-l border-gray-100 overflow-y-auto bg-white">
            {/* 카드를 중앙 정렬 — 최대 360px 고정, 넘치는 공간은 자동 여백 */}
            <div className="w-full max-w-[360px] mx-auto my-6 px-0">
              {/* ─ 단일 카드: 디자인 원본과 동일한 구조 ─ */}
              <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">

                {/* 카드 헤더 */}
                <div className="px-4 pt-4 pb-3">
                  <span className="text-gray-900 font-bold text-sm">미리보기</span>
                </div>

                {/* 캐릭터 이미지 — 카드 좌우 꽉 채움, 비율 4:3 */}
                <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-sky-200 via-sky-300 to-sky-400">
                  {previewImage ? (
                    <Image src={previewImage} alt="character preview" fill className="object-cover" unoptimized />
                  ) : (
                    /* 디자인 원본의 파란 배경 + 캐릭터 일러스트 재현 */
                    <div className="w-full h-full relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-sky-200 to-sky-400" />
                      {/* 하얀 삼각형 장식 */}
                      <div className="absolute top-0 right-0 w-2/3 h-2/3 bg-sky-100/60"
                        style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }} />
                      {/* 캐릭터 이모지 */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-5xl select-none" style={{ filter: 'opacity(0.7)' }}>·-·</span>
                      </div>
                    </div>
                  )}
                  {/* 좋아요 배지 */}
                  <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-white rounded-full px-2.5 py-1 shadow-md">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
                      <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" />
                      <path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
                    </svg>
                    <span className="text-gray-700 text-xs font-semibold">1.6K</span>
                  </div>
                </div>

                {/* 유저명 + 통계 */}
                <div className="px-4 pt-3 pb-3 border-b border-gray-100">
                  <p className="text-brand text-sm mb-2">
                    @{user?.username ?? '나도이런거만들거야'}
                  </p>
                  <div className="flex items-center gap-3 text-gray-400 text-xs">
                    <span className="flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      20.2K
                    </span>
                    <span className="flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>
                      10.2K
                    </span>
                    <span className="flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                      100
                    </span>
                  </div>
                </div>

                {/* 상세 설명 */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-gray-900 font-bold text-sm mb-2">상세 설명</p>
                  {formData.detailDescription.trim() ? (
                    <p className="text-gray-500 text-xs leading-relaxed whitespace-pre-wrap">
                      {formData.detailDescription}
                    </p>
                  ) : null}
                </div>

                {/* 인트로 미리보기 */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-gray-900 font-bold text-sm mb-2">인트로 미리보기</p>
                  {introMsgs.length > 0 && (
                    <div className="space-y-1.5">
                      {introMsgs.slice(0, 2).map((m) => (
                        <div key={m.id} className={cn(
                          'rounded-xl px-3 py-2 text-xs leading-relaxed',
                          m.role === 'character' ? 'bg-gray-100 text-gray-700' : 'bg-brand/10 text-brand ml-6',
                        )}>
                          {m.content}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 댓글 */}
                {formData.commentDisabled ? (
                  <div className="px-4 py-3">
                    <p className="text-gray-900 font-bold text-sm mb-2">댓글</p>
                    <div className="rounded-xl bg-gray-50 px-4 py-3">
                      <p className="text-gray-400 text-xs text-center">댓글 기능이 닫혀있어요</p>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-gray-900 font-bold text-sm">댓글 1,000건</span>
                      <button type="button" className="text-gray-400 text-xs hover:text-gray-600 transition-colors">전체보기</button>
                    </div>
                    {/* 샘플 댓글 */}
                    <div className="flex items-start gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-300 to-pink-300 flex-shrink-0 flex items-center justify-center">
                        <span className="text-white text-[10px] font-bold">나</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-gray-500 text-[10px] mb-0.5">{user?.username ?? '사용자'}님</p>
                        <p className="text-gray-700 text-xs leading-relaxed">너무 재있어요~~!!!</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ── 캐릭터 설정 탭: 인기 캐릭터 모아보기 ── */
          <div className="hidden lg:flex flex-1 min-w-0 border-l border-gray-100 overflow-y-auto bg-white">
            {/* 카드 그리드를 중앙 정렬 — 최대 360px 고정, 나머지는 여백 */}
            <div className="w-full max-w-[360px] mx-auto my-6 px-0">
              {/* 미리보기 헤더 — 캐릭터 상세 탭과 동일 스타일 */}
              <div className="px-4 pb-3">
                <span className="text-gray-900 font-bold text-sm">미리보기</span>
              </div>
              <div className="px-4 pb-2">
                <p className="text-gray-400 text-xs">인기 캐릭터 모아보기</p>
              </div>
              <div className="px-4 grid grid-cols-2 gap-4">
                <LivePreviewCard
                  imageUrl={previewImage}
                  name={formData.name}
                  desc={formData.description}
                />
                {popularCharacters.length > 0
                  ? popularCharacters.slice(0, 3).map((char: any) => (
                      <PopularCharacterCard key={char.id} character={char} />
                    ))
                  : (
                    <>
                      <PlaceholderCharacterCard name="서은빈" desc="개싸기기 여사친이 셀카를 잘못 보낸 것 같다" author="노타" />
                      <PlaceholderCharacterCard name="설태린" desc="모두에게 친절한 학생회장, 나만 싫어할 뿐이다." author="김타브" />
                      <PlaceholderCharacterCard name="루카" desc="제퍼의 비주얼 센터, 최에는 최에고, 루카는 루카다." author="기계" />
                    </>
                  )
                }
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 모바일 미리보기 바텀 시트 (lg 미만에서만 노출) ── */}
      {/* 캐릭터 상세 탭 모바일 미리보기 */}
      {showMobilePreview && (
        <MobilePreviewSheet
          onClose={() => setShowMobilePreview(false)}
          previewImage={previewImage}
          username={user?.username ?? '나도이런거만들거야'}
          detailDescription={formData.detailDescription}
          introMsgs={introMsgs}
          commentDisabled={formData.commentDisabled}
        />
      )}

      {/* 캐릭터 설정 탭 모바일 미리보기 */}
      {showMobileSettingsPreview && (
        <MobileSettingsPreviewSheet
          onClose={() => setShowMobileSettingsPreview(false)}
          previewImage={previewImage}
          name={formData.name}
          description={formData.description}
          popularCharacters={popularCharacters}
        />
      )}

      {/* 인트로 탭 모바일 미리보기 */}
      {showMobileIntroPreview && (
        <MobileChatPreviewSheet
          onClose={() => setShowMobileIntroPreview(false)}
          title="인트로"
          previewImage={previewImage}
          characterName={formData.name}
          messages={introMsgs}
        />
      )}

      {/* 프롬프트 탭 모바일 미리보기 */}
      {showMobilePromptPreview && (
        <MobileChatPreviewSheet
          onClose={() => setShowMobilePromptPreview(false)}
          title="대화"
          previewImage={previewImage}
          characterName={formData.name}
          messages={previewMessages}
        />
      )}

      {/* 고급 기능 탭 모바일 미리보기 */}
      {showMobileAdvancedPreview && (
        <MobileChatPreviewSheet
          onClose={() => setShowMobileAdvancedPreview(false)}
          title="대화"
          previewImage={previewImage}
          characterName={formData.name}
          messages={previewMessages}
        />
      )}

      {/* 아바타 이미지 크롭 모달 */}
      {showAvatarCropper && rawAvatarSrc && (
        <ImageCropModal
          imageSrc={rawAvatarSrc}
          aspect={1}
          onConfirm={handleAvatarCropConfirm}
          onCancel={() => { setShowAvatarCropper(false); setRawAvatarSrc(null); }}
        />
      )}
    </div>
  );
}
