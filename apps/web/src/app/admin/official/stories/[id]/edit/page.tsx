'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, Plus, Trash2, ChevronUp, ChevronDown, BookOpen } from 'lucide-react';
import { adminApi } from '../../../../../../lib/admin-api';
import { ConfirmModal } from '../../../../../../components/admin/common/ConfirmModal';

const CATEGORIES = ['ROMANCE','FANTASY','MYSTERY','THRILLER','SF','HISTORICAL','HORROR','COMEDY','ADVENTURE','SLICE_OF_LIFE','OTHER'];
const AGE_RATINGS = ['ALL','TEEN','ADULT'];
const VISIBILITIES = ['PUBLIC','PRIVATE','UNLISTED'];

interface Chapter {
  id: string;
  title: string;
  content: string;
  order: number;
  isPublished: boolean;
  createdAt: string;
}

type Tab = 'info' | 'chapters';

export default function EditOfficialStoryPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('info');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    title: '', description: '', systemPrompt: '', greeting: '',
    category: 'FANTASY', tags: '', ageRating: 'ALL',
    visibility: 'PUBLIC', status: 'DRAFT', language: 'ko',
  });

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [newChapterOpen, setNewChapterOpen] = useState(false);
  const [chapterForm, setChapterForm] = useState({ title: '', content: '', isPublished: false });
  const [chapterSaving, setChapterSaving] = useState(false);
  const [deleteChapterTarget, setDeleteChapterTarget] = useState<Chapter | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await adminApi.get(`/official/stories/${id}`);
        const s = res.data.data;
        setForm({
          title: s.title ?? '', description: s.description ?? '',
          systemPrompt: s.systemPrompt ?? '', greeting: s.greeting ?? '',
          category: s.category ?? 'FANTASY', tags: (s.tags ?? []).join(', '),
          ageRating: s.ageRating ?? 'ALL', visibility: s.visibility ?? 'PUBLIC',
          status: s.status ?? 'DRAFT', language: s.language ?? 'ko',
        });
        setChapters(s.chapters ?? []);
      } catch {
        setError('스토리 정보를 불러올 수 없습니다.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  function setField(key: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await adminApi.patch(`/official/stories/${id}`, {
        ...form,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      });
      setSuccess('저장되었습니다.');
    } catch (err: any) {
      setError(err?.response?.data?.error ?? '저장 실패');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveChapter() {
    if (!chapterForm.title || !chapterForm.content) return;
    setChapterSaving(true);
    try {
      if (editingChapter) {
        const res = await adminApi.patch(`/official/stories/${id}/chapters/${editingChapter.id}`, chapterForm);
        setChapters(prev => prev.map(c => c.id === editingChapter.id ? { ...c, ...res.data.data } : c));
        setEditingChapter(null);
      } else {
        const res = await adminApi.post(`/official/stories/${id}/chapters`, {
          ...chapterForm,
          order: chapters.length + 1,
        });
        setChapters(prev => [...prev, { ...chapterForm, ...res.data.data }]);
        setNewChapterOpen(false);
      }
      setChapterForm({ title: '', content: '', isPublished: false });
    } catch {
      setError('챕터 저장 실패');
    } finally {
      setChapterSaving(false);
    }
  }

  async function handleDeleteChapter() {
    if (!deleteChapterTarget) return;
    try {
      await adminApi.delete(`/official/stories/${id}/chapters/${deleteChapterTarget.id}`);
      setChapters(prev => prev.filter(c => c.id !== deleteChapterTarget.id));
      setDeleteChapterTarget(null);
    } catch {
      setError('챕터 삭제 실패');
    }
  }

  async function togglePublish(chapter: Chapter) {
    try {
      await adminApi.patch(`/official/stories/${id}/chapters/${chapter.id}`, { isPublished: !chapter.isPublished });
      setChapters(prev => prev.map(c => c.id === chapter.id ? { ...c, isPublished: !c.isPublished } : c));
    } catch { /* silent */ }
  }

  function openEdit(chapter: Chapter) {
    setEditingChapter(chapter);
    setChapterForm({ title: chapter.title, content: chapter.content, isPublished: chapter.isPublished });
    setNewChapterOpen(true);
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4 animate-pulse max-w-3xl">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="h-64 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl space-y-5">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> 스토리 목록
      </button>

      <h2 className="text-lg font-bold text-gray-900">스토리 수정</h2>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</div>}
      {success && <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">{success}</div>}

      {/* 탭 */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['info', 'chapters'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t === 'info' ? '기본 정보' : `챕터 관리 (${chapters.length})`}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <form onSubmit={handleSaveInfo} className="space-y-5">
          <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">기본 정보</h3>

            <Field label="제목 *">
              <input value={form.title} onChange={e => setField('title', e.target.value)} className={inputCls} />
            </Field>
            <Field label="설명 *">
              <textarea value={form.description} onChange={e => setField('description', e.target.value)} rows={3} className={inputCls} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="카테고리">
                <select value={form.category} onChange={e => setField('category', e.target.value)} className={inputCls}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="태그 (쉼표로 구분)">
                <input value={form.tags} onChange={e => setField('tags', e.target.value)} className={inputCls} />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Field label="연령 등급">
                <select value={form.ageRating} onChange={e => setField('ageRating', e.target.value)} className={inputCls}>
                  {AGE_RATINGS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="공개 범위">
                <select value={form.visibility} onChange={e => setField('visibility', e.target.value)} className={inputCls}>
                  {VISIBILITIES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </Field>
              <Field label="상태">
                <select value={form.status} onChange={e => setField('status', e.target.value)} className={inputCls}>
                  <option value="DRAFT">초안</option>
                  <option value="ONGOING">연재중</option>
                  <option value="COMPLETED">완결</option>
                  <option value="HIATUS">휴재</option>
                </select>
              </Field>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">AI 설정</h3>
            <Field label="시스템 프롬프트 *">
              <textarea value={form.systemPrompt} onChange={e => setField('systemPrompt', e.target.value)} rows={6} className={`${inputCls} font-mono text-xs`} />
            </Field>
            <Field label="첫 인사말 *">
              <textarea value={form.greeting} onChange={e => setField('greeting', e.target.value)} rows={3} className={inputCls} />
            </Field>
          </section>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">취소</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">
              <Save className="w-4 h-4" />
              {saving ? '저장 중...' : '변경 사항 저장'}
            </button>
          </div>
        </form>
      )}

      {tab === 'chapters' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => { setEditingChapter(null); setChapterForm({ title: '', content: '', isPublished: false }); setNewChapterOpen(true); }}
              className="flex items-center gap-1.5 text-sm bg-gray-900 text-white rounded-lg px-3 py-2 hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-4 h-4" /> 새 챕터
            </button>
          </div>

          {/* 챕터 편집 폼 */}
          {newChapterOpen && (
            <div className="bg-white rounded-xl border border-blue-200 p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">
                {editingChapter ? `챕터 수정 — ${editingChapter.title}` : '새 챕터'}
              </h3>
              <Field label="챕터 제목 *">
                <input
                  value={chapterForm.title}
                  onChange={e => setChapterForm(p => ({ ...p, title: e.target.value }))}
                  className={inputCls}
                  placeholder="예: 1장 - 운명의 만남"
                />
              </Field>
              <Field label="챕터 내용 *">
                <textarea
                  value={chapterForm.content}
                  onChange={e => setChapterForm(p => ({ ...p, content: e.target.value }))}
                  rows={10}
                  className={`${inputCls} font-mono text-xs`}
                  placeholder="챕터 본문을 작성하세요 (Markdown 지원)"
                />
              </Field>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={chapterForm.isPublished}
                  onChange={e => setChapterForm(p => ({ ...p, isPublished: e.target.checked }))}
                  className="w-4 h-4 accent-gray-900"
                />
                즉시 게시
              </label>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setNewChapterOpen(false); setEditingChapter(null); }}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={handleSaveChapter}
                  disabled={chapterSaving || !chapterForm.title || !chapterForm.content}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {chapterSaving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          )}

          {/* 챕터 목록 */}
          {chapters.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">챕터가 없습니다. 첫 챕터를 추가하세요.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {chapters.map((chapter, idx) => (
                <div key={chapter.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex items-center gap-3">
                  <div className="flex flex-col gap-0.5">
                    <button
                      disabled={idx === 0}
                      onClick={async () => {
                        if (idx === 0) return;
                        const prev = chapters[idx - 1];
                        await Promise.all([
                          adminApi.patch(`/official/stories/${id}/chapters/${chapter.id}`, { order: prev.order }),
                          adminApi.patch(`/official/stories/${id}/chapters/${prev.id}`, { order: chapter.order }),
                        ]);
                        const next = [...chapters];
                        [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
                        setChapters(next);
                      }}
                      className="text-gray-300 hover:text-gray-600 disabled:opacity-20"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      disabled={idx === chapters.length - 1}
                      onClick={async () => {
                        if (idx === chapters.length - 1) return;
                        const next2 = chapters[idx + 1];
                        await Promise.all([
                          adminApi.patch(`/official/stories/${id}/chapters/${chapter.id}`, { order: next2.order }),
                          adminApi.patch(`/official/stories/${id}/chapters/${next2.id}`, { order: chapter.order }),
                        ]);
                        const next = [...chapters];
                        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                        setChapters(next);
                      }}
                      className="text-gray-300 hover:text-gray-600 disabled:opacity-20"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>

                  <span className="text-xs text-gray-400 w-6 text-center font-mono">{chapter.order}</span>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{chapter.title}</p>
                    <p className="text-xs text-gray-400">{chapter.content.slice(0, 60)}...</p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => togglePublish(chapter)}
                      className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                        chapter.isPublished
                          ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                          : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {chapter.isPublished ? '게시됨' : '비공개'}
                    </button>
                    <button onClick={() => openEdit(chapter)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="수정">
                      <Save className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteChapterTarget(chapter)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="삭제">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        open={!!deleteChapterTarget}
        title="챕터 삭제"
        description={`"${deleteChapterTarget?.title}" 챕터를 삭제합니다. 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제하기"
        isDestructive
        isLoading={false}
        onConfirm={handleDeleteChapter}
        onCancel={() => setDeleteChapterTarget(null)}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white';
