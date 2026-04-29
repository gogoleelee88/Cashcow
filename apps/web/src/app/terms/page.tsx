import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[780px] mx-auto px-6 py-10">
        {/* Back button */}
        <Link href="/register" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-8">
          <ChevronLeft className="w-4 h-4" />
          뒤로
        </Link>

        <h1 className="text-[22px] font-bold text-gray-900 mb-1">서비스 이용약관</h1>
        <h2 className="text-[18px] font-bold text-gray-900 mb-4">Zacoo 서비스 이용약관</h2>

        <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed space-y-6 text-[14px]">

          <section>
            <h3 className="font-bold text-base">제1장 총칙</h3>
          </section>

          <section>
            <h3 className="font-semibold">제1조 (목적)</h3>
            <p>이 약관은 Zacoo(이하 '회사')은(는) 회사가 운영하는 Zacoo 및 이에 부수하는 제반 서비스(통칭하여 이하 '서비스')의 이용조건 및 절차에 관한 사항 및 기타 필요한 사항을 규정함을 목적으로 하며, 본 약관에 동의함으로써 해당 서비스들도 별도 이용계약 체결없이 이용이 가능합니다.</p>
          </section>

          <section>
            <h3 className="font-semibold">제2조 (생성형 인공지능 사전 고지 사항)</h3>
            <p>회사와 관련된 모든 서비스의 운영, 제작, 제공에는 AI가 적극적으로 활용되며, 대다수의 기능이 생성형 인공지능을 기반으로 운용 및 제공되고 있습니다.</p>
          </section>

          <section>
            <h3 className="font-semibold">제3조 (용어의 정의)</h3>
            <p>이 약관에서 사용하는 용어는 다음과 같이 정의합니다.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>회원: 이 약관에 따라 이용계약을 체결하고, 회사가 제공하는 서비스를 이용하는 자</li>
              <li>아이디(ID): 회원식별과 회원의 서비스 이용을 위해 회원이 선정하고 회사가 승인하는 문자와 숫자의 조합</li>
              <li>비밀번호(Password): 회원이 통신상의 자신의 비밀을 보호하기 위해 선정한 문자와 숫자의 조합</li>
              <li>콘텐츠: 회사가 회원에게 제공하는 부호·문자·음성·음향·화상·영상·도형·색채·이미지 등(이들의 복합체도 포함)을 말하며, 회원이 서비스가 제공하는 기능을 사용하여, 서비스상 작성된 결과물을 포함함</li>
              <li>유료서비스: 서비스 내에서 제공하는 유료 기능</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold">제4조 (약관의 공시 및 효력과 변경 등)</h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li>회사는 이 약관의 내용을 회원이 쉽게 알 수 있도록 서비스의 초기 서비스화면(전면)에 게시합니다. 다만, 약관의 내용은 회원이 연결화면을 통하여 볼 수 있도록 할 수 있습니다.</li>
              <li>회사는 「전자상거래 등에서의 소비자보호에 관한 법률」, 「약관의 규제에 관한 법률」, 「전자문서 및 전자거래기본법」, 「전자금융거래법」, 「전자서명법」, 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」, 「방문판매 등에 관한 법률」, 「소비자기본법」 등 관련 법을 위배하지 않는 범위에서 이 약관을 개정할 수 있습니다.</li>
              <li>회사가 이 약관을 개정할 경우에는 적용일자 및 개정사유를 명시하여 현행약관과 함께 회사의 초기화면에 그 적용일자 7일 이전부터 적용일자 전일까지 공지합니다. 다만, 회원에게 불리하게 약관내용을 변경하는 경우에는 최소한 30일 이상의 사전 유예기간을 두고 공지하고, 회원에게 개별 통지합니다.</li>
              <li>회사가 제3항에 따라 통지를 하면서 회원에게 적용일자까지 의사표시를 하지 않으면 약관 개정에 동의한 것으로 본다는 뜻을 분명히 알렸음에도 불구하고 공지된 적용일자까지 회원이 명시적으로 계약해지의 의사를 표명하지 않을 경우에는 개정된 약관에 동의하는 것으로 봅니다.</li>
              <li>이 약관에서 정하지 아니한 사항과 이 약관의 해석에 관하여는 전자상거래 등에서의 소비자보호에 관한 법률, 약관의 규제에 관한 법률, 기타 관계법령 또는 상관례에 따릅니다.</li>
            </ol>
          </section>

          <section>
            <h3 className="font-bold text-base">제2장 이용계약</h3>
          </section>

          <section>
            <h3 className="font-semibold">제5조 (회원가입 및 관리)</h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li>이용계약은 이용신청자가 회원가입 안내에서 이 약관의 내용에 대하여 동의하고 등록절차를 통해 서비스 이용 신청을 하고, 회사가 그 신청에 대해서 승낙함으로써 체결됩니다.</li>
              <li>이용신청자는 반드시 실명과 실제 정보를 사용해야 하며 한 회원은 오직 1건의 이용신청을 할 수 있습니다.</li>
              <li>실명이나 실제 정보를 입력하지 않은 회원은 법적인 보호를 받을 수 없으며, 서비스 이용이 불가합니다.</li>
              <li>회원은 회원가입 시 기재한 사항이 변경되었을 경우 온라인으로 수정을 하거나 전자우편 기타 방법으로 회사에 그 변경사항을 알려야 합니다.</li>
              <li>제4항의 변경사항을 회사에 알리지 않아 발생한 불이익에 대하여 회사는 고의 또는 중과실이 없는 한 책임지지 않습니다.</li>
              <li>만 14세 미만의 아동은 부모 등 법정대리인의 동의를 얻은 후에 서비스 이용 신청을 하여야 합니다.</li>
            </ol>
          </section>

          <section>
            <h3 className="font-semibold">제6조 (이용신청의 승낙)</h3>
            <p>회사는 아래 사항에 해당하는 경우에 그 제한사유가 해소될 때까지 승낙을 유보할 수 있습니다.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>서비스 관련 설비에 여유가 없는 경우</li>
              <li>기술상 또는 업무상 지장이 있는 경우</li>
              <li>기타 회사 사정상 필요하다고 인정되는 경우</li>
            </ul>
            <p className="mt-2">회사는 아래 사항에 해당하는 경우에 승낙을 하지 않을 수 있습니다.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>다른 사람의 명의를 사용하여 신청한 경우</li>
              <li>회원 정보를 허위로 기재하여 신청한 경우</li>
              <li>사회의 안녕질서 또는 미풍양속을 저해할 목적으로 신청한 경우</li>
              <li>이용 약관 위반으로 회원 자격을 박탈당하고 1년 이내에 재가입하는 경우</li>
              <li>만 14세 미만의 아동이 부모 등 법정대리인의 동의 없이 신청한 경우</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-base">제3장 계약 당사자의 의무</h3>
          </section>

          <section>
            <h3 className="font-semibold">제7조 (회사의 의무)</h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li>회사는 법령과 이 약관이 금지하거나 공서양속에 반하는 행위를 하지 않으며 이 약관이 정하는 바에 따라 지속적이고, 안정적으로 재화 또는 용역을 제공하는데 최선을 다하여야 합니다.</li>
              <li>회사는 회원이 안전하게 서비스를 이용할 수 있도록 개인정보보호를 위해 보안시스템을 갖추어야 하며 개인정보처리방침을 공시하고 준수합니다.</li>
              <li>회사는 회원으로부터 제기되는 의견이나 불만이 정당하다고 인정될 경우에는 즉시 처리해야 합니다.</li>
            </ol>
          </section>

          <section>
            <h3 className="font-semibold">제8조 (회원의 의무)</h3>
            <p>회원은 이 약관 및 회사의 공지사항, 웹사이트 이용안내 등 개별 서비스 정책을 숙지하고 준수해야 하며 아래 각 호의 행위를 해서는 안 됩니다.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>서비스의 신청 또는 변경 시 허위내용의 기재</li>
              <li>타인의 정보 또는 결제수단의 도용</li>
              <li>회사에 게시된 정보의 변경 또는 서비스에 장애를 주는 행위</li>
              <li>다른 회원의 개인정보 및 계정정보를 무단으로 수집·저장·게시·유포하는 행위</li>
              <li>리버스엔지니어링, 디컴파일, 디스어셈블 및 기타 일체의 가공행위를 통하여 서비스를 복제, 분해 또는 모방 기타 변형하는 행위</li>
              <li>해킹, 자동 접속 프로그램 등을 사용하는 등 정상적인 용법과 다른 방법으로 서비스를 이용하여 회사의 서버에 부하를 일으켜 회사의 정상적인 서비스를 방해하는 행위</li>
              <li>본인 아닌 제3자에게 계정을 대여, 양도하는 등 접속권한을 부여하는 행위</li>
              <li>도박 등 사행행위를 하거나 유도하는 행위, 음란·저속한 정보를 입력·교류·게재하거나 음란 사이트를 연결하는 행위</li>
              <li>음란물 등 관련 법령에 따라 위법한 정보를 전송·게시·유포하는 행위</li>
              <li>회사의 동의 없이 영리, 영업, 광고, 홍보, 정치활동, 선거운동 등 본래의 용도 이외의 용도로 서비스를 이용하는 행위</li>
              <li>기타 불법적이거나 이 약관에 위반되는 부당한 행위</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-base">제4장 서비스의 제공 및 이용</h3>
          </section>

          <section>
            <h3 className="font-semibold">제9조 (서비스 이용)</h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li>회원은 이 약관의 규정된 사항을 준수해 서비스를 이용합니다.</li>
              <li>회사가 회원의 이용신청을 승낙한 때부터 회원은 서비스를 이용할 수 있습니다.</li>
              <li>서비스의 이용은 연중무휴, 1일 24시간을 원칙으로 합니다. 다만, 회사의 업무상 또는 기술상의 이유로 서비스가 일시 중지될 수 있습니다.</li>
            </ol>
          </section>

          <section>
            <h3 className="font-semibold">제10조 (유료서비스)</h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li>서비스는 원칙적으로 유료서비스로 제공됩니다. 단, 회사는 회원의 전부 또는 일부에게 서비스의 전부 또는 일부를 무료로 제공할 수 있습니다.</li>
              <li>회사는 회원에게 회사의 서비스의 전부 또는 일부를 유료로 제공할 수 있으며, 유료서비스에 관한 구체적인 사항은 유료서비스 공지사항 또는 별도의 유료서비스 운영정책에서 정한 바에 따릅니다.</li>
            </ol>
          </section>

          <section>
            <h3 className="font-semibold">제11조 (서비스 제공의 중지)</h3>
            <p>회사는 다음 각 호에 해당하는 경우 서비스의 전부 또는 일부의 제공을 중지할 수 있습니다.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>전기통신사업법 상에 규정된 기간통신사업자/인터넷망사업자가 서비스를 중지했을 경우</li>
              <li>정전으로 서비스 제공이 불가능할 경우</li>
              <li>설비의 이전, 보수 또는 공사로 인해 부득이한 경우</li>
              <li>서비스 설비의 장애 또는 서비스 이용의 폭주 등으로 정상적인 서비스 제공이 어려운 경우</li>
              <li>전시, 사변, 천재지변 또는 이에 준하는 국가비상사태가 발생하거나 발생할 우려가 있는 경우</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold">제12조 (회원 탈퇴 및 자격 상실)</h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li>회원은 회사에 언제든지 이용계약의 해지(탈퇴)를 요청할 수 있으며 회사는 즉시 회원탈퇴를 처리합니다.</li>
              <li>회원이 다음 각호의 사유에 해당하는 경우, 회사는 회원자격을 제한 및 정지시키거나 이용계약을 해지할 수 있습니다.</li>
            </ol>
          </section>

          <section>
            <h3 className="font-semibold">제16조 (저작권 등의 귀속 등)</h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li>회원이 콘텐츠와 관련하여 보유하고 있는 모든 지적 재산권의 소유권은 유지됩니다. 즉, 회원이 보유한 콘텐츠는 회원에게 존속됩니다.</li>
              <li>회사는 서비스 특성상 회원이 서비스가 제공하는 기능을 사용하여, 서비스상 작성된 결과물이나 결과물 작성과정에 노출된 각종 정보가 타인의 저작권과 기타 지적재산권을 침해하지 않음을 보증하지 않습니다.</li>
              <li>회사는 회원이 서비스 내에 게시한 게시글 및 회원이 서비스가 제공하는 기능을 사용하여, 서비스상 작성된 결과물을 서비스 내 노출, 서비스 홍보를 위한 활용, 서비스 운영, 개선 및 새로운 서비스 개발을 위한 연구 목적을 위하여 이용할 수 있습니다.</li>
            </ol>
          </section>

          <section>
            <h3 className="font-bold text-base">제5장 재화의 주문 및 결제 관련</h3>
          </section>

          <section>
            <h3 className="font-semibold">제17조 (대금결제)</h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li>회원은 유료서비스에 대한 버튼을 클릭함으로써 이 본 이용약관 및 게시된 구매조건에 따라 유료서비스 이용계약이 성립하고, 이용요금이 결제됩니다.</li>
              <li>회원은 유료서비스에 대하여 선불카드, 직불카드, 신용카드 등의 각종 카드 결제 수단을 이용하여 결제할 수 있습니다.</li>
            </ol>
          </section>

          <section>
            <h3 className="font-semibold">제18조 (청약철회 등)</h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li>회사와 유료서비스의 구매에 관한 계약을 체결한 회원은 해당 유료서비스를 전혀 사용하지 아니하였을 경우에 한하여 결제일과 콘텐츠 이용 가능일 중 늦은 날부터 7일 이내에 청약철회를 할 수 있습니다.</li>
              <li>청약철회가 불가능한 경우: 회원이 이미 사용하거나 일부 소비하여 그 가치가 현저히 감소한 경우, 디지털콘텐츠의 제공이 개시된 경우</li>
            </ol>
          </section>

          <section>
            <h3 className="font-bold text-base">제6장 AI 윤리 규정 관련</h3>
          </section>

          <section>
            <h3 className="font-semibold">제20조 (AI 윤리 규정)</h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li>회사의 모든 구성원은 AI 윤리를 중요하게 여기며 자체적인 AI 윤리 규정을 준수합니다.</li>
              <li>회사는 사용자에게 친근하고 유용한 AI를 지향하고 있습니다. 그 과정에서 올바른 표현 도출과 개인정보 보호를 우선하고 있으며 잘못된 정보와 편향된 정보가 도출되지 않도록 노력하고 있습니다.</li>
            </ol>
          </section>

          <section>
            <h3 className="font-bold text-base">제8장 기타</h3>
          </section>

          <section>
            <h3 className="font-semibold">제28조 (면책 및 손해배상)</h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li>회사 또는 회원은 본 약관을 위반하여 상대방에게 손해를 입힌 경우에는 그 손해를 배상할 책임이 있습니다. 다만, 고의 또는 과실이 없는 경우에는 그러하지 아니 합니다.</li>
              <li>회사는 서비스용 설비의 보수, 교체, 정기점검 등의 사유로 인하여 회원에게 발생한 손해에 대하여 책임을 지지 않습니다. 다만, 회사의 고의 또는 중과실에 의한 경우에는 그러하지 아니합니다.</li>
            </ol>
          </section>

          <section>
            <h3 className="font-semibold">제29조 (회원에 대한 통지)</h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li>회사가 회원에 대한 통지를 하는 경우, 회원의 전자우편 주소, 휴대전화번호, 문자메시지(SMS/MMS) 등으로 할 수 있습니다.</li>
              <li>회사가 불특정다수 회원에 대한 통지의 경우 7일이상 회사 홈페이지 내에 게시함으로써 개별 통지에 갈음할 수 있습니다.</li>
            </ol>
          </section>

          <section>
            <h3 className="font-semibold">제30조 (재판권 및 준거법)</h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li>이 약관은 대한민국 법률에 따라 규율되고 해석됩니다.</li>
              <li>회사와 회원은 본 서비스 이용과 관련해 발생한 분쟁을 원만하게 해결하기 위하여 필요한 모든 노력을 해야 합니다.</li>
              <li>회사와 회원 간에 발생한 분쟁으로 소송이 제기되는 경우에는 민사소송법에 따라 관할권을 가지는 법원을 관할 법원으로 합니다.</li>
            </ol>
          </section>

          <div className="border-t pt-6 mt-8 text-gray-500">
            <p>공고일자: 2026.03.08</p>
            <p>시행일자: 2026.03.11</p>
          </div>
        </div>
      </div>
    </div>
  );
}
