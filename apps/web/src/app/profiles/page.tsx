'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, X, Check, Baby } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { useProfileStore } from '../../stores/profile.store';
import type { Profile } from '@characterverse/types';
import { cn } from '../../lib/utils';

const EMOJI_OPTIONS = ['😊','🦁','🐯','🐻','🐼','🦊','🐸','🐧','🦄','🌟','🎮','🎨','🎵','🚀','⚽','🎀','🌈','🍭','🦋','🐬'];
const COLOR_OPTIONS = ['#00D96B','#3B82F6','#10B981','#F59E0B','#8B5CF6','#EC4899','#06B6D4','#F97316','#6366F1','#14B8A6'];

// ─── 프로필 아바타 ───────────────────────────────
function ProfileAvatar({ profile, size = 'lg' }: { profile: Profile; size?: 'sm' | 'lg' }) {
  const sz = size === 'lg' ? 'w-28 h-28 text-5xl' : 'w-14 h-14 text-2xl';
  return (
    <div
      className={cn('rounded-xl flex items-center justify-center flex-shrink-0', sz)}
      style={{ backgroundColor: profile.avatarColor + '33', border: `3px solid ${profile.avatarColor}` }}
    >
      <span>{profile.avatarEmoji}</span>
      {profile.isKids && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-sky-500 rounded-full flex items-center justify-center text-white text-[10px]">
          <Baby className="w-3 h-3" />
        </span>
      )}
    </div>
  );
}

