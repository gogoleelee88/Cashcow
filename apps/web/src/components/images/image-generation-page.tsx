'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '../../lib/utils';
import { MainLayout } from '../layout/main-layout';
import { useAuthStore } from '../../stores/auth.store';
import { api } from '../../lib/api';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Sparkles, ChevronLeft, ChevronRight, Plus, SlidersHorizontal, AlertCircle, Download, Heart } from 'lucide-react';
import { ImageTransformTab } from './image-transform-tab';
import { ImageLibraryTab } from './image-library-tab';

// ── 상수 ────────────────────────────────────────────────────────────────────
const IMAGE_GEN_COST = 190;

const STYLES = [
  { name: '청초',   img: '/styles/청초.jpg' },
  { name: '순정',   img: '/styles/순정.jpg' },
  { name: '키치',   img: '/styles/키치.jpg' },
  { name: '로판',   img: '/styles/로판.jpg' },
  { name: '모에',   img: '/styles/모에.jpg' },
  { name: '액션',   img: '/styles/액션.jpg' },
  { name: '모던',   img: '/styles/모던.jpg' },
  { name: '와일드', img: '/styles/와일드.jpg' },
  { name: '남사친', img: '/styles/남사친.jpg' },
  { name: '육아물', img: '/styles/육아물.jpg' },
  { name: '집착',   img: '/styles/집착.jpg' },
];

const RATIOS: { label: string; w: number; h: number }[] = [
  { label: '2:3',  w: 2,  h: 3  },
  { label: '1:1',  w: 1,  h: 1  },
  { label: '4:3',  w: 4,  h: 3  },
  { label: '3:4',  w: 3,  h: 4  },
  { label: '16:9', w: 16, h: 9  },
  { label: '9:16', w: 9,  h: 16 },
];

const TABS = ['라이브러리', '좋아요', '신규 생성', '포토카드 변형'];

const CRACKER_PACKAGES = [
  { id: 'p1', amount: 2000,  bonus: 0,     price: 2000,  recommended: false },
  { id: 'p2', amount: 4900,  bonus: 100,   price: 4900,  recommended: false },
  { id: 'p3', amount: 9600,  bonus: 400,   price: 9600,  recommended: false },
  { id: 'p4', amount: 28000, bonus: 2000,  price: 28000, recommended: true  },
  { id: 'p5', amount: 46000, bonus: 4000,  price: 46000, recommended: false },
  { id: 'p6', amount: 90000, bonus: 10000, price: 90000, recommended: false },
];
const PAYMENT_METHODS = [
  { id: 'toss',    label: 'tosspay',     badge: '[혜택] 생애 첫 결제 1만 포인트 적립!' },
  { id: 'card',    label: '신용/체크카드', badge: null },
  { id: 'account', label: '계좌 이체',    badge: null },
  { id: 'phone',   label: '휴대폰 결제',  badge: null },
  { id: 'culture', label: '문화상품권',   badge: null },
];

