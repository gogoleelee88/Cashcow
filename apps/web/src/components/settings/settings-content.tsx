'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { User, Bell, Shield, CreditCard, LogOut, Camera, Save, ChevronRight, Coins } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { toast } from '../ui/toaster';
import { cn } from '../../lib/utils';

type Tab = 'profile' | 'notifications' | 'privacy' | 'account';

const TABS = [
  { id: 'profile' as Tab, label: '프로필', icon: User },
  { id: 'notifications' as Tab, label: '알림', icon: Bell },
  { id: 'privacy' as Tab, label: '개인정보', icon: Shield },
  { id: 'account' as Tab, label: '계정', icon: CreditCard },
];

export function SettingsContent() {
  const { user, setUser } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState((user as any)?.bio ?? '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { displayName: string; bio: string; avatarUrl?: string }) => {
      return api.users.updateMe(data);
    },
    onSuccess: (res: any) => {
      setUser(res);
      toast.success('저장 완료', '프로필이 업데이트되었습니다.');
    },
    onError: () => toast.error('오류', '프로필 업데이트에 실패했습니다.'),
  });

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSaveProfile = async () => {
    let avatarUrl = user?.avatarUrl;

    if (avatarFile) {
      try {
        const res = await api.users.uploadAvatar(avatarFile);
        avatarUrl = res.data.avatarUrl;
      } catch {
        toast.error('오류', '이미지 업로드에 실패했습니다.');
        return;
      }
    }

    updateProfileMutation.mutate({ displayName, bio, ...(avatarUrl ? { avatarUrl } : {}) });
  };

  const logoutMutation = useMutation({
    mutationFn: () => api.auth.logout(useAuthStore.getState().refreshToken ?? ''),
    onSuccess: () => {
      useAuthStore.getState().logout();
      router.push('/login');
    },
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-text-primary font-bold text-2xl mb-6">설정</h1>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar */}
        <div className="w-full md:w-56 flex-shrink-0">
          <nav className="space-y-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                  activeTab === tab.id
                    ? 'bg-brand/15 text-brand border border-brand/20'
                    : 'text-text-muted hover:text-text-primary hover:bg-surface'
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
            <Link
              href="/settings/credits"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-text-muted hover:text-text-primary hover:bg-surface transition-all"
            >
              <Coins className="w-4 h-4" />
              크레딧 충전
              <ChevronRight className="w-3 h-3 ml-auto" />
            </Link>
          </nav>
        </div>

        {/* Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 card p-6"
        >
          {activeTab === 'profile' && (
            <div className="space-y-5">
              <h2 className="text-text-primary font-semibold text-lg">프로필 설정</h2>

              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20 rounded-full overflow-hidden bg-brand/20 ring-2 ring-border">
                  {avatarPreview || user?.avatarUrl ? (
                    <Image
                      src={avatarPreview || user!.avatarUrl!}
                      alt="Avatar"
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-brand font-bold text-2xl">
                      {user?.displayName?.[0]}
                    </div>
                  )}
                  <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                    <Camera className="w-5 h-5 text-white" />
                    <input type="file" accept="image/*" onChange={handleAvatarChange} className="sr-only" />
                  </label>
                </div>
                <div>
                  <p className="text-text-primary font-medium">{user?.displayName}</p>
                  <p className="text-text-muted text-sm">@{user?.username}</p>
                </div>
              </div>

              <div>
                <label className="block text-text-secondary text-sm mb-1.5">표시 이름</label>
                <input
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-text-primary text-sm focus:outline-none focus:border-brand/50"
                  maxLength={30}
                />
              </div>

              <div>
                <label className="block text-text-secondary text-sm mb-1.5">소개</label>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  rows={3}
                  className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-text-primary text-sm focus:outline-none focus:border-brand/50 resize-none"
                  maxLength={200}
                  placeholder="자신을 소개해보세요..."
                />
                <p className="text-text-muted text-xs mt-1 text-right">{bio.length}/200</p>
              </div>

              <button
                onClick={handleSaveProfile}
                disabled={updateProfileMutation.isPending}
                className="btn-primary flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {updateProfileMutation.isPending ? '저장 중...' : '저장'}
              </button>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <h2 className="text-text-primary font-semibold text-lg">알림 설정</h2>
              {[
                { key: 'emailNotifications', label: '이메일 알림', desc: '새로운 좋아요, 팔로워 알림을 이메일로 받습니다.' },
                { key: 'chatNotifications', label: '채팅 알림', desc: '대화 관련 알림을 받습니다.' },
                { key: 'marketingEmails', label: '마케팅 이메일', desc: '새로운 기능, 이벤트 소식을 받습니다.' },
              ].map(item => (
                <div key={item.key} className="flex items-start justify-between p-4 rounded-xl border border-border">
                  <div>
                    <p className="text-text-primary text-sm font-medium">{item.label}</p>
                    <p className="text-text-muted text-xs mt-0.5">{item.desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-4 flex-shrink-0">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-10 h-6 bg-surface peer-checked:bg-brand rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-4" />
                  </label>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <h2 className="text-text-primary font-semibold text-lg">개인정보 설정</h2>
              {[
                { key: 'publicProfile', label: '공개 프로필', desc: '다른 사용자가 내 프로필을 볼 수 있습니다.' },
                { key: 'showActivity', label: '활동 공개', desc: '최근 활동을 다른 사용자에게 표시합니다.' },
              ].map(item => (
                <div key={item.key} className="flex items-start justify-between p-4 rounded-xl border border-border">
                  <div>
                    <p className="text-text-primary text-sm font-medium">{item.label}</p>
                    <p className="text-text-muted text-xs mt-0.5">{item.desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-4 flex-shrink-0">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-10 h-6 bg-surface peer-checked:bg-brand rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-4" />
                  </label>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'account' && (
            <div className="space-y-4">
              <h2 className="text-text-primary font-semibold text-lg">계정 관리</h2>

              <div className="p-4 rounded-xl border border-border">
                <p className="text-text-secondary text-sm">이메일</p>
                <p className="text-text-primary font-medium mt-0.5">{(user as any)?.email ?? '—'}</p>
              </div>

              <div className="p-4 rounded-xl border border-border">
                <p className="text-text-secondary text-sm">크레딧 잔액</p>
                <p className="text-text-primary font-bold text-xl mt-0.5">
                  {((user as any)?.credits ?? 0).toLocaleString()}
                  <span className="text-text-muted text-sm font-normal ml-1">크레딧</span>
                </p>
                <Link href="/settings/credits" className="btn-primary text-sm mt-3 inline-flex items-center gap-1.5">
                  <Coins className="w-4 h-4" />충전하기
                </Link>
              </div>

              <button
                onClick={() => logoutMutation.mutate()}
                className="w-full flex items-center gap-2 px-4 py-3 rounded-xl text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all text-sm font-medium"
              >
                <LogOut className="w-4 h-4" />
                로그아웃
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
