import Link from 'next/link';
import { ShieldOff } from 'lucide-react';

export default function AdminForbiddenPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-5">
          <ShieldOff className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">접근 권한 없음</h1>
        <p className="text-gray-500 text-sm mb-6">관리자 계정으로 로그인하세요.</p>
        <Link href="/" className="inline-flex items-center px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors">
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
