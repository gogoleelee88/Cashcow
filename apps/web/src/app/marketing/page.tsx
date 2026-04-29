import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[780px] mx-auto px-6 py-10">
        {/* Back button */}
        <Link href="/register" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-8">
          <ChevronLeft className="w-4 h-4" />
          뒤로
        </Link>

        <h1 className="text-[22px] font-bold text-gray-900 mb-1">이벤트·혜택 정보 수신 및 활용</h1>
        <h2 className="text-[18px] font-bold text-gray-900 mb-4">[선택동의] 이벤트·혜택 정보 수신 및 활용 동의</h2>

        <div className="text-[14px] text-gray-800 leading-relaxed space-y-6">
          <p>Zacoo 서비스는 연계 서비스를 포함합니다. 이하 "서비스"라고 합니다.</p>
          <p>본 동의는 서비스에서 수집한 아래와 같은 항목을 이용하여 전자적 전송매체를 통해 마케팅 등의 목적으로 개인에게 광고성 정보를 전송하는 것에 대한 수신동의 및 수집한 정보를 활용하는 것에 대한 활용 동의로서, 사용자는 본 동의를 거부할 권리가 있습니다.</p>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-3 py-2 text-left font-semibold">개인정보 수집 항목</th>
                  <th className="border border-gray-300 px-3 py-2 text-left font-semibold">개인정보 수집 및 이용 목적</th>
                  <th className="border border-gray-300 px-3 py-2 text-left font-semibold">보유 및 이용기간</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 px-3 py-2">이름, 이메일, 소속, 휴대폰번호</td>
                  <td className="border border-gray-300 px-3 py-2">전자적 전송매체를 통해, 이벤트 운영 및 광고성 정보 전송/ 서비스 및 혜택 관련 정보 안내/ 신규 기능 및 연계 서비스 프로모션 제공</td>
                  <td className="border border-gray-300 px-3 py-2">이용자가 동의를 철회하거나 탈퇴 시까지 보유·이용</td>
                </tr>
              </tbody>
            </table>
          </div>

          <section>
            <p className="font-semibold mb-3">안내</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>본 동의에는 야간 시간대(오후 9시 ~ 익일 오전 8시)에 발송되는 광고성 정보 수신이 포함됩니다.</li>
              <li>이벤트·혜택 정보 수신 및 야간 알림 수신 설정은 서비스별로 각각 관리됩니다.</li>
            </ul>
          </section>

          <section>
            <p className="font-bold mb-2">■ Zacoo 서비스</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>이벤트·혜택 알림 수신 동의 철회 : [설정 &gt; 계정 설정 &gt; 이벤트·혜택 정보 수신 및 활용 동의]</li>
              <li>야간 혜택 알림 수신 거부 : [설정 &gt; 알림 &gt; 야간 혜택 알림]</li>
            </ul>
          </section>

          <div className="border-t pt-6 text-gray-500">
            <p>공고일자: 2025.12.22</p>
            <p>시행일자: 2025.12.22</p>
          </div>
        </div>
      </div>
    </div>
  );
}
