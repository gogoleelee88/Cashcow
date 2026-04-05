'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Zap, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../../stores/auth.store';
import { api } from '../../../lib/api';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { login } = useAuthStore();

  useEffect(() => {
    // Parse tokens from URL fragment (never exposed in query string for security)
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (!accessToken || !refreshToken) {
      router.replace('/login?error=oauth_failed');
      return;
    }

    // Set tokens first so the request interceptor picks them up
    useAuthStore.getState().setTokens(accessToken, refreshToken);

    // Fetch user info with the new token
    api.auth.me().then((res) => {
      if (res.success) {
        login(res.data, accessToken, refreshToken);
        router.replace('/');
      } else {
        router.replace('/login?error=oauth_failed');
      }
    }).catch(() => {
      router.replace('/login?error=oauth_failed');
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <div className="w-14 h-14 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-brand mx-auto mb-4">
          <Zap className="w-7 h-7 text-white" />
        </div>
        <Loader2 className="w-6 h-6 animate-spin text-brand mx-auto mb-3" />
        <p className="text-text-secondary text-sm">로그인 처리 중...</p>
      </motion.div>
    </div>
  );
}
