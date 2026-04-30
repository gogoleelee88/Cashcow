'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Eye, EyeOff, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';

function detectInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /KAKAOTALK|Instagram|FBAN|FBIOS|FB_IAB|Line\/|NAVER|MicroMessenger|Whale\//.test(ua);
}

function openInExternalBrowser(url: string) {
  const ua = navigator.userAgent;
  const isAndroid = /Android/.test(ua);
  if (isAndroid) {
    window.location.href = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
  } else {
    // iOS — copy URL hint (can't force open Safari)
    try { navigator.clipboard.writeText(url); } catch {}
  }
}

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInApp, setIsInApp] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams?.get('redirect') || '/';
  const { login } = useAuthStore();

  useEffect(() => {
    setIsInApp(detectInAppBrowser());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await api.auth.login({ email, password });
      if (res.success) {
        login(res.data.user, res.data.accessToken, res.data.refreshToken);
        router.push('/profiles');
      } else {
        setError(res.error?.message || '로그인에 실패했습니다.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || '로그인에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuth = (provider: string) => {
    if (provider === 'google' && isInApp) {
      const currentUrl = window.location.href;
      const ua = navigator.userAgent;
      if (/Android/.test(ua)) {
        openInExternalBrowser(currentUrl);
      } else {
        setError('카카오톡 내 브라우저에서는 Google 로그인을 사용할 수 없습니다.\nSafari 또는 Chrome에서 열어주세요.');
      }
      return;
    }
    window.location.href = api.auth.oauthUrl(provider);
  };

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  const isAndroid = typeof navigator !== 'undefined' && /Android/.test(navigator.userAgent);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
          {/* Logo */}
          <div className="text-center mb-10">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center">
                <span className="text-white font-black text-xl">Z</span>
              </div>
              <span className="font-black text-3xl text-text-primary">Zac<span className="text-4xl">∞</span></span>
            </Link>
          </div>

          {isInApp && (
            <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-amber-800 text-sm font-semibold mb-1">인앱 브라우저 감지됨</p>
              <p className="text-amber-700 text-xs leading-relaxed mb-3">
                카카오톡 내 브라우저에서는 Google 로그인이 차단됩니다.
                외부 브라우저(Chrome / Safari)에서 열어주세요.
              </p>
              {isAndroid ? (
                <button
                  onClick={() => openInExternalBrowser(currentUrl)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 underline underline-offset-2"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Chrome으로 열기
                </button>
              ) : (
                <p className="text-xs text-amber-600">
                  오른쪽 상단 ··· 메뉴 → <strong>외부 브라우저로 열기</strong>를 선택해주세요.
                </p>
              )}
            </div>
          )}


          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm mb-5"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* 이메일 — 라벨 인라인 */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 pt-2.5 pb-2 focus-within:border-brand transition-colors">
              <label className="block text-xs text-gray-400 mb-0.5">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                autoComplete="email"
                className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none"
              />
            </div>

            {/* 비밀번호 — 라벨 인라인 */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 pt-2.5 pb-2 focus-within:border-brand transition-colors">
              <div className="flex items-center justify-between mb-0.5">
                <label className="text-xs text-gray-400">비밀번호</label>
                <Link href="/forgot-password" className="text-brand text-xs hover:underline">
                  비밀번호 찾기
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none pr-8"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLoading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          {/* OAuth buttons */}
          <div className="space-y-3 mt-4">
            <button
              onClick={() => handleOAuth('kakao')}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl
                         bg-[#FEE500] hover:bg-[#F5D800] text-[#3B1E1E] font-semibold text-sm
                         transition-all duration-200"
            >
              <KakaoIcon />
              카카오로 계속하기
            </button>
            <button
              onClick={() => handleOAuth('google')}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl
                         bg-white hover:bg-gray-50 text-gray-700 font-semibold text-sm
                         border border-gray-200 transition-all duration-200"
            >
              <GoogleIcon />
              Google로 계속하기
            </button>
          </div>

          <p className="text-center text-text-muted text-sm mt-6">
            계정이 없으신가요?{' '}
            <Link href="/register" className="text-brand hover:underline font-semibold">
              회원가입
            </Link>
          </p>
      </motion.div>
    </div>
  );
}

function KakaoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M9 0C4.029 0 0 3.134 0 7c0 2.475 1.609 4.648 4.064 5.933L3.122 16.49c-.082.33.3.588.588.389L8.24 13.93C8.492 13.956 8.745 13.97 9 13.97c4.971 0 9-3.133 9-7C18 3.134 13.971 0 9 0z" fill="#3B1E1E"/>
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.96L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}
