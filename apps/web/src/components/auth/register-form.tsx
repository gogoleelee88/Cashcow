'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Zap, AlertCircle, CheckCircle2, Loader2, ChevronRight, Check, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { isValidEmail, isValidUsername, isValidPassword } from '@characterverse/utils';
import { cn } from '../../lib/utils';

// ─────────────────────────────────────────────
// TERMS MODAL
// ─────────────────────────────────────────────
const TERMS_CONTENT: Record<string, { title: string; content: React.ReactNode }> = {
  service: {
    title: '서비스 이용약관',
    content: (
      <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed space-y-6 text-[14px]">
        <section><h3 className="font-bold text-base">제1장 총칙</h3></section>
        <section>
          <h3 className="font-semibold">제1조 (목적)</h3>
          <p>이 약관은 CharacterVerse(이하 '회사')은(는) 회사가 운영하는 CharacterVerse 및 이에 부수하는 제반 서비스(통칭하여 이하 '서비스')의 이용조건 및 절차에 관한 사항 및 기타 필요한 사항을 규정함을 목적으로 하며, 본 약관에 동의함으로써 해당 서비스들도 별도 이용계약 체결없이 이용이 가능합니다.</p>
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
            <li>회사는 이 약관의 내용을 회원이 쉽게 알 수 있도록 서비스의 초기 서비스화면(전면)에 게시합니다.</li>
            <li>회사는 관련 법을 위배하지 않는 범위에서 이 약관을 개정할 수 있습니다.</li>
            <li>회사가 이 약관을 개정할 경우에는 적용일자 및 개정사유를 명시하여 현행약관과 함께 회사의 초기화면에 그 적용일자 7일 이전부터 공지합니다.</li>
          </ol>
        </section>
        <section><h3 className="font-bold text-base">제2장 이용계약</h3></section>
        <section>
          <h3 className="font-semibold">제5조 (회원가입 및 관리)</h3>
          <ol className="list-decimal pl-5 space-y-2">
            <li>이용계약은 이용신청자가 이 약관의 내용에 대하여 동의하고 등록절차를 통해 서비스 이용 신청을 하고, 회사가 그 신청에 대해서 승낙함으로써 체결됩니다.</li>
            <li>이용신청자는 반드시 실명과 실제 정보를 사용해야 하며 한 회원은 오직 1건의 이용신청을 할 수 있습니다.</li>
            <li>만 14세 미만의 아동은 부모 등 법정대리인의 동의를 얻은 후에 서비스 이용 신청을 하여야 합니다.</li>
          </ol>
        </section>
        <section>
          <h3 className="font-semibold">제8조 (회원의 의무)</h3>
          <p>회원은 이 약관 및 회사의 공지사항 등 개별 서비스 정책을 숙지하고 준수해야 하며 아래 각 호의 행위를 해서는 안 됩니다.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>서비스의 신청 또는 변경 시 허위내용의 기재</li>
            <li>타인의 정보 또는 결제수단의 도용</li>
            <li>회사에 게시된 정보의 변경 또는 서비스에 장애를 주는 행위</li>
            <li>해킹, 자동 접속 프로그램 등을 사용하는 등 비정상적인 방법으로 서비스를 이용하는 행위</li>
          </ul>
        </section>
        <section>
          <h3 className="font-semibold">제16조 (저작권 등의 귀속)</h3>
          <ol className="list-decimal pl-5 space-y-2">
            <li>회원이 콘텐츠와 관련하여 보유하고 있는 모든 지적 재산권의 소유권은 유지됩니다.</li>
            <li>회사는 회원이 서비스 내에 게시한 게시글을 서비스 내 노출, 서비스 홍보를 위한 활용, 서비스 운영 및 개선을 위한 연구 목적으로 이용할 수 있습니다.</li>
          </ol>
        </section>
        <section>
          <h3 className="font-semibold">제30조 (재판권 및 준거법)</h3>
          <ol className="list-decimal pl-5 space-y-2">
            <li>이 약관은 대한민국 법률에 따라 규율되고 해석됩니다.</li>
            <li>회사와 회원 간에 발생한 분쟁으로 소송이 제기되는 경우에는 민사소송법에 따라 관할권을 가지는 법원을 관할 법원으로 합니다.</li>
          </ol>
        </section>
        <div className="border-t pt-6 mt-8 text-gray-500">
          <p>공고일자: 2026.03.08</p>
          <p>시행일자: 2026.03.11</p>
        </div>
      </div>
    ),
  },
  privacy: {
    title: '개인정보 수집 및 이용',
    content: (
      <div className="text-[14px] text-gray-800 leading-relaxed space-y-6">
        <p>CharacterVerse(이하 '회사')가 운영하는 CharacterVerse은(는) 아래와 같이 정보주체의 개인정보를 수집·이용합니다.</p>
        <section>
          <p className="font-bold mb-3">■ 정보주체의 동의를 받아 처리하는 개인정보</p>
          <p className="font-semibold mb-2">① 회원가입을 위해 수집하는 개인정보</p>
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
                  <td className="border border-gray-300 px-3 py-2">회원가입 및 이용자 식별, 문의 및 민원 처리</td>
                  <td className="border border-gray-300 px-3 py-2">이메일, 비밀번호</td>
                  <td className="border border-gray-300 px-3 py-2">회원탈퇴 시까지</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <div className="bg-gray-50 p-4 rounded text-[13px] text-gray-600">
          ※ 정보주체는 개인정보 수집·이용에 동의하지 않을 권리가 있으나, 동의를 거부할 경우 서비스 이용이 어렵습니다.
        </div>
        <div className="border-t pt-6 text-gray-500">
          <p>공고일자: 2026.01.21</p>
          <p>시행일자: 2026.01.21</p>
        </div>
      </div>
    ),
  },
  marketing: {
    title: '이벤트·혜택 정보 수신 및 활용',
    content: (
      <div className="text-[14px] text-gray-800 leading-relaxed space-y-6">
        <p>본 동의는 서비스에서 수집한 아래와 같은 항목을 이용하여 전자적 전송매체를 통해 마케팅 등의 목적으로 개인에게 광고성 정보를 전송하는 것에 대한 수신동의입니다. 사용자는 본 동의를 거부할 권리가 있습니다.</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-2 text-left font-semibold">개인정보 수집 항목</th>
                <th className="border border-gray-300 px-3 py-2 text-left font-semibold">수집 및 이용 목적</th>
                <th className="border border-gray-300 px-3 py-2 text-left font-semibold">보유 및 이용기간</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-3 py-2">이름, 이메일, 소속, 휴대폰번호</td>
                <td className="border border-gray-300 px-3 py-2">이벤트 운영 및 광고성 정보 전송, 신규 기능 및 프로모션 제공</td>
                <td className="border border-gray-300 px-3 py-2">동의 철회 또는 탈퇴 시까지</td>
              </tr>
            </tbody>
          </table>
        </div>
        <section>
          <p className="font-semibold mb-3">안내</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>본 동의에는 야간 시간대(오후 9시 ~ 익일 오전 8시)에 발송되는 광고성 정보 수신이 포함됩니다.</li>
            <li>이벤트·혜택 정보 수신 설정은 [설정 &gt; 계정 설정]에서 변경할 수 있습니다.</li>
          </ul>
        </section>
        <div className="border-t pt-6 text-gray-500">
          <p>공고일자: 2025.12.22</p>
          <p>시행일자: 2025.12.22</p>
        </div>
      </div>
    ),
  },
};