// ── 결제 모달 ────────────────────────────────────────────────────────────────
function CrackerPaymentModal({ onClose }: { onClose: () => void }) {
  const [selectedPkg, setSelectedPkg] = useState('p4');
  const [selectedMethod, setSelectedMethod] = useState('toss');
  const pkg = CRACKER_PACKAGES.find(p => p.id === selectedPkg)!;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }} transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="text-gray-900 font-bold text-base">단짠초코감자칩 충전하기</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          {/* Banner */}
          <button className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 mb-5 hover:bg-amber-100 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎫</span>
              <span className="text-amber-700 font-semibold text-sm">더 많은 단짠초코감자칩 혜택, 자동 구매 바로가기!</span>
            </div>
            <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* 상품구성 */}
          <p className="text-gray-900 font-bold text-sm mb-3">상품구성</p>
          <div className="space-y-2 mb-5">
            {CRACKER_PACKAGES.map(p => (
              <button key={p.id} onClick={() => setSelectedPkg(p.id)}
                className={cn('w-full flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all',
                  selectedPkg === p.id ? 'border-brand bg-brand/5' : 'border-gray-200 hover:border-gray-300')}>
                <div className="flex items-center gap-3">
                  <div className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                    selectedPkg === p.id ? 'border-brand' : 'border-gray-300')}>
                    {selectedPkg === p.id && <div className="w-2 h-2 rounded-full bg-brand" />}
                  </div>
                  <span className="text-lg">🎫</span>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      {p.recommended && (
                        <span className="px-1.5 py-0.5 rounded-md bg-brand text-white text-[10px] font-bold">추천</span>
                      )}
                      <span className="text-gray-800 font-semibold text-sm">{p.amount.toLocaleString()}개</span>
                      {p.bonus > 0 && (
                        <span className="text-brand text-xs font-medium">+{p.bonus.toLocaleString()}개</span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-brand font-bold text-sm">{p.price.toLocaleString()}원</span>
              </button>
            ))}
          </div>

          {/* 결제수단 */}
          <p className="text-gray-900 font-bold text-sm mb-3">결제수단</p>
          <div className="space-y-1 mb-5">
            {PAYMENT_METHODS.map(m => (
              <button key={m.id} onClick={() => setSelectedMethod(m.id)}
                className={cn('w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all',
                  selectedMethod === m.id ? 'border-brand bg-brand/5' : 'border-transparent hover:bg-gray-50')}>
                <div className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                  selectedMethod === m.id ? 'border-brand' : 'border-gray-300')}>
                  {selectedMethod === m.id && <div className="w-2 h-2 rounded-full bg-brand" />}
                </div>
                <div className="text-left">
                  <p className="text-gray-700 font-medium text-sm">{m.label}</p>
                  {m.badge && <p className="text-brand text-xs mt-0.5">{m.badge}</p>}
                </div>
              </button>
            ))}
          </div>

          {/* 환불정책 */}
          <div className="mb-5 text-xs text-gray-400 leading-relaxed space-y-1">
            <p className="font-semibold text-gray-500 mb-1.5">완불 정책 및 단짠초코감자칩 이용 안내</p>
            {[
              '모든 결제 상품은 결제일로부터 7일 이내 완불을 요청할 수 있습니다.',
              '7일 이내라도 구매한 단짠초코감자칩 목록을 사용한 이력이 있다면 완불이 불가합니다.',
              '사용 이력이 있을 경우, 남은 단짠초코감자칩에 대한 완불은 불가합니다.',
              '주관적인 AI 생성의 불만족으로 인한 완불은 불가합니다.',
              '무료로 구매한 단짠초코감자칩의 유효기간은 취득 시점으로부터 5년입니다.',
            ].map((text, i) => <p key={i}>• {text}</p>)}
          </div>

          <button onClick={onClose}
            className="w-full py-4 rounded-2xl bg-brand text-white font-bold text-base hover:brightness-110 transition-all">
            결제하기
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── 메인 페이지 컴포넌트 ────────────────────────────────────────────────────
export function ImageGenerationPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const credits = user?.creditBalance ?? 0;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  const [activeTab, setActiveTab] = useState('신규 생성');
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('청초');
  const [ratio, setRatio] = useState('2:3');
  const [count, setCount] = useState(2);
  const [generating, setGenerating] = useState(false);
  const [helperLoading, setHelperLoading] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [styleIndex, setStyleIndex] = useState(0);
  const VISIBLE_STYLES = 5;
  // ── 생성 결과 ────────────────────────────────────────────────────────────────
  type GenStatus = 'generating' | 'processing' | 'completed' | 'failed';
  const [genResult, setGenResult] = useState<{
    status: GenStatus; urls: string[]; imageId?: string; error?: string; isLiked: boolean;
  } | null>(null);
  const [genError, setGenError]     = useState('');
  const [libRefreshKey, setLibRefreshKey] = useState(0);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current); }, []);

  const [attachedImages, setAttachedImages] = useState<{ url: string; file: File }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedFields, setAdvancedFields] = useState({
    subject: '', composition: '', pose: '', environment: '',
    lighting: '', camera: '', style: '', negative: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ADVANCED_DEFS = [
    { key: 'subject',     label: '주제 (Subject)',           placeholder: '무엇을 그릴지 (예: 20대 여성, 옆을 바라보는)' },
    { key: 'composition', label: '구도·구성 (Composition)',   placeholder: '화면 배치 (예: 상반신 클로즈업, 중앙 정렬)' },
    { key: 'pose',        label: '자세·동작 (Pose)',          placeholder: '캐릭터 자세 (예: 미소 짓는, 머리 쓸어 넘기는)' },
    { key: 'environment', label: '장소·배경 (Environment)',   placeholder: '배경 (예: 벚꽃 공원, 도시 야경)' },
    { key: 'lighting',    label: '조명 (Lighting)',           placeholder: '빛 (예: 황금빛 역광, 부드러운 자연광)' },
    { key: 'camera',      label: '카메라·렌즈 (Camera)',      placeholder: '촬영 느낌 (예: f1.8 얕은 심도, 35mm 렌즈)' },
    { key: 'style',       label: '스타일 (Style)',            placeholder: '미적 방향 (예: 수채화풍, 일러스트, 실사)' },
    { key: 'negative',    label: '금지 (Negative Prompt)',    placeholder: '제외 요소 (예: 텍스트, 워터마크, 손가락 이상)' },
  ] as const;

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    const newImgs = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .map(file => ({ url: URL.createObjectURL(file), file }));
    setAttachedImages(prev => [...prev, ...newImgs].slice(0, 4));
  };

  const removeAttached = (idx: number) => {
    setAttachedImages(prev => {
      const next = [...prev];
      URL.revokeObjectURL(next[idx].url);
      next.splice(idx, 1);
      return next;
    });
  };

  const applyAdvancedToPrompt = () => {
    const positive = (['subject', 'composition', 'pose', 'environment', 'lighting', 'camera', 'style'] as const)
      .map(k => advancedFields[k]).filter(Boolean).join(', ');
    const parts: string[] = [];
    if (positive) parts.push(positive);
    if (advancedFields.negative) parts.push(`[부정: ${advancedFields.negative}]`);
    if (!parts.length) return;
    const compiled = parts.join('\n');
    setPrompt(prev => prev ? `${prev}\n${compiled}` : compiled);
  };

  const cost = count * IMAGE_GEN_COST;

  const handleGenerate = async () => {
    if (credits < cost) { setPaymentOpen(true); return; }
    if (!prompt.trim()) { setGenError('프롬프트를 입력해 주세요.'); return; }

    setGenError('');
    setGenerating(true);
    setGenResult({ status: 'generating', urls: [], isLiked: false });
    if (pollRef.current) clearTimeout(pollRef.current);

    try {
      const res = await api.images.generate({ prompt: prompt.trim(), style: selectedStyle, ratio, count });
      const { imageId } = res.data;
      setGenResult(prev => prev ? { ...prev, imageId } : null);

      const poll = async () => {
        try {
          const job = await api.images.pollJob(imageId);
          const { status, urls, errorMsg } = job.data;
          if (status === 'COMPLETED') {
            setGenResult({ status: 'completed', urls, imageId, isLiked: false });
            setGenerating(false);
            setLibRefreshKey(k => k + 1);
          } else if (status === 'FAILED') {
            setGenResult({ status: 'failed', urls: [], imageId, error: errorMsg ?? '생성에 실패했습니다.', isLiked: false });
            setGenerating(false);
          } else {
            setGenResult(prev => prev ? { ...prev, status: 'processing' } : null);
            pollRef.current = setTimeout(poll, 2500);
          }
        } catch {
          pollRef.current = setTimeout(poll, 3500);
        }
      };
      pollRef.current = setTimeout(poll, 2500);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? '생성에 실패했습니다.';
      setGenResult({ status: 'failed', urls: [], error: msg, isLiked: false });
      setGenerating(false);
    }
  };

  const handleDownloadResult = async (url: string) => {
    try {
      const r = await fetch(url, { mode: 'cors' });
      const blob = await r.blob();
      const obj = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = obj; a.download = `photocard-${Date.now()}.png`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(obj);
    } catch { window.open(url, '_blank'); }
  };

  const handleLikeResult = async () => {
    if (!genResult?.imageId) return;
    const prev = genResult.isLiked;
    setGenResult(r => r ? { ...r, isLiked: !r.isLiked } : null);
    try { await api.images.toggleLike(genResult.imageId); }
    catch { setGenResult(r => r ? { ...r, isLiked: prev } : null); }
  };

  const handlePromptHelper = async () => {
    setHelperLoading(true);
    try {
      const res = await api.images.promptHelper({ style: selectedStyle, userInput: prompt || undefined });
      setPrompt(res.data.prompt);
    } catch {
      // silent fail
    } finally {
      setHelperLoading(false);
    }
  };

  return (
    <MainLayout showSearch={true}>
      {/* 전체 레이아웃 */}
      <div className="flex h-[calc(100vh-60px)] overflow-hidden">

        {/* ── 왼쪽 사이드바 (lg 이상) ── */}
        <aside className="hidden lg:flex w-52 flex-shrink-0 border-r border-gray-100 flex-col bg-white">
          <nav className="flex flex-col pt-4 flex-1">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'w-full text-left px-5 py-3 text-sm font-medium transition-colors border-l-2',
                  activeTab === tab
                    ? 'text-gray-900 font-bold bg-gray-50 border-gray-900'
                    : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50 border-transparent'
                )}
              >
                {tab}
              </button>
            ))}
          </nav>
          <div className="px-4 pb-5 pt-3 border-t border-gray-100">
            <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-3">
              <p className="text-[11px] text-gray-400 mb-0.5">보유 단짠초코감자칩</p>
              <p className="text-base font-bold text-gray-800">{credits.toLocaleString()}<span className="text-xs font-normal text-gray-500 ml-0.5">개</span></p>
              <button
                onClick={() => setPaymentOpen(true)}
                className="mt-2 w-full py-1.5 rounded-lg bg-brand text-white text-xs font-bold hover:brightness-110 transition-all"
              >
                충전하기
              </button>
            </div>
          </div>
        </aside>

        {/* ── 오른쪽 영역 (탭 + 콘텐츠) ── */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

          {/* 모바일 상단 탭 바 (lg 미만) */}
          <div className="lg:hidden flex-shrink-0 border-b border-gray-100 bg-white">
            <div className="flex overflow-x-auto scrollbar-hide px-2">
              {TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors relative whitespace-nowrap',
                    activeTab === tab ? 'text-gray-900 font-bold' : 'text-gray-400 hover:text-gray-700'
                  )}
                >
                  {tab}
                  {activeTab === tab && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900 rounded-t-full" />
                  )}
                </button>
              ))}
            </div>
            {/* 모바일 단짠초코감자칩 */}
            <div className="flex items-center gap-2 px-4 py-2 border-t border-gray-100 bg-gray-50/50">
              <span className="text-xs text-gray-400">보유 단짠초코감자칩</span>
              <span className="text-xs font-bold text-gray-800">{credits.toLocaleString()}개</span>
              <button
                onClick={() => setPaymentOpen(true)}
                className="ml-auto px-3 py-1 rounded-lg bg-brand text-white text-[11px] font-bold hover:brightness-110 transition-all"
              >
                충전하기
              </button>
            </div>
          </div>

          {/* ── 메인 콘텐츠 ── */}
          <main className="flex-1 min-w-0 overflow-y-auto px-4 lg:px-8 py-8">

          {activeTab === '신규 생성' ? (
            <div className="max-w-2xl mx-auto space-y-6">
              {/* 이미지 스타일 — 버튼 캐러셀 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-brand text-sm font-bold">✦</span>
                    <h2 className="text-gray-900 font-bold text-base">포토카드 스타일</h2>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setStyleIndex(i => Math.max(0, i - 1))}
                      disabled={styleIndex === 0}
                      className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setStyleIndex(i => Math.min(STYLES.length - VISIBLE_STYLES, i + 1))}
                      disabled={styleIndex >= STYLES.length - VISIBLE_STYLES}
                      className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex gap-2 h-44">
                  {STYLES.slice(styleIndex, styleIndex + VISIBLE_STYLES).map(style => (
                    <button
                      key={style.name}
                      onClick={() => setSelectedStyle(style.name)}
                      className={cn(
                        'relative flex-1 rounded-2xl overflow-hidden border-2 transition-all hover:scale-[1.02]',
                        selectedStyle === style.name
                          ? 'border-brand shadow-[0_0_0_2px_rgba(230,51,37,0.3)]'
                          : 'border-transparent'
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={style.img} alt={style.name} className="w-full h-full object-cover" />
                      {selectedStyle === style.name && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand flex items-center justify-center shadow-md">
                          <svg width="8" height="7" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 py-1.5 bg-gradient-to-t from-black/70 to-transparent">
                        <span className="text-white text-xs font-semibold drop-shadow">{style.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 이미지 비율 */}
              <div>
                <p className="text-gray-800 font-bold text-sm mb-3">
                  포토카드 비율<span className="text-brand">*</span>
                </p>
                <div className="flex gap-2 justify-between">
                  {RATIOS.map(r => (
                    <button
                      key={r.label}
                      onClick={() => setRatio(r.label)}
                      className={cn(
                        'flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-all',
                        ratio === r.label
                          ? 'border-[#E8A020] bg-[#FFF8EC] text-[#E8A020]'
                          : 'border-gray-200 text-gray-400 hover:border-gray-300'
                      )}
                    >
                      <div
                        className={cn('border-2 rounded-sm', ratio === r.label ? 'border-[#E8A020]' : 'border-gray-300')}
                        style={{ width: r.w <= r.h ? 14 : 20, height: r.h <= r.w ? 14 : 20 }}
                      />
                      <span>{r.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 이미지 개수 */}
              <div>
                <p className="text-gray-800 font-bold text-sm mb-1">
                  포토카드 개수<span className="text-brand">*</span>
                </p>
                <p className="text-gray-400 text-xs mb-3">포토카드 개수 설정에 맞게 단짠초코감자칩가 소비돼요</p>
                <div className="flex gap-2 justify-between">
                  {[1, 2, 3, 4].map(n => (
                    <button
                      key={n}
                      onClick={() => setCount(n)}
                      className={cn(
                        'flex-1 py-2 rounded-xl border text-sm font-semibold transition-all',
                        count === n
                          ? 'border-[#E8A020] bg-[#FFF8EC] text-[#E8A020]'
                          : 'border-gray-200 text-gray-400 hover:border-gray-300'
                      )}
                    >
                      {n}개
                    </button>
                  ))}
                </div>
              </div>

              {/* 프롬프트 */}
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => { handleFileSelect(e.target.files); e.target.value = ''; }}
                />
                <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                  {/* 첨부 이미지 미리보기 */}
                  {attachedImages.length > 0 && (
                    <div className="flex gap-2 px-4 pt-3 flex-wrap">
                      {attachedImages.map((img, i) => (
                        <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-200 flex-shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.url} alt="" className="w-full h-full object-cover" />
                          <button
                            onClick={() => removeAttached(i)}
                            className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 rounded-full flex items-center justify-center hover:bg-black/80 transition-colors"
                          >
                            <X className="w-2.5 h-2.5 text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* 드래그앤드롭 영역 */}
                  <div
                    className={cn('relative transition-colors', isDragging && 'bg-brand/5')}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={e => { e.preventDefault(); setIsDragging(false); handleFileSelect(e.dataTransfer.files); }}
                  >
                    <textarea
                      value={prompt}
                      onChange={e => setPrompt(e.target.value.slice(0, 1000))}
                      placeholder={`만들고 싶은 포토카드를 차례대로 설명해 보세요\n(성별, 포즈, 얼굴, 표정, 자세, 구도, 의상, 배경, 그 외)`}
                      rows={5}
                      className="w-full px-5 py-4 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none resize-none bg-transparent"
                    />
                    {isDragging && (
                      <div className="absolute inset-0 flex items-center justify-center m-2 rounded-xl border-2 border-dashed border-brand/50 bg-brand/5 pointer-events-none">
                        <p className="text-brand text-sm font-semibold">이미지를 여기에 놓으세요</p>
                      </div>
                    )}
                  </div>
                  {/* 하단 바 */}
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        title="이미지 첨부"
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <span className="text-gray-300 text-xs">{prompt.length}/1000</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handlePromptHelper}
                        disabled={helperLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-200 text-purple-600 text-xs font-medium hover:bg-purple-50 transition-colors disabled:opacity-50"
                      >
                        <Sparkles className="w-3 h-3" />
                        {helperLoading ? 'AI 생성 중...' : '프롬프트 헬퍼'}
                      </button>
                      <button
                        onClick={() => setShowAdvanced(v => !v)}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                          showAdvanced
                            ? 'border-blue-300 bg-blue-50 text-blue-600'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        )}
                      >
                        <SlidersHorizontal className="w-3 h-3" />
                        고급상세
                      </button>
                      <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-60"
                      >
                        <span>🔑</span>
                        {generating ? '생성 중...' : `포토카드 생성 ${cost}`}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 프롬프트 에러 */}
                {genError && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-brand px-1">
                    {genError}
                  </motion.p>
                )}

                {/* 고급상세 패널 */}
                {showAdvanced && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-blue-100 bg-blue-50/40 p-5"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-gray-800">고급 상세 설정</h3>
                      <button
                        onClick={applyAdvancedToPrompt}
                        className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-semibold hover:bg-blue-600 transition-colors"
                      >
                        프롬프트에 적용
                      </button>
                    </div>
                    <div className="space-y-3">
                      {ADVANCED_DEFS.map(({ key, label, placeholder }) => (
                        <div key={key}>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                          <input
                            type="text"
                            value={advancedFields[key]}
                            onChange={e => setAdvancedFields(prev => ({ ...prev, [key]: e.target.value }))}
                            placeholder={placeholder}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs text-gray-800 placeholder:text-gray-300 focus:outline-none focus:border-blue-300 transition-colors"
                          />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* ── 생성 결과 패널 ── */}
              <AnimatePresence>
                {genResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="rounded-2xl border border-gray-200 bg-white overflow-hidden"
                  >
                    {(genResult.status === 'generating' || genResult.status === 'processing') && (
                      <div className="p-8 flex flex-col items-center gap-5">
                        {/* 스피너 */}
                        <div className="relative w-14 h-14">
                          <div className="absolute inset-0 rounded-full border-[3px] border-gray-100" />
                          <div className="absolute inset-0 rounded-full border-[3px] border-t-brand animate-spin" />
                          <div className="absolute inset-0 flex items-center justify-center text-lg">✦</div>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-800 font-bold text-sm">
                            {genResult.status === 'generating' ? 'AI가 포토카드를 그리고 있어요' : '이미지를 정교하게 다듬는 중이에요'}
                          </p>
                          <p className="text-gray-400 text-xs mt-1">보통 30초 ~ 1분 정도 걸려요</p>
                        </div>
                        {/* 스켈레톤 그리드 */}
                        <div className={cn('w-full grid gap-3', count <= 1 ? 'grid-cols-1' : 'grid-cols-2')}>
                          {Array.from({ length: count }).map((_, i) => (
                            <div
                              key={i}
                              className="w-full rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 animate-pulse"
                              style={{ aspectRatio: ratio.replace(':', '/'), minHeight: 100 }}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {genResult.status === 'failed' && (
                      <div className="p-8 flex flex-col items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                          <AlertCircle className="w-6 h-6 text-brand" />
                        </div>
                        <div className="text-center">
                          <p className="text-gray-800 font-bold text-sm">생성에 실패했어요</p>
                          <p className="text-gray-500 text-xs mt-1">{genResult.error}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setGenResult(null)}
                            className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                          >닫기</button>
                          <button
                            onClick={handleGenerate}
                            className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition-colors"
                          >다시 시도</button>
                        </div>
                      </div>
                    )}

                    {genResult.status === 'completed' && genResult.urls.length > 0 && (
                      <div className="p-5">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <span className="text-base">✨</span>
                            <span className="text-gray-800 font-bold text-sm">생성 완료!</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={handleLikeResult}
                              className={cn(
                                'w-8 h-8 rounded-full flex items-center justify-center border transition-all',
                                genResult.isLiked
                                  ? 'bg-brand border-brand text-white'
                                  : 'border-gray-200 text-gray-400 hover:border-brand hover:text-brand'
                              )}
                            >
                              <Heart className={cn('w-4 h-4', genResult.isLiked && 'fill-white')} />
                            </button>
                            <button onClick={() => setGenResult(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className={cn('grid gap-2', genResult.urls.length <= 1 ? 'grid-cols-1' : 'grid-cols-2')}>
                          {genResult.urls.map((url, i) => (
                            <div key={i} className="relative group rounded-xl overflow-hidden bg-gray-100">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt="" className="w-full" style={{ aspectRatio: ratio.replace(':', '/'), objectFit: 'cover' }} />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end justify-end p-2 opacity-0 group-hover:opacity-100">
                                <button
                                  onClick={() => handleDownloadResult(url)}
                                  className="w-8 h-8 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/75 transition-colors"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-gray-400 mt-3 text-right">라이브러리에 자동 저장됐어요</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : activeTab === '포토카드 변형' ? (
            <ImageTransformTab
              ratio={ratio}
              count={count}
              credits={credits}
              onNeedPayment={() => setPaymentOpen(true)}
              onRatioChange={setRatio}
              onCountChange={setCount}
            />
          ) : activeTab === '라이브러리' || activeTab === '좋아요' ? (
            <ImageLibraryTab
              mode={activeTab === '라이브러리' ? 'library' : 'liked'}
              onNavigateToNew={() => setActiveTab('신규 생성')}
              refreshKey={libRefreshKey}
            />
          ) : (
            <div className="flex items-center justify-center h-60 text-gray-300 text-sm">
              {activeTab} 준비 중
            </div>
          )}
          </main>
        </div>
      </div>

      {/* 결제 모달 */}

      <AnimatePresence>
        {paymentOpen && <CrackerPaymentModal onClose={() => setPaymentOpen(false)} />}
      </AnimatePresence>
    </MainLayout>
  );
}
