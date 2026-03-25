'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Coins, Zap, Star, Crown, CreditCard, ChevronLeft, CheckCircle, History } from 'lucide-react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { formatDate } from '@characterverse/utils';
import { cn } from '../../lib/utils';
import { toast } from '../ui/toaster';

const CREDIT_PACKAGES = [
  { id: 'starter', credits: 100, price: 1100, bonus: 0, label: '스타터', icon: Zap, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  { id: 'basic', credits: 550, price: 5500, bonus: 50, label: '베이직', icon: Star, color: 'text-brand bg-brand/10 border-brand/20', popular: true },
  { id: 'pro', credits: 1200, price: 11000, bonus: 200, label: '프로', icon: Crown, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  { id: 'premium', credits: 2700, price: 22000, bonus: 700, label: '프리미엄', icon: Crown, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
];

export function CreditsContent() {
  const { user } = useAuthStore();
  const [selectedPackage, setSelectedPackage] = useState(CREDIT_PACKAGES[1].id);
  const [paymentMethod, setPaymentMethod] = useState<'toss' | 'stripe'>('toss');

  const { data: transactionsData } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => api.get('/payments/transactions'),
  });

  const initiateMutation = useMutation({
    mutationFn: (packageId: string) =>
      api.post('/payments/toss/initiate', { packageId }),
    onSuccess: (res: any) => {
      window.location.href = res.data.checkoutUrl;
    },
    onError: () => toast.error('오류', '결제를 시작할 수 없습니다.'),
  });

  const stripeIntentMutation = useMutation({
    mutationFn: (packageId: string) =>
      api.post('/payments/stripe/create-intent', { packageId }),
    onSuccess: (res: any) => {
      window.location.href = res.data.checkoutUrl;
    },
    onError: () => toast.error('오류', '결제를 시작할 수 없습니다.'),
  });

  const handlePurchase = () => {
    if (paymentMethod === 'toss') {
      initiateMutation.mutate(selectedPackage);
    } else {
      stripeIntentMutation.mutate(selectedPackage);
    }
  };

  const pkg = CREDIT_PACKAGES.find(p => p.id === selectedPackage)!;
  const isPending = initiateMutation.isPending || stripeIntentMutation.isPending;

  const transactions = (transactionsData as any)?.data?.transactions ?? [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings" className="text-text-muted hover:text-text-primary transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <Coins className="w-6 h-6 text-amber-400" />
        <h1 className="text-text-primary font-bold text-2xl">크레딧 충전</h1>
      </div>

      {/* Current balance */}
      <div className="card p-5 mb-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
          <Coins className="w-6 h-6 text-amber-400" />
        </div>
        <div>
          <p className="text-text-muted text-sm">현재 크레딧 잔액</p>
          <p className="text-text-primary font-bold text-3xl">
            {((user as any)?.credits ?? 0).toLocaleString()}
            <span className="text-text-muted text-base font-normal ml-1">크레딧</span>
          </p>
        </div>
      </div>

      {/* Packages */}
      <h2 className="text-text-primary font-semibold mb-3">패키지 선택</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {CREDIT_PACKAGES.map(pkg => (
          <motion.button
            key={pkg.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedPackage(pkg.id)}
            className={cn(
              'relative p-4 rounded-2xl border text-left transition-all',
              selectedPackage === pkg.id
                ? 'border-brand bg-brand/10 ring-1 ring-brand/30'
                : 'border-border bg-surface-DEFAULT hover:border-brand/30'
            )}
          >
            {pkg.popular && (
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-brand rounded-full text-white text-xs font-bold whitespace-nowrap">
                인기
              </span>
            )}
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-3 border', pkg.color)}>
              <pkg.icon className="w-4 h-4" />
            </div>
            <p className="text-text-primary font-bold">
              {(pkg.credits + pkg.bonus).toLocaleString()}
            </p>
            <p className="text-text-muted text-xs">크레딧</p>
            {pkg.bonus > 0 && (
              <p className="text-emerald-400 text-xs mt-0.5">+{pkg.bonus} 보너스</p>
            )}
            <p className="text-text-primary font-semibold text-sm mt-2">
              {pkg.price.toLocaleString()}원
            </p>
          </motion.button>
        ))}
      </div>

      {/* Payment method */}
      <h2 className="text-text-primary font-semibold mb-3">결제 수단</h2>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { id: 'toss' as const, label: '토스페이먼츠', desc: '국내 카드·계좌이체' },
          { id: 'stripe' as const, label: 'Stripe', desc: '해외 카드' },
        ].map(method => (
          <button
            key={method.id}
            onClick={() => setPaymentMethod(method.id)}
            className={cn(
              'p-4 rounded-xl border text-left transition-all',
              paymentMethod === method.id
                ? 'border-brand bg-brand/10'
                : 'border-border hover:border-brand/30'
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-brand" />
              <span className="text-text-primary font-medium text-sm">{method.label}</span>
              {paymentMethod === method.id && <CheckCircle className="w-4 h-4 text-brand ml-auto" />}
            </div>
            <p className="text-text-muted text-xs">{method.desc}</p>
          </button>
        ))}
      </div>

      {/* Summary & CTA */}
      <div className="card p-5 mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-text-secondary text-sm">{pkg.label} 패키지</span>
          <span className="text-text-primary font-medium">{pkg.credits.toLocaleString()} 크레딧</span>
        </div>
        {pkg.bonus > 0 && (
          <div className="flex justify-between items-center mb-2">
            <span className="text-emerald-400 text-sm">보너스 크레딧</span>
            <span className="text-emerald-400 font-medium">+{pkg.bonus.toLocaleString()}</span>
          </div>
        )}
        <div className="border-t border-border pt-2 mt-2 flex justify-between items-center">
          <span className="text-text-primary font-semibold">결제 금액</span>
          <span className="text-brand font-bold text-lg">{pkg.price.toLocaleString()}원</span>
        </div>
      </div>

      <button
        onClick={handlePurchase}
        disabled={isPending}
        className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2"
      >
        <CreditCard className="w-5 h-5" />
        {isPending ? '처리 중...' : `${pkg.price.toLocaleString()}원 결제하기`}
      </button>

      {/* Transaction history */}
      {transactions.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-4 h-4 text-text-muted" />
            <h2 className="text-text-primary font-semibold">결제 내역</h2>
          </div>
          <div className="space-y-2">
            {transactions.map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl border border-border">
                <div>
                  <p className="text-text-primary text-sm font-medium">{tx.description ?? '크레딧 충전'}</p>
                  <p className="text-text-muted text-xs mt-0.5">{formatDate(tx.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className={cn('font-semibold text-sm', tx.credits > 0 ? 'text-emerald-400' : 'text-text-primary')}>
                    {tx.credits > 0 ? '+' : ''}{tx.credits.toLocaleString()} 크레딧
                  </p>
                  <p className="text-text-muted text-xs">{(tx.amount ?? 0).toLocaleString()}원</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
