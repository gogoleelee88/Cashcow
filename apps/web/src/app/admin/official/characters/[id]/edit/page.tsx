'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { adminApi } from '../../../../../../lib/admin-api';
import { ConfirmModal } from '../../../../../../components/admin/common/ConfirmModal';

const CATEGORIES = ['ANIME','GAME','MOVIE','BOOK','ORIGINAL','CELEBRITY','HISTORICAL','VTUBER','OTHER'];
const AGE_RATINGS = ['ALL','TEEN','ADULT'];
const VISIBILITIES = ['PUBLIC','PRIVATE','UNLISTED'];
const MODELS = ['claude-haiku-3','claude-sonnet-3-5','claude-opus-4'];

export default function EditOfficialCharacterPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    name: '', description: '', detailDescription: '',
    systemPrompt: '', greeting: '',
    category: 'ORIGINAL', tags: '', visibility: 'PUBLIC',
    ageRating: 'ALL', language: 'ko', model: 'claude-haiku-3',
    temperature: 0.8, maxTokens: 1024,
    memoryEnabled: true, commentDisabled: false,
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await adminApi.get(`/official/characters/${id}`);
        const c = res.data.data;
        setForm({
          name: c.name ?? '',
          description: c.description ?? '',
          detailDescription: c.detailDescription ?? '',
          systemPrompt: c.systemPrompt ?? '',
          greeting: c.greeting ?? '',
          category: c.category ?? 'ORIGINAL',
          tags: (c.tags ?? []).join(', '),
          visibility: c.visibility ?? 'PUBLIC',
          ageRating: c.ageRating ?? 'ALL',
          language: c.language ?? 'ko',
          model: c.model ?? 'claude-haiku-3',
          temperature: c.temperature ?? 0.8,
          maxTokens: c.maxTokens ?? 1024,
          memoryEnabled: c.memoryEnabled ?? true,
          commentDisabled: c.commentDisabled ?? false,
        });
      } catch {
        setError('캐릭터 정보를 불러올 수 없습니다.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  function set(key: string, value: unknown) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await adminApi.patch(`/official/characters/${id}`, {
        ...form,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      });
      setSuccess('저장되었습니다.');
    } catch (err: any) {
      setError(err?.response?.data?.error ?? '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await adminApi.delete(`/official/characters/${id}`);
      router.push('/admin/official/characters');
    } catch {
      setError('삭제에 실패했습니다.');
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4 animate-pulse max-w-3xl">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="h-64 bg-gray-200 rounded-xl" />
        <div className="h-48 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl space-y-5">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> 캐릭터 목록
      </button>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">캐릭터 수정</h2>
        <button onClick={() => setDeleteOpen(true)} className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700">
          <Trash2 className="w-4 h-4" /> 삭제
        </button>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</div>}
      {success && <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">{success}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">기본 정보</h3>

          <Field label="캐릭터 이름 *">
            <input value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} />
          </Field>

          <Field label="짧은 설명 *">
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} className={inputCls} />
          </Field>

          <Field label="상세 설명">
            <textarea value={form.detailDescription} onChange={e => set('detailDescription', e.target.value)} rows={3} className={inputCls} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="카테고리 *">
              <select value={form.category} onChange={e => set('category', e.target.value)} className={inputCls}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="태그 (쉼표로 구분)">
              <input value={form.tags} onChange={e => set('tags', e.target.value)} className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="연령 등급">
              <select value={form.ageRating} onChange={e => set('ageRating', e.target.value)} className={inputCls}>
                {AGE_RATINGS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="공개 범위">
              <select value={form.visibility} onChange={e => set('visibility', e.target.value)} className={inputCls}>
                {VISIBILITIES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
            <Field label="언어">
              <select value={form.language} onChange={e => set('language', e.target.value)} className={inputCls}>
                <option value="ko">한국어</option>
                <option value="en">English</option>
                <option value="ja">日本語</option>
              </select>
            </Field>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">AI 설정</h3>

          <Field label="시스템 프롬프트 *">
            <textarea value={form.systemPrompt} onChange={e => set('systemPrompt', e.target.value)} rows={6} className={`${inputCls} font-mono text-xs`} />
          </Field>

          <Field label="첫 인사말 *">
            <textarea value={form.greeting} onChange={e => set('greeting', e.target.value)} rows={3} className={inputCls} />
          </Field>

          <div className="grid grid-cols-3 gap-4">
            <Field label="모델">
              <select value={form.model} onChange={e => set('model', e.target.value)} className={inputCls}>
                {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Temperature">
              <input type="number" value={form.temperature} onChange={e => set('temperature', parseFloat(e.target.value))} step={0.1} min={0} max={2} className={inputCls} />
            </Field>
            <Field label="Max Tokens">
              <input type="number" value={form.maxTokens} onChange={e => set('maxTokens', parseInt(e.target.value))} step={256} min={256} max={4096} className={inputCls} />
            </Field>
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.memoryEnabled} onChange={e => set('memoryEnabled', e.target.checked)} className="w-4 h-4 accent-gray-900" />
              메모리 활성화
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.commentDisabled} onChange={e => set('commentDisabled', e.target.checked)} className="w-4 h-4 accent-gray-900" />
              댓글 비활성화
            </label>
          </div>
        </section>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
            취소
          </button>
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors">
            <Save className="w-4 h-4" />
            {saving ? '저장 중...' : '변경 사항 저장'}
          </button>
        </div>
      </form>

      <ConfirmModal
        open={deleteOpen}
        title="캐릭터 삭제"
        description={`"${form.name}" 캐릭터를 비활성화합니다. (소프트 삭제)`}
        confirmLabel="삭제하기"
        isDestructive
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
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