// ─── 프로필 추가/수정 모달 ───────────────────────
function ProfileFormModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: Profile;
  onClose: () => void;
  onSave: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [isKids, setIsKids] = useState(initial?.isKids ?? false);
  const [emoji, setEmoji] = useState(initial?.avatarEmoji ?? '😊');
  const [color, setColor] = useState(initial?.avatarColor ?? '#00D96B');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const createMut = useMutation({
    mutationFn: () => api.profiles.create({ name, isKids, pin: pin || undefined, avatarEmoji: emoji, avatarColor: color }),
    onSuccess: onSave,
    onError: (e: any) => setError(e.response?.data?.error ?? '저장 실패'),
  });
  const updateMut = useMutation({
    mutationFn: () => api.profiles.update(initial!.id, { name, isKids, pin: pin || null, avatarEmoji: emoji, avatarColor: color }),
    onSuccess: onSave,
    onError: (e: any) => setError(e.response?.data?.error ?? '저장 실패'),
  });

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-md p-6 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">{initial ? '프로필 수정' : '프로필 추가'}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 아바타 미리보기 */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-xl flex items-center justify-center text-5xl"
              style={{ backgroundColor: color + '33', border: `3px solid ${color}` }}>
              {emoji}
            </div>
            {isKids && (
              <span className="absolute -top-1 -right-1 w-6 h-6 bg-sky-500 rounded-full flex items-center justify-center">
                <Baby className="w-3.5 h-3.5 text-white" />
              </span>
            )}
          </div>
        </div>

        {/* 이모지 선택 */}
        <div className="flex flex-wrap gap-2 mb-4 justify-center">
          {EMOJI_OPTIONS.map((e) => (
            <button key={e} onClick={() => setEmoji(e)}
              className={cn('w-9 h-9 rounded-lg text-xl flex items-center justify-center transition-all',
                emoji === e ? 'bg-white/20 scale-110' : 'hover:bg-white/10')}>
              {e}
            </button>
          ))}
        </div>

        {/* 색상 선택 */}
        <div className="flex gap-2 mb-5 justify-center flex-wrap">
          {COLOR_OPTIONS.map((c) => (
            <button key={c} onClick={() => setColor(c)}
              className={cn('w-7 h-7 rounded-full transition-all', color === c && 'ring-2 ring-white ring-offset-2 ring-offset-[#1a1a1a] scale-110')}
              style={{ backgroundColor: c }} />
          ))}
        </div>

        {/* 이름 */}
        <input
          type="text" maxLength={20} placeholder="이름" value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-white/40 mb-3 focus:outline-none focus:border-white/40"
        />

        {/* PIN */}
        <input
          type="password" maxLength={4} placeholder="전환 PIN (선택, 숫자 4자리)" value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-white/40 mb-4 focus:outline-none focus:border-white/40"
        />

        {/* 키즈 모드 */}
        <button onClick={() => setIsKids(!isKids)}
          className={cn('w-full flex items-center gap-3 px-4 py-3 rounded-xl border mb-5 transition-all',
            isKids ? 'bg-sky-500/20 border-sky-500 text-sky-300' : 'bg-white/5 border-white/20 text-white/60 hover:bg-white/10')}>
          <Baby className="w-5 h-5" />
          <div className="text-left">
            <p className="text-sm font-medium">키즈 모드</p>
            <p className="text-xs opacity-70">전체 이용가 콘텐츠만 표시됩니다</p>
          </div>
          {isKids && <Check className="w-4 h-4 ml-auto" />}
        </button>

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

        <button
          onClick={() => initial ? updateMut.mutate() : createMut.mutate()}
          disabled={!name.trim() || isPending}
          className="w-full py-3 rounded-xl bg-white text-black font-bold hover:bg-white/90 transition-all disabled:opacity-50"
        >
          {isPending ? '저장 중...' : '저장'}
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────
export default function ProfilesPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, logout } = useAuthStore();
  const { setActiveProfile } = useProfileStore();
  const queryClient = useQueryClient();

  const [editMode, setEditMode] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Profile | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isAuthenticated, isLoading, router]);

  const { data, isLoading: profilesLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => api.profiles.list().then((r) => r.data as Profile[]),
    enabled: isAuthenticated,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.profiles.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profiles'] }),
  });

  const profiles: Profile[] = data ?? [];

  const handleSelect = (profile: Profile) => {
    if (editMode) return;
    setActiveProfile(profile);
    router.push('/');
  };

  const handleFormSave = () => {
    queryClient.invalidateQueries({ queryKey: ['profiles'] });
    setShowForm(false);
    setEditTarget(null);
  };

  if (isLoading || profilesLoading) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center px-4">
      {/* 로고 */}
      <div className="mb-12 flex items-center gap-2">
        <div className="w-10 h-10 rounded-xl bg-[#00D96B] flex items-center justify-center">
          <span className="text-white font-black text-lg">C</span>
        </div>
        <span className="text-white font-black text-2xl tracking-tight">
          crack<span className="text-[#00D96B]">.</span>
        </span>
      </div>

      <h1 className="text-white text-3xl font-bold mb-10">
        {editMode ? '프로필 관리' : '누가 시청하나요?'}
      </h1>

      {/* 프로필 그리드 */}
      <div className="flex flex-wrap justify-center gap-6 mb-10 max-w-2xl">
        {profiles.map((profile, i) => (
          <motion.div
            key={profile.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="flex flex-col items-center gap-3 cursor-pointer group"
            onClick={() => handleSelect(profile)}
          >
            <div className="relative">
              <div className={cn(
                'w-28 h-28 rounded-xl flex items-center justify-center text-5xl transition-all duration-200',
                !editMode && 'group-hover:scale-105 group-hover:ring-2 group-hover:ring-white'
              )}
                style={{ backgroundColor: profile.avatarColor + '33', border: `3px solid ${profile.avatarColor}` }}>
                {profile.avatarEmoji}
              </div>

              {profile.isKids && (
                <span className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-sky-500 rounded-full flex items-center justify-center shadow-lg">
                  <Baby className="w-3.5 h-3.5 text-white" />
                </span>
              )}

              {editMode && (
                <div className="absolute inset-0 rounded-xl bg-black/60 flex items-center justify-center gap-3">
                  <button onClick={(e) => { e.stopPropagation(); setEditTarget(profile); setShowForm(true); }}
                    className="p-2 rounded-full bg-white/20 hover:bg-white/40 transition-colors">
                    <Pencil className="w-4 h-4 text-white" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); if (confirm(`"${profile.name}" 프로필을 삭제할까요?`)) deleteMut.mutate(profile.id); }}
                    className="p-2 rounded-full bg-red-500/60 hover:bg-red-500 transition-colors">
                    <Trash2 className="w-4 h-4 text-white" />
                  </button>
                </div>
              )}
            </div>

            <div className="text-center">
              <p className="text-white text-sm font-medium">{profile.name}</p>
              {profile.isKids && (
                <span className="text-sky-400 text-xs">키즈</span>
              )}
            </div>
          </motion.div>
        ))}

        {/* 프로필 추가 */}
        {profiles.length < 5 && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: profiles.length * 0.06 }}
            onClick={() => { setEditTarget(null); setShowForm(true); }}
            className="flex flex-col items-center gap-3 group"
          >
            <div className="w-28 h-28 rounded-xl border-2 border-dashed border-white/30 flex items-center justify-center
                            group-hover:border-white/60 group-hover:bg-white/5 transition-all">
              <Plus className="w-8 h-8 text-white/40 group-hover:text-white/70 transition-colors" />
            </div>
            <p className="text-white/50 text-sm group-hover:text-white/80 transition-colors">프로필 추가</p>
          </motion.button>
        )}
      </div>

      {/* 하단 버튼 */}
      <div className="flex gap-4">
        <button
          onClick={() => setEditMode(!editMode)}
          className={cn(
            'px-6 py-2.5 rounded-xl border text-sm font-medium transition-all',
            editMode
              ? 'bg-white text-black border-white'
              : 'border-white/40 text-white/70 hover:border-white hover:text-white'
          )}
        >
          {editMode ? '완료' : '프로필 관리'}
        </button>
        <button
          onClick={() => { logout(); router.push('/login'); }}
          className="px-6 py-2.5 rounded-xl border border-white/20 text-white/50 hover:text-white/80 hover:border-white/40 text-sm transition-all"
        >
          로그아웃
        </button>
      </div>

      {/* 모달 */}
      <AnimatePresence>
        {showForm && (
          <ProfileFormModal
            initial={editTarget ?? undefined}
            onClose={() => { setShowForm(false); setEditTarget(null); }}
            onSave={handleFormSave}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
