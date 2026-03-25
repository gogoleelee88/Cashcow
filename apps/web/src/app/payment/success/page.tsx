'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle, Coins, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth.store';

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [credits, setCredits] = useState(0);

  useEffect(() => {
    const paymentKey = searchParams.get('paymentKey');
    const orderId = searchParams.get('orderId');
    const amount = searchParams.get('amount');

    if (!paymentKey || !orderId || !amount) {
      setStatus('error');
      return;
    }

    api.payments.confirmToss({ paymentKey, orderId, amount: Number(amount) })
      .then((res: any) => {
        setCredits(res.creditsAdded ?? 0);
        setStatus('success');
        // Refresh user data to get updated credits
        api.auth.me().then((meRes: any) => {
          if (meRes) setUser(meRes);
        });
      })
      .catch(() => setStatus('error'));
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full border-4 border-brand border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-text-muted">결제 확인 중...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-red-400 text-2xl">✕</span>
          </div>
          <h1 className="text-text-primary font-bold text-xl mb-2">결제 확인 실패</h1>
          <p className="text-text-muted mb-5">결제 확인에 실패했습니다. 고객센터에 문의해주세요.</p>
          <Link href="/settings/credits" className="btn-primary">다시 시도</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-sm"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-6"
        >
          <CheckCircle className="w-10 h-10 text-emerald-400" />
        </motion.div>

        <h1 className="text-text-primary font-bold text-2xl mb-2">결제 완료!</h1>
        <p className="text-text-muted mb-6">크레딧이 충전되었습니다.</p>

        <div className="card p-5 mb-6">
          <div className="flex items-center justify-center gap-3">
            <Coins className="w-8 h-8 text-amber-400" />
            <div>
              <p className="text-text-muted text-sm">충전된 크레딧</p>
              <p className="text-text-primary font-bold text-3xl">+{credits.toLocaleString()}</p>
            </div>
          </div>
          {user && (
            <div className="border-t border-border mt-4 pt-4">
              <p className="text-text-muted text-sm">현재 잔액</p>
              <p className="text-text-primary font-semibold text-xl">
                {((user as any)?.credits ?? 0).toLocaleString()} 크레딧
              </p>
            </div>
          )}
        </div>

        <Link href="/" className="btn-primary w-full flex items-center justify-center gap-2">
          캐릭터 탐색하기
          <ArrowRight className="w-4 h-4" />
        </Link>
      </motion.div>
    </div>
  );
}
