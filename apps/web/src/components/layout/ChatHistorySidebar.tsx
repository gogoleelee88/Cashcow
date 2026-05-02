'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { MessageCircle, Pencil, MoreVertical } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { cn } from '../../lib/utils';
import { getCharacterAvatarUrl } from '@characterverse/utils';

function ConvItem({ conv }: { conv: any }) {
  const [imgErr, setImgErr] = useState(false);
  const router = useRouter();
  const character = conv.character;
  const src = imgErr ? getCharacterAvatarUrl(null, character?.name ?? '?') : character?.avatarUrl;

  const formatRelativeTime = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    return `${Math.floor(hours / 24)}일 전`;
  };

  return (
    <div
      className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-gray-50 cursor-pointer group transition-colors"
      onClick={() => router.push(`/chat?conversationId=${conv.id}`)}
    >
      <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-gray-100">
        {src
          ? <Image src={src} alt={character?.name ?? ''} width={36} height={36} className="object-cover" onError={() => setImgErr(true)} />
          : <div className="w-full h-full bg-brand/10 flex items-center justify-center text-brand text-xs font-bold">
              {character?.name?.[0] ?? '?'}
            </div>
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <p className="text-[12px] font-semibold text-gray-800 truncate pr-1">{character?.name ?? '알 수 없음'}</p>
          <span className="text-[10px] text-gray-400 flex-shrink-0">{formatRelativeTime(conv.updatedAt)}</span>
        </div>
        <p className="text-[11px] text-gray-400 truncate leading-snug">
          {conv.lastMessage?.content ?? '대화를 시작해보세요'}
        </p>
      </div>
      <button
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-gray-400 hover:text-gray-600"
        onClick={(e) => e.stopPropagation()}
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ChatHistorySidebar() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [sidebarTab, setSidebarTab] = useState<'episode' | 'party'>('episode');

  const { data: convData } = useQuery({
    queryKey: ['conversations', 'recent'],
    queryFn: () => api.chat.conversations({ limit: 20 }),
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });

  const conversations: any[] = convData?.data ?? [];

  return (
    <aside className="hidden lg:flex flex-col w-[215px] flex-shrink-0 border-r border-gray-200 bg-white">
      {/* 에피소드 / 파티챗 탭 */}
      <div className="flex border-b border-gray-200">
        {(['episode', 'party'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setSidebarTab(t)}
            className={cn(
              'flex-1 py-3 text-[13px] font-semibold transition-colors relative',
              sidebarTab === t ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
            )}
          >
            {t === 'episode' ? '에피소드' : '파티챗'}
            {sidebarTab === t && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-900 rounded-t" />
            )}
          </button>
        ))}
      </div>

      {/* 채팅 내역 헤더 */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="text-[12px] font-semibold text-gray-700">채팅 내역</span>
        {isAuthenticated && (
          <button className="flex items-center gap-0.5 text-[12px] text-gray-500 hover:text-gray-700 transition-colors">
            <Pencil className="w-3 h-3" />
            편집
          </button>
        )}
      </div>

      {/* 채팅 목록 */}
      <div className="flex-1 overflow-y-auto hide-scrollbar">
        {!isAuthenticated ? (
          <div className="px-3 py-6 text-center">
            <p className="text-[12px] text-gray-400 mb-3">로그인하면 채팅 내역을 볼 수 있어요</p>
            <button
              onClick={() => router.push('/login')}
              className="w-full py-2 rounded-lg bg-brand text-white text-[12px] font-semibold hover:bg-brand-hover transition-colors"
            >
              로그인
            </button>
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <MessageCircle className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-[12px] text-gray-400">아직 채팅 내역이 없어요</p>
          </div>
        ) : (
          conversations.map((conv) => (
            <ConvItem key={conv.id} conv={conv} />
          ))
        )}
      </div>
    </aside>
  );
}
