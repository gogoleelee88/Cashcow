'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pin, Star, Bell, Eye, EyeOff } from 'lucide-react';
import { adminApi } from '../../../lib/admin-api';
import { RichEditor } from '../../../components/editor/RichEditor';
import { BannerImageUpload } from '../../../components/editor/BannerImageUpload';

const CATEGORIES = [
  { value: 'NOTICE', label: '공지' },
  { value: 'UPDATE', label: '업데이트' },
  { value: 'EVENT', label: '이벤트' },
  { value: 'MAINTENANCE', label: '점검' },
];

interface PostFormProps {
  initialData?: {
    id: string;
    title: string;
    subtitle: string | null;
    bannerImageUrl: string | null;
    content: any;
    category: string;
    status: string;
    isPinned: boolean;
    isFeatured: boolean;
    sendNotification: boolean;
    publishedAt: string | null;
    expiresAt: string | null;
  };
}

export function PostForm({ initialData }: PostFormProps) {
  const router = useRouter();
  const isEdit = !!initialData;

  const [title, setTitle] = useState(initialData?.title ?? '');
  const [subtitle, setSubtitle] = useState(initialData?.subtitle ?? '');
  const [bannerImageUrl, setBannerImageUrl] = useState(initialData?.bannerImageUrl ?? '');
  const [content, setContent] = useState<any>(initialData?.content ?? null);
  const [category, setCategory] = useState(initialData?.category ?? 'NOTICE');
  const [isPinned, setIsPinned] = useState(initialData?.isPinned ?? false);
  const [isFeatured, setIsFeatured] = useState(initialData?.isFeatured ?? false);
  const [sendNotification, setSendNotification] = useState(initialData?.sendNotification ?? false);
  const [expiresAt, setExpiresAt] = useState(initialData?.expiresAt ? initialData.expiresAt.slice(0, 16) : '');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const buildBody = (status: string) => ({
    title, subtitle: subtitle || undefined,
    bannerImageUrl: bannerImageUrl || undefined,
    content, category, isPinned, isFeatured, sendNotification,
    expiresAt: expiresAt || undefined, status,
  });

  const handleSave = async (status: 'DRAFT' | 'PUBLISHED') => {
    if (!title.trim()) { alert('제목을 입력해주세요'); return; }
    if (!content) { alert('내용을 입력해주세요'); return; }

    const setLoading = status === 'PUBLISHED' ? setPublishing : setSaving;
    setLoading(true);
    try {
      if (isEdit) {
        await adminApi.patch(`/posts/${initialData!.id}`, buildBody(status));
      } else {
        await adminApi.post('/posts', buildBody(status));
      }
      router.push('/admin/posts');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isEdit ? '글 수정' : '새 글 작성'}</h1>
          <p className="text-sm text-gray-500 mt-1">공지, 업데이트, 이벤트 글을 작성합니다</p>
        </div>
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← 목록으로</button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* 메인 편집 영역 */}
        <div className="col-span-2 space-y-4">
          {/* 제목 */}
          <div>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="제목을 입력하세요"
              className="w-full text-2xl font-bold border-0 border-b-2 border-gray-200 focus:border-gray-900 outline-none py-2 placeholder-gray-300 bg-transparent" />
          </div>
          {/* 부제목 */}
          <div>
            <input type="text" value={subtitle} onChange={e => setSubtitle(e.target.value)}
              placeholder="부제목 (선택)"
              className="w-full text-base text-gray-500 border-0 border-b border-gray-100 focus:border-gray-400 outline-none py-1.5 placeholder-gray-300 bg-transparent" />
          </div>

          {/* 배너 이미지 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">배너 이미지</label>
            <BannerImageUpload value={bannerImageUrl} onChange={setBannerImageUrl} aspectRatio={16 / 5} hint="1280×400px 권장" />
          </div>

          {/* 본문 에디터 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">본문</label>
            <RichEditor content={content} onChange={setContent} placeholder="공지 내용을 입력하세요. 이미지와 텍스트를 자유롭게 배치할 수 있습니다." />
          </div>
        </div>

        {/* 사이드 설정 패널 */}
        <div className="space-y-4">
          {/* 발행 버튼 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-gray-900 text-sm">발행 설정</h3>
            <button onClick={() => handleSave('PUBLISHED')} disabled={publishing || saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 rounded-lg transition-colors">
              <Eye className="w-4 h-4" />
              {publishing ? '발행 중...' : isEdit ? '수정 발행' : '발행하기'}
            </button>
            <button onClick={() => handleSave('DRAFT')} disabled={saving || publishing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded-lg transition-colors">
              <EyeOff className="w-4 h-4" />
              {saving ? '저장 중...' : '임시저장'}
            </button>
          </div>

          {/* 카테고리 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-gray-900 text-sm">카테고리</h3>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(({ value, label }) => (
                <button key={value} type="button" onClick={() => setCategory(value)}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                    category === value
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 옵션 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-gray-900 text-sm">옵션</h3>
            {[
              { key: 'isPinned', value: isPinned, set: setIsPinned, icon: Pin, label: '상단 고정', desc: '목록 최상단에 표시' },
              { key: 'isFeatured', value: isFeatured, set: setIsFeatured, icon: Star, label: '슬라이더 노출', desc: '랜딩페이지 배너에 표시' },
              { key: 'sendNotification', value: sendNotification, set: setSendNotification, icon: Bell, label: '알림 발송', desc: '발행 시 전체 유저에게 알림' },
            ].map(({ key, value, set, icon: Icon, label, desc }) => (
              <label key={key} className="flex items-start gap-3 cursor-pointer group">
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                  value ? 'bg-gray-900 border-gray-900' : 'border-gray-300 group-hover:border-gray-500'
                }`} onClick={() => set(!value)}>
                  {value && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">{label}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                </div>
              </label>
            ))}
          </div>

          {/* 만료일 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
            <h3 className="font-semibold text-gray-900 text-sm">만료일 (선택)</h3>
            <input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
            <p className="text-xs text-gray-400">설정하면 해당 날짜 이후 자동으로 비공개됩니다</p>
          </div>
        </div>
      </div>
    </div>
  );
}
