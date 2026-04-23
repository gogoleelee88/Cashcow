'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Clock, Send, Trash2, Plus, Calendar } from 'lucide-react';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';

interface Chapter {
  id: string;
  title: string;
  order: number;
  isPublished: boolean;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
}

interface ChapterPublishModalProps {
  storyId: string;
  storyTitle: string;
  onClose: () => void;
}

function formatKST(isoString: string): string {
  return new Date(isoString).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function toLocalDatetimeValue(isoString: string | null): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ChapterPublishModal({ storyId, storyTitle, onClose }: ChapterPublishModalProps) {
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [creating, setCreating] = useState(false);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [scheduleValue, setScheduleValue] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['chapters', storyId],
    queryFn: () => api.stories.listChapters(storyId).then((r) => r.data as Chapter[]),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['chapters', storyId] });

  const createMut = useMutation({
    mutationFn: () => api.stories.createChapter(storyId, { title: newTitle.trim(), content: newContent.trim() }),
    onSuccess: () => { setNewTitle(''); setNewContent(''); setCreating(false); invalidate(); },
  });

  const publishMut = useMutation({
    mutationFn: (chapterId: string) => api.stories.publishChapter(storyId, chapterId),
    onSuccess: invalidate,
  });

  const scheduleMut = useMutation({
    mutationFn: ({ chapterId, scheduledAt }: { chapterId: string; scheduledAt: string }) =>
      api.stories.scheduleChapter(storyId, chapterId, new Date(scheduledAt).toISOString()),
    onSuccess: () => { setSchedulingId(null); setScheduleValue(''); invalidate(); },
  });

  const cancelScheduleMut = useMutation({
    mutationFn: (chapterId: string) => api.stories.cancelChapterSchedule(storyId, chapterId),
    onSuccess: invalidate,
  });

  const deleteMut = useMutation({
    mutationFn: (chapterId: string) => api.stories.deleteChapter(storyId, chapterId),
    onSuccess: invalidate,
  });

  const chapters: Chapter[] = data ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface-elevated border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-text-primary font-bold text-lg">챕터 관리</h2>
            <p className="text-text-muted text-sm truncate max-w-xs">{storyTitle}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface text-text-muted hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chapter list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 skeleton rounded-xl" />
              ))}
            </div>
          )}

          {!isLoading && chapters.length === 0 && (
            <div className="text-center py-10 text-text-muted">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">아직 챕터가 없습니다.</p>
            </div>
          )}

          {chapters.map((ch) => (
            <div key={ch.id} className="border border-border rounded-xl p-4 bg-surface">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-text-primary font-medium text-sm truncate">
                    {ch.order + 1}화. {ch.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {ch.isPublished ? (
                      <span className="text-xs text-emerald-400">
                        발행됨 {ch.publishedAt ? `· ${formatKST(ch.publishedAt)}` : ''}
                      </span>
                    ) : ch.scheduledAt ? (
                      <span className="text-xs text-amber-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatKST(ch.scheduledAt)} 예약
                      </span>
                    ) : (
                      <span className="text-xs text-text-muted">미발행</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {!ch.isPublished && (
                    <>
                      <button
                        onClick={() => publishMut.mutate(ch.id)}
                        disabled={publishMut.isPending}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand/15 hover:bg-brand text-brand-light hover:text-white text-xs font-medium transition-all"
                      >
                        <Send className="w-3.5 h-3.5" />
                        즉시 발행
                      </button>
                      <button
                        onClick={() => {
                          setSchedulingId(ch.id);
                          setScheduleValue(toLocalDatetimeValue(ch.scheduledAt));
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500 text-amber-400 hover:text-white text-xs font-medium transition-all"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        예약
                      </button>
                    </>
                  )}
                  {!ch.isPublished && ch.scheduledAt && (
                    <button
                      onClick={() => cancelScheduleMut.mutate(ch.id)}
                      disabled={cancelScheduleMut.isPending}
                      className="px-2.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-red-500/20 text-text-muted hover:text-red-400 text-xs font-medium transition-all"
                    >
                      예약 취소
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (confirm(`"${ch.title}" 챕터를 삭제할까요?`)) deleteMut.mutate(ch.id);
                    }}
                    className="p-1.5 rounded-lg hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Schedule picker */}
              {schedulingId === ch.id && (
                <div className="mt-3 flex items-center gap-2 pt-3 border-t border-border">
                  <input
                    type="datetime-local"
                    value={scheduleValue}
                    onChange={(e) => setScheduleValue(e.target.value)}
                    min={toLocalDatetimeValue(new Date().toISOString())}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-surface border border-border text-text-primary text-sm"
                  />
                  <button
                    onClick={() => scheduleMut.mutate({ chapterId: ch.id, scheduledAt: scheduleValue })}
                    disabled={!scheduleValue || scheduleMut.isPending}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-xs font-medium transition-all disabled:opacity-50"
                  >
                    확인
                  </button>
                  <button
                    onClick={() => { setSchedulingId(null); setScheduleValue(''); }}
                    className="px-3 py-1.5 rounded-lg bg-surface-elevated text-text-muted text-xs transition-all"
                  >
                    취소
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* New chapter form */}
        {creating ? (
          <div className="px-6 py-4 border-t border-border flex-shrink-0 space-y-3">
            <input
              type="text"
              placeholder="챕터 제목"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-surface border border-border text-text-primary text-sm placeholder:text-text-muted"
            />
            <textarea
              placeholder="챕터 내용"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 rounded-xl bg-surface border border-border text-text-primary text-sm placeholder:text-text-muted resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setCreating(false)}
                className="px-4 py-2 rounded-xl text-sm text-text-muted hover:text-text-primary transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => createMut.mutate()}
                disabled={!newTitle.trim() || !newContent.trim() || createMut.isPending}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-medium transition-all',
                  'bg-brand hover:bg-brand/90 text-white disabled:opacity-50'
                )}
              >
                {createMut.isPending ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        ) : (
          <div className="px-6 py-4 border-t border-border flex-shrink-0">
            <button
              onClick={() => setCreating(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-border hover:border-brand/50 hover:bg-brand/5 text-text-muted hover:text-brand-light text-sm font-medium transition-all"
            >
              <Plus className="w-4 h-4" />
              새 챕터 추가
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
