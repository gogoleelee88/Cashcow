import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[780px] mx-auto px-6 py-10">
        {/* Back button */}
        <Link href="/register" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-8">
          <ChevronLeft className="w-4 h-4" />
          뒤로
        </Link>

        <h1 className="text-[22px] font-bold text-gray-900 mb-1">개인정보 수집 및 이용</h1>
        <h2 className="text-[18px] font-bold text-gray-900 mb-4">개인정보 수집 및 이용 동의</h2>

        <div className="text-[14px] text-gray-800 leading-relaxed space-y-6">
          <p>Zacoo(이하 '회사')가 운영하는 Zacoo은(는) 아래와 같이 정보주체의 개인정보를 수집·이용합니다.</p>

          <p>회사는 통합 로그인 및 데이터 관리 시스템을 기반으로 Zacoo 서비스 및 이에 부수하는 제반 서비스(통칭하여 이하 '서비스')를 제공하고 관리합니다.</p>

          <section>
            <p className="font-bold mb-3">■ 정보주체의 동의를 받아 처리하는 개인정보</p>

            <p className="font-semibold mb-2">① 회원가입을 위해 수집하는 개인정보</p>
            <p className="mb-3">통합 로그인 및 데이터 관리 시스템을 기반으로 서비스를 제공하고 관리합니다.</p>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold">수집 및 이용 목적</th>
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold">수집하는 개인정보 항목</th>
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold">보유 및 이용기간</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-3 py-2">아이디 및 비밀번호 찾기, Zacoo 서비스 제공을 위한 회원가입 및 이용자 식별, 문의 및 민원 처리</td>
                    <td className="border border-gray-300 px-3 py-2">이메일, 비밀번호</td>
                    <td className="border border-gray-300 px-3 py-2">회원탈퇴 시까지</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <p className="font-semibold mb-2">② 서비스 이용 중 별도로 추가 수집하는 개인정보</p>
            <p className="mb-3">회사는 다양한 서비스 제공을 위해 이용자에게 동의를 받고 추가적인 개인정보를 수집할 수 있습니다.</p>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold">분류</th>
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold">서비스명</th>
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold">수집 및 이용 목적</th>
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold">수집하는 개인정보 항목</th>
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold">보유 및 이용기간</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-3 py-2">공통 및 일반</td>
                    <td className="border border-gray-300 px-3 py-2">공통</td>
                    <td className="border border-gray-300 px-3 py-2">Zacoo AI 서비스 제공 및 서비스 성능, 알고리즘 개선</td>
                    <td className="border border-gray-300 px-3 py-2">AI 대화 정보(텍스트·이미지·비디오·음성 등을 포함한 대화 내용) / 서비스 이용 행태 정보(입력 정보 및 결과물)</td>
                    <td className="border border-gray-300 px-3 py-2">회원탈퇴 시까지</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-3 py-2">Zacoo</td>
                    <td className="border border-gray-300 px-3 py-2">개인화 서비스</td>
                    <td className="border border-gray-300 px-3 py-2">서비스 제공과 관련한 추천 알고리즘 개선</td>
                    <td className="border border-gray-300 px-3 py-2">닉네임, 직업, 성별, 생년월일, 전화번호, 목표, 관심사</td>
                    <td className="border border-gray-300 px-3 py-2">회원탈퇴 시까지</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-3 py-2">Zacoo</td>
                    <td className="border border-gray-300 px-3 py-2">이미지 제작</td>
                    <td className="border border-gray-300 px-3 py-2">AI 서비스를 활용한 이미지 생성</td>
                    <td className="border border-gray-300 px-3 py-2">업로드 이미지, 생성 결과물</td>
                    <td className="border border-gray-300 px-3 py-2">제공 서비스사 처리 방침에 따라 기간 상이</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-3 py-2">Zacoo</td>
                    <td className="border border-gray-300 px-3 py-2">혜택</td>
                    <td className="border border-gray-300 px-3 py-2">맞춤형 광고 제공 및 광고 참여 정보 확인 및 리워드 제공</td>
                    <td className="border border-gray-300 px-3 py-2">암호화된 고객정보, Google 광고 ID, 광고주식별자, 성별, 연령, OS 정보, 마스킹된 성명, IP주소, 모바일기기 모델명, 통신사</td>
                    <td className="border border-gray-300 px-3 py-2">고객의 서비스 해지 시 또는 탈퇴 시까지</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-3 py-2">Zacoo</td>
                    <td className="border border-gray-300 px-3 py-2">최저가 협상</td>
                    <td className="border border-gray-300 px-3 py-2">상품 결제</td>
                    <td className="border border-gray-300 px-3 py-2">결제자 이름, 결제 방식, 결제 기록, 결제 금액</td>
                    <td className="border border-gray-300 px-3 py-2">배송 완료 시 즉시 삭제</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-3 py-2">Zacoo</td>
                    <td className="border border-gray-300 px-3 py-2">최저가 협상</td>
                    <td className="border border-gray-300 px-3 py-2">상품 입출고</td>
                    <td className="border border-gray-300 px-3 py-2">주문 상품 및 개수, 주문자 이름, 휴대폰 번호, 주소지, 주문 시간</td>
                    <td className="border border-gray-300 px-3 py-2">배송 완료 시 즉시 삭제</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-3 py-2">Zacoo</td>
                    <td className="border border-gray-300 px-3 py-2">최저가 협상</td>
                    <td className="border border-gray-300 px-3 py-2">상품 배송</td>
                    <td className="border border-gray-300 px-3 py-2">배송 메시지</td>
                    <td className="border border-gray-300 px-3 py-2">배송 완료 시 즉시 삭제</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <div className="bg-gray-50 p-4 rounded text-[13px] text-gray-600">
            ※ 정보주체는 개인정보 수집·이용에 동의하지 않을 권리가 있으나, 동의를 거부할 경우 회사가 제공하는 서비스의 이용이 어렵습니다.
          </div>

          <div className="border-t pt-6 text-gray-500">
            <p className="font-semibold mb-1">&lt;시행일자&gt;</p>
            <p>공고일자: 2026.01.21</p>
            <p>시행일자: 2026.01.21</p>
          </div>
        </div>
      </div>
    </div>
  );
}