function TermsModal({ type, onClose, onAgree }: { type: keyof typeof TERMS_CONTENT; onClose: () => void; onAgree: () => void }) {
  const { title, content } = TERMS_CONTENT[type];
  const [reachedBottom, setReachedBottom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const checkBottom = (el: HTMLDivElement) => {
    if (el.scrollHeight <= el.clientHeight + 10) {
      setReachedBottom(true);
    }
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
      setReachedBottom(true);
    }
  };

  const handleAgree = () => {
    onAgree();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl w-full max-w-[640px] max-h-[80vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <h2 className="text-[17px] font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div
          ref={(el) => { (scrollRef as any).current = el; if (el) checkBottom(el); }}
          onScroll={handleScroll}
          className="overflow-y-auto px-6 py-5 flex-1"
        >{content}</div>
        <div className="px-6 py-4 border-t flex-shrink-0">
          {reachedBottom ? (
            <button
              onClick={handleAgree}
              className="w-full py-3 rounded-xl bg-gray-900 text-white text-[15px] font-semibold hover:bg-gray-800 transition-colors"
            >
              동의하기
            </button>
          ) : (
            <p className="text-center text-[13px] text-gray-400">내용을 끝까지 읽어주세요</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TERMS STEP
// ─────────────────────────────────────────────
function TermsStep({ onNext }: { onNext: () => void }) {
  const [agreed, setAgreed] = useState({
    age: false,
    service: false,
    privacy: false,
    marketing: false,
  });
  const [viewed, setViewed] = useState({
    service: false,
    privacy: false,
    marketing: false,
  });
  const [warned, setWarned] = useState<string | null>(null);
  const [openModal, setOpenModal] = useState<keyof typeof TERMS_CONTENT | null>(null);

  const openTerms = (key: keyof typeof TERMS_CONTENT) => {
    setOpenModal(key);
    markViewed(key);
  };

  const allRequired = agreed.age && agreed.service && agreed.privacy;
  const allChecked = allRequired && agreed.marketing;

  const toggleAll = () => {
    const canToggleAll = viewed.service && viewed.privacy;
    if (!canToggleAll) return;
    const next = !allChecked;
    const marketingNext = viewed.marketing ? next : false;
    setAgreed({ age: next, service: next, privacy: next, marketing: marketingNext });
  };

  const toggle = (key: keyof typeof agreed) => {
    if (key !== 'age' && !viewed[key as keyof typeof viewed]) {
      setWarned(key);
      setTimeout(() => setWarned(null), 2000);
      return;
    }
    setAgreed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const markViewed = (key: keyof typeof viewed) => {
    setViewed((prev) => ({ ...prev, [key]: true }));
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-4">
      {openModal && (
        <TermsModal
          type={openModal}
          onClose={() => setOpenModal(null)}
          onAgree={() => setAgreed((prev) => ({ ...prev, [openModal]: true }))}
        />
      )}
      {/* Header */}
      <div className="w-full max-w-[560px] pt-16 pb-10 text-center">
        <div className="text-[#E8613C] font-bold text-base mb-2">CharacterVerse</div>
        <h1 className="text-[28px] font-bold text-gray-900">회원가입</h1>
      </div>

      {/* Terms card */}
      <div className="w-full max-w-[560px]">
        <div className="mb-5">
          <p className="text-sm font-semibold text-gray-800">CharacterVerse 계정</p>
          <p className="text-[17px] font-bold text-gray-900 mt-0.5">서비스 약관에 동의해주세요</p>
        </div>

        <div className="space-y-0">
          {/* 모두 동의 */}
          <label className="flex items-center gap-3 py-3 cursor-pointer select-none">
            <span
              onClick={toggleAll}
              className={cn(
                'w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-colors',
                allChecked ? 'bg-[#3CBFB4] border-[#3CBFB4]' : 'border-gray-300 bg-white'
              )}
            >
              {allChecked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </span>
            <span className="text-[15px] font-semibold text-gray-800" onClick={toggleAll}>모두 동의</span>
          </label>

          {/* divider */}
          <div className="h-px bg-gray-200 my-1" />

          {/* 만 14세 */}
          <label className="flex items-center gap-3 py-3 cursor-pointer select-none" onClick={() => toggle('age')}>
            <span className={cn(
              'w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-colors',
              agreed.age ? 'bg-[#3CBFB4] border-[#3CBFB4]' : 'border-gray-300 bg-white'
            )}>
              {agreed.age && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </span>
            <span className="text-[14px] text-gray-700">만 14세 이상입니다</span>
          </label>

          {/* 서비스 이용약관 */}
          <div className="flex items-center gap-3 py-3">
            <span
              onClick={() => toggle('service')}
              className={cn(
                'w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-colors',
                viewed.service ? 'cursor-pointer' : 'cursor-not-allowed opacity-40',
                agreed.service ? 'bg-[#3CBFB4] border-[#3CBFB4]' : 'border-gray-300 bg-white'
              )}
            >
              {agreed.service && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </span>
            <span
              className={cn('text-[14px] text-gray-700 flex-1', viewed.service ? 'cursor-pointer' : 'cursor-not-allowed')}
              onClick={() => toggle('service')}
            >
              [필수] 서비스 이용약관
              {warned === 'service' && <span className="ml-1 text-[11px] text-red-400">내용을 먼저 확인해주세요</span>}
            </span>
            <button type="button" onClick={() => openTerms('service')} className="text-gray-400 hover:text-gray-600">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* 개인정보 수집 및 이용 */}
          <div className="flex items-center gap-3 py-3">
            <span
              onClick={() => toggle('privacy')}
              className={cn(
                'w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-colors',
                viewed.privacy ? 'cursor-pointer' : 'cursor-not-allowed opacity-40',
                agreed.privacy ? 'bg-[#3CBFB4] border-[#3CBFB4]' : 'border-gray-300 bg-white'
              )}
            >
              {agreed.privacy && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </span>
            <span
              className={cn('text-[14px] text-gray-700 flex-1', viewed.privacy ? 'cursor-pointer' : 'cursor-not-allowed')}
              onClick={() => toggle('privacy')}
            >
              [필수] 개인정보 수집 및 이용
              {warned === 'privacy' && <span className="ml-1 text-[11px] text-red-400">내용을 먼저 확인해주세요</span>}
            </span>
            <button type="button" onClick={() => openTerms('privacy')} className="text-gray-400 hover:text-gray-600">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* 마케팅 */}
          <div className="flex items-center gap-3 py-3">
            <span
              onClick={() => toggle('marketing')}
              className={cn(
                'w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-colors',
                viewed.marketing ? 'cursor-pointer' : 'cursor-not-allowed opacity-40',
                agreed.marketing ? 'bg-[#3CBFB4] border-[#3CBFB4]' : 'border-gray-300 bg-white'
              )}
            >
              {agreed.marketing && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </span>
            <span
              className={cn('text-[14px] text-gray-700 flex-1', viewed.marketing ? 'cursor-pointer' : 'cursor-not-allowed')}
              onClick={() => toggle('marketing')}
            >
              [선택] 이벤트•혜택 정보 수신 및 활용 동의
              {warned === 'marketing' && <span className="ml-1 text-[11px] text-red-400">내용을 먼저 확인해주세요</span>}
            </span>
            <button type="button" onClick={() => openTerms('marketing')} className="text-gray-400 hover:text-gray-600">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 다음 버튼 */}
        <div className="mt-10">
          <button
            onClick={onNext}
            disabled={!allRequired}
            className={cn(
              'w-full py-[17px] rounded-xl text-[15px] font-semibold transition-colors',
              allRequired
                ? 'bg-gray-900 text-white hover:bg-gray-800'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            )}
          >
            다음
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto pt-12 pb-6 flex items-center gap-6 text-xs text-gray-400">
        <Link href="/terms" className="hover:text-gray-600">이용약관</Link>
        <Link href="/privacy" className="hover:text-gray-600">개인정보처리방침</Link>
        <Link href="/youth-policy" className="hover:text-gray-600">청소년 보호정책</Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// REGISTER FORM (step 2)
// ─────────────────────────────────────────────
export function RegisterForm() {
  const [step, setStep] = useState<'terms' | 'form'>('terms');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    displayName: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuthStore();

  if (step === 'terms') {
    return <TermsStep onNext={() => setStep('form')} />;
  }

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!isValidEmail(formData.email)) newErrors.email = '유효한 이메일을 입력해주세요';
    if (!isValidUsername(formData.username)) newErrors.username = '3-20자의 영문, 숫자, _만 사용 가능합니다';
    if (!isValidPassword(formData.password)) newErrors.password = '8자 이상, 대문자 및 숫자 포함';
    if (!formData.displayName.trim()) newErrors.displayName = '이름을 입력해주세요';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setApiError('');
    setIsLoading(true);

    try {
      const res = await api.auth.register(formData);
      if (res.success) {
        login(res.data.user, res.data.accessToken, res.data.refreshToken);
        router.push('/');
      }
    } catch (err: any) {
      setApiError(err.response?.data?.error?.message || '회원가입에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuth = (provider: string) => {
    window.location.href = api.auth.oauthUrl(provider);
  };

  const passwordStrength = () => {
    const p = formData.password;
    if (!p) return 0;
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score;
  };

  const strengthColors = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500'];
  const strengthLabels = ['', '매우 약함', '약함', '보통', '강함'];
  const strength = passwordStrength();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md"
    >
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center gap-2.5 mb-6">
          <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center shadow-brand">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl gradient-text">CharacterVerse</span>
        </Link>
        <h1 className="text-2xl font-bold text-text-primary mb-1">함께해요! 🎉</h1>
        <p className="text-text-muted text-sm">무료로 가입하고 100 크레딧을 받으세요</p>
      </div>

      <div className="card p-6">
        {/* OAuth */}
        <div className="space-y-2.5 mb-6">
          <button
            onClick={() => handleOAuth('kakao')}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl
                       bg-[#FEE500] hover:bg-[#F5D800] text-[#3B1E1E] font-semibold text-sm transition-all"
          >
            <span className="text-base">💬</span> 카카오로 시작하기
          </button>
          <button
            onClick={() => handleOAuth('google')}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl
                       bg-white hover:bg-gray-50 text-gray-800 font-semibold text-sm
                       border border-gray-200 transition-all"
          >
            <span className="text-base">G</span> Google로 시작하기
          </button>
        </div>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-border" />
          <span className="text-text-muted text-xs">또는 이메일로</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {apiError && (
          <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-5">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-text-secondary text-sm font-medium mb-1.5">이름 (닉네임)</label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              placeholder="홍길동"
              className={cn('input-base', errors.displayName && 'border-red-500/50 focus:ring-red-500/30')}
            />
            {errors.displayName && <p className="text-red-400 text-xs mt-1">{errors.displayName}</p>}
          </div>

          <div>
            <label className="block text-text-secondary text-sm font-medium mb-1.5">사용자명</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted text-sm">@</span>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase() })}
                placeholder="username"
                className={cn('input-base pl-8', errors.username && 'border-red-500/50')}
              />
            </div>
            {errors.username ? (
              <p className="text-red-400 text-xs mt-1">{errors.username}</p>
            ) : formData.username && isValidUsername(formData.username) ? (
              <p className="text-emerald-400 text-xs mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> 사용 가능한 사용자명입니다
              </p>
            ) : null}
          </div>

          <div>
            <label className="block text-text-secondary text-sm font-medium mb-1.5">이메일</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="name@example.com"
              className={cn('input-base', errors.email && 'border-red-500/50')}
            />
            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-text-secondary text-sm font-medium mb-1.5">비밀번호</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                className={cn('input-base pr-10', errors.password && 'border-red-500/50')}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {formData.password && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className={cn('h-1 flex-1 rounded-full transition-all duration-300',
                      i <= strength ? strengthColors[strength] : 'bg-border')} />
                  ))}
                </div>
                <p className="text-xs text-text-muted">{strengthLabels[strength]}</p>
              </div>
            )}
            {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
          </div>

          <p className="text-text-muted text-xs">
            가입하면 <Link href="/terms" className="text-brand-light hover:underline">이용약관</Link> 및{' '}
            <Link href="/privacy" className="text-brand-light hover:underline">개인정보처리방침</Link>에 동의하는 것으로 간주됩니다.
          </p>

          <button type="submit" disabled={isLoading} className="btn-primary w-full flex items-center justify-center gap-2">
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isLoading ? '가입 중...' : '무료로 가입하기'}
          </button>
        </form>
      </div>

      <p className="text-center text-text-muted text-sm mt-5">
        이미 계정이 있으신가요?{' '}
        <Link href="/login" className="text-brand-light hover:underline font-medium">로그인</Link>
      </p>
    </motion.div>
  );
}
