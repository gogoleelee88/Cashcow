'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Zap, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { cn } from '../../lib/utils';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';
  const { login } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await api.auth.login({ email, password });
      if (res.success) {
        login(res.data.user, res.data.accessToken, res.data.refreshToken);
        router.push(redirect);
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
    window.location.href = api.auth.oauthUrl(provider);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md"
    >
      {/* Logo */}
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center gap-2.5 mb-6">
          <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center shadow-brand">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl gradient-text">CharacterVerse</span>
        </Link>
        <h1 className="text-2xl font-bold text-text-primary mb-1">다시 만나요! 👋</h1>
        <p className="text-text-muted text-sm">계정에 로그인하세요</p>
      </div>

      {/* Card */}
      <div className="card p-6">
        {/* OAuth buttons */}
        <div className="space-y-2.5 mb-6">
          <button
            onClick={() => handleOAuth('kakao')}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl
                       bg-[#FEE500] hover:bg-[#F5D800] text-[#3B1E1E] font-semibold text-sm
                       transition-all duration-200 hover:shadow-lg"
          >
            <KakaoIcon />
            카카오로 계속하기
          </button>
          <button
            onClick={() => handleOAuth('google')}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl
                       bg-white hover:bg-gray-50 text-gray-800 font-semibold text-sm
                       border border-gray-200 transition-all duration-200 hover:shadow-lg"
          >
            <GoogleIcon />
            Google로 계속하기
          </button>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-text-muted text-xs">또는 이메일로</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-5"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </motion.div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-text-secondary text-sm font-medium mb-1.5">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
              autoComplete="email"
              className="input-base"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-text-secondary text-sm font-medium">비밀번호</label>
              <Link href="/forgot-password" className="text-brand-light text-xs hover:underline">
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
                className="input-base pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !email || !password}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isLoading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>

      <p className="text-center text-text-muted text-sm mt-5">
        계정이 없으신가요?{' '}
        <Link href="/register" className="text-brand-light hover:underline font-medium">
          회원가입
        </Link>
      </p>
    </motion.div>
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
