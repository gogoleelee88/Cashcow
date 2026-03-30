'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, HelpCircle, Clock, History, X, Upload, Trash2, Wand2, ChevronUp, ChevronDown, AlertCircle, Megaphone, Plus, GripVertical, MessageSquare } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../stores/auth.store';
import { useEffect } from 'react';

// ─────────────────────────────────────────────
// TABS
// ─────────────────────────────────────────────
type StoryTab = 'profile' | 'story-settings' | 'start-settings' | 'stat-settings' | 'media' | 'keywords' | 'ending' | 'register';

const TABS: { key: StoryTab; label: string; required?: boolean }[] = [
  { key: 'profile',        label: '프로필',   required: true },
  { key: 'story-settings', label: '스토리 설정', required: true },
  { key: 'start-settings', label: '시작 설정',  required: true },
  { key: 'stat-settings',  label: '스탯 설정' },
  { key: 'media',          label: '미디어' },
  { key: 'keywords',       label: '키워드북' },
  { key: 'ending',         label: '엔딩 설정' },
  { key: 'register',       label: '등록',     required: true },
];

// ─────────────────────────────────────────────
// IMAGE UPLOAD AREA
// ─────────────────────────────────────────────
function ImageUploadArea({
  label,
  required,
  ratio,
  hint,
  size,
}: {
  label: string;
  required?: boolean;
  ratio: string;
  hint: string;
  size: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
  };

  return (
    <div className="mb-8">
      <div className="flex items-center gap-1 mb-2">
        <span className="text-gray-900 font-semibold text-sm">{label}</span>
        {required && <span className="text-brand text-sm font-bold">*</span>}
      </div>

      <div className="flex items-start gap-4">
        {/* Preview box */}
        <div
          className={cn(
            'flex-shrink-0 rounded-xl overflow-hidden border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center cursor-pointer hover:border-gray-300 transition-colors',
            ratio === '1:1' ? 'w-20 h-20' : 'w-20 h-[calc(20px*4/3)] min-h-[107px]'
          )}
          onClick={() => inputRef.current?.click()}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="preview" className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-1 text-gray-300">
              {/* Mountain/image placeholder icon */}
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          )}
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </div>

        {/* Info + buttons */}
        <div className="flex-1">
          <p className="text-gray-500 text-xs leading-relaxed mb-3">{hint}<br />부적절한 이미지는 업로드가 제한됩니다.<br />{size}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              업로드
            </button>
            {preview && (
              <button
                type="button"
                onClick={() => { setPreview(null); if (inputRef.current) inputRef.current.value = ''; }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                삭제
              </button>
            )}
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors"
            >
              <Wand2 className="w-3.5 h-3.5" />
              생성
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// RIGHT PANEL — 기존/업데이트 프로필 미리보기
// ─────────────────────────────────────────────
function RightPreviewPanel({ name, description }: { name: string; description: string }) {
  const MOCK_EXISTING = [
    { title: '작품 이름', desc: '어떤 스토리인지 설명할 수 있는 간단한 소개를 입력해 주세요', author: '나도이런거만들거야', cover: null },
    { title: '로판 악녀가 되다', desc: '깨어나보니 최악의 악녀에게 빙의되었다', author: '강형', cover: null, hasImage: true },
  ];
  const MOCK_UPDATED = [
    { title: '', cover: null },
    { title: '명부를 쥔 SSS급 헌터', cover: null, hasImage: true },
  ];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
      {/* 기존 프로필 */}
      <section className="mb-8">
        <h3 className="text-gray-700 font-semibold text-sm mb-4">기존 프로필</h3>
        <div className="grid grid-cols-2 gap-3">
          {MOCK_EXISTING.map((item, i) => (
            <div key={i} className="rounded-xl overflow-hidden border border-gray-100">
              <div className={cn(
                'aspect-square bg-gray-100 flex items-center justify-center',
                item.hasImage && 'bg-gradient-to-br from-gray-700 via-purple-900 to-pink-800'
              )}>
                {item.hasImage ? (
                  <div className="w-full h-full flex items-end p-3">
                    <span className="text-white text-xs font-bold leading-tight">{item.title}</span>
                  </div>
                ) : (
                  <div className="text-gray-300">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="p-2.5">
                <p className="text-gray-700 font-medium text-xs truncate mb-0.5">{item.title || '작품 이름'}</p>
                {item.desc && <p className="text-gray-400 text-[10px] line-clamp-2 leading-relaxed">{item.desc}</p>}
                {item.author && <p className="text-gray-400 text-[10px] mt-1">@ {item.author}</p>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 업데이트 이후 변경 프로필 */}
      <section>
        <h3 className="text-gray-700 font-semibold text-sm mb-4">업데이트 이후 변경 프로필</h3>
        <div className="grid grid-cols-2 gap-3">
          {MOCK_UPDATED.map((item, i) => (
            <div key={i} className="rounded-xl overflow-hidden border border-gray-100">
              <div className={cn(
                'aspect-[2/3] bg-gray-100 flex items-center justify-center',
                item.hasImage && 'bg-gradient-to-b from-gray-900 via-gray-800 to-black'
              )}>
                {item.hasImage ? (
                  <div className="w-full h-full flex items-center justify-center p-3">
                    <span className="text-white text-xs font-bold text-center leading-tight">{item.title}</span>
                  </div>
                ) : (
                  <div className="text-gray-300">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────
// PROFILE FORM (첫 번째 탭)
// ─────────────────────────────────────────────
function ProfileForm({
  name, setName,
  description, setDescription,
  onNext,
}: {
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  onNext: () => void;
}) {
  const [showAgeNotice, setShowAgeNotice] = useState(true);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
      {/* Random generate */}
      <div className="flex items-center justify-between mb-6 py-3 border-b border-gray-100">
        <span className="text-gray-700 text-sm">프로필을 랜덤으로 생성해 보세요</span>
        <button
          type="button"
          className="px-3 py-1.5 rounded-lg border border-brand text-brand text-xs font-semibold hover:bg-brand/5 transition-colors"
        >
          랜덤 생성
        </button>
      </div>

      {/* Age notice */}
      <AnimatePresence>
        {showAgeNotice && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center justify-between gap-3 px-4 py-3 mb-6 bg-gray-900 text-white rounded-xl overflow-hidden"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Megaphone className="w-4 h-4 flex-shrink-0" />
              <p className="text-sm truncate">민감한 스토리의 경우 제작 시 성인 인증이 필요해요.</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                className="px-3 py-1 rounded-lg bg-white text-gray-900 text-xs font-semibold hover:bg-gray-100 transition-colors"
              >
                성인 인증
              </button>
              <button
                type="button"
                onClick={() => setShowAgeNotice(false)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Square image */}
      <ImageUploadArea
        label="정방형 이미지(1:1)"
        required
        ratio="1:1"
        hint="이미지를 필수로 등록해주세요."
        size="5MB 이하 (1,080 x 1,080px)"
      />

      {/* Vertical image */}
      <ImageUploadArea
        label="세로형 이미지(2:3)"
        ratio="2:3"
        hint="필수는 아니지만 미리 등록하면 더 예쁘게 노출돼요."
        size="5MB 이하 (1,080 x 1,620px)"
      />

      {/* Update notice */}
      <div className="flex items-start gap-2.5 px-4 py-3.5 mb-8 bg-gray-50 rounded-xl border border-gray-100">
        <Megaphone className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-gray-600 text-xs font-medium mb-1">26년 4월 중 업데이트 예정</p>
          <p className="text-gray-400 text-xs leading-relaxed">
            스토리 작품 썸네일이 <span className="text-brand font-semibold">세로형(2:3)</span>으로 바뀌어요.<br />
            여백 없이 꽉 찬 화면으로 보여주고 싶다면 세로형 이미지를 추천해요.
          </p>
        </div>
      </div>

      {/* Name */}
      <div className="mb-6">
        <div className="flex items-center gap-1 mb-2">
          <label className="text-gray-900 font-semibold text-sm">이름</label>
          <span className="text-brand font-bold text-sm">*</span>
        </div>
        <p className="text-gray-400 text-xs mb-2">2~30자 이내로 입력해 주세요 (특수문자, 이모지 제외)</p>
        <div className="relative">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 30))}
            placeholder="스토리의 이름을 입력해 주세요"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400 transition-colors pr-16"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 text-xs">
            {name.length} / 30
          </span>
        </div>
      </div>

      {/* Description */}
      <div className="mb-6">
        <div className="flex items-center gap-1 mb-2">
          <label className="text-gray-900 font-semibold text-sm">한 줄 소개</label>
          <span className="text-brand font-bold text-sm">*</span>
        </div>
        <div className="relative">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 30))}
            placeholder="어떤 스토리인지 설명할 수 있는 간단한 소개를 입력해 주세요"
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400 transition-colors resize-none"
          />
          <span className="absolute right-4 bottom-3 text-gray-300 text-xs">
            {description.length} / 30
          </span>
        </div>
      </div>

      {/* Content warning */}
      <div className="flex items-start gap-2 text-gray-400 text-xs mb-12">
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <p>폭력, 혐오, 성적묘사 등의 표현 및 이미지는 규정에 따라 영구적으로 제재될 수 있어요</p>
      </div>

      {/* Scroll to top button */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-20 right-8 w-10 h-10 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors z-10"
      >
        <ChevronUp className="w-5 h-5" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// START SETTINGS TAB  (시작 설정)
// ─────────────────────────────────────────────
interface StartSetting {
  id: string;
  name: string;
  prologue: string;
  situation: string;
  playGuide: string;
  suggestedReplies: string[];
}

function StartSettingsTab() {
  const [settings, setSettings] = useState<StartSetting[]>([
    { id: '1', name: '기본 설정', prologue: '', situation: '', playGuide: '', suggestedReplies: [] },
  ]);
  const [activeSettingId, setActiveSettingId] = useState('1');
  const [advancedOpen, setAdvancedOpen] = useState(true);

  const activeSetting = settings.find(s => s.id === activeSettingId) ?? settings[0];

  const update = (field: keyof StartSetting, value: string | string[]) => {
    setSettings(prev => prev.map(s => s.id === activeSettingId ? { ...s, [field]: value } : s));
  };

  const addSetting = () => {
    const newId = String(Date.now());
    setSettings(prev => [...prev, {
      id: newId, name: `설정 ${prev.length + 1}`,
      prologue: '', situation: '', playGuide: '', suggestedReplies: [],
    }]);
    setActiveSettingId(newId);
  };

  const addReply = () => {
    if (activeSetting.suggestedReplies.length >= 3) return;
    update('suggestedReplies', [...activeSetting.suggestedReplies, '']);
  };

  const updateReply = (idx: number, val: string) => {
    const arr = [...activeSetting.suggestedReplies];
    arr[idx] = val;
    update('suggestedReplies', arr);
  };

  const removeReply = (idx: number) => {
    update('suggestedReplies', activeSetting.suggestedReplies.filter((_, i) => i !== idx));
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
      {/* Setting pills */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {settings.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSettingId(s.id)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-semibold transition-all',
              s.id === activeSettingId
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            )}
          >
            {s.id === settings[0].id ? `기본 ${s.name}` : s.name}
          </button>
        ))}
        {settings.length < 5 && (
          <button
            onClick={addSetting}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm text-gray-400 hover:bg-gray-100 transition-colors border border-dashed border-gray-300"
          >
            <Plus className="w-3.5 h-3.5" />
            설정 추가
          </button>
        )}
      </div>

      {/* 프롤로그 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1">
            <span className="text-gray-900 font-semibold text-sm">프롤로그</span>
            <span className="text-brand font-bold text-sm">*</span>
          </div>
          <button className="px-3 py-1 rounded-lg border border-brand/40 text-brand text-xs font-semibold hover:bg-brand/5 transition-colors">
            자동 생성
          </button>
        </div>
        <p className="text-gray-400 text-xs mb-2">스토리의 프롤로그를 작성해 주세요</p>
        <div className="relative">
          <textarea
            value={activeSetting.prologue}
            onChange={e => update('prologue', e.target.value.slice(0, 1000))}
            placeholder="자동 생성 기능을 활용하면 AI가 프롬프트를 참고하여 초안을 작성해 드려요"
            rows={5}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-800 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400 resize-none"
          />
          <span className="absolute right-4 bottom-3 text-gray-300 text-xs">{activeSetting.prologue.length} / 1000</span>
        </div>
      </div>

      {/* 시작설정 이름 */}
      <div className="mb-6">
        <div className="flex items-center gap-1 mb-1">
          <span className="text-gray-900 font-semibold text-sm">시작설정 이름</span>
          <span className="text-brand font-bold text-sm">*</span>
        </div>
        <p className="text-gray-400 text-xs mb-2">시작설정의 이름을 작성해 주세요</p>
        <div className="relative">
          <input
            type="text"
            value={activeSetting.name}
            onChange={e => update('name', e.target.value.slice(0, 12))}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-800 text-sm focus:outline-none focus:border-gray-400 pr-16"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 text-xs">
            {activeSetting.name.length} / 12
          </span>
        </div>
      </div>

      {/* 시작 상황 */}
      <div className="mb-6">
        <div className="flex items-center gap-1 mb-1">
          <span className="text-gray-900 font-semibold text-sm">시작 상황</span>
        </div>
        <p className="text-gray-400 text-xs mb-2">스토리 전개를 위한 시작 상황 정보를 입력해 주세요</p>
        <div className="relative">
          <textarea
            value={activeSetting.situation}
            onChange={e => update('situation', e.target.value.slice(0, 1000))}
            placeholder="사용자의 역할, 등장인물과의 관계, 이야기가 시작되는 세계관 등"
            rows={5}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-800 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400 resize-none"
          />
          <span className="absolute right-4 bottom-3 text-gray-300 text-xs">{activeSetting.situation.length} / 1000</span>
        </div>
      </div>

      {/* 고급 설정 toggle */}
      <button
        onClick={() => setAdvancedOpen(p => !p)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition-colors mb-6"
      >
        고급 설정
        <ChevronUp className={cn('w-4 h-4 transition-transform', !advancedOpen && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {advancedOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            {/* 플레이 가이드 */}
            <div className="mb-6">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-gray-900 font-semibold text-sm">플레이 가이드</span>
              </div>
              <p className="text-gray-400 text-xs mb-2">
                AI가 기억하지 않는, 사용자에게만 보이는 가이드 메시지를 추가해 플레이 방법을 안내해 보세요.
              </p>
              <div className="relative">
                <textarea
                  value={activeSetting.playGuide}
                  onChange={e => update('playGuide', e.target.value.slice(0, 500))}
                  placeholder="사용자를 위한 가이드를 작성해주세요"
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-800 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400 resize-none"
                />
                <span className="absolute right-4 bottom-3 text-gray-300 text-xs">{activeSetting.playGuide.length} / 500</span>
              </div>
            </div>

            {/* 추천 답변 */}
            <div className="mb-8">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-gray-900 font-semibold text-sm">추천 답변</span>
              </div>
              <p className="text-gray-400 text-xs mb-3">사용자들에게 첫 답변을 최대 3개 추천해 보세요.</p>
              {activeSetting.suggestedReplies.map((reply, idx) => (
                <div key={idx} className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={reply}
                    onChange={e => updateReply(idx, e.target.value)}
                    placeholder={`추천 답변 ${idx + 1}`}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-800 text-sm focus:outline-none focus:border-gray-400"
                  />
                  <button onClick={() => removeReply(idx)} className="text-gray-300 hover:text-gray-500 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {activeSetting.suggestedReplies.length < 3 && (
                <button
                  onClick={addReply}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-gray-300 text-gray-400 text-sm hover:bg-gray-50 hover:text-gray-600 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  추천 답변 추가
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scroll to top */}
      <button
        type="button"
        onClick={() => document.querySelector('.overflow-y-auto')?.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-20 right-[44%] w-10 h-10 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors z-10"
      >
        <ChevronUp className="w-5 h-5" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// STAT SETTINGS TAB  (스탯 설정)
// ─────────────────────────────────────────────
const STAT_ICONS = ['❤️', '⚔️', '🧠', '💪', '🏃', '💰', '⭐', '🔮', '🛡️', '🍀'];
const STAT_COLORS = [
  { label: '빨강', value: '#E63325' },
  { label: '파랑', value: '#3B82F6' },
  { label: '초록', value: '#10B981' },
  { label: '노랑', value: '#F59E0B' },
  { label: '보라', value: '#8B5CF6' },
  { label: '분홍', value: '#EC4899' },
  { label: '하늘', value: '#06B6D4' },
  { label: '회색', value: '#6B7280' },
];

interface StatItem {
  id: string;
  name: string;
  icon: string;
  color: string;
  minValue: string;
  maxValue: string;
  defaultValue: string;
  unit: string;
  description: string;
  collapsed: boolean;
  levels: { id: string; label: string; min: string; max: string }[];
}

function StatCard({
  stat,
  index,
  onUpdate,
  onRemove,
}: {
  stat: StatItem;
  index: number;
  onUpdate: (id: string, field: keyof StatItem, value: unknown) => void;
  onRemove: (id: string) => void;
}) {
  const [iconOpen, setIconOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);

  const selectedColor = STAT_COLORS.find(c => c.value === stat.color);

  const addLevel = () => {
    onUpdate(stat.id, 'levels', [
      ...stat.levels,
      { id: String(Date.now()), label: '', min: '', max: '' },
    ]);
  };

  const updateLevel = (levelId: string, field: string, val: string) => {
    onUpdate(stat.id, 'levels', stat.levels.map(l =>
      l.id === levelId ? { ...l, [field]: val } : l
    ));
  };

  const removeLevel = (levelId: string) => {
    onUpdate(stat.id, 'levels', stat.levels.filter(l => l.id !== levelId));
  };

  return (
    <div className="mb-3 rounded-xl border border-gray-200 overflow-hidden">
      {/* Stat header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-gray-300 cursor-grab" />
          <span className="text-gray-700 font-semibold text-sm">스탯 {index + 1}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onRemove(stat.id)}
            className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onUpdate(stat.id, 'collapsed', !stat.collapsed)}
            className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ChevronUp className={cn('w-3.5 h-3.5 transition-transform', stat.collapsed && 'rotate-180')} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {!stat.collapsed && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-4">
              {/* 스탯 이름 */}
              <div>
                <div className="flex items-center gap-1 mb-1.5">
                  <span className="text-gray-700 font-semibold text-sm">스탯 이름</span>
                  <span className="text-brand text-sm font-bold">*</span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={stat.name}
                    onChange={e => onUpdate(stat.id, 'name', e.target.value.slice(0, 10))}
                    placeholder="예) 호감도, 체력, 전투력, 지능 등"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-800 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400 pr-14"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 text-xs">{stat.name.length} / 10</span>
                </div>
              </div>

              {/* 아이콘 + 색상 */}
              <div className="grid grid-cols-2 gap-3">
                {/* 아이콘 */}
                <div>
                  <div className="flex items-center gap-1 mb-1.5">
                    <span className="text-gray-700 font-semibold text-sm">아이콘</span>
                    <span className="text-brand text-sm font-bold">*</span>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => { setIconOpen(p => !p); setColorOpen(false); }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-200 text-sm hover:border-gray-300 transition-colors"
                    >
                      <span className={stat.icon ? 'text-base' : 'text-gray-300'}>
                        {stat.icon || '선택'}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    <AnimatePresence>
                      {iconOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="absolute top-full mt-1 left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-2 grid grid-cols-5 gap-1 w-48"
                        >
                          {STAT_ICONS.map(icon => (
                            <button
                              key={icon}
                              onClick={() => { onUpdate(stat.id, 'icon', icon); setIconOpen(false); }}
                              className={cn(
                                'w-8 h-8 flex items-center justify-center rounded-lg text-base hover:bg-gray-100 transition-colors',
                                stat.icon === icon && 'bg-brand/10'
                              )}
                            >
                              {icon}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* 색상 */}
                <div>
                  <div className="flex items-center gap-1 mb-1.5">
                    <span className="text-gray-700 font-semibold text-sm">색상</span>
                    <span className="text-brand text-sm font-bold">*</span>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => { setColorOpen(p => !p); setIconOpen(false); }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-200 text-sm hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {stat.color ? (
                          <div className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: stat.color }} />
                        ) : null}
                        <span className={stat.color ? 'text-gray-700' : 'text-gray-300'}>
                          {selectedColor?.label || '선택'}
                        </span>
                      </div>
                      <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    <AnimatePresence>
                      {colorOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="absolute top-full mt-1 left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden w-36"
                        >
                          {STAT_COLORS.map(c => (
                            <button
                              key={c.value}
                              onClick={() => { onUpdate(stat.id, 'color', c.value); setColorOpen(false); }}
                              className={cn(
                                'w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 transition-colors',
                                stat.color === c.value && 'bg-gray-50 font-semibold'
                              )}
                            >
                              <div className="w-3.5 h-3.5 rounded-full border border-gray-200 flex-shrink-0" style={{ backgroundColor: c.value }} />
                              {c.label}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* 최소/최대/기본값 */}
              <div>
                <div className="flex items-center gap-1 mb-1.5">
                  <span className="text-gray-700 font-semibold text-sm">최소 / 최대 / 기본값 설정</span>
                  <span className="text-brand text-sm font-bold">*</span>
                </div>
                <p className="text-gray-400 text-xs mb-2">기본값은 최소~최댓값의 범위 내에 있어야 해요 (입력 가능 수치: -99,999 ~ 99,999)</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['minValue', 'maxValue', 'defaultValue'] as const).map((field, i) => (
                    <input
                      key={field}
                      type="number"
                      value={stat[field]}
                      onChange={e => onUpdate(stat.id, field, e.target.value)}
                      placeholder={['최솟값', '최댓값', '기본값'][i]}
                      className="px-3 py-2.5 rounded-xl border border-gray-200 text-gray-800 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400 text-center"
                    />
                  ))}
                </div>
              </div>

              {/* 스탯 단위 */}
              <div>
                <div className="flex items-center gap-1 mb-1.5">
                  <span className="text-gray-700 font-semibold text-sm">스탯 단위 설정</span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={stat.unit}
                    onChange={e => onUpdate(stat.id, 'unit', e.target.value.slice(0, 3))}
                    placeholder="예) 억원, 순위, 개, %"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-800 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400 pr-14"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 text-xs">{stat.unit.length} / 3</span>
                </div>
              </div>

              {/* 스탯 설명 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-700 font-semibold text-sm">스탯 설명</span>
                    <span className="text-brand text-sm font-bold">*</span>
                  </div>
                  <button className="px-2.5 py-1 rounded-lg border border-brand/40 text-brand text-xs font-semibold hover:bg-brand/5 transition-colors">
                    자동생성
                  </button>
                </div>
                <p className="text-gray-400 text-xs mb-2">
                  AI가 스탯을 이해하고 스토리에 적용할 수 있도록 스탯에 대한 설명을 작성해주세요
                </p>
                <div className="relative">
                  <textarea
                    value={stat.description}
                    onChange={e => onUpdate(stat.id, 'description', e.target.value.slice(0, 500))}
                    placeholder={`예) {user}가 간식을 주면 증가한다.\n{char}가 혼자 있으면 감소한다.\n{user}가 스킨십을 해주면 증가한다.`}
                    rows={4}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-800 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400 resize-none"
                  />
                  <span className="absolute right-3 bottom-3 text-gray-300 text-xs">{stat.description.length} / 500</span>
                </div>
              </div>

              {/* 스탯 레벨 설정 */}
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-gray-700 font-semibold text-sm">스탯 레벨 설정</span>
                </div>
                <p className="text-gray-400 text-xs mb-3">레벨에 따라 다채롭게 전개되는 작품을 만들어 보세요</p>
                {stat.levels.map((level, li) => (
                  <div key={level.id} className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={level.label}
                      onChange={e => updateLevel(level.id, 'label', e.target.value)}
                      placeholder={`레벨 ${li + 1} 이름`}
                      className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-gray-800 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400"
                    />
                    <input
                      type="number"
                      value={level.min}
                      onChange={e => updateLevel(level.id, 'min', e.target.value)}
                      placeholder="최솟값"
                      className="w-20 px-2 py-2 rounded-xl border border-gray-200 text-gray-800 text-sm text-center focus:outline-none focus:border-gray-400"
                    />
                    <input
                      type="number"
                      value={level.max}
                      onChange={e => updateLevel(level.id, 'max', e.target.value)}
                      placeholder="최댓값"
                      className="w-20 px-2 py-2 rounded-xl border border-gray-200 text-gray-800 text-sm text-center focus:outline-none focus:border-gray-400"
                    />
                    <button onClick={() => removeLevel(level.id)} className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addLevel}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-gray-300 text-gray-400 text-sm hover:bg-gray-50 hover:text-gray-600 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  레벨 추가
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatSettingsTab({ stats, setStats }: {
  stats: StatItem[];
  setStats: React.Dispatch<React.SetStateAction<StatItem[]>>;
}) {
  const addStat = () => {
    if (stats.length >= 7) return;
    setStats(prev => [...prev, {
      id: String(Date.now()),
      name: '', icon: '', color: '#E63325',
      minValue: '0', maxValue: '100', defaultValue: '50',
      unit: '', description: '', collapsed: false, levels: [],
    }]);
  };

  const updateStat = (id: string, field: keyof StatItem, value: unknown) => {
    setStats(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const removeStat = (id: string) => {
    setStats(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
      <div className="mb-2">
        <h2 className="text-gray-900 font-bold text-base mb-1">스탯 설정</h2>
        <p className="text-gray-400 text-xs">
          스탯을 설정하여 스토리에 생동감을 불어넣어 보세요. 시작 설정별로 최대 7개까지 추가할 수 있어요.
        </p>
      </div>

      {/* Active setting pill */}
      <div className="flex items-center gap-2 mt-4 mb-5">
        <button className="px-3 py-1.5 rounded-full text-sm font-semibold bg-gray-900 text-white">
          기본 설정 {stats.length}
        </button>
      </div>

      {/* Stat cards */}
      {stats.map((stat, i) => (
        <StatCard
          key={stat.id}
          stat={stat}
          index={i}
          onUpdate={updateStat}
          onRemove={removeStat}
        />
      ))}

      {/* Add stat button */}
      <button
        onClick={addStat}
        disabled={stats.length >= 7}
        className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border border-dashed border-gray-300 text-gray-400 text-sm hover:bg-gray-50 hover:text-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed mt-2 mb-8"
      >
        <Plus className="w-4 h-4" />
        스탯 추가
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// PLACEHOLDER TABS
// ─────────────────────────────────────────────
function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-8 py-12 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">⚙️</span>
        </div>
        <p className="text-gray-500 text-sm">{label} 설정을 완료하세요</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// STORY SETTINGS TAB (simplified example)
// ─────────────────────────────────────────────
function StorySettingsTab() {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [examples, setExamples] = useState([{ user: '', assistant: '' }]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
      {/* System prompt */}
      <div className="mb-8">
        <div className="flex items-center gap-1 mb-2">
          <label className="text-gray-900 font-semibold text-sm">스토리 설정</label>
          <span className="text-brand font-bold text-sm">*</span>
        </div>
        <p className="text-gray-400 text-xs mb-2">스토리의 세계관, 배경, 규칙을 상세히 설명해주세요</p>
        <div className="relative">
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value.slice(0, 3000))}
            placeholder="스토리 설정을 입력해 주세요"
            rows={8}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400 transition-colors resize-none"
          />
          <span className="absolute right-4 bottom-3 text-gray-300 text-xs">{systemPrompt.length} / 3000</span>
        </div>
      </div>

      {/* Advanced settings toggle */}
      <button
        type="button"
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition-colors mb-8"
      >
        고급 설정
        <ChevronUp className="w-4 h-4 rotate-180" />
      </button>

      {/* Examples */}
      <div className="mb-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-gray-900 font-semibold text-sm mb-0.5">전개 예시</p>
            <p className="text-gray-400 text-xs">전개 예시를 입력해서 스토리의 완성도를 높여보세요.<br />예시는 3개까지 등록할 수 있어요.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="px-3 py-1.5 rounded-lg border border-brand/40 text-brand text-xs font-medium hover:bg-brand/5 transition-colors">
              전체 자동 생성
            </button>
            {examples.length < 3 && (
              <button
                type="button"
                onClick={() => setExamples(p => [...p, { user: '', assistant: '' }])}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors"
              >
                예시 추가
              </button>
            )}
          </div>
        </div>

        {examples.map((ex, i) => (
          <div key={i} className="mb-4 rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <span className="text-gray-700 font-semibold text-sm">예시 {i + 1}</span>
              <button
                type="button"
                onClick={() => setExamples(p => p.filter((_, j) => j !== i))}
                className="text-gray-400 hover:text-gray-600 text-sm transition-colors"
              >
                삭제
              </button>
            </div>
            <div className="p-3 space-y-3">
              {/* User example */}
              <div>
                <div className="flex items-center gap-2 mb-2 text-gray-500 text-xs">
                  <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px]">👤</div>
                  나도이런거만들거야
                </div>
                <textarea
                  value={ex.user}
                  onChange={(e) => setExamples(p => p.map((item, j) => j === i ? { ...item, user: e.target.value.slice(0, 500) } : item))}
                  placeholder="입력 예시"
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-800 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400 resize-none"
                />
                <p className="text-gray-300 text-xs text-right mt-1">{ex.user.length} / 500</p>
              </div>
              {/* Divider with robot icon */}
              <div className="flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-base">🤖</div>
              </div>
              {/* Assistant example */}
              <div>
                <textarea
                  value={ex.assistant}
                  onChange={(e) => setExamples(p => p.map((item, j) => j === i ? { ...item, assistant: e.target.value.slice(0, 500) } : item))}
                  placeholder="출력 예시"
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-800 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400 resize-none"
                />
                <p className="text-gray-300 text-xs text-right mt-1">{ex.assistant.length} / 500</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN STORY CREATE FORM
// ─────────────────────────────────────────────
export function StoryCreateForm() {
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<StoryTab>('profile');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [stats, setStats] = useState<StatItem[]>([]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login?redirect=/creator/story/new');
  }, [isAuthenticated, authLoading, router]);

  const currentTabIndex = TABS.findIndex(t => t.key === activeTab);

  const handleNext = () => {
    const nextTab = TABS[currentTabIndex + 1];
    if (nextTab) setActiveTab(nextTab.key);
  };

  const handlePrev = () => {
    const prevTab = TABS[currentTabIndex - 1];
    if (prevTab) setActiveTab(prevTab.key);
  };

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* ── TOP BAR ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-white z-20">
        {/* Left: back + title */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/creator')}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-gray-900 font-bold text-base">스토리 만들기</h1>
            <button type="button" className="text-gray-300 hover:text-gray-500 transition-colors">
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: save buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <Clock className="w-4 h-4" />
            임시저장
          </button>
          <button type="button" className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:bg-gray-50 transition-colors">
            <History className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="px-5 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition-colors"
          >
            등록하기
          </button>
        </div>
      </div>

      {/* ── TAB NAV ── */}
      <div className="flex-shrink-0 flex items-center gap-0 px-6 border-b border-gray-100 overflow-x-auto scrollbar-hide bg-white">
        {TABS.map(({ key, label, required }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex items-center gap-0.5 px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-all',
              activeTab === key
                ? 'border-brand text-gray-900 font-semibold'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            )}
          >
            {label}
            {required && <span className="text-brand text-xs font-bold">*</span>}
          </button>
        ))}
      </div>

      {/* ── MAIN SPLIT ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left form */}
        <div className="flex flex-col h-full" style={{ width: '58%', borderRight: '1px solid #f3f4f6' }}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.12 }}
              className="flex flex-col flex-1 min-h-0 overflow-hidden"
            >
              {activeTab === 'profile' && (
                <ProfileForm
                  name={name}
                  setName={setName}
                  description={description}
                  setDescription={setDescription}
                  onNext={handleNext}
                />
              )}
              {activeTab === 'story-settings' && <StorySettingsTab />}
              {activeTab === 'start-settings' && <StartSettingsTab />}
              {activeTab === 'stat-settings' && <StatSettingsTab stats={stats} setStats={setStats} />}
              {activeTab !== 'profile' && activeTab !== 'story-settings' && activeTab !== 'start-settings' && activeTab !== 'stat-settings' && (
                <PlaceholderTab label={TABS.find(t => t.key === activeTab)?.label ?? ''} />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Bottom nav buttons */}
          <div className="flex-shrink-0 flex items-center justify-between px-8 py-4 border-t border-gray-100 bg-white">
            {currentTabIndex > 0 ? (
              <button
                type="button"
                onClick={handlePrev}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                이전
              </button>
            ) : <div />}

            <button
              type="button"
              onClick={handleNext}
              disabled={currentTabIndex === TABS.length - 1}
              className="px-8 py-2.5 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              다음
            </button>
          </div>
        </div>

        {/* Right preview panel */}
        <div className="flex flex-col h-full overflow-hidden" style={{ width: '42%' }}>
          {activeTab === 'profile' || activeTab === 'story-settings' ? (
            <>
              <div className="flex-shrink-0 text-center py-3 border-b border-gray-100">
                <p className="text-gray-400 text-xs">이 대화는 AI로 생성된 가상의 이야기입니다</p>
              </div>
              <RightPreviewPanel name={name} description={description} />
            </>
          ) : (
            /* Chat preview for start/stat/other tabs */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Chat preview header bar */}
              <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
                <button className="flex items-center gap-1.5 text-gray-500 text-sm hover:text-gray-700 transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                  채팅 미리보기
                </button>
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                    <span>🍇</span>
                    슈퍼챗 2.0
                    <ChevronDown className="w-3 h-3 text-gray-400" />
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                    <MessageSquare className="w-3.5 h-3.5" />
                    채팅 내역
                  </button>
                </div>
              </div>

              {/* Stat bars (only in stat-settings tab) */}
              {activeTab === 'stat-settings' && stats.length > 0 && (
                <div className="flex-shrink-0 px-4 py-3 border-b border-gray-100 space-y-2">
                  {stats.slice(0, 3).map(stat => (
                    <div key={stat.id} className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 w-28 flex-shrink-0">
                        {stat.icon && <span className="text-sm">{stat.icon}</span>}
                        <span className="text-gray-600 text-xs font-medium truncate">
                          {stat.name || '스탯 이름'}
                        </span>
                      </div>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            backgroundColor: stat.color || '#E63325',
                            width: stat.maxValue
                              ? `${Math.round((Number(stat.defaultValue) - Number(stat.minValue)) / (Number(stat.maxValue) - Number(stat.minValue)) * 100)}%`
                              : '50%',
                          }}
                        />
                      </div>
                      <span className="text-gray-400 text-xs w-8 text-right flex-shrink-0">
                        {stat.defaultValue || 0}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* AI disclaimer */}
              <div className="flex-shrink-0 text-center py-3 border-b border-gray-100">
                <p className="text-gray-400 text-xs">이 대화는 AI로 생성된 가상의 이야기입니다</p>
              </div>

              {/* Chat area */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-gray-400 text-xs mb-1.5">스토리 이름</p>
                    <div className="h-10 w-52 bg-blue-50 rounded-2xl rounded-tl-sm" />
                  </div>
                </div>
              </div>

              {/* Chat input */}
              <div className="flex-shrink-0 px-4 py-3 border-t border-gray-100">
                <div className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-gray-200 bg-gray-50">
                  <input
                    type="text"
                    placeholder="[이름, 캐릭터 설정 및 정보, 첫 메시지]를 입력해주세요"
                    className="flex-1 bg-transparent text-xs text-gray-400 outline-none placeholder:text-gray-300"
                    readOnly
                  />
                  <button className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M5 12h14m-7-7l7 7-7 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
