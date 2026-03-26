import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-8xl font-black text-brand mb-4">404</h1>
        <p className="text-text-primary font-bold text-xl mb-2">페이지를 찾을 수 없습니다</p>
        <p className="text-text-muted mb-8">요청하신 페이지가 존재하지 않거나 이동되었습니다.</p>
        <Link href="/" className="btn-primary inline-flex items-center gap-2 px-6 py-2.5">
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
