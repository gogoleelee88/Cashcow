'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  Upload, Zap, AlertCircle, CheckCircle2, Loader2,
  Image as ImageIcon, Type, Lock, Globe, Link, Info,
  ChevronDown, ChevronUp, Sparkles
} from 'lucide-react';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import { CATEGORY_LABELS } from '@characterverse/utils';
import type { CharacterCategory } from '@characterverse/types';
import { toast } from '../ui/toaster';

const STEPS = ['기본 정보', '성격 설정', '고급 설정', '완료'];

export function CharacterCreateForm() {
  const [step, setStep] = useState(0);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [showSystemPromptHelp, setShowSystemPromptHelp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    systemPrompt: '',
    greeting: '',
    category: 'ORIGINAL' as CharacterCategory,
    tags: '',
    visibility: 'PUBLIC' as 'PUBLIC' | 'PRIVATE' | 'UNLISTED',
    ageRating: 'ALL' as 'ALL' | 'TEEN' | 'MATURE',
    language: 'ko',
    model: 'claude-haiku-3' as 'claude-haiku-3' | 'claude-sonnet-4',
    temperature: 0.8,
    maxTokens: 1024,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.characters.create({
        ...formData,
        tags: formData.tags.split(',').map((t) => t.trim()).filter(Boolean),
        avatarUrl: imageKey ? undefined : null,
        avatarKey: imageKey,
      }),
    onSuccess: (res) => {
      toast.success('캐릭터가 생성되었습니다!', '이제 캐릭터와 대화해보세요');
      router.push(`/characters/${res.data.id}`);
    },
    onError: (err: any) => {
      toast.error('오류 발생', err.response?.data?.error?.message || '캐릭터 생성에 실패했습니다.');
    },
  });

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('이미지 파일만 업로드 가능합니다');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('파일 크기는 5MB 이하여야 합니다');
      return;
    }

    setIsUploadingImage(true);
    const preview = URL.createObjectURL(file);
    setPreviewImage(preview);

    try {
      const res = await api.characters.getUploadUrl(file.type, 'avatar');
      const { uploadUrl, key, publicUrl } = res.data;

      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      setImageKey(key);
      setPreviewImage(publicUrl);
      toast.success('이미지가 업로드되었습니다');
    } catch (err) {
      toast.error('이미지 업로드에 실패했습니다');
      setPreviewImage(null);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const canProceedStep0 = formData.name.trim().length >= 1 && formData.description.trim().length >= 10;
  const canProceedStep1 = formData.systemPrompt.trim().length >= 20 && formData.greeting.trim().length >= 1;
  const canSubmit = canProceedStep0 && canProceedStep1;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Progress steps */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((stepLabel, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-all',
              i < step ? 'bg-brand text-white' :
                i === step ? 'bg-brand/20 text-brand-light ring-2 ring-brand/40' :
                  'bg-surface-DEFAULT text-text-muted'
            )}>
              {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
            </div>
            <span className={cn('text-xs font-medium hidden sm:block', i === step ? 'text-text-primary' : 'text-text-muted')}>
              {stepLabel}
            </span>
            {i < STEPS.length - 1 && (
              <div className={cn('flex-1 h-0.5 rounded', i < step ? 'bg-brand' : 'bg-border')} />
            )}
          </div>
        ))}
      </div>

      {/* STEP 0: Basic info */}
      {step === 0 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
          <div>
            <h2 className="text-text-primary font-bold text-xl mb-1">기본 정보</h2>
            <p className="text-text-muted text-sm">캐릭터의 이름, 설명, 이미지를 설정해주세요</p>
          </div>

          {/* Image upload */}
          <div>
            <label className="block text-text-secondary text-sm font-medium mb-2">캐릭터 이미지</label>
            <div
              className={cn(
                'relative w-32 h-32 rounded-2xl overflow-hidden cursor-pointer',
                'border-2 border-dashed border-border hover:border-brand/50',
                'bg-surface-DEFAULT flex items-center justify-center',
                'transition-all duration-200 group'
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              {previewImage ? (
                <>
                  <Image src={previewImage} alt="Preview" fill className="object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                    <ImageIcon className="w-6 h-6 text-white" />
                  </div>
                </>
              ) : (
                <div className="text-center">
                  {isUploadingImage ? (
                    <Loader2 className="w-6 h-6 animate-spin text-brand mx-auto" />
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-text-muted mx-auto mb-1.5" />
                      <span className="text-text-muted text-xs">이미지 추가</span>
                    </>
                  )}
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
            />
          </div>

          <div>
            <label className="block text-text-secondary text-sm font-medium mb-1.5">캐릭터 이름 *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="홍길동, 엘사, 나루토..."
              maxLength={50}
              className="input-base"
            />
            <p className="text-text-muted text-xs mt-1 text-right">{formData.name.length}/50</p>
          </div>

          <div>
            <label className="block text-text-secondary text-sm font-medium mb-1.5">한 줄 소개 *</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="캐릭터에 대한 간단한 소개를 작성해주세요"
              maxLength={500}
              rows={3}
              className="input-base resize-none"
            />
            <p className="text-text-muted text-xs mt-1 text-right">{formData.description.length}/500</p>
          </div>

          <div>
            <label className="block text-text-secondary text-sm font-medium mb-1.5">카테고리</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(CATEGORY_LABELS) as CharacterCategory[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFormData({ ...formData, category: cat })}
                  className={cn(
                    'py-2 px-3 rounded-xl text-sm font-medium transition-all',
                    formData.category === cat
                      ? 'bg-brand/20 text-brand-light border border-brand/40'
                      : 'bg-surface-DEFAULT text-text-muted border border-border hover:border-brand/30'
                  )}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-text-secondary text-sm font-medium mb-1.5">태그 (쉼표로 구분)</label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="판타지, 마법사, 친근함..."
              className="input-base"
            />
          </div>
        </motion.div>
      )}

      {/* STEP 1: Personality */}
      {step === 1 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
          <div>
            <h2 className="text-text-primary font-bold text-xl mb-1">성격 설정</h2>
            <p className="text-text-muted text-sm">캐릭터의 성격과 첫 인사말을 설정해주세요</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-text-secondary text-sm font-medium">시스템 프롬프트 *</label>
              <button
                type="button"
                onClick={() => setShowSystemPromptHelp(!showSystemPromptHelp)}
                className="flex items-center gap-1 text-brand-light text-xs hover:underline"
              >
                <Info className="w-3.5 h-3.5" />
                작성 도움말
              </button>
            </div>
            {showSystemPromptHelp && (
              <div className="mb-3 p-3 rounded-xl bg-brand/10 border border-brand/20 text-text-secondary text-xs leading-relaxed">
                <p className="font-semibold text-brand-light mb-1">✨ 좋은 시스템 프롬프트 작성 팁</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>캐릭터의 성격, 말투, 배경을 구체적으로 설명하세요</li>
                  <li>예: "당신은 용감한 기사입니다. 존댓말을 사용하며 명예를 중시합니다."</li>
                  <li>어떤 상황에서 어떻게 반응할지 적어주면 더 자연스러워요</li>
                  <li>캐릭터가 잘 알고 있는 지식이나 관심사를 적어주세요</li>
                </ul>
              </div>
            )}
            <textarea
              value={formData.systemPrompt}
              onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
              placeholder="당신은 [캐릭터 이름]입니다. [성격, 말투, 배경, 특징을 자세히 설명해주세요]..."
              maxLength={10000}
              rows={8}
              className="input-base resize-none font-mono text-sm"
            />
            <p className="text-text-muted text-xs mt-1 text-right">{formData.systemPrompt.length}/10,000</p>
          </div>

          <div>
            <label className="block text-text-secondary text-sm font-medium mb-1.5">첫 인사말 *</label>
            <textarea
              value={formData.greeting}
              onChange={(e) => setFormData({ ...formData, greeting: e.target.value })}
              placeholder="대화가 시작될 때 캐릭터가 처음으로 하는 말을 작성해주세요"
              maxLength={1000}
              rows={3}
              className="input-base resize-none"
            />
          </div>
        </motion.div>
      )}

      {/* STEP 2: Advanced */}
      {step === 2 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
          <div>
            <h2 className="text-text-primary font-bold text-xl mb-1">고급 설정</h2>
            <p className="text-text-muted text-sm">공개 범위와 AI 모델을 설정해주세요</p>
          </div>

          <div>
            <label className="block text-text-secondary text-sm font-medium mb-2">공개 범위</label>
            <div className="space-y-2">
              {[
                { value: 'PUBLIC', icon: Globe, label: '공개', desc: '모든 사용자가 볼 수 있어요' },
                { value: 'UNLISTED', icon: Link, label: '링크 공유', desc: '링크가 있는 사람만 접근할 수 있어요' },
                { value: 'PRIVATE', icon: Lock, label: '비공개', desc: '나만 볼 수 있어요' },
              ].map(({ value, icon: Icon, label, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFormData({ ...formData, visibility: value as any })}
                  className={cn(
                    'w-full flex items-center gap-3 p-3.5 rounded-xl text-left transition-all border',
                    formData.visibility === value
                      ? 'bg-brand/15 border-brand/40 text-text-primary'
                      : 'bg-surface-DEFAULT border-border hover:border-brand/30 text-text-secondary'
                  )}
                >
                  <Icon className="w-4.5 h-4.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-text-muted">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-text-secondary text-sm font-medium mb-2">AI 모델</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'claude-haiku-3', label: 'Haiku', desc: '빠르고 경제적 (무료 사용 가능)', badge: '기본', badgeColor: 'bg-brand/15 text-brand-light' },
                { value: 'claude-sonnet-4', label: 'Sonnet', desc: '더 자연스럽고 창의적인 응답', badge: 'PRO', badgeColor: 'bg-purple-500/15 text-purple-300' },
              ].map(({ value, label, desc, badge, badgeColor }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFormData({ ...formData, model: value as any })}
                  className={cn(
                    'p-4 rounded-xl text-left border transition-all',
                    formData.model === value
                      ? 'bg-brand/15 border-brand/40'
                      : 'bg-surface-DEFAULT border-border hover:border-brand/30'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-text-primary font-semibold text-sm">{label}</span>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', badgeColor)}>{badge}</span>
                  </div>
                  <p className="text-text-muted text-xs">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-text-secondary text-sm font-medium mb-2">
              응답 창의성 <span className="text-text-muted font-normal">(Temperature: {formData.temperature})</span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={formData.temperature}
              onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
              className="w-full accent-brand"
            />
            <div className="flex justify-between text-xs text-text-muted mt-1">
              <span>일관성</span>
              <span>창의성</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
        <button
          type="button"
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className="btn-secondary disabled:opacity-0 disabled:pointer-events-none"
        >
          이전
        </button>

        {step < 2 ? (
          <button
            type="button"
            onClick={() => setStep(step + 1)}
            disabled={step === 0 ? !canProceedStep0 : !canProceedStep1}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            다음
          </button>
        ) : (
          <button
            type="button"
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit || createMutation.isPending}
            className="btn-primary flex items-center gap-2"
          >
            {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            <Sparkles className="w-4 h-4" />
            캐릭터 생성
          </button>
        )}
      </div>
    </div>
  );
}
