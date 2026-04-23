'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  X, MessageCircle, Heart, Share2, Star, Crown,
  Sparkles, ChevronDown, ChevronUp, Loader2, Send, Trash2,
  ThumbsUp, ThumbsDown, Flag,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { formatCount, formatDate, CATEGORY_LABELS, getCharacterAvatarUrl } from '@characterverse/utils';
import { cn } from '../../lib/utils';
import { toast } from '../ui/toaster';
import { useState, useEffect } from 'react';

interface CharacterPreviewModalProps {
  characterId: string | null;
  onClose: () => void;
}

export function CharacterPreviewModal({ characterId, onClose }: CharacterPreviewModalProps) {
  // 내부적으로 현재 보고 있는 캐릭터 ID (비슷한 캐릭터 클릭 시 전환)
  const [previewCharId, setPreviewCharId] = useState<string | null>(characterId);
  const [imageError, setImageError] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [greetingExpanded, setGreetingExpanded] = useState(false);
  const [commentText, setCommentText] = useState('');
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => { setPreviewCharId(characterId); }, [characterId]);

  const { data, isLoading } = useQuery({
    queryKey: ['character', previewCharId],
    queryFn: () => api.characters.get(previewCharId!),
    enabled: !!previewCharId,
  });

  const character = data?.data;

  const { data: similarData } = useQuery({
    queryKey: ['character-similar', character?.category, previewCharId],
    queryFn: () => api.characters.list({ category: character!.category, limit: 10, sort: 'trending' }),
    enabled: !!character?.category,
    staleTime: 5 * 60 * 1000,
  });
  const similarChars = (similarData?.data ?? []).filter((c: any) => c.id !== previewCharId).slice(0, 8);

  const { data: commentsData } = useQuery({
    queryKey: ['character-comments', previewCharId],
    queryFn: () => api.characters.listComments(previewCharId!, { limit: 5 }),
    enabled: !!previewCharId,
  });

  const createCommentMutation = useMutation({
    mutationFn: (content: string) => api.characters.createComment(previewCharId!, content),
    onSuccess: () => {
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: ['character-comments', previewCharId] });
    },
    onError: () => toast.error('오류', '댓글 작성에 실패했습니다.'),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => api.characters.deleteComment(previewCharId!, commentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['character-comments', previewCharId] }),
  });

  useEffect(() => {
    if (character) {
      setIsLiked(character.isLiked ?? false);
      setLikeCount(character.likeCount ?? 0);
      setImageError(false);
      setGreetingExpanded(false);
      setCommentText('');
    }
  }, [character?.id]);

  useEffect(() => {
    if (characterId) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [characterId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const startChatMutation = useMutation({
    mutationFn: () => api.chat.createConversation(previewCharId!),
    onSuccess: (res) => {
      onClose();
      router.push(`/chat?conversationId=${res.data.id}`);
    },
    onError: (err: any) => {
      const code = err.response?.data?.error?.code;
      if (code === 'AGE_VERIFICATION_REQUIRED') toast.error('성인 인증 필요', '이 캐릭터는 성인 인증이 필요합니다.');
      else if (code === 'INSUFFICIENT_CREDITS') { toast.error('크레딧 부족', '크레딧을 충전해주세요.'); router.push('/settings/credits'); }
      else toast.error('오류', '대화를 시작할 수 없습니다.');
    },
  });

  const likeMutation = useMutation({
    mutationFn: () => api.characters.like(previewCharId!),
    onMutate: () => {
      setIsLiked((p) => !p);
      setLikeCount((p) => isLiked ? p - 1 : p + 1);
    },
    onError: () => {
      setIsLiked((p) => !p);
      setLikeCount((p) => isLiked ? p + 1 : p - 1);
    },
  });

  const handleChat = () => {
    if (!isAuthenticated) { onClose(); router.push(`/login?redirect=/characters/${previewCharId}`); return; }
    startChatMutation.mutate();
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) { onClose(); router.push('/login'); return; }
    likeMutation.mutate();
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/characters/${previewCharId}`;
    navigator.share?.({ title: character?.name, url }) ||
      navigator.clipboard.writeText(url).then(() => toast.success('링크 복사됨'));
  };

  const avatarSrc = imageError ? null : character?.avatarUrl;

  const GREETING_LIMIT = 140;
  const greetingText = character?.greeting ?? '';
  const greetingNeedsToggle = greetingText.length > GREETING_LIMIT;
  const greetingDisplay = greetingExpanded || !greetingNeedsToggle
    ? greetingText
    : greetingText.slice(0, GREETING_LIMIT) + '...';

  return (
    <AnimatePresence>
      {characterId && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 bg-black/75 z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', damping: 30, stiffness: 350 }}
            className="fixed inset-x-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 top-[4%] md:top-[5%] z-50 w-auto md:w-[600px] max-h-[92vh] flex flex-col"
          >
            <div className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh]">

              {/* ── HEADER ── */}
              <div className="flex items-center justify-between px-5 py-4 flex-shrink-0">
                <h2 className="text-[17px] font-bold text-gray-900">캐릭터 정보</h2>
                <button
                  onClick={onClose}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500"
                >
                  <X className="w-4 h-4" strokeWidth={2.5} />
                </button>
              </div>

              {/* ── SCROLLABLE BODY ── */}
              <div className="flex-1 overflow-y-auto">
                {isLoading || !character ? (
                  <div className="flex items-center justify-center py-32">
                    <Loader2 className="w-8 h-8 text-brand animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* ── SECTION 1: Cover + Info ── */}
                    <div className="flex gap-4 px-5 pb-3">
                      <div className="relative w-[110px] flex-shrink-0 rounded-xl overflow-hidden bg-gray-100"
                           style={{ aspectRatio: '3/4' }}>
                        <Image
                          src={avatarSrc || getCharacterAvatarUrl(null, character.name)}
                          alt={character.name}
                          fill
                          className="object-cover"
                          onError={() => setImageError(true)}
                          sizes="110px"
                          priority
                        />
                        {character.isFeatured && (
                          <div className="absolute top-1.5 left-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-400 text-amber-900 text-[9px] font-bold">
                            <Crown className="w-2 h-2" />추천
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 pt-0.5">
                        <h3 className="text-[15px] font-bold text-gray-900 leading-snug mb-1.5 line-clamp-2">
                          {character.name}
                        </h3>
                        <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
                          {character.creator && (
                            <span className="text-[12px] text-gray-500">{character.creator.displayName}</span>
                          )}
                          {character.creator && <span className="text-gray-300 text-xs">·</span>}
                          {character.isOfficial && (
                            <span className="inline-flex items-center gap-0.5 text-[11px] text-blue-600 font-semibold">
                              <Star className="w-2.5 h-2.5 fill-current" />공식
                            </span>
                          )}
                          {character.model === 'claude-sonnet-4' && (
                            <span className="inline-flex items-center gap-0.5 text-[11px] text-purple-600 font-semibold">
                              <Sparkles className="w-2.5 h-2.5" />PRO
                            </span>
                          )}
                          <span className="text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                            {(CATEGORY_LABELS as any)[character.category] ?? character.category}
                          </span>
                          <span className={cn(
                            'text-[11px] px-1.5 py-0.5 rounded-full',
                            character.ageRating === 'MATURE' ? 'text-red-500 bg-red-50' :
                            character.ageRating === 'TEEN' ? 'text-amber-600 bg-amber-50' :
                            'text-emerald-600 bg-emerald-50'
                          )}>
                            {character.ageRating === 'ALL' ? '전체이용가' : character.ageRating === 'TEEN' ? '청소년' : '성인'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                          <button
                            onClick={handleLike}
                            className={cn(
                              'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border transition-all',
                              isLiked
                                ? 'bg-rose-50 border-rose-200 text-rose-500'
                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-rose-200 hover:text-rose-400'
                            )}
                          >
                            <Heart className={cn('w-3.5 h-3.5', isLiked && 'fill-rose-500')} />
                            관심등록
                          </button>
                          <button
                            onClick={handleShare}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300 transition-all"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            공유
                          </button>
                        </div>
                        <div className="flex items-center gap-2 text-[12px] text-gray-400">
                          <span className="flex items-center gap-1">
                            <MessageCircle className="w-3.5 h-3.5" />
                            {formatCount(character.chatCount)}
                          </span>
                          <span className="text-gray-200">·</span>
                          <span className="flex items-center gap-1">
                            <Heart className="w-3.5 h-3.5" />
                            {formatCount(likeCount)}
                          </span>
                        </div>
                        {character.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-2.5">
                            {character.tags.map((tag: string) => (
                              <Link key={tag} href={`/explore?q=${encodeURIComponent(tag)}`} onClick={onClose}
                                className="text-[12px] text-gray-400 hover:text-brand transition-colors">
                                #{tag}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="h-px bg-gray-100 mx-5" />

                    {/* ── SECTION 2: 상세 설명 ── */}
                    <div className="px-5 pt-4 pb-2">
                      <p className="text-[13px] font-bold text-gray-700 mb-3">상세 설명</p>
                      <div className="relative w-full rounded-xl overflow-hidden bg-gray-100 mb-4" style={{ aspectRatio: '16/9' }}>
                        <Image
                          src={avatarSrc || getCharacterAvatarUrl(null, character.name)}
                          alt={character.name}
                          fill
                          className="object-cover"
                          sizes="560px"
                        />
                      </div>
                      {character.description && (
                        <p className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-line mb-1">
                          {character.description}
                        </p>
                      )}
                    </div>

                    {/* ── SECTION 3: Greeting (expandable) ── */}
                    {greetingText && (
                      <div className="px-5 pb-4">
                        <div className="h-px bg-gray-100 mb-4" />
                        <p className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-line">
                          {greetingDisplay}
                        </p>
                        {greetingNeedsToggle && (
                          <button
                            onClick={() => setGreetingExpanded((v) => !v)}
                            className="flex items-center gap-0.5 text-[13px] text-gray-400 hover:text-gray-600 transition-colors mt-2 mx-auto"
                          >
                            {greetingExpanded
                              ? <>접기 <ChevronUp className="w-3.5 h-3.5" /></>
                              : <>펼치기 <ChevronDown className="w-3.5 h-3.5" /></>}
                          </button>
                        )}
                      </div>
                    )}

                    {/* ── SECTION 4: Update date ── */}
                    <div className="h-2 bg-gray-50" />
                    <div className="px-5 py-4">
                      <p className="text-[13px] text-gray-500 mb-2">업데이트 날짜</p>
                      <div className="px-4 py-3 border border-gray-200 rounded-xl">
                        <p className="text-[13px] text-gray-700">
                          {formatDate(character.updatedAt ?? character.createdAt)}
                        </p>
                      </div>
                    </div>

                    {/* ── SECTION 5: Creator ── */}
                    {character.creator && (
                      <>
                        <div className="h-px bg-gray-100 mx-5" />
                        <div className="px-5 py-4">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[13px] text-gray-500">제작자</p>
                            <Link href={`/profile/${character.creator.username}`} onClick={onClose}
                              className="text-[12px] text-brand hover:underline">전체보기</Link>
                          </div>
                          <Link href={`/profile/${character.creator.username}`} onClick={onClose}
                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors border border-gray-200">
                            <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-brand/10">
                              {character.creator.avatarUrl
                                ? <Image src={character.creator.avatarUrl} alt={character.creator.displayName} width={36} height={36} className="object-cover" />
                                : <div className="w-full h-full flex items-center justify-center text-brand font-bold text-sm">{character.creator.displayName[0]}</div>}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold text-gray-800 truncate">{character.creator.displayName}</p>
                              <p className="text-[12px] text-gray-400 truncate">@{character.creator.username}</p>
                            </div>
                            <Crown className="w-4 h-4 text-amber-400 ml-auto flex-shrink-0" />
                          </Link>
                        </div>
                      </>
                    )}

                    {/* ── SECTION 6: 비슷한 캐릭터 ── */}
                    {similarChars.length > 0 && (
                      <>
                        <div className="h-2 bg-gray-50" />
                        <div className="py-4">
                          <p className="text-[14px] font-bold text-gray-800 px-5 mb-3">
                            이 캐릭터와 비슷해요
                          </p>
                          <div className="flex gap-3 overflow-x-auto px-5 pb-1 hide-scrollbar">
                            {similarChars.map((c: any) => (
                              <SimilarCard
                                key={c.id}
                                character={c}
                                onClick={() => setPreviewCharId(c.id)}
                              />
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {/* ── SECTION 7: 댓글 ── */}
                    <div className="h-2 bg-gray-50" />
                    <div className="px-5 py-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[13px] font-semibold text-gray-700">
                          댓글{!character.commentDisabled && ` ${commentsData?.meta?.total ?? 0}건`}
                        </p>
                        {!character.commentDisabled && (
                          <Link href={`/characters/${previewCharId}`} onClick={onClose}
                            className="text-[12px] text-brand hover:underline">전체보기</Link>
                        )}
                      </div>

                      {character.commentDisabled ? (
                        <div className="flex items-center justify-center py-6 rounded-xl bg-gray-50 border border-gray-200">
                          <p className="text-[13px] text-gray-400">제작자가 댓글을 비활성화했습니다.</p>
                        </div>
                      ) : (
                        <>
                          {isAuthenticated ? (
                            <div className="flex gap-2 mb-4">
                              <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden bg-brand/10 flex items-center justify-center">
                                {(user as any)?.avatarUrl
                                  ? <Image src={(user as any).avatarUrl} alt="" width={32} height={32} className="object-cover" />
                                  : <span className="text-brand text-xs font-bold">{(user as any)?.displayName?.[0]?.toUpperCase() ?? 'U'}</span>}
                              </div>
                              <div className="flex-1 flex gap-2">
                                <input
                                  type="text"
                                  value={commentText}
                                  onChange={(e) => setCommentText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey && commentText.trim()) {
                                      e.preventDefault();
                                      createCommentMutation.mutate(commentText.trim());
                                    }
                                  }}
                                  placeholder="댓글을 입력하세요..."
                                  maxLength={500}
                                  className="flex-1 px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:border-brand/40 bg-gray-50 placeholder:text-gray-400"
                                />
                                <button
                                  onClick={() => commentText.trim() && createCommentMutation.mutate(commentText.trim())}
                                  disabled={!commentText.trim() || createCommentMutation.isPending}
                                  className="flex-shrink-0 p-2 rounded-xl bg-brand text-white hover:bg-brand-hover transition-colors disabled:opacity-40"
                                >
                                  {createCommentMutation.isPending
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : <Send className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => { onClose(); router.push('/login'); }}
                              className="w-full mb-4 py-2.5 rounded-xl border border-dashed border-gray-300 text-[13px] text-gray-400 hover:border-brand/40 hover:text-brand transition-colors"
                            >
                              로그인하고 댓글 달기
                            </button>
                          )}

                          <div className="space-y-4">
                            {(commentsData?.data ?? []).map((comment: any) => (
                              <CommentItem
                                key={comment.id}
                                comment={comment}
                                characterId={previewCharId!}
                                currentUserId={(user as any)?.id}
                                isAuthenticated={isAuthenticated}
                                onDelete={() => deleteCommentMutation.mutate(comment.id)}
                                onReact={(type) => {
                                  if (!isAuthenticated) { onClose(); router.push('/login'); return; }
                                  queryClient.setQueryData(['character-comments', previewCharId], (old: any) => ({
                                    ...old,
                                    data: old.data.map((c: any) => {
                                      if (c.id !== comment.id) return c;
                                      const sameType = c.myReaction === type;
                                      return {
                                        ...c,
                                        myReaction: sameType ? null : type,
                                        likeCount: type === 'LIKE'
                                          ? c.likeCount + (sameType ? -1 : c.myReaction === 'LIKE' ? -1 : 1)
                                          : c.likeCount + (c.myReaction === 'LIKE' ? -1 : 0),
                                        dislikeCount: type === 'DISLIKE'
                                          ? c.dislikeCount + (sameType ? -1 : c.myReaction === 'DISLIKE' ? -1 : 1)
                                          : c.dislikeCount + (c.myReaction === 'DISLIKE' ? -1 : 0),
                                      };
                                    }),
                                  }));
                                  api.characters.reactComment(previewCharId!, comment.id, type)
                                    .catch(() => queryClient.invalidateQueries({ queryKey: ['character-comments', previewCharId] }));
                                }}
                                onReport={(reason) => {
                                  api.characters.reportComment(previewCharId!, comment.id, reason)
                                    .then(() => toast.success('신고 완료', '검토 후 조치가 이루어집니다.'))
                                    .catch(() => toast.error('오류', '신고에 실패했습니다.'));
                                }}
                              />
                            ))}
                            {commentsData?.data?.length === 0 && (
                              <p className="text-center text-[13px] text-gray-400 py-4">아직 댓글이 없어요. 첫 댓글을 작성해보세요!</p>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="h-4" />
                  </>
                )}
              </div>

              {/* ── FIXED BOTTOM ── */}
              <div className="flex-shrink-0 flex items-center gap-2.5 px-4 py-3 border-t border-gray-100 bg-white">
                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border border-gray-200 bg-gray-50">
                  {character && (avatarSrc || getCharacterAvatarUrl(null, character.name)) ? (
                    <Image
                      src={avatarSrc || getCharacterAvatarUrl(null, character.name)}
                      alt={character?.name ?? ''}
                      width={40} height={40}
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 animate-pulse" />
                  )}
                </div>
                <button
                  onClick={handleChat}
                  disabled={startChatMutation.isPending || isLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-900 hover:bg-black text-white text-[14px] font-semibold transition-all disabled:opacity-50"
                >
                  {startChatMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {startChatMutation.isPending ? '시작 중...' : '대화하기'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── 비슷한 캐릭터 카드 ───────────────────────────────────────
function SimilarCard({ character, onClick }: { character: any; onClick: () => void }) {
  const [imgErr, setImgErr] = useState(false);
  const src = imgErr ? getCharacterAvatarUrl(null, character.name) : character.avatarUrl;

  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 w-[130px] text-left group"
    >
      <div className="relative w-[130px] rounded-xl overflow-hidden bg-gray-100 mb-2" style={{ aspectRatio: '3/4' }}>
        <Image
          src={src || getCharacterAvatarUrl(null, character.name)}
          alt={character.name}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          onError={() => setImgErr(true)}
          sizes="130px"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        {/* chat count badge */}
        <div className="absolute bottom-2 right-2 flex items-center gap-0.5 bg-black/60 rounded-full px-1.5 py-0.5 text-white text-[10px]">
          <MessageCircle className="w-2.5 h-2.5" />
          {formatCount(character.chatCount)}
        </div>
      </div>
      <p className="text-[12px] font-semibold text-gray-800 truncate leading-tight">{character.name}</p>
      {character.creator && (
        <p className="text-[11px] text-gray-400 truncate mt-0.5">
          {formatCount(character.chatCount)} · {character.creator.displayName}
        </p>
      )}
    </button>
  );
}

// ── 댓글 아이템 ──────────────────────────────────────────────
interface CommentItemProps {
  comment: any;
  characterId: string;
  currentUserId?: string;
  isAuthenticated: boolean;
  onDelete: () => void;
  onReact: (type: 'LIKE' | 'DISLIKE') => void;
  onReport: (reason: string) => void;
}

function CommentItem({ comment, currentUserId, isAuthenticated, onDelete, onReact, onReport }: CommentItemProps) {
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');

  return (
    <div className="flex gap-2.5 group">
      <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden bg-gray-100 flex items-center justify-center">
        {comment.user.avatarUrl
          ? <Image src={comment.user.avatarUrl} alt="" width={32} height={32} className="object-cover" />
          : <span className="text-gray-500 text-xs font-bold">{comment.user.displayName[0]?.toUpperCase()}</span>}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[12px] font-semibold text-gray-700">{comment.user.displayName}</span>
          <span className="text-[11px] text-gray-400">{formatDate(comment.createdAt)}</span>
        </div>

        <p className="text-[13px] text-gray-600 leading-relaxed mb-1.5">{comment.content}</p>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onReact('LIKE')}
            className={cn(
              'flex items-center gap-1 text-[12px] transition-colors',
              comment.myReaction === 'LIKE' ? 'text-brand font-semibold' : 'text-gray-400 hover:text-brand'
            )}
          >
            <ThumbsUp className={cn('w-3.5 h-3.5', comment.myReaction === 'LIKE' && 'fill-brand')} />
            {comment.likeCount > 0 && <span>{comment.likeCount}</span>}
          </button>

          <button
            onClick={() => onReact('DISLIKE')}
            className={cn(
              'flex items-center gap-1 text-[12px] transition-colors',
              comment.myReaction === 'DISLIKE' ? 'text-gray-600 font-semibold' : 'text-gray-400 hover:text-gray-600'
            )}
          >
            <ThumbsDown className={cn('w-3.5 h-3.5', comment.myReaction === 'DISLIKE' && 'fill-gray-600')} />
            {comment.dislikeCount > 0 && <span>{comment.dislikeCount}</span>}
          </button>

          {isAuthenticated && currentUserId !== comment.userId && (
            <button
              onClick={() => setShowReport((v) => !v)}
              className="flex items-center gap-1 text-[12px] text-gray-400 hover:text-red-400 transition-colors ml-auto opacity-0 group-hover:opacity-100"
            >
              <Flag className="w-3.5 h-3.5" />신고
            </button>
          )}

          {currentUserId === comment.userId && (
            <button
              onClick={onDelete}
              className="flex items-center gap-1 text-[12px] text-gray-400 hover:text-red-400 transition-colors ml-auto opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="w-3.5 h-3.5" />삭제
            </button>
          )}
        </div>

        {showReport && (
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="신고 사유를 입력하세요"
              maxLength={200}
              className="flex-1 px-3 py-1.5 text-[12px] border border-red-200 rounded-lg focus:outline-none focus:border-red-400 bg-red-50 placeholder:text-gray-400"
            />
            <button
              onClick={() => {
                if (!reportReason.trim()) return;
                onReport(reportReason.trim());
                setShowReport(false);
                setReportReason('');
              }}
              disabled={!reportReason.trim()}
              className="px-3 py-1.5 text-[12px] bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-40"
            >
              신고
            </button>
            <button
              onClick={() => { setShowReport(false); setReportReason(''); }}
              className="px-2 py-1.5 text-[12px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              취소
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
