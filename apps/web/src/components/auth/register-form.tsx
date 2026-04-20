'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Zap, AlertCircle, CheckCircle2, Loader2, ChevronRight, Check } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { isValidEmail, isValidUsername, isValidPassword } from '@characterverse/utils';
import { cn } from '../../lib/utils';

// ─────────────────────────────────────────────
// TERMS STEP
// ─────────────────────────────────────────────
function TermsStep({ onNext }: { onNext: () => void }) {
  const [agreed, setAgreed] = useState({
    age: false,
    service: false,
    privacy: false,
    marketing: false,
  });

  const allRequired = agreed.age && agreed.service && agreed.privacy;
  const allChecked = allRequired && agreed.marketing;

  const toggleAll = () => {
    const next = !allChecked;
    setAgreed({ age: next, service: next, privacy: next, marketing: next });
  };

  const toggle = (key: keyof typeof agreed) => {
    setAgreed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-4">
      {/* Header */}
      <div className="w-full max-w-[560px] pt-16 pb-10 text-center">
        <div className="text-[#E8613C] font-bold text-base mb-2">CharacterVerse</div>
        <h1 className="text-[28px] font-bold text-gray-900">회원가입</h1>
      </div>

      {/* Terms card */}
      <div className="w-full max-w-[560px]">
        <div className="mb-5">
          <p className="text-sm font-semibold text-gray-800">CharacterVerse 계정</p>
          <p className="text-[17px] font-bold text-gray-900 mt-0.5">서비스 약관에 동의해주세요</p>
        </div>

        <div className="space-y-0">
          {/* 모두 동의 */}
          <label className="flex items-center gap-3 py-3 cursor-pointer select-none">
            <span
              onClick={toggleAll}
              className={cn(
                'w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-colors',
                allChecked ? 'bg-[#3CBFB4] border-[#3CBFB4]' : 'border-gray-300 bg-white'
              )}
            >
              {allChecked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </span>
            <span className="text-[15px] font-semibold text-gray-800" onClick={toggleAll}>모두 동의</span>
          </label>

          {/* divider */}
          <div className="h-px bg-gray-200 my-1" />

          {/* 만 14세 */}
          <label className="flex items-center gap-3 py-3 cursor-pointer select-none" onClick={() => toggle('age')}>
            <span className={cn(
              'w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-colors',
              agreed.age ? 'bg-[#3CBFB4] border-[#3CBFB4]' : 'border-gray-300 bg-white'
            )}>
              {agreed.age && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </span>
            <span className="text-[14px] text-gray-700">만 14세 이상입니다</span>
          </label>

          {/* 서비스 이용약관 */}
          <div className="flex items-center gap-3 py-3">
            <span
              onClick={() => toggle('service')}
              className={cn(
                'w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-colors cursor-pointer',
                agreed.service ? 'bg-[#3CBFB4] border-[#3CBFB4]' : 'border-gray-300 bg-white'
              )}
            >
              {agreed.service && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </span>
            <span className="text-[14px] text-gray-700 flex-1 cursor-pointer" onClick={() => toggle('service')}>
              [필수] 서비스 이용약관
            </span>
            <Link href="/terms" className="text-gray-400 hover:text-gray-600">
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {/* 개인정보 수집 및 이용 */}
          <div className="flex items-center gap-3 py-3">
            <span
              onClick={() => toggle('privacy')}
              className={cn(
                'w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-colors cursor-pointer',
                agreed.privacy ? 'bg-[#3CBFB4] border-[#3CBFB4]' : 'border-gray-300 bg-white'
              )}
            >
              {agreed.privacy && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </span>
            <span className="text-[14px] text-gray-700 flex-1 cursor-pointer" onClick={() => toggle('privacy')}>
              [필수] 개인정보 수집 및 이용
            </span>
            <Link href="/privacy" className="text-gray-400 hover:text-gray-600">
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {/* 마케팅 */}
          <div className="flex items-center gap-3 py-3">
            <span
              onClick={() => toggle('marketing')}
              className={cn(
                'w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-colors cursor-pointer',
                agreed.marketing ? 'bg-[#3CBFB4] border-[#3CBFB4]' : 'border-gray-300 bg-white'
              )}
            >
              {agreed.marketing && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </span>
            <span className="text-[14px] text-gray-700 flex-1 cursor-pointer" onClick={() => toggle('marketing')}>
              [선택] 이벤트•혜택 정보 수신 및 활용 동의
            </span>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </div>
        </div>

        {/* 다음 버튼 */}
        <div className="mt-10">
          <button
            onClick={onNext}
            disabled={!allRequired}
            className={cn(
              'w-full py-[17px] rounded-xl text-[15px] font-semibold transition-colors',
              allRequired
                ? 'bg-gray-900 text-white hover:bg-gray-800'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            )}
          >
            다음
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto pt-12 pb-6 flex items-center gap-6 text-xs text-gray-400">
        <Link href="/terms" className="hover:text-gray-600">이용약관</Link>
        <Link href="/privacy" className="hover:text-gray-600">개인정보처리방침</Link>
        <Link href="/youth-policy" className="hover:text-gray-600">청소년 보호정책</Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// REGISTER FORM (step 2)
// ─────────────────────────────────────────────
export function RegisterForm() {
  const [step, setStep] = useState<'terms' | 'form'>('terms');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    displayName: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuthStore();

  if (step === 'terms') {
    return <TermsStep onNext={() => setStep('form')} />;
  }

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!isValidEmail(formData.email)) newErrors.email = '유효한 이메일을 입력해주세요';
    if (!isValidUsername(formData.username)) newErrors.username = '3-20자의 영문, 숫자, _만 사용 가능합니다';
    if (!isValidPassword(formData.password)) newErrors.password = '8자 이상, 대문자 및 숫자 포함';
    if (!formData.displayName.trim()) newErrors.displayName = '이름을 입력해주세요';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setApiError('');
    setIsLoading(true);

    try {
      const res = await api.auth.register(formData);
      if (res.success) {
        login(res.data.user, res.data.accessToken, res.data.refreshToken);
        router.push('/');
      }
    } catch (err: any) {
      setApiError(err.response?.data?.error?.message || '회원가입에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuth = (provider: string) => {
    window.location.href = api.auth.oauthUrl(provider);
  };

  const passwordStrength = () => {
    const p = formData.password;
    if (!p) return 0;
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score;
  };

  const strengthColors = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500'];
  const strengthLabels = ['', '매우 약함', '약함', '보통', '강함'];
  const strength = passwordStrength();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md"
    >
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center gap-2.5 mb-6">
          <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center shadow-brand">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl gradient-text">CharacterVerse</span>
        </Link>
        <h1 className="text-2xl font-bold text-text-primary mb-1">함께해요! 🎉</h1>
        <p className="text-text-muted text-sm">무료로 가입하고 100 크레딧을 받으세요</p>
      </div>

      <div className="card p-6">
        {/* OAuth */}
        <div className="space-y-2.5 mb-6">
          <button
            onClick={() => handleOAuth('kakao')}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl
                       bg-[#FEE500] hover:bg-[#F5D800] text-[#3B1E1E] font-semibold text-sm transition-all"
          >
            <span className="text-base">💬</span> 카카오로 시작하기
          </button>
          <button
            onClick={() => handleOAuth('google')}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl
                       bg-white hover:bg-gray-50 text-gray-800 font-semibold text-sm
                       border border-gray-200 transition-all"
          >
            <span className="text-base">G</span> Google로 시작하기
          </button>
        </div>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-border" />
          <span className="text-text-muted text-xs">또는 이메일로</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {apiError && (
          <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-5">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-text-secondary text-sm font-medium mb-1.5">이름 (닉네임)</label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              placeholder="홍길동"
              className={cn('input-base', errors.displayName && 'border-red-500/50 focus:ring-red-500/30')}
            />
            {errors.displayName && <p className="text-red-400 text-xs mt-1">{errors.displayName}</p>}
          </div>

          <div>
            <label className="block text-text-secondary text-sm font-medium mb-1.5">사용자명</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted text-sm">@</span>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase() })}
                placeholder="username"
                className={cn('input-base pl-8', errors.username && 'border-red-500/50')}
              />
            </div>
            {errors.username ? (
              <p className="text-red-400 text-xs mt-1">{errors.username}</p>
            ) : formData.username && isValidUsername(formData.username) ? (
              <p className="text-emerald-400 text-xs mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> 사용 가능한 사용자명입니다
              </p>
            ) : null}
          </div>

          <div>
            <label className="block text-text-secondary text-sm font-medium mb-1.5">이메일</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="name@example.com"
              className={cn('input-base', errors.email && 'border-red-500/50')}
            />
            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-text-secondary text-sm font-medium mb-1.5">비밀번호</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                className={cn('input-base pr-10', errors.password && 'border-red-500/50')}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {formData.password && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className={cn('h-1 flex-1 rounded-full transition-all duration-300',
                      i <= strength ? strengthColors[strength] : 'bg-border')} />
                  ))}
                </div>
                <p className="text-xs text-text-muted">{strengthLabels[strength]}</p>
              </div>
            )}
            {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
          </div>

          <p className="text-text-muted text-xs">
            가입하면 <Link href="/terms" className="text-brand-light hover:underline">이용약관</Link> 및{' '}
            <Link href="/privacy" className="text-brand-light hover:underline">개인정보처리방침</Link>에 동의하는 것으로 간주됩니다.
          </p>

          <button type="submit" disabled={isLoading} className="btn-primary w-full flex items-center justify-center gap-2">
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isLoading ? '가입 중...' : '무료로 가입하기'}
          </button>
        </form>
      </div>

      <p className="text-center text-text-muted text-sm mt-5">
        이미 계정이 있으신가요?{' '}
        <Link href="/login" className="text-brand-light hover:underline font-medium">로그인</Link>
      </p>
    </motion.div>
  );
}
