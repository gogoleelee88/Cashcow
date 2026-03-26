'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-6xl font-black text-text-muted mb-4">500</h1>
        <p className="text-text-primary font-bold text-xl mb-2">오류가 발생했습니다</p>
        <p className="text-text-muted mb-8">서버에서 오류가 발생했습니다. 잠시 후 다시 시도해주세요.</p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={reset} className="btn-primary px-6 py-2.5">
            다시 시도
          </button>
          <Link href="/" className="btn-secondary px-6 py-2.5">
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}
