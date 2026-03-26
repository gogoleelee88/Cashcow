'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { XCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';

const ERROR_MESSAGES: Record<string, string> = {
  PAY_PROCESS_CANCELED: '결제가 취소되었습니다.',
  PAY_PROCESS_ABORTED: '결제 처리 중 오류가 발생했습니다.',
  REJECT_CARD_COMPANY: '카드사에서 결제를 거절했습니다.',
  INVALID_PAYMENT_AMOUNT: '결제 금액이 올바르지 않습니다.',
};

function PaymentFailContent() {
  const searchParams = useSearchParams()!;
  const errorCode = searchParams?.get('code') ?? '';
  const errorMessage = searchParams?.get('message') ?? '';
  const displayMessage = ERROR_MESSAGES[errorCode] ?? errorMessage ?? '결제에 실패했습니다.';

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-sm"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6"
        >
          <XCircle className="w-10 h-10 text-red-500" />
        </motion.div>

        <h1 className="text-text-primary font-bold text-2xl mb-2">결제 실패</h1>
        <p className="text-text-secondary mb-2">{displayMessage}</p>
        {errorCode && (
          <p className="text-text-muted text-xs mb-6">오류 코드: {errorCode}</p>
        )}

        <div className="flex flex-col gap-3">
          <Link href="/settings/credits" className="btn-primary w-full flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4" />
            다시 시도
          </Link>
          <Link href="/" className="btn-secondary w-full flex items-center justify-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            홈으로
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

export default function PaymentFailPage() {
  return (
    <Suspense>
      <PaymentFailContent />
    </Suspense>
  );
}
