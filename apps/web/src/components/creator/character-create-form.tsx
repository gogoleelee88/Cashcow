'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, AlertCircle, CheckCircle2, Loader2,
  Image as ImageIcon, Lock, Globe, Link2, Info,
  Sparkles, Wand2, ChevronRight, RefreshCw,
  Zap, Crown, MessageSquare, Star, X,
} from 'lucide-react';
import { api } from '../../lib/api';
import { apiClient } from '../../lib/api';
import { cn } from '../../lib/utils';
import { CATEGORY_LABELS, CATEGORY_ICONS } from '@characterverse/utils';
import type { CharacterCategory } from '@characterverse/types';
import { toast } from '../ui/toaster';

const STEPS = [
  { label: '기본 정보', desc: '이름과 컨셉을 알려주세요' },
  { label: '성격 설정', desc: '캐릭터의 개성을 만들어요' },
  { label: '공개 설정', desc: '마지막 단계예요!' },
];

const GENRE_TEMPLATES = [
  { label: '로맨스', icon: '💝', concept: '따뜻하고 다정한 성격으로, 사랑에 솔직하며 상대방을 항상 배려하는' },
  { label: '판타지', icon: '🧙', concept: '마법을 사용하는 고귀한 성격의, 지혜롭고 신비로운' },
  { label: '무협', icon: '⚔️', concept: '의리와 명예를 중시하며 강인한 의지를 가진 무사' },
  { label: '먼치킨', icon: '⚡', concept: '모든 분야에서 압도적으로 뛰어난, 자신감 넘치는' },
  { label: 'BL', icon: '🌸', concept: '섬세하고 감성적이며, 깊은 감정을 내면에 품고 있는' },
  { label: 'SF', icon: '🚀', concept: '첨단 기술을 다루며 논리적이고 미래지향적인 사고를 가진' },
];

