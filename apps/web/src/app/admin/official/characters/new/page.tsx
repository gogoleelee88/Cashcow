'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import { adminApi } from '../../../../../lib/admin-api';

const CATEGORIES = ['ANIME','GAME','MOVIE','BOOK','ORIGINAL','CELEBRITY','HISTORICAL','VTUBER','OTHER'];
const AGE_RATINGS = ['ALL','TEEN','ADULT'];
const VISIBILITIES = ['PUBLIC','PRIVATE','UNLISTED'];
const MODELS = ['claude-haiku-3','claude-sonnet-3-5','claude-opus-4'];

export default function NewOfficialCharacterPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '', description: '', detailDescription: '',
    systemPrompt: '', greeting: '',
    category: 'ORIGINAL', tags: '', visibility: 'PUBLIC',
    ageRating: 'ALL', language: 'ko', model: 'claude-haiku-3',
    temperature: 0.8, maxTokens: 1024,
    memoryEnabled: true, commentDisabled: false,
  });

  function set(key: string, value: unknown) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.description || !form.systemPrompt || !form.greeting || !form.category) {
      setError('이름, 설명, 시스템 프롬프트, 인사말, 카테고리는 필수입니다.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await adminApi.post('/official/characters', {
        ...form,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      });
      router.push('/admin/official/characters');
    } catch (err: any) {
      setError(err?.response?.data?.error ?? '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl space-y-5">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> 캐릭터 목록
      </button>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">새 캐릭터 생성</h2>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">기본 정보</h3>

          <Field label="캐릭터 이름 *">
            <input value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} placeholder="예: 아리아" />
          </Field>

          <Field label="짧은 설명 *">
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} className={inputCls} placeholder="캐릭터를 한 줄로 설명하세요" />
          </Field>

          <Field label="상세 설명">
            <textarea value={form.detailDescription} onChange={e => set('detailDescription', e.target.value)} rows={3} className={inputCls} placeholder="캐릭터 상세 설명 (최대 1000자)" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="카테고리 *">
              <select value={form.category} onChange={e => set('category', e.target.value)} className={inputCls}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="태그 (쉼표로 구분)">
              <input value={form.tags} onChange={e => set('tags', e.target.value)} className={inputCls} placeholder="예: 판타지, 마법사" />
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
            <textarea value={form.systemPrompt} onChange={e => set('systemPrompt', e.target.value)} rows={6} className={`${inputCls} font-mono text-xs`} placeholder="캐릭터의 성격, 말투, 배경 등을 설명하세요" />
          </Field>

          <Field label="첫 인사말 *">
            <textarea value={form.greeting} onChange={e => set('greeting', e.target.value)} rows={3} className={inputCls} placeholder="사용자와 채팅 시작 시 보내는 첫 메시지" />
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
            {saving ? '저장 중...' : '캐릭터 생성'}
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
