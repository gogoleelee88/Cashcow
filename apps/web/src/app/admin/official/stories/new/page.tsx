'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import { adminApi } from '../../../../../lib/admin-api';

const CATEGORIES = ['ROMANCE','FANTASY','MYSTERY','THRILLER','SF','HISTORICAL','HORROR','COMEDY','ADVENTURE','SLICE_OF_LIFE','OTHER'];
const AGE_RATINGS = ['ALL','TEEN','ADULT'];
const VISIBILITIES = ['PUBLIC','PRIVATE','UNLISTED'];

export default function NewOfficialStoryPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '', description: '', systemPrompt: '', greeting: '',
    category: 'FANTASY', tags: '', ageRating: 'ALL',
    visibility: 'PUBLIC', language: 'ko', status: 'DRAFT',
  });

  function set(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.description || !form.systemPrompt || !form.greeting) {
      setError('제목, 설명, 시스템 프롬프트, 인사말은 필수입니다.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await adminApi.post('/official/stories', {
        ...form,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      });
      router.push(`/admin/official/stories/${res.data.data.id}/edit`);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl space-y-5">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> 스토리 목록
      </button>

      <h2 className="text-lg font-bold text-gray-900">새 스토리 생성</h2>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">기본 정보</h3>

          <Field label="제목 *">
            <input value={form.title} onChange={e => set('title', e.target.value)} className={inputCls} placeholder="스토리 제목" />
          </Field>

          <Field label="설명 *">
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} className={inputCls} placeholder="스토리를 소개하는 설명" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="카테고리">
              <select value={form.category} onChange={e => set('category', e.target.value)} className={inputCls}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="태그 (쉼표로 구분)">
              <input value={form.tags} onChange={e => set('tags', e.target.value)} className={inputCls} placeholder="예: 이세계, 마법" />
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
            <Field label="상태">
              <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>
                <option value="DRAFT">초안</option>
                <option value="ONGOING">연재중</option>
              </select>
            </Field>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">AI 설정</h3>
          <p className="text-xs text-gray-500">독자와 대화하는 AI의 역할과 스토리 세계관을 설정합니다.</p>

          <Field label="시스템 프롬프트 *">
            <textarea value={form.systemPrompt} onChange={e => set('systemPrompt', e.target.value)} rows={6} className={`${inputCls} font-mono text-xs`} placeholder="스토리 세계관, AI 역할, 말투 등을 설명하세요" />
          </Field>

          <Field label="첫 인사말 *">
            <textarea value={form.greeting} onChange={e => set('greeting', e.target.value)} rows={3} className={inputCls} placeholder="독자와 채팅 시작 시 보내는 첫 메시지" />
          </Field>
        </section>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
            취소
          </button>
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">
            <Save className="w-4 h-4" />
            {saving ? '생성 중...' : '스토리 생성 후 챕터 관리'}
          </button>
        </div>
      </form>
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