export function CharacterCreateForm() {
  const [step, setStep] = useState(0);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    concept: '',          // Used for AI generation (not sent to API)
    systemPrompt: '',
    greeting: '',
    category: 'ORIGINAL' as CharacterCategory,
    tags: [] as string[],
    tagInput: '',
    visibility: 'PUBLIC' as 'PUBLIC' | 'PRIVATE' | 'UNLISTED',
    ageRating: 'ALL' as 'ALL' | 'TEEN' | 'MATURE',
    language: 'ko',
    model: 'claude-haiku-3' as 'claude-haiku-3' | 'claude-sonnet-4',
    temperature: 0.8,
    maxTokens: 1024,
  });

  const update = useCallback((patch: Partial<typeof formData>) => {
    setFormData((prev) => ({ ...prev, ...patch }));
  }, []);

  // ── AI Generate ──────────────────────────────
  const handleAIGenerate = async () => {
    if (!formData.name.trim() || !formData.concept.trim()) {
      toast.error('이름과 캐릭터 컨셉을 먼저 입력해주세요');
      return;
    }
    setIsGenerating(true);
    try {
      const res = await apiClient.post('/api/characters/generate', {
        name: formData.name,
        concept: formData.concept,
        category: formData.category,
        language: formData.language,
      }).then((r: any) => r.data);

      if (res.success) {
        const { systemPrompt, greeting, description, tags } = res.data;
        update({
          systemPrompt,
          greeting,
          description: description || formData.description,
          tags: tags || formData.tags,
        });
        toast.success('AI가 캐릭터를 생성했어요!', '내용을 확인하고 수정해보세요');
        if (step === 0) setStep(1);
      }
    } catch {
      toast.error('AI 생성 실패', '직접 입력해주세요');
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Image Upload ─────────────────────────────
  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('이미지 파일만 업로드 가능합니다'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('파일 크기는 5MB 이하여야 합니다'); return; }

    setIsUploadingImage(true);
    setPreviewImage(URL.createObjectURL(file));

    try {
      const res = await api.characters.getUploadUrl(file.type, 'avatar');
      const { uploadUrl, key, publicUrl } = res.data;
      await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      setImageKey(key);
      setPreviewImage(publicUrl);
      toast.success('이미지가 업로드되었습니다');
    } catch {
      toast.error('이미지 업로드 실패');
      setPreviewImage(null);
    } finally {
      setIsUploadingImage(false);
    }
  };

  // ── Tag handling ─────────────────────────────
  const addTag = (tag: string) => {
    const t = tag.trim().replace(/,/g, '');
    if (!t || formData.tags.includes(t) || formData.tags.length >= 10) return;
    update({ tags: [...formData.tags, t], tagInput: '' });
  };

  const removeTag = (tag: string) => {
    update({ tags: formData.tags.filter((t) => t !== tag) });
  };

  // ── Create mutation ──────────────────────────
  const createMutation = useMutation({
    mutationFn: () =>
      api.characters.create({
        name: formData.name,
        description: formData.description,
        systemPrompt: formData.systemPrompt,
        greeting: formData.greeting,
        category: formData.category,
        tags: formData.tags,
        visibility: formData.visibility,
        ageRating: formData.ageRating,
        language: formData.language,
        model: formData.model,
        temperature: formData.temperature,
        maxTokens: formData.maxTokens,
      }),
    onSuccess: (res) => {
      toast.success('캐릭터가 생성되었습니다!', '이제 대화해보세요');
      router.push(`/characters/${res.data.id}`);
    },
    onError: (err: any) => {
      toast.error('생성 실패', err.response?.data?.error?.message || '다시 시도해주세요');
    },
  });

  const canStep0 = formData.name.trim().length >= 1 && formData.description.trim().length >= 10;
  const canStep1 = formData.systemPrompt.trim().length >= 20 && formData.greeting.trim().length >= 1;
  const canSubmit = canStep0 && canStep1;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* ── STEPS ── */}
      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center flex-1">
            <div
              className={cn(
                'flex items-center gap-2.5 cursor-pointer group',
                i <= step ? 'cursor-pointer' : 'cursor-default'
              )}
              onClick={() => i < step && setStep(i)}
            >
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all',
                i < step ? 'bg-brand text-white' :
                  i === step ? 'bg-brand/25 text-brand-light ring-2 ring-brand/40' :
                    'bg-surface text-text-muted border border-border'
              )}>
                {i < step ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <div className="hidden sm:block">
                <p className={cn('text-xs font-semibold', i === step ? 'text-text-primary' : 'text-text-muted')}>{s.label}</p>
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('flex-1 h-0.5 mx-3 rounded transition-all', i < step ? 'bg-brand' : 'bg-border')} />
            )}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ═══════════ STEP 0: Basic Info ═══════════ */}
        {step === 0 && (
          <motion.div
            key="step0"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-5"
          >
            <div>
              <h2 className="text-text-primary font-bold text-xl mb-0.5">기본 정보</h2>
              <p className="text-text-muted text-sm">캐릭터 이름과 컨셉을 입력하면 AI가 도와드려요</p>
            </div>

            {/* Image + Name row */}
            <div className="flex gap-4 items-start">
              {/* Image upload */}
              <div
                className={cn(
                  'relative w-24 h-24 rounded-2xl overflow-hidden cursor-pointer flex-shrink-0',
                  'border-2 border-dashed border-border hover:border-brand/50',
                  'bg-surface flex items-center justify-center transition-all group'
                )}
                onClick={() => fileInputRef.current?.click()}
              >
                {previewImage ? (
                  <>
                    <Image src={previewImage} alt="Preview" fill className="object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                      <ImageIcon className="w-5 h-5 text-white" />
                    </div>
                  </>
                ) : (
                  <div className="text-center p-2">
                    {isUploadingImage ? (
                      <Loader2 className="w-5 h-5 animate-spin text-brand mx-auto" />
                    ) : (
                      <>
                        <Upload className="w-5 h-5 text-text-muted mx-auto mb-1" />
                        <span className="text-text-muted text-xs">이미지</span>
                      </>
                    )}
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />

              <div className="flex-1 space-y-3">
                <div>
                  <label className="block text-text-secondary text-sm font-medium mb-1.5">캐릭터 이름 *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => update({ name: e.target.value })}
                    placeholder="홍길동, 엘사, 나루토..."
                    maxLength={50}
                    className="input-base"
                  />
                </div>

                <div>
                  <label className="block text-text-secondary text-sm font-medium mb-1.5">카테고리</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(CATEGORY_LABELS) as CharacterCategory[]).map((cat) => (
                      <button key={cat} type="button"
                        onClick={() => update({ category: cat })}
                        className={cn(
                          'flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                          formData.category === cat
                            ? 'bg-brand/20 text-brand-light border-brand/40'
                            : 'bg-surface text-text-muted border-border hover:border-brand/30'
                        )}
                      >
                        <span>{CATEGORY_ICONS[cat]}</span>
                        {CATEGORY_LABELS[cat]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* One-line description */}
            <div>
              <label className="block text-text-secondary text-sm font-medium mb-1.5">한 줄 소개 *</label>
              <textarea
                value={formData.description}
                onChange={(e) => update({ description: e.target.value })}
                placeholder="캐릭터에 대한 간단한 소개를 작성해주세요 (최소 10자)"
                maxLength={500}
                rows={2}
                className="input-base resize-none"
              />
              <p className="text-text-muted text-xs mt-1 text-right">{formData.description.length}/500</p>
            </div>

            {/* AI Concept for generation */}
            <div className="card p-4 border border-brand/20 bg-brand/5">
              <div className="flex items-center gap-2 mb-3">
                <Wand2 className="w-4 h-4 text-brand-light" />
                <span className="text-brand-light text-sm font-semibold">AI 캐릭터 자동 생성</span>
                <span className="text-xs text-text-muted">(선택)</span>
              </div>

              {/* Genre template shortcuts */}
              <div className="flex gap-1.5 flex-wrap mb-3">
                {GENRE_TEMPLATES.map((t) => (
                  <button key={t.label} type="button"
                    onClick={() => update({ concept: t.concept })}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface border border-border text-xs text-text-secondary hover:border-brand/40 hover:text-brand-light transition-all"
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              <textarea
                value={formData.concept}
                onChange={(e) => update({ concept: e.target.value })}
                placeholder="캐릭터 컨셉을 간략히 설명해주세요. 예: '차갑지만 속으로 따뜻한 재벌 2세'"
                rows={2}
                maxLength={300}
                className="input-base resize-none text-sm mb-3"
              />

              <button
                type="button"
                onClick={handleAIGenerate}
                disabled={isGenerating || !formData.name.trim() || !formData.concept.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                           bg-brand hover:bg-brand-hover text-white text-sm font-semibold
                           transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />AI가 캐릭터를 만드는 중...</>
                ) : (
                  <><Sparkles className="w-4 h-4" />AI로 자동 생성하기</>
                )}
              </button>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-text-secondary text-sm font-medium mb-1.5">
                태그 <span className="text-text-muted font-normal">({formData.tags.length}/10)</span>
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {formData.tags.map((tag) => (
                  <span key={tag}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand/15 text-brand-light text-xs">
                    {tag}
                    <button onClick={() => removeTag(tag)} className="hover:text-red-400 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                value={formData.tagInput}
                onChange={(e) => update({ tagInput: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(formData.tagInput); }
                }}
                onBlur={() => formData.tagInput && addTag(formData.tagInput)}
                placeholder="태그 입력 후 Enter (예: 판타지, 마법사)"
                className="input-base text-sm"
              />
            </div>
          </motion.div>
        )}

        {/* ═══════════ STEP 1: Personality ═══════════ */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-5"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-text-primary font-bold text-xl mb-0.5">성격 설정</h2>
                <p className="text-text-muted text-sm">캐릭터의 성격과 첫 인사말을 설정해주세요</p>
              </div>
              {formData.concept && (
                <button
                  type="button"
                  onClick={handleAIGenerate}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                             bg-brand/10 hover:bg-brand/20 text-brand-light text-xs font-medium
                             border border-brand/20 transition-all disabled:opacity-50"
                >
                  {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  재생성
                </button>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-text-secondary text-sm font-medium">시스템 프롬프트 *</label>
                <button type="button" onClick={() => setShowTip(!showTip)}
                  className="flex items-center gap-1 text-brand-light text-xs hover:underline">
                  <Info className="w-3.5 h-3.5" />
                  도움말
                </button>
              </div>

              <AnimatePresence>
                {showTip && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-3 p-3.5 rounded-xl bg-brand/10 border border-brand/20 overflow-hidden"
                  >
                    <p className="text-brand-light text-xs font-semibold mb-2">✨ 좋은 시스템 프롬프트 작성 팁</p>
                    <ul className="text-text-secondary text-xs space-y-1 list-disc list-inside">
                      <li>캐릭터의 이름, 나이, 직업, 성격을 구체적으로 설명하세요</li>
                      <li>말투 예시를 포함시키면 더 자연스러워요 (예: "~입니다체 사용")</li>
                      <li>캐릭터의 배경 스토리, 관심사, 버릇을 추가하세요</li>
                      <li>어떤 상황에 어떻게 반응할지 알려주면 일관성이 높아져요</li>
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>

              <textarea
                value={formData.systemPrompt}
                onChange={(e) => update({ systemPrompt: e.target.value })}
                placeholder={`당신은 ${formData.name || '[캐릭터 이름]'}입니다. [성격, 말투, 배경, 특징을 자세히 설명해주세요]...`}
                maxLength={10000}
                rows={9}
                className="input-base resize-none font-mono text-sm"
              />
              <div className="flex justify-between mt-1">
                <span className={cn('text-xs', formData.systemPrompt.length < 20 ? 'text-red-400' : 'text-text-muted')}>
                  최소 20자 필요
                </span>
                <span className="text-text-muted text-xs">{formData.systemPrompt.length.toLocaleString()}/10,000</span>
              </div>
            </div>

            <div>
              <label className="block text-text-secondary text-sm font-medium mb-1.5">첫 인사말 *</label>
              <textarea
                value={formData.greeting}
                onChange={(e) => update({ greeting: e.target.value })}
                placeholder="대화가 시작될 때 캐릭터가 처음으로 하는 말을 작성해주세요"
                maxLength={1000}
                rows={4}
                className="input-base resize-none"
              />
              <p className="text-text-muted text-xs mt-1 text-right">{formData.greeting.length}/1,000</p>
            </div>

            {/* Language */}
            <div>
              <label className="block text-text-secondary text-sm font-medium mb-2">언어</label>
              <div className="flex gap-2">
                {[
                  { value: 'ko', label: '한국어 🇰🇷' },
                  { value: 'en', label: 'English 🇺🇸' },
                  { value: 'ja', label: '日本語 🇯🇵' },
                ].map(({ value, label }) => (
                  <button key={value} type="button"
                    onClick={() => update({ language: value })}
                    className={cn(
                      'px-4 py-2 rounded-xl text-sm font-medium border transition-all',
                      formData.language === value
                        ? 'bg-brand/20 text-brand-light border-brand/40'
                        : 'bg-surface text-text-muted border-border hover:border-brand/30'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══════════ STEP 2: Settings ═══════════ */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-5"
          >
            <div>
              <h2 className="text-text-primary font-bold text-xl mb-0.5">공개 설정</h2>
              <p className="text-text-muted text-sm">공개 범위와 AI 모델을 선택해주세요</p>
            </div>

            {/* Visibility */}
            <div>
              <label className="block text-text-secondary text-sm font-medium mb-2">공개 범위</label>
              <div className="space-y-2">
                {[
                  { value: 'PUBLIC', icon: Globe, label: '전체 공개', desc: '탐색 페이지에 노출되고 누구나 대화할 수 있어요', badge: '수익 발생' },
                  { value: 'UNLISTED', icon: Link2, label: '링크 공유', desc: '링크가 있는 사람만 접근할 수 있어요', badge: null },
                  { value: 'PRIVATE', icon: Lock, label: '비공개', desc: '나만 볼 수 있어요', badge: null },
                ].map(({ value, icon: Icon, label, desc, badge }) => (
                  <button key={value} type="button"
                    onClick={() => update({ visibility: value as any })}
                    className={cn(
                      'w-full flex items-center gap-3 p-4 rounded-xl text-left border transition-all',
                      formData.visibility === value
                        ? 'bg-brand/10 border-brand/40'
                        : 'bg-surface border-border hover:border-brand/30'
                    )}
                  >
                    <div className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                      formData.visibility === value ? 'bg-brand/20' : 'bg-background-tertiary'
                    )}>
                      <Icon className={cn('w-4.5 h-4.5', formData.visibility === value ? 'text-brand-light' : 'text-text-muted')} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-text-primary text-sm font-semibold">{label}</p>
                        {badge && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                            {badge}
                          </span>
                        )}
                      </div>
                      <p className="text-text-muted text-xs mt-0.5">{desc}</p>
                    </div>
                    {formData.visibility === value && (
                      <CheckCircle2 className="w-5 h-5 text-brand-light flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* AI Model */}
            <div>
              <label className="block text-text-secondary text-sm font-medium mb-2">AI 모델</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    value: 'claude-haiku-3', label: 'Claude Haiku',
                    desc: '빠르고 경제적 · 무료 사용 가능',
                    badge: '기본', badgeColor: 'bg-brand/15 text-brand-light',
                    icon: Zap,
                  },
                  {
                    value: 'claude-sonnet-4', label: 'Claude Sonnet',
                    desc: '더 자연스럽고 창의적인 답변',
                    badge: 'PRO', badgeColor: 'bg-purple-500/15 text-purple-300',
                    icon: Crown,
                  },
                ].map(({ value, label, desc, badge, badgeColor, icon: Icon }) => (
                  <button key={value} type="button"
                    onClick={() => update({ model: value as any })}
                    className={cn(
                      'p-4 rounded-xl text-left border transition-all',
                      formData.model === value
                        ? 'bg-brand/10 border-brand/40'
                        : 'bg-surface border-border hover:border-brand/30'
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <Icon className={cn('w-5 h-5', formData.model === value ? 'text-brand-light' : 'text-text-muted')} />
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', badgeColor)}>{badge}</span>
                    </div>
                    <p className="text-text-primary font-semibold text-sm mb-1">{label}</p>
                    <p className="text-text-muted text-xs">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Temperature */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-text-secondary text-sm font-medium">응답 창의성</label>
                <span className="text-brand-light text-sm font-bold">{formData.temperature}</span>
              </div>
              <input
                type="range" min="0" max="1" step="0.1"
                value={formData.temperature}
                onChange={(e) => update({ temperature: parseFloat(e.target.value) })}
                className="w-full accent-brand h-2 rounded-full cursor-pointer"
              />
              <div className="flex justify-between text-xs text-text-muted mt-1">
                <span>일관성 (0.0)</span>
                <span>창의성 (1.0)</span>
              </div>
            </div>

            {/* Age Rating */}
            <div>
              <label className="block text-text-secondary text-sm font-medium mb-2">연령 등급</label>
              <div className="flex gap-2">
                {[
                  { value: 'ALL', label: '전체 이용가', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
                  { value: 'TEEN', label: '청소년 이용가', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
                  { value: 'MATURE', label: '성인', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
                ].map(({ value, label, color }) => (
                  <button key={value} type="button"
                    onClick={() => update({ ageRating: value as any })}
                    className={cn(
                      'flex-1 py-2 rounded-xl text-xs font-medium border transition-all',
                      formData.ageRating === value ? color : 'bg-surface text-text-muted border-border hover:border-brand/30'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview card */}
            <div className="card p-4 border border-border/60">
              <p className="text-text-muted text-xs font-medium mb-3 flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5" /> 미리보기
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-surface">
                  {previewImage ? (
                    <Image src={previewImage} alt="preview" width={48} height={48} className="object-cover w-full h-full" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl">
                      {CATEGORY_ICONS[formData.category]}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-text-primary font-semibold text-sm">{formData.name || '캐릭터 이름'}</p>
                  <p className="text-text-muted text-xs truncate">{formData.description || '한 줄 소개'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-surface text-text-muted border border-border">
                      {CATEGORY_ICONS[formData.category]} {CATEGORY_LABELS[formData.category]}
                    </span>
                    <span className="flex items-center gap-0.5 text-text-muted text-xs">
                      <MessageSquare className="w-3 h-3" /> 0
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── NAVIGATION ── */}
      <div className="flex items-center justify-between mt-8 pt-5 border-t border-border">
        <button
          type="button"
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className="btn-secondary disabled:opacity-0 disabled:pointer-events-none"
        >
          이전
        </button>

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep(step + 1)}
            disabled={step === 0 ? !canStep0 : !canStep1}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            다음 <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit || createMutation.isPending}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createMutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" />생성 중...</>
            ) : (
              <><Sparkles className="w-4 h-4" />캐릭터 생성하기</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
