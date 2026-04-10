'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '../../lib/utils';
import { MainLayout } from '../layout/main-layout';
import { useAuthStore } from '../../stores/auth.store';
import { api } from '../../lib/api';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';
import { ImageTransformTab } from './image-transform-tab';

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

const TABS = ['라이브러리', '좋아요', '신규 생성', '이미지 변형'];

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
          <h3 className="text-gray-900 font-bold text-base">크래커 충전하기</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          {/* Banner */}
          <button className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 mb-5 hover:bg-amber-100 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎫</span>
              <span className="text-amber-700 font-semibold text-sm">더 많은 크래커 혜택, 자동 구매 바로가기!</span>
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
            <p className="font-semibold text-gray-500 mb-1.5">완불 정책 및 크래커 이용 안내</p>
            {[
              '모든 결제 상품은 결제일로부터 7일 이내 완불을 요청할 수 있습니다.',
              '7일 이내라도 구매한 크래커 목록을 사용한 이력이 있다면 완불이 불가합니다.',
              '사용 이력이 있을 경우, 남은 크래커에 대한 완불은 불가합니다.',
              '주관적인 AI 생성의 불만족으로 인한 완불은 불가합니다.',
              '무료로 구매한 크래커의 유효기간은 취득 시점으로부터 5년입니다.',
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
  const { user } = useAuthStore();
  const credits = user?.creditBalance ?? 0;

  const [activeTab, setActiveTab] = useState('신규 생성');
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('청초');
  const [ratio, setRatio] = useState('2:3');
  const [count, setCount] = useState(2);
  const [generating, setGenerating] = useState(false);
  const [helperLoading, setHelperLoading] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const cost = count * IMAGE_GEN_COST;

  const handleGenerate = async () => {
    if (credits < cost) { setPaymentOpen(true); return; }
    setGenerating(true);
    // TODO: 실제 이미지 생성 API 연동
    await new Promise(r => setTimeout(r, 1500));
    setGenerating(false);
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

        {/* ── 왼쪽 사이드바 ── */}
        <aside className="w-52 flex-shrink-0 border-r border-gray-100 flex flex-col py-4 bg-white">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'w-full text-left px-5 py-3 text-sm font-medium transition-colors',
                activeTab === tab
                  ? 'text-gray-900 font-bold bg-gray-50 border-l-2 border-gray-900'
                  : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50 border-l-2 border-transparent'
              )}
            >
              {tab}
            </button>
          ))}
        </aside>

        {/* ── 메인 콘텐츠 ── */}
        <main className="flex-1 min-w-0 overflow-y-auto px-8 py-8">

          {activeTab === '신규 생성' ? (
            <>
              {/* 프롬프트 영역 */}
              <div className="max-w-2xl mb-8">
                <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                  <textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value.slice(0, 1000))}
                    placeholder={`만들고 싶은 이미지를 차례대로 설명해 보세요\n(성별, 포즈, 얼굴, 표정, 자세, 구도, 의상, 배경, 그 외)`}
                    rows={5}
                    className="w-full px-5 py-4 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none resize-none"
                  />
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                    <span className="text-gray-300 text-xs">{prompt.length}/1000</span>
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
                        onClick={handleGenerate}
                        disabled={generating}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-60"
                      >
                        <span>🔑</span>
                        {generating ? '생성 중...' : `이미지 생성 ${cost}`}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 이미지 스타일 */}
              <div className="max-w-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-brand text-sm font-bold">✦</span>
                  <h2 className="text-gray-900 font-bold text-base">이미지 스타일</h2>
                </div>
                <p className="text-gray-400 text-sm mb-5">원하는 느낌의 스타일을 선택하세요</p>

                <div className="grid grid-cols-4 gap-3">
                  {STYLES.map(style => (
                    <button
                      key={style.name}
                      onClick={() => setSelectedStyle(style.name)}
                      className={cn(
                        'relative rounded-2xl overflow-hidden aspect-square border-2 transition-all hover:scale-[1.02]',
                        selectedStyle === style.name
                          ? 'border-brand shadow-[0_0_0_2px_rgba(230,51,37,0.3)]'
                          : 'border-transparent'
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={style.img} alt={style.name} className="w-full h-full object-cover" />

                      {/* 선택 체크 */}
                      {selectedStyle === style.name && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-brand flex items-center justify-center shadow-md">
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.8"
                              strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}

                      {/* 이름 */}
                      <div className="absolute bottom-0 left-0 right-0 py-1.5 bg-gradient-to-t from-black/60 to-transparent">
                        <span className="text-white text-xs font-semibold drop-shadow">{style.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : activeTab === '이미지 변형' ? (
            <ImageTransformTab
              ratio={ratio}
              count={count}
              credits={credits}
              onNeedPayment={() => setPaymentOpen(true)}
            />
          ) : (
            /* 다른 탭 플레이스홀더 */
            <div className="flex items-center justify-center h-60 text-gray-300 text-sm">
              {activeTab} 준비 중
            </div>
          )}
        </main>

        {/* ── 오른쪽 사이드바 ── */}
        <aside className="w-52 flex-shrink-0 border-l border-gray-100 overflow-y-auto py-6 px-4 bg-white">

          {/* 이미지 비율 */}
          <div className="mb-7">
            <p className="text-gray-800 font-bold text-sm mb-3">
              이미지 비율<span className="text-brand">*</span>
            </p>

            {activeTab === '이미지 변형' ? (
              /* 변형 탭: 가로 스크롤 1줄 */
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {RATIOS.filter(r => r.label !== '2:3').map(r => (
                  <button
                    key={r.label}
                    onClick={() => setRatio(r.label)}
                    className={cn(
                      'flex-shrink-0 flex flex-col items-center justify-center gap-1 w-12 py-2.5 rounded-xl border text-xs font-medium transition-all',
                      ratio === r.label
                        ? 'border-[#E8A020] bg-[#FFF8EC] text-[#E8A020]'
                        : 'border-gray-200 text-gray-400 hover:border-gray-300'
                    )}
                  >
                    <div className={cn('border-2 rounded-sm', ratio === r.label ? 'border-[#E8A020]' : 'border-gray-300')}
                      style={{ width: r.w <= r.h ? 12 : 18, height: r.h <= r.w ? 12 : 18 }} />
                    <span className="text-[10px]">{r.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              /* 신규 생성 탭: 3+3 그리드 */
              <>
                <div className="grid grid-cols-3 gap-1.5 mb-2">
                  {RATIOS.slice(0, 3).map(r => (
                    <button
                      key={r.label}
                      onClick={() => setRatio(r.label)}
                      className={cn(
                        'flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-all',
                        ratio === r.label
                          ? 'border-[#E8A020] bg-[#FFF8EC] text-[#E8A020]'
                          : 'border-gray-200 text-gray-400 hover:border-gray-300'
                      )}
                    >
                      <div className={cn('border-2 rounded-sm', ratio === r.label ? 'border-[#E8A020]' : 'border-gray-300')}
                        style={{ width: r.w <= r.h ? 14 : 20, height: r.h <= r.w ? 14 : 20 }} />
                      <span>{r.label}</span>
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {RATIOS.slice(3).map(r => (
                    <button
                      key={r.label}
                      onClick={() => setRatio(r.label)}
                      className={cn(
                        'flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-all',
                        ratio === r.label
                          ? 'border-[#E8A020] bg-[#FFF8EC] text-[#E8A020]'
                          : 'border-gray-200 text-gray-400 hover:border-gray-300'
                      )}
                    >
                      <div className={cn('border-2 rounded-sm', ratio === r.label ? 'border-[#E8A020]' : 'border-gray-300')}
                        style={{ width: r.w <= r.h ? 14 : 20, height: r.h <= r.w ? 14 : 20 }} />
                      <span>{r.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* 이미지 개수 */}
          <div className="mb-7">
            <p className="text-gray-800 font-bold text-sm mb-1">
              이미지 개수<span className="text-brand">*</span>
            </p>
            <p className="text-gray-400 text-xs mb-3">이미지 개수 설정에 맞게 크래커가 소비돼요</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[1, 2, 3, 4].map(n => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={cn(
                    'py-2 rounded-xl border text-sm font-semibold transition-all',
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

          {/* 크래커 잔액 */}
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
            <p className="text-xs text-gray-400 mb-0.5">보유 크래커</p>
            <p className="text-sm font-bold text-gray-800">{credits.toLocaleString()}개</p>
            <p className={cn('text-xs mt-1 font-medium', credits >= cost ? 'text-green-500' : 'text-brand')}>
              {credits >= cost ? `차감 예정: ${cost}개` : `부족: ${(cost - credits).toLocaleString()}개`}
            </p>
            {credits < cost && (
              <button
                onClick={() => setPaymentOpen(true)}
                className="mt-2 w-full py-1.5 rounded-lg bg-brand text-white text-xs font-bold hover:brightness-110 transition-all"
              >
                충전하기
              </button>
            )}
          </div>
        </aside>
      </div>

      {/* 결제 모달 */}
      <AnimatePresence>
        {paymentOpen && <CrackerPaymentModal onClose={() => setPaymentOpen(false)} />}
      </AnimatePresence>
    </MainLayout>
  );
}
