'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, HelpCircle, Clock, History, X, Upload, Trash2, Wand2, ChevronUp, ChevronDown, AlertCircle, Megaphone, Plus, GripVertical, MessageSquare, ZoomIn, ZoomOut, Check, Loader2 } from 'lucide-react';
import Cropper from 'react-easy-crop';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../stores/auth.store';
import { useStoryDraftStore, type DraftKeywordNote } from '../../stores/story-draft.store';
import { api } from '../../lib/api';

// ── data URL → Blob 변환 (CSP connect-src에서 data: 가 차단되므로 fetch 대신 사용) ──
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// ── 자동저장 훅 ───────────────────────────────────────────────────────────
function useAutoSave(initialStoryId?: string) {
  const {
    storyId, setStoryId, setSaveStatus,
    name, description, systemPrompt,
    startSettings, setStartSettings,
    examples,
    squareImage, setSquareImage,
    verticalImage, setVerticalImage,
  } = useStoryDraftStore();

  // ── 폼 진입: storyId 결정 ─────────────────────────────────────────────
  useEffect(() => {
    if (initialStoryId) {
      setStoryId(initialStoryId);
      return;
    }
    if (storyId) return;
    api.stories.create({}).then((res) => {
      setStoryId(res.data.id);
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 커버 이미지 복원: storyId 확정 후 이미지가 없으면 서버에서 가져옴 ──
  useEffect(() => {
    if (!storyId || squareImage) return;
    api.stories.getEditData(storyId).then((res: any) => {
      const d = res.data;
      if (d.coverUrl)         setSquareImage(d.coverUrl,         d.coverKey ?? null);
      if (d.coverVerticalUrl) setVerticalImage(d.coverVerticalUrl, d.coverVerticalKey ?? null);
    }).catch(() => {});
  }, [storyId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── storyId 확정 후, data URL로 임시 저장된 커버 이미지를 Supabase에 업로드 ──
  useEffect(() => {
    if (!storyId) return;

    const uploadPending = async (
      imageData: string | null,
      variant: 'square' | 'vertical',
      onDone: (url: string, key: string) => void,
    ) => {
      // Supabase URL이면 이미 업로드된 것 → 스킵
      if (!imageData || imageData.startsWith('https://')) return;
      // data URL인 경우 Supabase에 업로드
      try {
        const blob = imageData.startsWith('data:') ? dataUrlToBlob(imageData) : await fetch(imageData).then(r => r.blob());
        const { data } = await api.stories.getCoverUploadUrl(storyId, {
          contentType: 'image/jpeg',
          variant,
        });
        await fetch(data.uploadUrl, {
          method: 'PUT',
          body: blob,
          headers: { 'Content-Type': 'image/jpeg' },
        });
        await api.stories.confirmCoverUpload(storyId, {
          variant,
          url: data.publicUrl,
          key: data.key,
        });
        onDone(data.publicUrl, data.key);
      } catch {
        // 업로드 실패 시 data URL 유지
      }
    };

    uploadPending(squareImage, 'square', (url, key) => setSquareImage(url, key));
    uploadPending(verticalImage, 'vertical', (url, key) => setVerticalImage(url, key));
  }, [storyId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 이름 + 소개 debounce 저장 (800ms) ────────────────────────────────
  useEffect(() => {
    if (!storyId || (!name && !description)) return;
    const t = setTimeout(() => {
      setSaveStatus('saving');
      api.stories.update(storyId, { title: name, description })
        .then(() => setSaveStatus('saved'))
        .catch(() => setSaveStatus('error'));
    }, 800);
    return () => clearTimeout(t);
  }, [storyId, name, description]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 시스템 프롬프트 debounce 저장 (800ms) ────────────────────────────
  useEffect(() => {
    if (!storyId || !systemPrompt) return;
    const t = setTimeout(() => {
      setSaveStatus('saving');
      api.stories.updateSystemPrompt(storyId, systemPrompt)
        .then(() => setSaveStatus('saved'))
        .catch(() => setSaveStatus('error'));
    }, 800);
    return () => clearTimeout(t);
  }, [storyId, systemPrompt]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── draft-snapshot: startSettings + examples debounce 저장 (1500ms) ─
  useEffect(() => {
    if (!storyId) return;
    const t = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const res = await api.stories.saveDraftSnapshot(storyId, {
          startSettings: startSettings.map(s => ({
            localId: s.id,
            name: s.name,
            prologue: s.prologue ?? '',
            situation: s.situation ?? '',
            playGuide: s.playGuide ?? '',
            suggestedReplies: s.suggestedReplies ?? [],
          })),
          examples: examples.map(e => ({
            localId: e.id,
            user: e.user,
            assistant: e.assistant,
          })),
        });
        // 서버 ID로 로컬 store 업데이트 (ID 동기화) — 실제 변경 있을 때만
        const idMap = res?.data?.startSettingIdMap;
        if (idMap) {
          const hasChange = startSettings.some(s => idMap[s.id] && idMap[s.id] !== s.id);
          if (hasChange) {
            const synced = startSettings.map(s => ({ ...s, id: idMap[s.id] ?? s.id }));
            setStartSettings(synced as any);
          }
        }
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [storyId, startSettings, examples]); // eslint-disable-line react-hooks/exhaustive-deps
}

// ─────────────────────────────────────────────
// TABS
// ─────────────────────────────────────────────
type StoryTab = 'profile' | 'story-settings' | 'start-settings' | 'stat-settings' | 'media' | 'keywords' | 'ending' | 'register';

const TABS: { key: StoryTab; label: string; required?: boolean }[] = [
  { key: 'profile',        label: '프로필',   required: true },
  { key: 'story-settings', label: '스토리 설정', required: true },
  { key: 'start-settings', label: '시작 설정',  required: true },
  { key: 'stat-settings',  label: '스탯 설정' },
  { key: 'media',          label: '미디어' },
  { key: 'keywords',       label: '키워드북' },
  { key: 'ending',         label: '엔딩 설정' },
  { key: 'register',       label: '등록',     required: true },
];

// ─────────────────────────────────────────────
// AI CHAT MODELS
// ─────────────────────────────────────────────
interface ChatModel {
  value: string;
  label: string;
  icon: string;
  iconColor: string;
  description: string;
  coins: number | null;
  coinColor: string;
}

const CHAT_MODELS: ChatModel[] = [
  {
    value: 'hyper_chat',
    label: '하이퍼챗',
    icon: '⚡',
    iconColor: '#F59E0B',
    description: 'Opus-4.6을 활용한 최고 품질의 스토리',
    coins: 75,
    coinColor: '#F59E0B',
  },
  {
    value: 'super_chat_25',
    label: '슈퍼챗 2.5',
    icon: '🔥',
    iconColor: '#F97316',
    description: 'Sonnet-4.6을 활용한 다채로운 인물 묘사로 풍부하게 즐기는 스토리',
    coins: 50,
    coinColor: '#F97316',
  },
  {
    value: 'super_chat_20',
    label: '슈퍼챗 2.0',
    icon: '💧',
    iconColor: '#3B82F6',
    description: 'Sonnet-4.5를 활용한 생동감 넘치고 재미있는 스토리',
    coins: 50,
    coinColor: '#3B82F6',
  },
  {
    value: 'super_chat_15',
    label: '슈퍼챗 1.5',
    icon: '💧',
    iconColor: '#60A5FA',
    description: 'Sonnet-4.0을 활용한 실감나는 스토리',
    coins: 50,
    coinColor: '#60A5FA',
  },
  {
    value: 'pro_chat_25',
    label: '프로챗 2.5',
    icon: '✦',
    iconColor: '#8B5CF6',
    description: 'Gemini 3.1 Pro를 활용한 한층 깊어진 몰입감의 스토리',
    coins: 58,
    coinColor: '#8B5CF6',
  },
  {
    value: 'pro_chat_10',
    label: '프로챗 1.0',
    icon: '✦',
    iconColor: '#A78BFA',
    description: 'Gemini 2.5 Pro를 활용한 상황 묘사로 몰입도 있는 스토리',
    coins: 50,
    coinColor: '#A78BFA',
  },
  {
    value: 'power_chat',
    label: '파워챗',
    icon: '✦',
    iconColor: '#10B981',
    description: '가볍게 즐길 수 있는 스토리',
    coins: 20,
    coinColor: '#10B981',
  },
  {
    value: 'normal_chat',
    label: '일반챗',
    icon: '●',
    iconColor: '#9CA3AF',
    description: '무료로 이용할 수 있는 스토리',
    coins: null,
    coinColor: '#9CA3AF',
  },
];

// ─────────────────────────────────────────────
// AGE VERIFICATION MODAL
// ─────────────────────────────────────────────
type AgeVerifyStep = 'warning' | 'carrier' | 'waiting';
type Carrier = 'SKT' | 'KT' | 'LGU' | 'SKT_MVNO' | 'KT_MVNO' | 'LGU_MVNO';

const CARRIERS: { value: Carrier; label: string }[] = [
  { value: 'SKT',      label: 'SKT' },
  { value: 'KT',       label: 'KT' },
  { value: 'LGU',      label: 'LG U+' },
  { value: 'SKT_MVNO', label: 'SKT 알뜰폰' },
  { value: 'KT_MVNO',  label: 'KT 알뜰폰' },
  { value: 'LGU_MVNO', label: 'LG U+ 알뜰폰' },
];

function AgeVerificationModal({ onClose, onVerified }: { onClose: () => void; onVerified?: () => void }) {
  const [step, setStep] = useState<AgeVerifyStep>('warning');
  const [loading, setLoading] = useState(false);
  const [selectedCarrier, setSelectedCarrier] = useState<Carrier | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [verifyDone, setVerifyDone] = useState(false);
  // sandbox 모드에서 인증 대기 중 여부
  const [awaitingVerify, setAwaitingVerify] = useState(false);
  const [sandboxToken, setSandboxToken] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 컴포넌트 언마운트 시 폴링 정리
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // 인증 완료 여부 폴링 (1초 간격, 최대 10분)
  const startPolling = () => {
    let attempts = 0;
    const MAX = 600;
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const { api } = await import('../../lib/api');
        const res = await api.users.ageVerifyStatus();
        if (res.isVerified) {
          clearInterval(pollRef.current!);
          setVerifyDone(true);
          setAwaitingVerify(false);
          onVerified?.();
        }
      } catch { /* ignore */ }
      if (attempts >= MAX) {
        clearInterval(pollRef.current!);
        setAwaitingVerify(false);
        setErrorMsg('인증 시간이 초과되었습니다. 다시 시도해 주세요.');
      }
    }, 1000);
  };

  const handleCarrierSelect = async (carrier: Carrier) => {
    setSelectedCarrier(carrier);
    setLoading(true);
    setErrorMsg('');
    try {
      const { api } = await import('../../lib/api');
      const result = await api.users.ageVerifyInitiate(carrier);

      if (result.mode === 'nice' && result.encData) {
        // ── 실제 NICE 팝업 실행 ──────────────────────────────────
        // NICE 체크플러스는 form POST + 팝업 방식
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = result.checkUrl;
        form.target = 'nice_popup';
        const addInput = (name: string, value: string) => {
          const input = document.createElement('input');
          input.type = 'hidden'; input.name = name; input.value = value;
          form.appendChild(input);
        };
        addInput('m', 'checkplusService');
        addInput('token_version_id', result.tokenVersionId);
        addInput('enc_data', result.encData);
        addInput('integrity_value', result.integrityValue);
        document.body.appendChild(form);

        // 팝업 오픈 후 폼 제출
        window.open('', 'nice_popup', 'width=500,height=550,scrollbars=yes,resizable=no');
        form.submit();
        document.body.removeChild(form);

        setAwaitingVerify(true);
        setStep('waiting');
        startPolling();
      } else if (result.mode === 'sandbox') {
        // ── 샌드박스 모드 (개발/테스트 환경) ────────────────────
        setSandboxToken(result.sandboxToken);
        setStep('waiting');
        setAwaitingVerify(true);
      } else {
        setErrorMsg('인증 서버 응답이 올바르지 않습니다.');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? '인증 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  // 샌드박스 전용: "인증 완료" 버튼
  const handleSandboxComplete = async () => {
    if (!sandboxToken) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const { api } = await import('../../lib/api');
      await api.users.ageVerifySandboxComplete(sandboxToken);
      if (pollRef.current) clearInterval(pollRef.current);
      setVerifyDone(true);
      setAwaitingVerify(false);
      onVerified?.();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error ?? '인증 처리에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={(e) => { if (e.target === e.currentTarget && !awaitingVerify) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-2xl"
      >
        {/* ── 인증 완료 ─────────────────────────────────── */}
        {verifyDone ? (
          <div className="p-6 text-center">
            <div className="flex justify-center mb-5">
              <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h2 className="text-gray-900 font-bold text-lg mb-2">성인인증 완료</h2>
            <p className="text-gray-500 text-sm mb-6">성인인증이 성공적으로 완료되었습니다.</p>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-gray-800 transition-colors"
            >
              확인
            </button>
          </div>

        /* ── NICE 팝업 대기 / 샌드박스 ──────────────────── */
        ) : step === 'waiting' ? (
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <button type="button" onClick={() => { if (pollRef.current) clearInterval(pollRef.current); setStep('carrier'); setAwaitingVerify(false); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button type="button" onClick={() => { if (!awaitingVerify || sandboxToken) { if (pollRef.current) clearInterval(pollRef.current); onClose(); } }} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col items-center py-4">
              {/* 스피너 */}
              <div className="w-14 h-14 rounded-full border-4 border-gray-100 border-t-brand animate-spin mb-5" />
              <h3 className="text-gray-900 font-bold text-base mb-2">인증 진행 중</h3>
              {sandboxToken ? (
                <p className="text-gray-400 text-sm text-center mb-6">
                  <span className="inline-block px-2 py-0.5 bg-yellow-50 text-yellow-600 rounded text-xs font-medium mb-2">개발 샌드박스 모드</span><br />
                  실제 서비스에서는 PASS 앱 또는 SMS 인증이 진행됩니다.
                </p>
              ) : (
                <p className="text-gray-400 text-sm text-center mb-6">
                  팝업창에서 PASS 본인인증을 완료해 주세요.<br />
                  팝업이 보이지 않으면 브라우저의 팝업 차단을 해제해 주세요.
                </p>
              )}

              {errorMsg && (
                <p className="text-red-500 text-xs text-center mb-4">{errorMsg}</p>
              )}

              {/* 샌드박스 전용 완료 버튼 */}
              {sandboxToken && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSandboxComplete}
                  className="w-full py-3 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-gray-800 transition-colors disabled:opacity-50 mb-3"
                >
                  {loading ? '처리 중...' : '[샌드박스] 인증 완료 처리'}
                </button>
              )}

              <button
                type="button"
                onClick={() => { if (pollRef.current) clearInterval(pollRef.current); setStep('carrier'); setAwaitingVerify(false); setSandboxToken(null); setErrorMsg(''); }}
                className="text-gray-400 text-sm underline underline-offset-2"
              >
                통신사 다시 선택
              </button>
            </div>
          </div>

        /* ── Step 1: 19세 경고 ───────────────────────────── */
        ) : step === 'warning' ? (
          <div className="p-6 text-center">
            <div className="flex justify-end mb-2">
              <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex justify-center mb-5">
              <div className="w-20 h-20 rounded-full bg-brand flex items-center justify-center">
                <span className="text-white font-black text-3xl leading-none">19</span>
              </div>
            </div>
            <h2 className="text-gray-900 font-bold text-lg mb-3">청소년 유해매체물</h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-1">
              이 서비스는 청소년 유해매체물로서 정보통신망 이용 촉진 및 정보 보호 등에 관한 법률 및 청소년 보호법의 규정에 의해
            </p>
            <p className="text-gray-900 font-semibold text-sm mb-1">19세 미만의 청소년은 이용할 수 없습니다.</p>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
              성인인증을 통해 성인 여부를 확인합니다.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors">
                취소
              </button>
              <button type="button" onClick={() => setStep('carrier')} className="flex-1 py-3 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-gray-800 transition-colors">
                성인인증
              </button>
            </div>
          </div>

        /* ── Step 2: 통신사 선택 ─────────────────────────── */
        ) : (
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <button type="button" onClick={() => setStep('warning')} className="text-gray-400 hover:text-gray-600 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col items-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-brand flex items-center justify-center mb-3">
                <span className="text-white font-black text-xl tracking-tight">PASS</span>
              </div>
              <p className="text-gray-500 text-xs">인증을 넘어 일상으로 PASS</p>
            </div>

            <h3 className="text-gray-900 font-bold text-base text-center mb-1">이용 중인 통신사를 선택해 주세요</h3>
            <p className="text-gray-400 text-xs text-center mb-5">본인 명의의 통신사를 선택하세요</p>

            {errorMsg && (
              <p className="text-red-500 text-xs text-center mb-3">{errorMsg}</p>
            )}

            <div className="grid grid-cols-3 gap-2.5 mb-4">
              {CARRIERS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  disabled={loading}
                  onClick={() => handleCarrierSelect(c.value)}
                  className={cn(
                    'py-3 rounded-xl border text-sm font-semibold transition-all',
                    selectedCarrier === c.value && loading
                      ? 'border-brand bg-brand/5 text-brand opacity-70'
                      : 'border-gray-200 text-gray-700 hover:border-brand/40 hover:text-brand hover:bg-brand/5',
                    loading && selectedCarrier !== c.value && 'opacity-40 cursor-not-allowed'
                  )}
                >
                  {loading && selectedCarrier === c.value ? (
                    <span className="inline-block w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                  ) : c.label}
                </button>
              ))}
            </div>

            <div className="text-center mb-5">
              <button type="button" className="text-brand text-xs underline underline-offset-2">
                알뜰폰 사업자 확인
              </button>
            </div>

            <div className="flex items-start gap-2 px-3 py-3 bg-gray-50 rounded-xl">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <p className="text-gray-400 text-[11px] leading-relaxed">
                보안 프로그램 설치 없이 본인인증이 가능합니다. PASS 앱이 없어도 문자 인증으로 진행됩니다.
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// IMAGE UPLOAD AREA
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// IMAGE CROP UTILS
// ─────────────────────────────────────────────
interface CropArea { x: number; y: number; width: number; height: number }

// 크롭 후 표시용 blob URL + localStorage용 압축 data URL 동시 반환
async function getCroppedImg(imageSrc: string, pixelCrop: CropArea): Promise<{ blobUrl: string; dataUrl: string }> {
  const image = new Image();
  image.src = imageSrc;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('image load failed'));
  });

  // 원본 품질 캔버스 (표시용 blob URL)
  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);

  // 저장용 압축 캔버스 (max 400px, localStorage 용량 절약)
  const MAX = 400;
  const scale = Math.min(1, MAX / Math.max(pixelCrop.width, pixelCrop.height));
  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = Math.round(pixelCrop.width * scale);
  thumbCanvas.height = Math.round(pixelCrop.height * scale);
  const thumbCtx = thumbCanvas.getContext('2d')!;
  thumbCtx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
  const dataUrl = thumbCanvas.toDataURL('image/jpeg', 0.75);

  const blobUrl = await new Promise<string>((resolve) => {
    canvas.toBlob((blob) => resolve(URL.createObjectURL(blob!)), 'image/jpeg', 0.95);
  });

  return { blobUrl, dataUrl };
}

// ─────────────────────────────────────────────
// IMAGE CROP MODAL
// ─────────────────────────────────────────────
function ImageCropModal({
  imageSrc,
  aspect,
  onConfirm,
  onCancel,
}: {
  imageSrc: string;
  aspect: number;
  onConfirm: (blobUrl: string, dataUrl: string) => void;
  onCancel: () => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [applying, setApplying] = useState(false);

  const onCropComplete = useCallback((_: unknown, areaPixels: CropArea) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setApplying(true);
    try {
      const { blobUrl, dataUrl } = await getCroppedImg(imageSrc, croppedAreaPixels);
      onConfirm(blobUrl, dataUrl);
    } finally {
      setApplying(false);
    }
  };

  const label = aspect === 1 ? '1:1 정방형' : '2:3 세로형';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-white rounded-2xl shadow-2xl w-[480px] mx-4 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h3 className="text-gray-900 font-bold text-sm">이미지 영역 설정</h3>
            <p className="text-gray-400 text-xs mt-0.5">드래그하거나 핀치로 원하는 영역을 선택하세요 ({label})</p>
          </div>
          <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cropper area */}
        <div className="relative flex-1 bg-gray-900" style={{ minHeight: 320 }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            style={{
              containerStyle: { borderRadius: 0 },
              cropAreaStyle: { border: '2px solid #E63325' },
            }}
          />
        </div>

        {/* Zoom slider */}
        <div className="flex-shrink-0 px-5 py-3 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setZoom(z => Math.max(1, z - 0.1))} className="text-gray-500 hover:text-gray-700 transition-colors">
              <ZoomOut className="w-4 h-4" />
            </button>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-brand"
            />
            <button type="button" onClick={() => setZoom(z => Math.min(3, z + 0.1))} className="text-gray-500 hover:text-gray-700 transition-colors">
              <ZoomIn className="w-4 h-4" />
            </button>
            <span className="text-gray-400 text-xs w-10 text-right">{Math.round(zoom * 100)}%</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex gap-2 px-5 py-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={applying}
            className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {applying ? '적용 중...' : '적용'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// IMAGE UPLOAD AREA
// ─────────────────────────────────────────────
function ImageUploadArea({
  label,
  required,
  ratio,
  hint,
  size,
  onPreviewChange,
  uploading,
  externalPreview,
  onGenerate,
}: {
  label: string;
  required?: boolean;
  ratio: string;
  hint: string;
  size: string;
  onPreviewChange?: (url: string | null) => void;
  uploading?: boolean;
  externalPreview?: string | null;
  onGenerate?: () => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const aspect = ratio === '1:1' ? 1 : 2 / 3;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setRawImageSrc(url);
    setShowCropper(true);
    // reset input so same file can be re-selected
    e.target.value = '';
  };

  const handleCropConfirm = (blobUrl: string, dataUrl: string) => {
    setPreview(blobUrl);       // 로컬 고화질 미리보기 (현재 세션)
    onPreviewChange?.(dataUrl); // 부모가 store에 저장 (압축 data URL → localStorage 유지)
    setShowCropper(false);
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setRawImageSrc(null);
  };

  const handleDelete = () => {
    setPreview(null);
    setRawImageSrc(null);
    onPreviewChange?.(null);
  };

  return (
    <>
      {showCropper && rawImageSrc && (
        <ImageCropModal
          imageSrc={rawImageSrc}
          aspect={aspect}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}

      <div className="mb-8">
        <div className="flex items-center gap-1 mb-2">
          <span className="text-gray-900 font-semibold text-sm">{label}</span>
          {required && <span className="text-brand text-sm font-bold">*</span>}
        </div>

        <div className="flex items-start gap-4">
          {/* Preview box */}
          <div
            className={cn(
              'relative flex-shrink-0 rounded-xl overflow-hidden border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center cursor-pointer hover:border-gray-300 transition-colors',
              ratio === '1:1' ? 'w-20 h-20' : 'w-20 h-[calc(20px*4/3)] min-h-[107px]'
            )}
            onClick={() => !uploading && inputRef.current?.click()}
          >
            {(preview || externalPreview) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview ?? externalPreview!} alt="preview" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-1 text-gray-300">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
            {/* 업로드 중 오버레이 */}
            {uploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-xl">
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              </div>
            )}
          </div>

          {/* Info + buttons */}
          <div className="flex-1">
            <p className="text-gray-500 text-xs leading-relaxed mb-3">{hint}<br />부적절한 이미지는 업로드가 제한됩니다.<br />{size}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploading ? '업로드 중...' : '업로드'}
              </button>
              {(preview || externalPreview) && !uploading && (
                <>
                  <button
                    type="button"
                    onClick={() => { if (rawImageSrc) setShowCropper(true); else inputRef.current?.click(); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/>
                    </svg>
                    재조정
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    삭제
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={onGenerate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors"
              >
                <Wand2 className="w-3.5 h-3.5" />
                생성
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// RIGHT PANEL — 기존/업데이트 프로필 미리보기
// ─────────────────────────────────────────────
function RightPreviewPanel({
  name,
  description,
  squareImage,
  verticalImage,
}: {
  name: string;
  description: string;
  squareImage?: string | null;
  verticalImage?: string | null;
}) {
  const placeholderIcon = (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );

  const displayName = name.trim() || '작품 이름';
  const displayDesc = description.trim() || '어떤 스토리인지 설명할 수 있는 간단한 소개를 입력해 주세요';

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
      {/* 기존 프로필 — 정방형(1:1) */}
      <section className="mb-8">
        <h3 className="text-gray-700 font-semibold text-sm mb-4">기존 프로필</h3>
        <div className="grid grid-cols-2 gap-3">
          {/* 내 작품 카드 — 실시간 미리보기 */}
          <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
            <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden relative">
              {squareImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={squareImage} alt="정방형 미리보기" className="w-full h-full object-cover" />
              ) : (
                <div className="text-gray-300">{placeholderIcon}</div>
              )}
            </div>
            <div className="p-2.5">
              <p className="text-gray-700 font-medium text-xs truncate mb-0.5">{displayName}</p>
              <p className="text-gray-400 text-[10px] line-clamp-2 leading-relaxed">{displayDesc}</p>
            </div>
          </div>
          {/* 기존 예시 카드 */}
          <div className="rounded-xl overflow-hidden border border-gray-100">
            <div className="aspect-square bg-gradient-to-br from-gray-700 via-purple-900 to-pink-800 flex items-end p-3">
              <span className="text-white text-xs font-bold leading-tight">로판 악녀가 되다</span>
            </div>
            <div className="p-2.5">
              <p className="text-gray-700 font-medium text-xs truncate mb-0.5">로판 악녀가 되다</p>
              <p className="text-gray-400 text-[10px] line-clamp-2 leading-relaxed">깨어나보니 최악의 악녀에게 빙의되었다</p>
              <p className="text-gray-400 text-[10px] mt-1">@ 강형</p>
            </div>
          </div>
        </div>
      </section>

      {/* 업데이트 이후 변경 프로필 — 세로형(2:3) */}
      <section>
        <h3 className="text-gray-700 font-semibold text-sm mb-4">업데이트 이후 변경 프로필</h3>
        <div className="grid grid-cols-2 gap-3">
          {/* 내 작품 카드 — 실시간 미리보기 */}
          <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
            <div className="aspect-[2/3] bg-gray-100 flex items-center justify-center overflow-hidden relative">
              {verticalImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={verticalImage} alt="세로형 미리보기" className="w-full h-full object-cover" />
              ) : squareImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={squareImage} alt="정방형 대체" className="w-full h-full object-cover" />
              ) : (
                <div className="text-gray-300">{placeholderIcon}</div>
              )}
              {/* 이름 오버레이 — 항상 표시 (이미지 있을 때는 그라데이션, 없을 때는 투명) */}
              <div className={cn(
                'absolute inset-0 flex items-end p-3',
                (verticalImage || squareImage) && 'bg-gradient-to-t from-black/60 via-transparent to-transparent'
              )}>
                <span className={cn(
                  'text-xs font-bold leading-tight line-clamp-2',
                  (verticalImage || squareImage) ? 'text-white' : 'text-gray-500'
                )}>
                  {displayName}
                </span>
              </div>
            </div>
            {/* 세로형도 이름/소개 텍스트 표시 */}
            <div className="p-2.5">
              <p className="text-gray-700 font-medium text-xs truncate mb-0.5">{displayName}</p>
              <p className="text-gray-400 text-[10px] line-clamp-2 leading-relaxed">{displayDesc}</p>
            </div>
          </div>
          {/* 기존 예시 카드 */}
          <div className="rounded-xl overflow-hidden border border-gray-100">
            <div className="aspect-[2/3] bg-gradient-to-b from-gray-900 via-gray-800 to-black flex items-center justify-center p-3">
              <span className="text-white text-xs font-bold text-center leading-tight">명부를 쥔 SSS급 헌터</span>
            </div>
            <div className="p-2.5">
              <p className="text-gray-700 font-medium text-xs truncate mb-0.5">명부를 쥔 SSS급 헌터</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────
// PROFILE FORM (첫 번째 탭)
// ─────────────────────────────────────────────
function ProfileForm({
  name, setName,
  description, setDescription,
  storyId,
  onNext,
  onSquareImageChange,
  onVerticalImageChange,
  squareImagePreview,
  verticalImagePreview,
}: {
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  storyId?: string | null;
  onNext: () => void;
  onSquareImageChange?: (url: string | null, key?: string | null) => void;
  onVerticalImageChange?: (url: string | null, key?: string | null) => void;
  squareImagePreview?: string | null;
  verticalImagePreview?: string | null;
}) {
  const router = useRouter();
  const [showAgeNotice, setShowAgeNotice] = useState(true);
  const [showAgeModal, setShowAgeModal] = useState(false);
  const [generatingName, setGeneratingName] = useState(false);
  const [uploadingSquare, setUploadingSquare] = useState(false);
  const [uploadingVertical, setUploadingVertical] = useState(false);

  // ── Supabase 이미지 업로드 핸들러 ──────────────────────────────────────────────
  const handleImageUpload = async (
    imageData: string | null,  // data URL (압축) or blob URL
    variant: 'square' | 'vertical',
    setUploading: (v: boolean) => void,
    onDone: ((url: string | null, key?: string | null) => void) | undefined,
  ) => {
    if (!imageData) { onDone?.(null, null); return; }

    // storyId가 없으면 data URL을 임시로 사용 (draft 생성 후 재업로드됨)
    if (!storyId) { onDone?.(imageData); return; }

    setUploading(true);
    try {
      // 1. data URL → Blob 객체 (data: URL은 CSP connect-src 차단 → atob 사용)
      const blob = imageData.startsWith('data:') ? dataUrlToBlob(imageData) : await fetch(imageData).then(r => r.blob());

      // 2. Presigned URL 요청
      const { data } = await api.stories.getCoverUploadUrl(storyId, {
        contentType: 'image/jpeg',
        variant,
      });

      // 3. Supabase Storage에 PUT
      await fetch(data.uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': 'image/jpeg' },
      });

      // 4. 서버에 URL 확정 → DB 저장
      await api.stories.confirmCoverUpload(storyId, {
        variant,
        url: data.publicUrl,
        key: data.key,
      });

      // 5. store에 CDN URL + key 저장
      onDone?.(data.publicUrl, data.key);
    } catch {
      // 업로드 실패 시 data URL로 폴백 (미리보기는 유지)
      onDone?.(imageData);
    } finally {
      setUploading(false);
    }
  };

  // ── 실시간 제목 중복 체크 (500ms debounce) ────────────────────────────
  const [titleCheck, setTitleCheck] = useState<{ available: boolean; suggestion: string | null } | null>(null);
  const [titleCheckTimer, setTitleCheckTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleNameChange = (v: string) => {
    setName(v);
    if (titleCheckTimer) clearTimeout(titleCheckTimer);
    if (!v.trim() || v.trim().length < 2) { setTitleCheck(null); return; }
    const timer = setTimeout(async () => {
      try {
        const result = await api.stories.checkTitle(v.trim(), storyId ?? undefined);
        setTitleCheck(result);
      } catch {
        setTitleCheck(null);
      }
    }, 500);
    setTitleCheckTimer(timer);
  };

  const handleRandomName = async () => {
    setGeneratingName(true);
    try {
      const { api } = await import('../../lib/api');
      const { name: generated } = await api.stories.generateRandomName();
      setName(generated);
    } catch {
      // silent fail
    } finally {
      setGeneratingName(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
      {/* Random generate */}
      <div className="flex items-center justify-between mb-6 py-3 border-b border-gray-100">
        <span className="text-gray-700 text-sm">프로필을 랜덤으로 생성해 보세요</span>
        <button
          type="button"
          onClick={handleRandomName}
          disabled={generatingName}
          className="px-3 py-1.5 rounded-lg border border-brand text-brand text-xs font-semibold hover:bg-brand/5 transition-colors disabled:opacity-50"
        >
          {generatingName ? '생성 중...' : '랜덤 생성'}
        </button>
      </div>

      {/* Age notice */}
      <AnimatePresence>
        {showAgeNotice && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center justify-between gap-3 px-4 py-3 mb-6 bg-gray-900 text-white rounded-xl overflow-hidden"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Megaphone className="w-4 h-4 flex-shrink-0" />
              <p className="text-sm truncate">민감한 스토리의 경우 제작 시 성인 인증이 필요해요.</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowAgeModal(true)}
                className="px-3 py-1 rounded-lg bg-white text-gray-900 text-xs font-semibold hover:bg-gray-100 transition-colors"
              >
                성인 인증
              </button>
              <button
                type="button"
                onClick={() => setShowAgeNotice(false)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Square image */}
      <ImageUploadArea
        label="정방형 이미지(1:1)"
        required
        ratio="1:1"
        hint="이미지를 필수로 등록해주세요."
        size="5MB 이하 (1,080 x 1,080px)"
        uploading={uploadingSquare}
        externalPreview={squareImagePreview}
        onPreviewChange={(blobUrl) =>
          handleImageUpload(blobUrl, 'square', setUploadingSquare, onSquareImageChange)
        }
        onGenerate={() => router.push('/images')}
      />

      {/* Vertical image */}
      <ImageUploadArea
        label="세로형 이미지(2:3)"
        ratio="2:3"
        hint="필수는 아니지만 미리 등록하면 더 예쁘게 노출돼요."
        size="5MB 이하 (1,080 x 1,620px)"
        uploading={uploadingVertical}
        externalPreview={verticalImagePreview}
        onPreviewChange={(blobUrl) =>
          handleImageUpload(blobUrl, 'vertical', setUploadingVertical, onVerticalImageChange)
        }
        onGenerate={() => router.push('/images')}
      />

      {/* Update notice */}
      <div className="flex items-start gap-2.5 px-4 py-3.5 mb-8 bg-gray-50 rounded-xl border border-gray-100">
        <Megaphone className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-gray-600 text-xs font-medium mb-1">26년 4월 중 업데이트 예정</p>
          <p className="text-gray-400 text-xs leading-relaxed">
            스토리 작품 썸네일이 <span className="text-brand font-semibold">세로형(2:3)</span>으로 바뀌어요.<br />
            여백 없이 꽉 찬 화면으로 보여주고 싶다면 세로형 이미지를 추천해요.
          </p>
        </div>
      </div>

      {/* Name */}
      <div className="mb-6">
        <div className="flex items-center gap-1 mb-2">
          <label className="text-gray-900 font-semibold text-sm">이름</label>
          <span className="text-brand font-bold text-sm">*</span>
        </div>
        <p className="text-gray-400 text-xs mb-2">2~30자 이내로 입력해 주세요 (특수문자, 이모지 제외)</p>
        <div className="relative">
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value.slice(0, 30))}
            placeholder="스토리의 이름을 입력해 주세요"
            className={cn(
              'w-full px-4 py-3 rounded-xl border text-gray-900 text-sm placeholder:text-gray-300 focus:outline-none transition-colors pr-16',
              titleCheck?.available === false ? 'border-amber-300 focus:border-amber-400' : 'border-gray-200 focus:border-gray-400'
            )}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 text-xs">
            {name.length} / 30
          </span>
        </div>
        {/* 중복 제목 경고 */}
        {titleCheck?.available === false && (
          <div className="flex items-center gap-2 mt-1.5 text-amber-600 text-xs">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>내가 발행한 스토리 중 같은 제목이 있어요.</span>
            {titleCheck.suggestion && (
              <button
                type="button"
                onClick={() => { setName(titleCheck.suggestion!); setTitleCheck(null); }}
                className="underline font-medium hover:text-amber-700"
              >
                '{titleCheck.suggestion}' 사용
              </button>
            )}
          </div>
        )}
        {titleCheck?.available === true && name.trim().length >= 2 && (
          <div className="flex items-center gap-1.5 mt-1.5 text-emerald-600 text-xs">
            <Check className="w-3.5 h-3.5" />
            <span>사용 가능한 제목이에요.</span>
          </div>
        )}
      </div>

      {/* Description */}
      <div className="mb-6">
        <div className="flex items-center gap-1 mb-2">
          <label className="text-gray-900 font-semibold text-sm">한 줄 소개</label>
          <span className="text-brand font-bold text-sm">*</span>
        </div>
        <div className="relative">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 30))}
            placeholder="어떤 스토리인지 설명할 수 있는 간단한 소개를 입력해 주세요"
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400 transition-colors resize-none"
          />
          <span className="absolute right-4 bottom-3 text-gray-300 text-xs">
            {description.length} / 30
          </span>
        </div>
      </div>

      {/* Content warning */}
      <div className="flex items-start gap-2 text-gray-400 text-xs mb-12">
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <p>폭력, 혐오, 성적묘사 등의 표현 및 이미지는 규정에 따라 영구적으로 제재될 수 있어요</p>
      </div>

      {/* Scroll to top button */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-20 right-8 w-10 h-10 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors z-10"
      >
        <ChevronUp className="w-5 h-5" />
      </button>

      {/* Age Verification Modal */}
      <AnimatePresence>
        {showAgeModal && <AgeVerificationModal onClose={() => setShowAgeModal(false)} />}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────
// START SETTINGS TAB  (시작 설정)
// ─────────────────────────────────────────────
interface StartSetting {
  id: string;
  name: string;
  prologue: string;
  situation: string;
  playGuide: string;
  suggestedReplies: string[];
}

function StartSettingsTab({ storyName, systemPrompt, initialSettings, initialActiveId, onSettingsChange, onPlayGuideChange, onPrologueChange, onSuggestedRepliesChange }: {
  storyName: string; systemPrompt: string;
  initialSettings?: StartSetting[];
  initialActiveId?: string;
  onSettingsChange?: (settings: StartSetting[], activeId: string) => void;
  onPlayGuideChange?: (v: string) => void;
  onPrologueChange?: (v: string) => void;
  onSuggestedRepliesChange?: (v: string[]) => void;
}) {
  const [settings, setSettings] = useState<StartSetting[]>(
    initialSettings ?? [{ id: '1', name: '기본 설정', prologue: '', situation: '', playGuide: '', suggestedReplies: [] }]
  );
  const [activeSettingId, setActiveSettingId] = useState(initialActiveId ?? '1');
  const [advancedOpen, setAdvancedOpen] = useState(true);
  const [showInfoCard, setShowInfoCard] = useState(true);
  const [generatingPrologue, setGeneratingPrologue] = useState(false);
  const [showPrologueTooltip, setShowPrologueTooltip] = useState(false);

  const isPrologueProfileComplete = storyName.trim().length > 0;

  const handleAutoGeneratePrologue = () => {
    if (!isPrologueProfileComplete) {
      setShowPrologueTooltip(true);
      setTimeout(() => setShowPrologueTooltip(false), 3000);
      return;
    }
    handleGeneratePrologue();
  };

  const isDefaultSetting = activeSettingId === settings[0].id;
  const isExtraSetting = !isDefaultSetting;

  const activeSetting = settings.find(s => s.id === activeSettingId) ?? settings[0];

  const update = (field: keyof StartSetting, value: string | string[]) => {
    setSettings(prev => {
      const next = prev.map(s => s.id === activeSettingId ? { ...s, [field]: value } : s);
      onSettingsChange?.(next, activeSettingId);
      return next;
    });
    if (field === 'playGuide' && typeof value === 'string') onPlayGuideChange?.(value);
    if (field === 'prologue' && typeof value === 'string') onPrologueChange?.(value);
    if (field === 'suggestedReplies' && Array.isArray(value)) onSuggestedRepliesChange?.(value);
  };

  const addSetting = () => {
    const newId = String(Date.now());
    const extraCount = settings.length;
    setSettings(prev => {
      const next = [...prev, { id: newId, name: `추가 설정 ${extraCount}`, prologue: '', situation: '', playGuide: '', suggestedReplies: [] }];
      onSettingsChange?.(next, newId);
      return next;
    });
    setActiveSettingId(newId);
    setShowInfoCard(true);
  };

  const handleGeneratePrologue = async () => {
    setGeneratingPrologue(true);
    try {
      const { api } = await import('../../lib/api');
      const { prologue } = await api.stories.generatePrologue({
        name: storyName,
        systemPrompt,
        settingName: activeSetting.name,
      });
      update('prologue', prologue);
    } catch {
      // silent fail
    } finally {
      setGeneratingPrologue(false);
    }
  };

  const addReply = () => {
    if (activeSetting.suggestedReplies.length >= 3) return;
    update('suggestedReplies', [...activeSetting.suggestedReplies, '']);
  };

  const updateReply = (idx: number, val: string) => {
    const arr = [...activeSetting.suggestedReplies];
    arr[idx] = val;
    update('suggestedReplies', arr);
  };

  const removeReply = (idx: number) => {
    update('suggestedReplies', activeSetting.suggestedReplies.filter((_, i) => i !== idx));
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
      {/* Setting pills */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {settings.map((s, i) => (
          <button
            key={s.id}
            onClick={() => { setActiveSettingId(s.id); if (i > 0) setShowInfoCard(true); }}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-semibold transition-all',
              s.id === activeSettingId
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            )}
          >
            {i === 0 ? `기본 ${s.name}` : s.name}
          </button>
        ))}
        {settings.length < 5 && (
          <button
            onClick={addSetting}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm text-gray-400 hover:bg-gray-100 transition-colors border border-dashed border-gray-300"
          >
            <Plus className="w-3.5 h-3.5" />
            설정 추가
          </button>
        )}
      </div>

      {/* 추가 설정 인포카드 (기본 설정이 아닌 경우에만 표시) */}
      <AnimatePresence>
        {isExtraSetting && showInfoCard && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="flex items-start gap-4 p-4 rounded-2xl border border-gray-200 bg-gray-50">
              {/* Mock preview image */}
              <div className="flex-shrink-0 w-[140px] h-[100px] rounded-xl bg-gray-700 overflow-hidden flex flex-col">
                <div className="flex-1 p-2">
                  <div className="bg-white/10 rounded-lg px-2 py-1 mb-1.5 text-[9px] text-white/70">시작설정</div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 bg-white/20 rounded-md px-2 py-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-white/60" />
                      <span className="text-[9px] text-white/80">친구사이</span>
                    </div>
                    <div className="flex items-center gap-1 bg-white/10 rounded-md px-2 py-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      <span className="text-[9px] text-white/80">친구사이</span>
                    </div>
                    <div className="text-[9px] text-white/60 px-2">애인사이</div>
                  </div>
                </div>
                <div className="bg-gray-900 px-2 py-1.5">
                  <div className="bg-white/20 rounded-md text-center text-[9px] text-white py-0.5">대화 나누기</div>
                </div>
              </div>

              {/* Explanation */}
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 font-bold text-sm mb-1">스토리의 다양한 시작상황을 설정해 보세요</p>
                <p className="text-gray-400 text-xs leading-relaxed">
                  사용자가 스토리 정보에서 원하는 시작설정을 선택하여 대화를 시작할 수 있어요.
                </p>
              </div>

              {/* Close */}
              <button
                onClick={() => setShowInfoCard(false)}
                className="flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 프롤로그 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1">
            <span className="text-gray-900 font-semibold text-sm">프롤로그</span>
            <span className="text-brand font-bold text-sm">*</span>
          </div>
          <div className="relative">
            {showPrologueTooltip && (
              <div className="absolute bottom-full right-0 mb-2 z-50 whitespace-nowrap">
                <div className="bg-gray-900 text-white text-xs font-medium px-4 py-2.5 rounded-xl shadow-lg text-center leading-relaxed">
                  1단계 프로필 필수 정보를 채워야<br />자동 생성을 할 수 있어요
                </div>
                <div className="absolute right-4 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-gray-900" />
              </div>
            )}
            <button
              onClick={handleAutoGeneratePrologue}
              disabled={generatingPrologue}
              className="px-3 py-1 rounded-lg border border-brand/40 text-brand text-xs font-semibold hover:bg-brand/5 transition-colors disabled:opacity-50"
            >
              {generatingPrologue ? '생성 중...' : '자동 생성'}
            </button>
          </div>
        </div>
        <p className="text-gray-400 text-xs mb-2">스토리의 프롤로그를 작성해 주세요</p>
        <div className="relative">
          <textarea
            value={activeSetting.prologue}
            onChange={e => update('prologue', e.target.value.slice(0, 1000))}
            placeholder="자동 생성 기능을 활용하면 AI가 프롬프트를 참고하여 초안을 작성해 드려요"
            rows={5}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-800 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400 resize-none"
          />
          <span className="absolute right-4 bottom-3 text-gray-300 text-xs">{activeSetting.prologue.length} / 1000</span>
        </div>
      </div>

      {/* 시작설정 이름 */}
      <div className="mb-6">
        <div className="flex items-center gap-1 mb-1">
          <span className="text-gray-900 font-semibold text-sm">시작설정 이름</span>
          <span className="text-brand font-bold text-sm">*</span>
        </div>
        <p className="text-gray-400 text-xs mb-2">시작설정의 이름을 작성해 주세요</p>
        <div className="relative">
          <input
            type="text"
            value={activeSetting.name}
            onChange={e => update('name', e.target.value.slice(0, 12))}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-800 text-sm focus:outline-none focus:border-gray-400 pr-16"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 text-xs">
            {activeSetting.name.length} / 12
          </span>
        </div>
      </div>

      {/* 시작 상황 */}
      <div className="mb-6">
        <div className="flex items-center gap-1 mb-1">
          <span className="text-gray-900 font-semibold text-sm">시작 상황</span>
        </div>
        <p className="text-gray-400 text-xs mb-2">스토리 전개를 위한 시작 상황 정보를 입력해 주세요</p>
        <div className="relative">
          <textarea
            value={activeSetting.situation}
            onChange={e => update('situation', e.target.value.slice(0, 1000))}
            placeholder="사용자의 역할, 등장인물과의 관계, 이야기가 시작되는 세계관 등"
            rows={5}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-800 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400 resize-none"
          />
          <span className="absolute right-4 bottom-3 text-gray-300 text-xs">{activeSetting.situation.length} / 1000</span>
        </div>
      </div>

      {/* 고급 설정 toggle */}
      <button
        onClick={() => setAdvancedOpen(p => !p)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition-colors mb-6"
      >
        고급 설정
        <ChevronUp className={cn('w-4 h-4 transition-transform', !advancedOpen && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {advancedOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            {/* 플레이 가이드 */}
            <div className="mb-6">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-gray-900 font-semibold text-sm">플레이 가이드</span>
              </div>
              <p className="text-gray-400 text-xs mb-2">
                AI가 기억하지 않는, 사용자에게만 보이는 가이드 메시지를 추가해 플레이 방법을 안내해 보세요.
              </p>
              <div className="relative">
                <textarea
                  value={activeSetting.playGuide}
                  onChange={e => update('playGuide', e.target.value.slice(0, 500))}
                  placeholder="사용자를 위한 가이드를 작성해주세요"
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-800 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400 resize-none"
                />
                <span className="absolute right-4 bottom-3 text-gray-300 text-xs">{activeSetting.playGuide.length} / 500</span>
              </div>
            </div>

            {/* 추천 답변 */}
            <div className="mb-8">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-gray-900 font-semibold text-sm">추천 답변</span>
              </div>
              <p className="text-gray-400 text-xs mb-3">사용자들에게 첫 답변을 최대 3개 추천해 보세요.</p>
              {activeSetting.suggestedReplies.map((reply, idx) => (
                <div key={idx} className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={reply}
                    onChange={e => updateReply(idx, e.target.value)}
                    placeholder={`추천 답변 ${idx + 1}`}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-800 text-sm focus:outline-none focus:border-gray-400"
                  />
                  <button onClick={() => removeReply(idx)} className="text-gray-300 hover:text-gray-500 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {activeSetting.suggestedReplies.length < 3 && (
                <button
                  onClick={addReply}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-gray-300 text-gray-400 text-sm hover:bg-gray-50 hover:text-gray-600 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  추천 답변 추가
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scroll to top */}
      <button
        type="button"
        onClick={() => document.querySelector('.overflow-y-auto')?.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-20 right-[44%] w-10 h-10 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors z-10"
      >
        <ChevronUp className="w-5 h-5" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// STAT SETTINGS TAB  (스탯 설정)
// ─────────────────────────────────────────────
const STAT_ICONS = ['❤️', '⚔️', '🧠', '💪', '🏃', '💰', '⭐', '🔮', '🛡️', '🍀'];
const STAT_COLORS = [
  { label: '빨강', value: '#E63325' },
  { label: '파랑', value: '#3B82F6' },
  { label: '초록', value: '#10B981' },
  { label: '노랑', value: '#F59E0B' },
  { label: '보라', value: '#8B5CF6' },
  { label: '분홍', value: '#EC4899' },
  { label: '하늘', value: '#06B6D4' },
  { label: '회색', value: '#6B7280' },
];

interface StatItem {
  id: string;
  name: string;
  icon: string;
  color: string;
  minValue: string;
  maxValue: string;
  defaultValue: string;
  unit: string;
  description: string;
  collapsed: boolean;
  levels: { id: string; label: string; min: string; max: string }[];
}

function StatCard({
  stat,
  index,
  onUpdate,
  onRemove,
  storyName,
  storyDescription,
  systemPrompt,
}: {
  stat: StatItem;
  index: number;
  onUpdate: (id: string, field: keyof StatItem, value: unknown) => void;
  onRemove: (id: string) => void;
  storyName: string;
  storyDescription: string;
  systemPrompt: string;
}) {
  const [iconOpen, setIconOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [showStatTooltip, setShowStatTooltip] = useState(false);

  const isStatAutoGenReady =
    storyName.trim().length > 0 &&
    storyDescription.trim().length > 0 &&
    stat.name.trim().length > 0;

  const handleAutoGenerateDescription = async () => {
    if (!isStatAutoGenReady) {
      setShowStatTooltip(true);
      setTimeout(() => setShowStatTooltip(false), 3000);
      return;
    }
    setGeneratingDescription(true);
    try {
      const { api } = await import('../../lib/api');
      const { description } = await api.stories.generateStatDescription({
        storyName,
        storyDescription,
        systemPrompt: systemPrompt || undefined,
        statName: stat.name,
        statUnit: stat.unit || undefined,
      });
      onUpdate(stat.id, 'description', description.slice(0, 500));
    } catch {
      // silent fail
    } finally {
      setGeneratingDescription(false);
    }
  };

  const selectedColor = STAT_COLORS.find(c => c.value === stat.color);

  const addLevel = () => {
    onUpdate(stat.id, 'levels', [
      ...stat.levels,
      { id: String(Date.now()), label: '', min: '', max: '' },
    ]);
  };

  const updateLevel = (levelId: string, field: string, val: string) => {
    onUpdate(stat.id, 'levels', stat.levels.map(l =>
      l.id === levelId ? { ...l, [field]: val } : l
    ));
  };

  const removeLevel = (levelId: string) => {
    onUpdate(stat.id, 'levels', stat.levels.filter(l => l.id !== levelId));
  };

  return (
    <div className="mb-3 rounded-xl border border-gray-200 overflow-hidden">
      {/* Stat header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-gray-300 cursor-grab" />
          <span className="text-gray-700 font-semibold text-sm">스탯 {index + 1}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onRemove(stat.id)}
            className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onUpdate(stat.id, 'collapsed', !stat.collapsed)}
            className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ChevronUp className={cn('w-3.5 h-3.5 transition-transform', stat.collapsed && 'rotate-180')} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {!stat.collapsed && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-4">
              {/* 스탯 이름 */}
              <div>
                <div className="flex items-center gap-1 mb-1.5">
                  <span className="text-gray-700 font-semibold text-sm">스탯 이름</span>
                  <span className="text-brand text-sm font-bold">*</span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={stat.name}
                    onChange={e => onUpdate(stat.id, 'name', e.target.value.slice(0, 10))}
                    placeholder="예) 호감도, 체력, 전투력, 지능 등"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-800 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400 pr-14"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 text-xs">{stat.name.length} / 10</span>
                </div>
              </div>

              {/* 아이콘 + 색상 */}
              <div className="grid grid-cols-2 gap-3">
                {/* 아이콘 */}
                <div>
                  <div className="flex items-center gap-1 mb-1.5">
                    <span className="text-gray-700 font-semibold text-sm">아이콘</span>
                    <span className="text-brand text-sm font-bold">*</span>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => { setIconOpen(p => !p); setColorOpen(false); }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-200 text-sm hover:border-gray-300 transition-colors"
                    >
                      <span className={stat.icon ? 'text-base' : 'text-gray-300'}>
                        {stat.icon || '선택'}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    <AnimatePresence>
                      {iconOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="absolute top-full mt-1 left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-2 grid grid-cols-5 gap-1 w-48"
                        >
                          {STAT_ICONS.map(icon => (
                            <button
                              key={icon}
                              onClick={() => { onUpdate(stat.id, 'icon', icon); setIconOpen(false); }}
                              className={cn(
                                'w-8 h-8 flex items-center justify-center rounded-lg text-base hover:bg-gray-100 transition-colors',
                                stat.icon === icon && 'bg-brand/10'
                              )}
                            >
                              {icon}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* 색상 */}
                <div>
                  <div className="flex items-center gap-1 mb-1.5">
                    <span className="text-gray-700 font-semibold text-sm">색상</span>
                    <span className="text-brand text-sm font-bold">*</span>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => { setColorOpen(p => !p); setIconOpen(false); }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-200 text-sm hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {stat.color ? (
                          <div className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: stat.color }} />
                        ) : null}
                        <span className={stat.color ? 'text-gray-700' : 'text-gray-300'}>
                          {selectedColor?.label || '선택'}
                        </span>
                      </div>
                      <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    <AnimatePresence>
                      {colorOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="absolute top-full mt-1 left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden w-36"
                        >
                          {STAT_COLORS.map(c => (
                            <button
                              key={c.value}
                              onClick={() => { onUpdate(stat.id, 'color', c.value); setColorOpen(false); }}
                              className={cn(
                                'w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 transition-colors',
                                stat.color === c.value && 'bg-gray-50 font-semibold'
                              )}
                            >
                              <div className="w-3.5 h-3.5 rounded-full border border-gray-200 flex-shrink-0" style={{ backgroundColor: c.value }} />
                              {c.label}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* 최소/최대/기본값 */}
              <div>
                <div className="flex items-center gap-1 mb-1.5">
                  <span className="text-gray-700 font-semibold text-sm">최소 / 최대 / 기본값 설정</span>
                  <span className="text-brand text-sm font-bold">*</span>
                </div>
                <p className="text-gray-400 text-xs mb-2">기본값은 최소~최댓값의 범위 내에 있어야 해요 (입력 가능 수치: -99,999 ~ 99,999)</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['minValue', 'maxValue', 'defaultValue'] as const).map((field, i) => (
                    <input
                      key={field}
                      type="number"
                      value={stat[field]}
                      onChange={e => onUpdate(stat.id, field, e.target.value)}
                      placeholder={['최솟값', '최댓값', '기본값'][i]}
                      className="px-3 py-2.5 rounded-xl border border-gray-200 text-gray-800 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400 text-center"
                    />
                  ))}
                </div>
              </div>

              {/* 스탯 단위 */}
              <div>
                <div className="flex items-center gap-1 mb-1.5">
                  <span className="text-gray-700 font-semibold text-sm">스탯 단위 설정</span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={stat.unit}
                    onChange={e => onUpdate(stat.id, 'unit', e.target.value.slice(0, 3))}
                    placeholder="예) 억원, 순위, 개, %"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-800 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400 pr-14"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 text-xs">{stat.unit.length} / 3</span>
                </div>
              </div>

              {/* 스탯 설명 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-700 font-semibold text-sm">스탯 설명</span>
                    <span className="text-brand text-sm font-bold">*</span>
                  </div>
                  <div className="relative">
                    {showStatTooltip && (
                      <div className="absolute bottom-full right-0 mb-2 z-50 w-64">
                        <div className="bg-gray-900 text-white text-xs font-medium px-4 py-2.5 rounded-xl shadow-lg text-center leading-relaxed">
                          자동생성은 스토리 이름, 스토리 설정 및 정보,<br />스탯 이름이 입력되어야 가능해요.
                        </div>
                        <div className="absolute right-4 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-gray-900" />
                      </div>
                    )}
                    <button
                      onClick={handleAutoGenerateDescription}
                      disabled={generatingDescription}
                      className="px-2.5 py-1 rounded-lg border border-brand/40 text-brand text-xs font-semibold hover:bg-brand/5 transition-colors disabled:opacity-50"
                    >
                      {generatingDescription ? '생성 중...' : '자동생성'}
                    </button>
                  </div>
                </div>
                <p className="text-gray-400 text-xs mb-2">
                  AI가 스탯을 이해하고 스토리에 적용할 수 있도록 스탯에 대한 설명을 작성해주세요
                </p>
                <div className="relative">
                  <textarea
                    value={stat.description}
                    onChange={e => onUpdate(stat.id, 'description', e.target.value.slice(0, 500))}
                    placeholder={`예) {user}가 간식을 주면 증가한다.\n{char}가 혼자 있으면 감소한다.\n{user}가 스킨십을 해주면 증가한다.`}
                    rows={4}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-800 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400 resize-none"
                  />
                  <span className="absolute right-3 bottom-3 text-gray-300 text-xs">{stat.description.length} / 500</span>
                </div>
              </div>

              {/* 스탯 레벨 설정 */}
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-gray-700 font-semibold text-sm">스탯 레벨 설정</span>
                </div>
                <p className="text-gray-400 text-xs mb-3">레벨에 따라 다채롭게 전개되는 작품을 만들어 보세요</p>
                {stat.levels.map((level, li) => (
                  <div key={level.id} className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={level.label}
                      onChange={e => updateLevel(level.id, 'label', e.target.value)}
                      placeholder={`레벨 ${li + 1} 이름`}
                      className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-gray-800 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400"
                    />
                    <input
                      type="number"
                      value={level.min}
                      onChange={e => updateLevel(level.id, 'min', e.target.value)}
                      placeholder="최솟값"
                      className="w-20 px-2 py-2 rounded-xl border border-gray-200 text-gray-800 text-sm text-center focus:outline-none focus:border-gray-400"
                    />
                    <input
                      type="number"
                      value={level.max}
                      onChange={e => updateLevel(level.id, 'max', e.target.value)}
                      placeholder="최댓값"
                      className="w-20 px-2 py-2 rounded-xl border border-gray-200 text-gray-800 text-sm text-center focus:outline-none focus:border-gray-400"
                    />
                    <button onClick={() => removeLevel(level.id)} className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addLevel}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-gray-300 text-gray-400 text-sm hover:bg-gray-50 hover:text-gray-600 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  레벨 추가
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatSettingsTab({ stats, setStats, storyName, storyDescription, systemPrompt }: {
  stats: StatItem[];
  setStats: React.Dispatch<React.SetStateAction<StatItem[]>>;
  storyName: string;
  storyDescription: string;
  systemPrompt: string;
}) {
  const addStat = () => {
    if (stats.length >= 7) return;
    setStats(prev => [...prev, {
      id: String(Date.now()),
      name: '', icon: '', color: '#E63325',
      minValue: '0', maxValue: '100', defaultValue: '50',
      unit: '', description: '', collapsed: false, levels: [],
    }]);
  };

  const updateStat = (id: string, field: keyof StatItem, value: unknown) => {
    setStats(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const removeStat = (id: string) => {
    setStats(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
      <div className="mb-2">
        <h2 className="text-gray-900 font-bold text-base mb-1">스탯 설정</h2>
        <p className="text-gray-400 text-xs">
          스탯을 설정하여 스토리에 생동감을 불어넣어 보세요. 시작 설정별로 최대 7개까지 추가할 수 있어요.
        </p>
      </div>

      {/* Active setting pill */}
      <div className="flex items-center gap-2 mt-4 mb-5">
        <button className="px-3 py-1.5 rounded-full text-sm font-semibold bg-gray-900 text-white">
          기본 설정 {stats.length}
        </button>
      </div>

      {/* Stat cards */}
      {stats.map((stat, i) => (
        <StatCard
          key={stat.id}
          stat={stat}
          index={i}
          onUpdate={updateStat}
          onRemove={removeStat}
          storyName={storyName}
          storyDescription={storyDescription}
          systemPrompt={systemPrompt}
        />
      ))}

      {/* Add stat button */}
      <button
        onClick={addStat}
        disabled={stats.length >= 7}
        className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border border-dashed border-gray-300 text-gray-400 text-sm hover:bg-gray-50 hover:text-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed mt-2 mb-8"
      >
        <Plus className="w-4 h-4" />
        스탯 추가
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// MEDIA TAB  (미디어)
// ─────────────────────────────────────────────
interface MediaImage {
  id: string;
  settingId: string;
  url: string;
  name: string;
  situation: string;
  settingIds: string[];
  hint: string;
  collapsed: boolean;
}


// ─────────────────────────────────────────────
// MEDIA TAB  (미디어)
// ─────────────────────────────────────────────
interface MediaImage {
  id: string;
  settingId: string;
  url: string;
  name: string;
  situation: string;
  settingIds: string[];
  hint: string;
  collapsed: boolean;
}

function MediaTab({ startSettings }: { startSettings: { id: string; name: string }[] }) {
  const router = useRouter();
  const [images, setImages] = useState<MediaImage[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceIdRef = useRef<string | null>(null);

  const addImage = (url: string, name: string) => {
    const settingId = activeFilter === 'all' ? (startSettings[0]?.id ?? '1') : activeFilter;
    if (replaceIdRef.current) {
      setImages(prev => prev.map(img => img.id === replaceIdRef.current ? { ...img, url, name } : img));
      replaceIdRef.current = null;
    } else {
      setImages(prev => [...prev, {
        id: String(Date.now()), settingId, url, name,
        situation: '', settingIds: [settingId], hint: '', collapsed: false,
      }]);
    }
    setUploadModalOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    addImage(URL.createObjectURL(file), file.name);
  };

  const updateImage = (id: string, field: keyof MediaImage, value: unknown) =>
    setImages(prev => prev.map(img => img.id === id ? { ...img, [field]: value } : img));

  const filteredImages = activeFilter === 'all' ? images : images.filter(img => img.settingIds.includes(activeFilter));
  const countFor = (id: string) => images.filter(img => img.settingIds.includes(id)).length;
  const imgCodeTag = (imgName: string) => `{{img::${imgName.replace(/\.[^.]+$/, '')}}}`;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <h2 className="text-gray-900 font-bold text-base">상황 이미지</h2>
            <button className="text-gray-300 hover:text-gray-500 transition-colors"><HelpCircle className="w-4 h-4" /></button>
          </div>
          <p className="text-gray-400 text-xs">상황에 어울리는 인물, 배경 등의 이미지를 등록해 보세요 (시작 설정별로 최대 50개)</p>
        </div>
        <button onClick={() => router.push('/images')} className="flex-shrink-0 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors">
          이미지 생성
        </button>
      </div>
      <div className="flex items-center gap-2 mt-4 mb-5 flex-wrap">
        <button onClick={() => setActiveFilter('all')} className={cn('px-3 py-1.5 rounded-full text-sm font-semibold transition-all', activeFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}>전체 {images.length}</button>
        {startSettings.map(s => (
          <button key={s.id} onClick={() => setActiveFilter(s.id)} className={cn('px-3 py-1.5 rounded-full text-sm font-semibold transition-all', activeFilter === s.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}>
            기본 {s.name} {countFor(s.id)}
          </button>
        ))}
      </div>
      {images.length > 0 && (
        <div className="mb-4 rounded-xl bg-gray-50 border border-gray-200 p-4 flex items-start gap-3">
          <div className="flex-shrink-0 w-14 h-20 rounded-lg border border-gray-200 bg-white flex flex-col overflow-hidden text-[9px] p-1.5 leading-tight text-gray-400">
            <span className="font-semibold text-gray-600 text-[10px]">첫 인사말</span>
            <span className="mt-0.5 text-brand font-medium break-all">{`{{img::이미지 이름}}`}</span>
            <span className="mt-0.5">안녕하세요. 반가워요!</span>
          </div>
          <div>
            <p className="text-gray-700 font-semibold text-sm mb-1">상황 이미지를 채팅에 첨부해 보세요</p>
            <p className="text-gray-400 text-xs leading-relaxed">코드 복사 버튼을 통해 프롤로그와 전개 예시에 넣을 수 있어</p>
          </div>
        </div>
      )}
      <div className="space-y-3 mb-4">
        {filteredImages.map((img, i) => (
          <div key={img.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
              <span className="text-gray-300 cursor-grab text-xs">⋮⋮</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.name} className="w-8 h-10 object-cover rounded-md flex-shrink-0" />
              <span className="flex-1 text-gray-700 font-semibold text-sm">{i + 1}</span>
              <button onClick={() => { replaceIdRef.current = img.id; setUploadModalOpen(true); }} className="px-2.5 py-1 rounded-lg bg-gray-800 text-white text-xs font-medium hover:bg-gray-700 transition-colors">이미지 변경</button>
              <button onClick={() => navigator.clipboard.writeText(imgCodeTag(img.name))} className="px-2.5 py-1 rounded-lg bg-gray-800 text-white text-xs font-medium hover:bg-gray-700 transition-colors">코드 복사</button>
              <button onClick={() => setImages(prev => prev.filter(im => im.id !== img.id))} className="ml-1 text-gray-300 hover:text-red-400 transition-colors"><X className="w-4 h-4" /></button>
              <button onClick={() => updateImage(img.id, 'collapsed', !img.collapsed)} className="text-gray-300 hover:text-gray-600 transition-colors">
                <ChevronUp className={cn('w-4 h-4 transition-transform', img.collapsed && 'rotate-180')} />
              </button>
            </div>
            {!img.collapsed && (
              <div className="px-4 py-3 space-y-3">
                <div>
                  <div className="flex items-center gap-1 mb-1"><span className="text-gray-700 font-semibold text-sm">상황</span><span className="text-brand font-bold text-sm">*</span></div>
                  <p className="text-gray-400 text-xs mb-1.5">작성하신 상황이 되면 AI가 자동으로 이미지를 띄워드려요</p>
                  <div className="relative">
                    <textarea value={img.situation} onChange={e => updateImage(img.id, 'situation', e.target.value.slice(0, 50))} placeholder="예) 고양이 미뉴가 놀라는 상황" rows={2} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-gray-900 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400 resize-none" />
                    <span className="absolute right-3 bottom-2 text-gray-300 text-xs">{img.situation.length} / 50</span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1 mb-1"><span className="text-gray-700 font-semibold text-sm">이미지 적용 대상</span><span className="text-brand font-bold text-sm">*</span></div>
                  <p className="text-gray-400 text-xs mb-1.5">전체 또는 개별 적용이 가능합니다</p>
                  <div className="flex flex-wrap gap-1.5">
                    {startSettings.map(s => {
                      const selected = img.settingIds.includes(s.id);
                      return (
                        <button key={s.id} onClick={() => updateImage(img.id, 'settingIds', selected ? img.settingIds.filter(id => id !== s.id) : [...img.settingIds, s.id])}
                          className={cn('px-3 py-1 rounded-full text-xs font-medium border transition-colors', selected ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400')}>
                          {s.name} {selected && <span className="ml-1">×</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <span className="text-gray-700 font-semibold text-sm">이미지 힌트</span>
                  <p className="text-gray-400 text-xs mb-1.5 mt-0.5">유저에게 보여질 이미지 해금 힌트를 작성해주세요</p>
                  <div className="relative">
                    <input value={img.hint} onChange={e => updateImage(img.id, 'hint', e.target.value.slice(0, 20))} placeholder="예) 뭐... 뭐냥?!" className="w-full px-3 py-2 rounded-xl border border-gray-200 text-gray-900 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 text-xs">{img.hint.length} / 20</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <button onClick={() => { replaceIdRef.current = null; setUploadModalOpen(true); }} className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border border-dashed border-gray-300 text-gray-400 text-sm hover:bg-gray-50 hover:text-gray-600 transition-colors">
        <Plus className="w-4 h-4" />상황 이미지 추가
      </button>
      <AnimatePresence>
        {uploadModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={(e) => { if (e.target === e.currentTarget) setUploadModalOpen(false); }}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 8 }} transition={{ duration: 0.15 }} className="bg-white rounded-2xl shadow-xl w-[480px] p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-gray-900 font-bold text-base">이미지 업로드</h3>
                <button onClick={() => setUploadModalOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 transition-colors"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-start gap-2 p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all text-left">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"><Upload className="w-4 h-4 text-blue-500" /></div>
                  <div>
                    <p className="text-gray-900 font-semibold text-sm mb-1">기기에서 가져오기</p>
                    <p className="text-gray-400 text-xs leading-relaxed">내 기기에 있는 이미지를 선택해요,<br />최대 5MB까지 업로드할 수 있어요.</p>
                  </div>
                </button>
                <button className="flex flex-col items-start gap-2 p-4 rounded-xl border border-gray-200 hover:border-amber-300 hover:bg-amber-50/50 transition-all text-left">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                  </div>
                  <div>
                    <p className="text-gray-900 font-semibold text-sm mb-1">라이브러리에서 가져오기</p>
                    <p className="text-gray-400 text-xs leading-relaxed">내 라이브러리에 저장된<br />생성 이미지를 업로드할 수 있어요.</p>
                  </div>
                </button>
              </div>
              <button onClick={() => setUploadModalOpen(false)} className="w-full py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors">취소</button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────
// KEYWORD BOOK TAB  (키워드북)
// ─────────────────────────────────────────────
function KeywordsTab({ startSettings }: { startSettings: { id: string; name: string }[] }) {
  const { keywordNotes: notes, setKeywordNotes } = useStoryDraftStore();
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const addNote = () => {
    const settingId = activeFilter === 'all' ? (startSettings[0]?.id ?? '1') : activeFilter;
    setKeywordNotes([...notes, {
      id: String(Date.now()),
      settingId,
      title: `키워드 노트 ${notes.length + 1}`,
      keywords: '',
      content: '',
      expanded: false,
      editing: false,
    }]);
  };

  const updateNote = (id: string, field: keyof DraftKeywordNote, value: unknown) => {
    setKeywordNotes(notes.map(n => n.id === id ? { ...n, [field]: value } : n));
  };

  const removeNote = (id: string) => {
    setKeywordNotes(notes.filter(n => n.id !== id));
  };

  const filteredNotes = activeFilter === 'all'
    ? notes
    : notes.filter(n => n.settingId === activeFilter);

  const countFor = (id: string) => notes.filter(n => n.settingId === id).length;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-1">
        <h2 className="text-gray-900 font-bold text-base">키워드북</h2>
        <button className="text-gray-300 hover:text-gray-500 transition-colors">
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
      <p className="text-gray-400 text-xs leading-relaxed mb-4">
        스토리의 세계관이나 추가 정보를 저장해두는 기능이에요.<br />
        스토리나 사용자 메시지가 특정 키워드를 포함하면, 키워드북에 저장된 정보를 자동으로 불러와요.
      </p>

      {/* Filter pills */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <button
          onClick={() => setActiveFilter('all')}
          className={cn(
            'px-3 py-1.5 rounded-full text-sm font-semibold transition-all',
            activeFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          )}
        >
          전체 {notes.length}
        </button>
        {startSettings.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveFilter(s.id)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-semibold transition-all',
              activeFilter === s.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            )}
          >
            기본 {s.name} {countFor(s.id)}
          </button>
        ))}
      </div>

      {/* Note list */}
      {filteredNotes.map((note, i) => (
        <div key={note.id} className="mb-2 rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-white">
            <GripVertical className="w-4 h-4 text-gray-300 cursor-grab flex-shrink-0" />
            {note.editing ? (
              <input
                autoFocus
                value={note.title}
                onChange={e => updateNote(note.id, 'title', e.target.value)}
                onBlur={() => updateNote(note.id, 'editing', false)}
                onKeyDown={e => e.key === 'Enter' && updateNote(note.id, 'editing', false)}
                className="flex-1 text-gray-900 font-semibold text-sm bg-transparent outline-none border-b border-gray-300 pb-0.5"
              />
            ) : (
              <span className="flex-1 text-gray-900 font-semibold text-sm">{note.title}</span>
            )}
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => updateNote(note.id, 'editing', true)}
                className="p-1.5 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button
                onClick={() => removeNote(note.id)}
                className="p-1.5 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => updateNote(note.id, 'expanded', !note.expanded)}
                className="p-1.5 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', note.expanded && 'rotate-180')} />
              </button>
            </div>
          </div>

          <AnimatePresence>
            {note.expanded && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                className="overflow-hidden border-t border-gray-100"
              >
                <div className="p-4 space-y-3">
                  <div>
                    <label className="text-gray-700 font-semibold text-xs mb-1.5 block">
                      트리거 키워드 <span className="text-brand">*</span>
                    </label>
                    <input
                      type="text"
                      value={note.keywords}
                      onChange={e => updateNote(note.id, 'keywords', e.target.value)}
                      placeholder="쉼표로 구분하여 입력하세요 (예: 마법, 검술, 용)"
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-800 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400"
                    />
                  </div>
                  <div>
                    <label className="text-gray-700 font-semibold text-xs mb-1.5 block">
                      내용 <span className="text-brand">*</span>
                    </label>
                    <div className="relative">
                      <textarea
                        value={note.content}
                        onChange={e => updateNote(note.id, 'content', e.target.value.slice(0, 1000))}
                        placeholder="키워드가 감지되면 AI에게 전달할 추가 정보를 입력하세요"
                        rows={4}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-800 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400 resize-none"
                      />
                      <span className="absolute right-3 bottom-3 text-gray-300 text-xs">{note.content.length} / 1000</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}

      {/* Add note button */}
      <button
        onClick={addNote}
        className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border border-dashed border-gray-300 text-gray-400 text-sm hover:bg-gray-50 hover:text-gray-600 transition-colors"
      >
        <Plus className="w-4 h-4" />
        키워드 노트 추가
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// ENDING SETTINGS TAB
// ─────────────────────────────────────────────
type EndingGrade = 'N' | 'R' | 'SR' | 'SSR';

interface EndingRule { id: string; turnStart: number; sortOrder: number }

interface EndingItem {
  id: string;
  grade: EndingGrade;
  name: string;
  minTurnStart: number;
  rules: EndingRule[];
  prompt: string;
  epilogue: string;
  hint: string;
  imageUrl: string | null;
  collapsed: boolean;
  generatingEpilogue: boolean;
}

// 등급별 허용 개수 규칙 (총 엔딩 수에 따라 잠금 해제)
const GRADE_LIMITS: Record<EndingGrade, { maxCount: number; unlockAt: number }> = {
  N:   { maxCount: 1, unlockAt: 0 },
  R:   { maxCount: 1, unlockAt: 0 },
  SR:  { maxCount: 1, unlockAt: 4 },
  SSR: { maxCount: 1, unlockAt: 6 },
};

const TURN_OPTIONS = [10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100];

const GRADE_COLORS: Record<EndingGrade, string> = {
  N:   'text-gray-600 border-gray-300 bg-white',
  R:   'text-blue-600 border-blue-300 bg-blue-50',
  SR:  'text-purple-600 border-purple-300 bg-purple-50',
  SSR: 'text-yellow-600 border-yellow-300 bg-yellow-50',
};

function EndingSettingsTab({
  startSettings,
  storyName,
  stats,
  onGoToStats,
  onGradeCountChange,
}: {
  startSettings: { id: string; name: string }[];
  storyName: string;
  stats?: { id: string; name: string }[];
  onGoToStats?: () => void;
  onGradeCountChange?: (counts: Record<EndingGrade, number>) => void;
}) {
  const [activeStartId, setActiveStartId] = useState<string>(startSettings[0]?.id ?? '');
  const [endings, setEndings] = useState<EndingItem[]>([]);
  const [noStatsDialog, setNoStatsDialog] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync grade counts to parent whenever endings change
  useEffect(() => {
    if (!onGradeCountChange) return;
    const counts: Record<EndingGrade, number> = { N: 0, R: 0, SR: 0, SSR: 0 };
    endings.forEach(e => { counts[e.grade]++; });
    onGradeCountChange(counts);
  }, [endings, onGradeCountChange]);

  const addEnding = () => {
    if (endings.length >= 10) return;
    setEndings(prev => [...prev, {
      id: String(Date.now()),
      grade: 'N',
      name: '',
      minTurnStart: 10,
      rules: [],
      prompt: '',
      epilogue: '',
      hint: '',
      imageUrl: null,
      collapsed: false,
      generatingEpilogue: false,
    }]);
  };

  const update = <K extends keyof EndingItem>(id: string, field: K, value: EndingItem[K]) =>
    setEndings(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));

  const remove = (id: string) => setEndings(prev => prev.filter(e => e.id !== id));

  const addRule = (id: string) => {
    if (!stats || stats.length === 0) { setNoStatsDialog(true); return; }
    setEndings(prev => prev.map(e => e.id === id ? {
      ...e,
      rules: [...e.rules, { id: String(Date.now()), turnStart: 10, sortOrder: e.rules.length }],
    } : e));
  };

  const removeRule = (endingId: string, ruleId: string) => {
    setEndings(prev => prev.map(e => e.id === endingId ? {
      ...e, rules: e.rules.filter(r => r.id !== ruleId),
    } : e));
  };

  const handleGenerateEpilogue = async (ending: EndingItem) => {
    if (!ending.prompt.trim()) return;
    update(ending.id, 'generatingEpilogue', true);
    try {
      const { api } = await import('../../lib/api');
      const res = await api.stories.generateEpilogue({
        storyName, prompt: ending.prompt, endingName: ending.name || '엔딩',
      });
      update(ending.id, 'epilogue', (res.epilogue || '').slice(0, 1000));
    } catch { /* silent */ }
    finally { update(ending.id, 'generatingEpilogue', false); }
  };

  // 등급 분포 계산
  const gradeCount = (g: EndingGrade) => endings.filter(e => e.grade === g).length;
  const total = endings.length;
  const gradeStatus = (g: EndingGrade) => {
    const { maxCount, unlockAt } = GRADE_LIMITS[g];
    if (total < unlockAt) return { available: false, used: 0, max: 0 };
    return { available: true, used: gradeCount(g), max: maxCount };
  };

  const canSelectGrade = (endingId: string, g: EndingGrade) => {
    const status = gradeStatus(g);
    if (!status.available) return false;
    const currentGrade = endings.find(e => e.id === endingId)?.grade;
    if (currentGrade === g) return true; // 이미 이 등급이면 허용
    return status.used < status.max;
  };

  return (
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
      {/* Header */}
      <h2 className="text-gray-900 font-bold text-base mb-1">엔딩 설정</h2>
      <p className="text-gray-400 text-xs leading-relaxed mb-5">
        각 시작 설정에 따른 엔딩을 설정해보세요. 가장 먼저 조건에 도달한 엔딩 하나만 제공됩니다
        <br />(시작설정 별 최대 10개)
      </p>

      {/* Start setting pills */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {(startSettings.length > 0 ? startSettings : [{ id: '', name: '기본 설정' }]).map((s, i) => (
          <button
            key={s.id || 'default'}
            onClick={() => setActiveStartId(s.id)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-semibold transition-colors',
              activeStartId === s.id || (!activeStartId && i === 0)
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            )}
          >
            {s.name} {i === 0 ? endings.length : ''}
          </button>
        ))}
      </div>

      {/* Ending cards */}
      {endings.map((ending, i) => (
        <div key={ending.id} className="mb-3 rounded-xl border border-gray-200 overflow-hidden bg-white">
          {/* Card header */}
          <div className="flex items-center gap-2 px-4 py-3 bg-white border-b border-gray-100">
            <GripVertical className="w-4 h-4 text-gray-300 cursor-grab flex-shrink-0" />
            <span className="flex-1 text-gray-800 font-semibold text-sm">엔딩 {i + 1}</span>
            <button onClick={() => remove(ending.id)} className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => update(ending.id, 'collapsed', !ending.collapsed)} className="p-1.5 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <ChevronUp className={cn('w-3.5 h-3.5 transition-transform', ending.collapsed && 'rotate-180')} />
            </button>
          </div>

          <AnimatePresence>
            {!ending.collapsed && (
              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                <div className="p-5 space-y-6">

                  {/* 엔딩 이미지 */}
                  <div>
                    <div className="flex items-center gap-1 mb-2">
                      <span className="text-gray-900 font-semibold text-sm">엔딩 이미지</span>
                      <span className="text-brand font-bold text-sm">*</span>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="w-[67px] h-[100px] rounded-xl overflow-hidden border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center flex-shrink-0">
                        {ending.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={ending.imageUrl} alt="엔딩 이미지" className="w-full h-full object-cover" />
                        ) : (
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs mb-2">이미지를 필수로 등록해주세요.<br />5MB 이하/카드 사이즈 (1,005 x 1,490px)</p>
                        <div className="flex gap-2">
                          <button type="button" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors">
                            <Upload className="w-3 h-3" />업로드
                          </button>
                          <button type="button" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors">
                            <Wand2 className="w-3 h-3" />생성
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 엔딩 등급 */}
                  <div>
                    <div className="flex items-center gap-1 mb-2">
                      <span className="text-gray-900 font-semibold text-sm">엔딩 등급</span>
                      <span className="text-brand font-bold text-sm">*</span>
                    </div>
                    <div className="flex gap-2">
                      {(['N', 'R', 'SR', 'SSR'] as EndingGrade[]).map(g => {
                        const ok = canSelectGrade(ending.id, g);
                        return (
                          <button
                            key={g}
                            type="button"
                            disabled={!ok}
                            onClick={() => ok && update(ending.id, 'grade', g)}
                            className={cn(
                              'px-4 py-2 rounded-full border text-sm font-bold transition-colors',
                              ending.grade === g
                                ? g === 'N' ? 'bg-gray-800 text-white border-gray-800'
                                  : g === 'R' ? 'bg-blue-500 text-white border-blue-500'
                                  : g === 'SR' ? 'bg-purple-500 text-white border-purple-500'
                                  : 'bg-yellow-500 text-white border-yellow-500'
                                : ok
                                  ? cn('hover:bg-gray-50', GRADE_COLORS[g])
                                  : 'text-gray-300 border-gray-200 bg-gray-50 cursor-not-allowed opacity-50'
                            )}
                          >
                            {g}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 엔딩 이름 */}
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <span className="text-gray-900 font-semibold text-sm">엔딩 이름</span>
                      <span className="text-brand font-bold text-sm">*</span>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={ending.name}
                        onChange={e => update(ending.id, 'name', e.target.value.slice(0, 20))}
                        placeholder="예) 미뉴의 해피엔딩"
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-800 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400 pr-14"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 text-xs">{ending.name.length} / 20</span>
                    </div>
                  </div>

                  {/* 엔딩 조건 */}
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-gray-900 font-semibold text-sm">엔딩 조건</span>
                      <span className="text-brand font-bold text-sm">*</span>
                    </div>
                    <p className="text-gray-400 text-xs mb-3">
                      턴 수에 도달하고 아래 조건이 충족되면 엔딩이 제공돼요. (최소 10턴 이상, 5턴마다 조건 검사)
                    </p>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-gray-600 text-sm flex-shrink-0">엔딩 가능 시점:</span>
                      <select
                        value={ending.minTurnStart}
                        onChange={e => update(ending.id, 'minTurnStart', Number(e.target.value))}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 text-sm focus:outline-none focus:border-gray-400 bg-white"
                      >
                        {TURN_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <span className="text-gray-500 text-sm">턴 부터</span>
                    </div>
                    {ending.rules.map(rule => (
                      <div key={rule.id} className="flex items-center gap-2 mb-2">
                        <select
                          value={rule.turnStart}
                          onChange={e => setEndings(prev => prev.map(en => en.id === ending.id ? {
                            ...en, rules: en.rules.map(r => r.id === rule.id ? { ...r, turnStart: Number(e.target.value) } : r)
                          } : en))}
                          className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 text-sm focus:outline-none bg-white"
                        >
                          {TURN_OPTIONS.map(t => <option key={t} value={t}>{t}턴</option>)}
                        </select>
                        <button onClick={() => removeRule(ending.id, rule.id)} className="text-gray-300 hover:text-red-400 transition-colors p-1">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addRule(ending.id)}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-gray-300 text-gray-400 text-xs hover:bg-gray-50 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />규칙 추가
                    </button>
                  </div>

                  {/* 프롬프트 */}
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-gray-900 font-semibold text-sm">프롬프트</span>
                      <span className="text-brand font-bold text-sm">*</span>
                    </div>
                    <p className="text-gray-400 text-xs mb-2">엔딩을 판단하기 위한 상세한 조건을 묘사해 주세요</p>
                    <div className="relative">
                      <textarea
                        value={ending.prompt}
                        onChange={e => update(ending.id, 'prompt', e.target.value.slice(0, 500))}
                        placeholder="예) 미뉴가 가족을 찾는 과정에서 구체적인 단서(냄새, 장소, 목소리 등)를 발견했고 미뉴와 가족이 서로를 확실히 인지하여 미뉴가 안전함·안도감을 느끼고 있음 또는 가족과 이미 재회하여 좋은 시간을 보내고 있음"
                        rows={4}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-800 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400 resize-none"
                      />
                      <span className="absolute right-3 bottom-3 text-gray-300 text-xs">{ending.prompt.length} / 500</span>
                    </div>
                  </div>

                  {/* 에필로그 */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-900 font-semibold text-sm">에필로그</span>
                      <button
                        onClick={() => handleGenerateEpilogue(ending)}
                        disabled={ending.generatingEpilogue || !ending.prompt.trim()}
                        className="px-2.5 py-1 rounded-lg border border-brand/40 text-brand text-xs font-semibold hover:bg-brand/5 transition-colors disabled:opacity-40"
                      >
                        {ending.generatingEpilogue ? '생성 중...' : '자동생성'}
                      </button>
                    </div>
                    <p className="text-gray-400 text-xs mb-2">입력한 내용을 예시로 AI가 에필로그를 상황에 더 맞게 작성해요</p>
                    <div className="relative">
                      <textarea
                        value={ending.epilogue}
                        onChange={e => update(ending.id, 'epilogue', e.target.value.slice(0, 1000))}
                        placeholder="자동 생성 기능을 활용하면 AI가 프롬프트를 참고하여 초안을 작성해 드려요"
                        rows={5}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-800 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400 resize-none"
                      />
                      <span className="absolute right-3 bottom-3 text-gray-300 text-xs">{ending.epilogue.length} / 1000</span>
                    </div>
                  </div>

                  {/* 엔딩 힌트 */}
                  <div>
                    <span className="text-gray-900 font-semibold text-sm block mb-1">엔딩 힌트</span>
                    <p className="text-gray-400 text-xs mb-2">유저에게 보여질 엔딩 힌트를 작성해 주세요</p>
                    <div className="relative">
                      <textarea
                        value={ending.hint}
                        onChange={e => update(ending.id, 'hint', e.target.value.slice(0, 20))}
                        placeholder="예) 어디서 익숙한 소리가 들린다냥..!"
                        rows={2}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-800 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400 resize-none"
                      />
                      <span className="absolute right-3 bottom-3 text-gray-300 text-xs">{ending.hint.length} / 20</span>
                    </div>
                  </div>

                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}

      {/* Scroll to top */}
      {endings.length > 0 && (
        <div className="flex justify-end mb-3">
          <button
            onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
            className="w-9 h-9 rounded-full border border-gray-200 bg-white shadow-sm flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add ending */}
      <button
        onClick={addEnding}
        disabled={endings.length >= 10}
        className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border border-dashed border-gray-300 text-gray-400 text-sm hover:bg-gray-50 hover:text-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed mb-8"
      >
        <Plus className="w-4 h-4" />엔딩 추가
      </button>

      {/* 스탯 미등록 다이얼로그 */}
      {noStatsDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-80 mx-4 overflow-hidden">
            <div className="px-6 pt-8 pb-6 text-center">
              <h3 className="text-gray-900 font-bold text-base mb-3">스탯을 등록해주세요</h3>
              <p className="text-gray-500 text-sm leading-relaxed">등록된 스탯을 바탕으로<br />상세 조건을 추가할 수 있어요</p>
            </div>
            <div className="px-4 pb-4 flex gap-2">
              <button
                onClick={() => setNoStatsDialog(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => { setNoStatsDialog(false); onGoToStats?.(); }}
                className="flex-1 py-3 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition-colors"
              >
                스탯 추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// REGISTER TAB  (등록)
// ─────────────────────────────────────────────
const GENRE_OPTIONS = ['판타지', '로맨스', '액션', '미스터리', '공포', 'SF', '일상', '역사', '무협', '스포츠'];
const TARGET_OPTIONS = ['전체', '남성향', '여성향'];
const CHAT_STYLE_OPTIONS = ['1인칭', '3인칭', '혼합'];
const MODEL_OPTIONS = [
  { label: '🍇 슈퍼챗 2.0 (기본)', value: 'super_chat_20' },
  { label: '🍇 슈퍼챗 2.5', value: 'super_chat_25' },
  { label: '🍇 슈퍼챗 1.5', value: 'super_chat_15' },
  { label: '⚡ 하이퍼챗', value: 'hyper_chat' },
  { label: '💬 프로챗 2.5', value: 'pro_chat_25' },
  { label: '💬 프로챗 1.0', value: 'pro_chat_10' },
  { label: '📨 파워챗', value: 'power_chat' },
  { label: '💭 일반챗', value: 'normal_chat' },
];

function RegisterTab({ name, coverUrl, onVisibilityChange }: { name: string; coverUrl?: string; onVisibilityChange?: (v: string) => void }) {
  const [showAgeNotice, setShowAgeNotice] = useState(true);
  const [showAgeModal, setShowAgeModal] = useState(false);
  const [detailDesc, setDetailDesc] = useState('');
  const [genre, setGenre] = useState('');
  const [target, setTarget] = useState('');
  const [chatStyle, setChatStyle] = useState('');
  const [model, setModel] = useState('super_chat_20');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState('');
  const [ageRating, setAgeRating] = useState<'all' | 'adult'>('all');
  const [visibility, setVisibility] = useState<'public' | 'private' | 'link'>('private');
  const [commentsOff, setCommentsOff] = useState(false);
  const [genreOpen, setGenreOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const [chatStyleOpen, setChatStyleOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const addHashtag = () => {
    const tag = hashtagInput.trim().replace(/^#/, '');
    if (!tag || hashtags.length >= 10 || hashtags.includes(tag)) return;
    setHashtags(prev => [...prev, tag]);
    setHashtagInput('');
  };

  const selectedModel = MODEL_OPTIONS.find(m => m.value === model);

  return (
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
      {/* Age notice */}
      {showAgeNotice && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 mb-6 bg-gray-900 text-white rounded-xl">
          <p className="text-sm">민감한 스토리의 경우 제작 시 성인 인증이 필요해요.</p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowAgeModal(true)}
              className="px-3 py-1 rounded-lg bg-white text-gray-900 text-xs font-semibold hover:bg-gray-100 transition-colors"
            >
              성인 인증
            </button>
            <button onClick={() => setShowAgeNotice(false)} className="text-white/60 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 상세 설명 */}
      <div className="mb-6">
        <div className="flex items-center gap-1 mb-1">
          <span className="text-gray-900 font-semibold text-sm">상세 설명</span>
          <span className="text-brand font-bold text-sm">*</span>
        </div>
        <p className="text-gray-400 text-xs mb-2">스토리에 대한 구체적인 설명을 입력해 주세요</p>
        <div className="relative">
          <textarea
            value={detailDesc}
            onChange={e => setDetailDesc(e.target.value.slice(0, 1000))}
            placeholder="스토리의 성격이나 서사, 과거 사건 등 상세한 내용을 작성해주세요"
            rows={5}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-800 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400 resize-none"
          />
          <span className="absolute right-3 bottom-3 text-gray-300 text-xs">{detailDesc.length} / 1000</span>
        </div>
      </div>

      {/* 장르 설정 */}
      <div className="mb-6 relative">
        <div className="flex items-center gap-1 mb-1">
          <span className="text-gray-900 font-semibold text-sm">장르 설정</span>
          <span className="text-brand font-bold text-sm">*</span>
        </div>
        <p className="text-gray-400 text-xs mb-2">스토리에 맞는 장르를 선택해 주세요</p>
        <button
          onClick={() => { setGenreOpen(p => !p); setTargetOpen(false); setChatStyleOpen(false); setModelOpen(false); }}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-200 text-sm hover:border-gray-300 transition-colors"
        >
          <span className={genre ? 'text-gray-800' : 'text-gray-300'}>{genre || '장르를 선택해주세요'}</span>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>
        {genreOpen && (
          <div className="absolute top-full mt-1 left-0 z-50 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            {GENRE_OPTIONS.map(g => (
              <button key={g} onClick={() => { setGenre(g); setGenreOpen(false); }}
                className={cn('w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors', genre === g && 'bg-brand/5 text-brand font-semibold')}>
                {g}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 타겟 설정 */}
      <div className="mb-6 relative">
        <div className="flex items-center gap-1 mb-1">
          <span className="text-gray-900 font-semibold text-sm">타겟 설정</span>
          <span className="text-brand font-bold text-sm">*</span>
        </div>
        <p className="text-gray-400 text-xs mb-2">스토리의 주 소비층을 선택해 주세요.<br />선택된 타겟에 따라 다른 사용자에게 추천돼요.</p>
        <button
          onClick={() => { setTargetOpen(p => !p); setGenreOpen(false); setChatStyleOpen(false); setModelOpen(false); }}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-200 text-sm hover:border-gray-300 transition-colors"
        >
          <span className={target ? 'text-gray-800' : 'text-gray-300'}>{target || '타겟을 선택해주세요'}</span>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>
        {targetOpen && (
          <div className="absolute top-full mt-1 left-0 z-50 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            {TARGET_OPTIONS.map(t => (
              <button key={t} onClick={() => { setTarget(t); setTargetOpen(false); }}
                className={cn('w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors', target === t && 'bg-brand/5 text-brand font-semibold')}>
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 대화 형태 설정 */}
      <div className="mb-6 relative">
        <div className="flex items-center gap-1 mb-1">
          <span className="text-gray-900 font-semibold text-sm">대화 형태 설정</span>
          <span className="text-brand font-bold text-sm">*</span>
        </div>
        <p className="text-gray-400 text-xs mb-2">스토리의 대화 형태를 선택해 주세요</p>
        <button
          onClick={() => { setChatStyleOpen(p => !p); setGenreOpen(false); setTargetOpen(false); setModelOpen(false); }}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-200 text-sm hover:border-gray-300 transition-colors"
        >
          <span className={chatStyle ? 'text-gray-800' : 'text-gray-300'}>{chatStyle || '대화 형태를 선택해주세요'}</span>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>
        {chatStyleOpen && (
          <div className="absolute top-full mt-1 left-0 z-50 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            {CHAT_STYLE_OPTIONS.map(s => (
              <button key={s} onClick={() => { setChatStyle(s); setChatStyleOpen(false); }}
                className={cn('w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors', chatStyle === s && 'bg-brand/5 text-brand font-semibold')}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 권장 모드 */}
      <div className="mb-6 relative">
        <div className="flex items-center gap-1 mb-1">
          <span className="text-gray-900 font-semibold text-sm">권장 모드</span>
          <span className="text-brand font-bold text-sm">*</span>
        </div>
        <button
          onClick={() => { setModelOpen(p => !p); setGenreOpen(false); setTargetOpen(false); setChatStyleOpen(false); }}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-200 text-sm hover:border-gray-300 transition-colors"
        >
          <span className="text-gray-800">{selectedModel?.label}</span>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>
        {modelOpen && (
          <div className="absolute top-full mt-1 left-0 z-50 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            {MODEL_OPTIONS.map(m => (
              <button key={m.value} onClick={() => { setModel(m.value); setModelOpen(false); }}
                className={cn('w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors', model === m.value && 'bg-brand/5 text-brand font-semibold')}>
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 해시태그 */}
      <div className="mb-6">
        <div className="flex items-center gap-1 mb-1">
          <span className="text-gray-900 font-semibold text-sm">해시태그</span>
        </div>
        <p className="text-gray-400 text-xs mb-2">해시태그를 입력해 주세요. 단어 입력 후 엔터를 눌러주세요. (최대 10개)</p>
        <div className="relative">
          <input
            type="text"
            value={hashtagInput}
            onChange={e => setHashtagInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addHashtag(); } }}
            placeholder="단어 입력 후 엔터"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-800 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400 pr-14"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 text-xs">{hashtags.length} / 10</span>
        </div>
        {hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {hashtags.map(tag => (
              <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                #{tag}
                <button onClick={() => setHashtags(prev => prev.filter(t => t !== tag))} className="text-gray-400 hover:text-gray-600">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 이용자 층 설정 */}
      <div className="mb-6">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-gray-900 font-semibold text-sm">이용자 층 설정</span>
          <span className="text-brand font-bold text-sm">*</span>
          <button className="text-gray-300 hover:text-gray-500 transition-colors">
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
        <p className="text-gray-400 text-xs mb-3">
          이용자 층은 한번 설정하면 변경할 수 없어요.<br />
          민감한 스토리는 운영자에 의해 상태가 변경될 수 있어요.
        </p>
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          {[
            { value: 'all', icon: '✅', label: '미성년자가 대화하기에 적절해요' },
            { value: 'adult', icon: '🛡️', label: '미성년자가 대화하기에 적절하지 않아요' },
          ].map(opt => (
            <label
              key={opt.value}
              className={cn(
                'flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors border-b border-gray-100 last:border-0',
                ageRating === opt.value ? 'bg-gray-50' : 'hover:bg-gray-50'
              )}
            >
              <input
                type="radio"
                name="ageRating"
                value={opt.value}
                checked={ageRating === opt.value}
                onChange={() => setAgeRating(opt.value as 'all' | 'adult')}
                className="accent-brand"
              />
              <span className="text-sm">{opt.icon}</span>
              <span className={cn('text-sm', ageRating === opt.value ? 'text-gray-900 font-medium' : 'text-gray-600')}>
                {opt.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* 공개 여부 */}
      <div className="mb-6">
        <div className="flex items-center gap-1 mb-3">
          <span className="text-gray-900 font-semibold text-sm">공개 여부</span>
          <span className="text-brand font-bold text-sm">*</span>
        </div>
        <div className="space-y-2">
          {[
            { value: 'public', label: '공개', desc: '누구나 이 스토리를 플레이할 수 있어요' },
            { value: 'private', label: '비공개', desc: '스토리 제작자만 이 스토리를 플레이할 수 있어요' },
            { value: 'link', label: '링크 공개', desc: '링크를 가진 사용자만 이 스토리를 플레이할 수 있어요' },
          ].map(opt => (
            <label
              key={opt.value}
              className={cn(
                'flex items-start gap-3 px-4 py-3.5 rounded-xl border cursor-pointer transition-all',
                visibility === opt.value
                  ? 'border-brand bg-brand/5'
                  : 'border-gray-200 hover:border-gray-300'
              )}
            >
              <input
                type="radio"
                name="visibility"
                value={opt.value}
                checked={visibility === opt.value}
                onChange={() => { const v = opt.value as 'public' | 'private' | 'link'; setVisibility(v); onVisibilityChange?.(v); }}
                className="accent-brand mt-0.5"
              />
              <div>
                <p className={cn('text-sm font-medium', visibility === opt.value ? 'text-gray-900' : 'text-gray-700')}>
                  {opt.label}
                </p>
                <p className="text-gray-400 text-xs mt-0.5">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* 댓글 기능 닫기 */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-900 font-semibold text-sm">댓글 기능 닫기</p>
            <p className="text-gray-400 text-xs mt-0.5">스토리 정보 상단 메뉴(...)에서도 설정을 변경할 수 있어요</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCommentsOff(p => !p)}
              className={cn(
                'w-11 h-6 rounded-full relative transition-colors',
                commentsOff ? 'bg-brand' : 'bg-gray-200'
              )}
            >
              <span className={cn(
                'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                commentsOff ? 'translate-x-5' : 'translate-x-0.5'
              )} />
            </button>
            <button
              onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
              className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Age Verification Modal */}
      <AnimatePresence>
        {showAgeModal && <AgeVerificationModal onClose={() => setShowAgeModal(false)} />}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────
// REGISTER RIGHT PANEL  (등록 탭 미리보기)
// ─────────────────────────────────────────────
function RegisterPreviewPanel({ name, coverImage }: { name: string; coverImage?: string | null }) {
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace('.', '');

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {/* Story card */}
      <div className="mx-4 mt-4 rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
        {/* Cover image area */}
        <div className="relative bg-gradient-to-br from-brand/80 to-brand aspect-[4/3] flex items-center justify-center overflow-hidden">
          {coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverImage} alt="커버" className="w-full h-full object-cover" />
          ) : (
            <div className="text-5xl select-none">😊</div>
          )}
          <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/40 text-white text-xs font-semibold px-2 py-1 rounded-full">
            <span>👍</span> 1.6K
          </div>
        </div>

        {/* Info */}
        <div className="p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-gray-900 font-bold text-sm">{name || '스토리 이름'}</p>
            <button className="text-gray-300 hover:text-gray-500">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h.01M12 12h.01M19 12h.01" />
              </svg>
            </button>
          </div>
          <p className="text-gray-400 text-xs mb-2">@나도이런거만들거야</p>
          <div className="mb-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
              <Plus className="w-3 h-3" /> 기본 프롬프트
            </span>
          </div>
          <div className="flex items-center gap-3 text-gray-400 text-xs">
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> 20.2K
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
              </svg>
              10.2K
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              100
            </span>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="px-4 py-3 space-y-4">
        <div>
          <p className="text-gray-400 text-xs font-semibold mb-1">상세 설명</p>
        </div>

        <div>
          <p className="text-gray-400 text-xs font-semibold mb-2">프롤로그 미리보기</p>
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
            기본 설정
          </div>
        </div>

        <div>
          <p className="text-gray-400 text-xs font-semibold mb-1">업데이트 날짜</p>
          <div className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-gray-700 text-sm">
            {today}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-400 text-xs font-semibold">댓글 1,000건</p>
            <button className="text-brand text-xs font-semibold">전체보기</button>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">나</div>
            <div className="flex-1 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100">
              <p className="text-gray-700 text-xs">나도이런거만들거야님 너무 재밌어요~~!!</p>
            </div>
          </div>
        </div>

        <button className="w-full py-3 rounded-xl bg-gray-200 text-gray-400 text-sm font-semibold">
          플레이
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PLACEHOLDER TAB (fallback only)
// ─────────────────────────────────────────────
function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-8 py-12 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">⚙️</span>
        </div>
        <p className="text-gray-500 text-sm">{label} 설정을 완료하세요</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PROMPT TEMPLATES
// ─────────────────────────────────────────────
const PROMPT_TEMPLATES = [
  {
    id: 'basic',
    label: '기본 프롬프트',
    description: 'AI가 다양한 상황을 폭넓게 이해하고 답해요',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18M12 3l9 9-9 9" />
      </svg>
    ),
  },
  {
    id: 'roleplay',
    label: '1:1 롤플레이 프롬프트',
    description: 'AI가 사람처럼 대화하고 감정을 표현해요',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="8" r="4" /><path strokeLinecap="round" d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
  {
    id: 'simulation',
    label: '시뮬레이션 프롬프트',
    description: 'AI가 게임이나 여러 스토리들을 등장시키는 상황을 잘 만들어요',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="6" width="20" height="12" rx="2"/><path strokeLinecap="round" d="M8 12h8M12 8v8"/>
      </svg>
    ),
  },
  {
    id: 'productivity',
    label: '생산성 프롬프트',
    description: 'AI가 전문 지식을 바탕으로 유용한 답을 해요',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: 'custom',
    label: '제작자 커스텀 프롬프트',
    description: '제작자가 직접 AI에게 모든 지시사항을 입력하는 고급 커스텀이에요',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
] as const;

type PromptTemplateId = (typeof PROMPT_TEMPLATES)[number]['id'];

// ─────────────────────────────────────────────
// STORY SETTINGS TAB
// ─────────────────────────────────────────────
function StorySettingsTab({
  storyName, storyDescription, initialSystemPrompt, onSystemPromptChange,
  initialExamples, onExamplesChange,
}: {
  storyName: string; storyDescription: string; initialSystemPrompt: string; onSystemPromptChange: (v: string) => void;
  initialExamples?: { id: string; user: string; assistant: string }[];
  onExamplesChange?: (examples: { id: string; user: string; assistant: string }[]) => void;
}) {
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplateId>('basic');
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(initialSystemPrompt);
  const [customPrompt, setCustomPrompt] = useState('');
  const [examples, setExamplesLocal] = useState<{ id: string; user: string; assistant: string }[]>(
    initialExamples?.length ? initialExamples : [{ id: '1', user: '', assistant: '' }]
  );

  const setExamples = (updater: ((prev: { id: string; user: string; assistant: string }[]) => { id: string; user: string; assistant: string }[]) | { id: string; user: string; assistant: string }[]) => {
    setExamplesLocal(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      onExamplesChange?.(next);
      return next;
    });
  };
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [generatingExamples, setGeneratingExamples] = useState(false);
  const [showProfileTooltip, setShowProfileTooltip] = useState(false);
  const [showExamplesMaxTooltip, setShowExamplesMaxTooltip] = useState(false);
  const [examplesError, setExamplesError] = useState(false);

  const isProfileComplete = storyName.trim().length > 0 && storyDescription.trim().length > 0;

  const handleAutoGeneratePrompt = () => {
    if (!isProfileComplete) {
      setShowProfileTooltip(true);
      setTimeout(() => setShowProfileTooltip(false), 3000);
      return;
    }
    handleGeneratePrompt();
  };

  const isCustom = selectedTemplate === 'custom';
  const activeTemplate = PROMPT_TEMPLATES.find(t => t.id === selectedTemplate)!;

  const handleUpdatePrompt = (v: string) => {
    setSystemPrompt(v);
    onSystemPromptChange(v);
  };

  const handleSelectTemplate = (id: PromptTemplateId) => {
    setSelectedTemplate(id);
    setTemplateDropdownOpen(false);
    // custom 선택 시 커스텀 프롬프트를 systemPrompt로 반영
    if (id === 'custom') onSystemPromptChange(customPrompt);
    else onSystemPromptChange(systemPrompt);
  };

  const handleGeneratePrompt = async () => {
    setGeneratingPrompt(true);
    try {
      const { api } = await import('../../lib/api');
      const { systemPrompt: generated } = await api.stories.generateStorySettings({
        name: storyName,
        description: storyDescription,
        // 기존 내용이 있으면 바탕으로 생성
        ...(systemPrompt.trim() ? { existingContent: systemPrompt } : {}),
      });
      handleUpdatePrompt(generated.slice(0, 3000));
    } catch {
      // silent fail
    } finally {
      setGeneratingPrompt(false);
    }
  };

  const handleGenerateExamples = async () => {
    setGeneratingExamples(true);
    setExamplesError(false);
    try {
      const { api } = await import('../../lib/api');
      const result = await api.stories.generateExamples({
        name: storyName,
        description: storyDescription,
        systemPrompt,
      });

      // 응답 구조 방어적 처리: { examples: [...] } 또는 [...] 모두 허용
      const generated: { user: string; assistant: string }[] =
        Array.isArray(result) ? result :
        Array.isArray(result?.examples) ? result.examples :
        [];

      if (generated.length > 0) {
        setExamples(prev => {
          const base = prev.length > 0 ? prev : generated.map((_, i) => ({ id: String(Date.now() + i), user: '', assistant: '' }));
          return base.map((slot, i) => {
            const gen = generated[i];
            if (!gen) return slot;
            return {
              id: slot.id ?? String(Date.now() + i),
              user: (gen.user || '').slice(0, 500),
              assistant: (gen.assistant || '').slice(0, 500),
            };
          });
        });
      } else {
        setExamplesError(true);
        setTimeout(() => setExamplesError(false), 3000);
      }
    } catch {
      setExamplesError(true);
      setTimeout(() => setExamplesError(false), 3000);
    } finally {
      setGeneratingExamples(false);
    }
  };

  const handleAddExample = () => {
    if (examples.length >= 3) {
      setShowExamplesMaxTooltip(true);
      setTimeout(() => setShowExamplesMaxTooltip(false), 3000);
      return;
    }
    setExamples(p => [...p, { id: String(Date.now()), user: '', assistant: '' }]);
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
      {/* ── 상단 토스트 (예시 최대 / 생성 오류) ── */}
      <AnimatePresence>
        {(showExamplesMaxTooltip || examplesError) && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          >
            <div className="bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-xl shadow-xl whitespace-nowrap">
              {examplesError ? '생성에 실패했어요. 스토리 정보를 먼저 입력해 주세요.' : '예시는 3개까지 등록할 수 있어요'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 프롬프트 템플릿 선택기 ── */}
      <div className="mb-8">
        <div className="flex items-center gap-1 mb-1">
          <label className="text-gray-900 font-semibold text-sm">프롬프트 템플릿</label>
          <span className="text-brand font-bold text-sm">*</span>
        </div>
        <p className="text-gray-400 text-xs mb-3">스토리의 목적에 맞는 템플릿을 선택해 주세요.<br />템플릿을 변경해도 입력하신 내용이 사라지지 않아요.</p>

        <div className="relative">
          <button
            type="button"
            onClick={() => setTemplateDropdownOpen(p => !p)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 bg-white hover:border-gray-300 transition-colors"
          >
            <span className="flex items-center gap-2.5 text-gray-700 text-sm font-medium">
              <span className="text-gray-500">{activeTemplate.icon}</span>
              {activeTemplate.label}
            </span>
            <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', templateDropdownOpen && 'rotate-180')} />
          </button>

          {templateDropdownOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setTemplateDropdownOpen(false)} />
              <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl border border-gray-200 shadow-lg z-40 overflow-hidden py-1">
                {PROMPT_TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelectTemplate(t.id)}
                    className={cn(
                      'w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors',
                      selectedTemplate === t.id && 'bg-gray-50'
                    )}
                  >
                    <span className="text-gray-500 mt-0.5 flex-shrink-0">{t.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 font-semibold text-sm">{t.label}</p>
                      <p className="text-gray-400 text-xs mt-0.5">{t.description}</p>
                    </div>
                    {selectedTemplate === t.id && (
                      <svg className="w-4 h-4 text-brand flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── 제작자 커스텀: 프롬프트 직접 입력 ── */}
      {isCustom ? (
        <div className="mb-8">
          <div className="flex items-center gap-1.5 mb-1">
            <label className="text-gray-900 font-semibold text-sm">프롬프트</label>
            <span className="text-brand font-bold text-sm">*</span>
            <button type="button" className="text-gray-300 hover:text-gray-500 transition-colors">
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-gray-400 text-xs mb-3">AI에게 지시할 내용을 자유 형식으로 입력해 주세요</p>
          <div className="relative">
            <textarea
              value={customPrompt}
              onChange={(e) => {
                const v = e.target.value.slice(0, 5000);
                setCustomPrompt(v);
                onSystemPromptChange(v);
              }}
              placeholder="AI에게 지시할 내용을 자유 형식으로 입력해 주세요"
              rows={14}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400 transition-colors resize-none"
            />
            <span className="absolute right-4 bottom-3 text-gray-300 text-xs">{customPrompt.length} / 5000</span>
          </div>
        </div>
      ) : (
        <>
          {/* ── 스토리 설정 및 정보 (기본/롤플레이/시뮬레이션/생산성) ── */}
          <div className="mb-8">
            <div className="flex items-center gap-1 mb-1">
              <label className="text-gray-900 font-semibold text-sm">스토리 설정 및 정보</label>
              <span className="text-brand font-bold text-sm">*</span>
            </div>
            <p className="text-gray-400 text-xs mb-3">세계관, 설정, 등장인물 외모, 성격, 말투 등 스토리의 더 자세한 정보를 입력해 주세요</p>
            <div className="relative">
              <textarea
                value={systemPrompt}
                onChange={(e) => handleUpdatePrompt(e.target.value.slice(0, 3000))}
                placeholder="자동 생성 기능을 활용하면 AI가 프롬프트를 참고하여 초안을 작성해 드려요"
                rows={8}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400 transition-colors resize-none"
              />
              <span className="absolute right-4 bottom-3 text-gray-300 text-xs">{systemPrompt.length} / 3000</span>
            </div>
            <div className="flex justify-end mt-2">
              <div className="relative">
                {showProfileTooltip && (
                  <div className="absolute bottom-full right-0 mb-2 z-50 whitespace-nowrap">
                    <div className="bg-gray-900 text-white text-xs font-medium px-4 py-2.5 rounded-xl shadow-lg text-center leading-relaxed">
                      1단계 프로필 필수 정보를 채워야<br />자동 생성을 할 수 있어요
                    </div>
                    <div className="absolute right-4 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-gray-900" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleAutoGeneratePrompt}
                  disabled={generatingPrompt}
                  className="px-3 py-1.5 rounded-lg border border-brand/40 text-brand text-xs font-semibold hover:bg-brand/5 transition-colors disabled:opacity-50"
                >
                  {generatingPrompt ? '생성 중...' : '자동 생성'}
                </button>
              </div>
            </div>
          </div>

          {/* ── 고급 설정 ── */}
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition-colors mb-8"
          >
            고급 설정
            <ChevronUp className="w-4 h-4 rotate-180" />
          </button>

          {/* ── 전개 예시 로딩 모달 ── */}
          <AnimatePresence>
            {generatingExamples && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 8 }}
                  transition={{ duration: 0.18 }}
                  className="bg-white rounded-2xl shadow-2xl w-[480px] overflow-hidden"
                >
                  <div className="px-6 pt-5 pb-1">
                    <h3 className="text-gray-900 font-bold text-base">자동 생성</h3>
                    <div className="mt-2 h-0.5 w-8 bg-brand rounded-full" />
                  </div>
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <svg className="w-9 h-9 animate-spin text-gray-800" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <p className="text-gray-700 font-medium text-sm">AI가 초안을 열심히 작성하고 있어요</p>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── 전개 예시 ── */}
          <div className="mb-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-gray-900 font-semibold text-sm mb-0.5">전개 예시</p>
                <p className="text-gray-400 text-xs">전개 예시를 입력해서 스토리의 완성도를 높여보세요.<br />예시는 3개까지 등록할 수 있어요.</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleGenerateExamples}
                  disabled={generatingExamples}
                  className="px-3 py-1.5 rounded-lg border border-brand/40 text-brand text-xs font-medium hover:bg-brand/5 transition-colors disabled:opacity-50"
                >
                  전체 자동 생성
                </button>
                <button
                  type="button"
                  onClick={handleAddExample}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors"
                >
                  예시 추가
                </button>
              </div>
            </div>

            {examples.map((ex, i) => (
              <div key={i} className="mb-4 rounded-xl border border-gray-200 overflow-hidden bg-white">
                {/* 예시 헤더 */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <span className="text-gray-700 font-semibold text-sm">예시 {examples.length - i}</span>
                  <button
                    type="button"
                    onClick={() => setExamples(p => p.filter((_, j) => j !== i))}
                    className="text-gray-400 hover:text-red-400 text-sm transition-colors"
                  >
                    삭제
                  </button>
                </div>

                <div className="divide-y divide-gray-100">
                  {/* 사용자 입력 */}
                  <div className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3.5 h-3.5 text-gray-500" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                        </svg>
                      </div>
                      <span className="text-gray-500 text-xs font-medium">나도이런거만들거야</span>
                    </div>
                    <textarea
                      value={ex.user}
                      onChange={(e) => setExamples(p => p.map((item, j) => j === i ? { ...item, user: e.target.value.slice(0, 500) } : item))}
                      placeholder="사용자가 입력할 예시 대화를 작성해주세요"
                      rows={3}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-800 text-sm placeholder:text-gray-300 focus:outline-none focus:border-gray-400 resize-none transition-colors"
                    />
                    <p className="text-gray-300 text-xs text-right mt-1">{ex.user.length} / 500</p>
                  </div>

                  {/* AI 응답 */}
                  <div className="px-4 py-3 bg-gray-50/50">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3.5 h-3.5 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
                        </svg>
                      </div>
                      <span className="text-brand text-xs font-medium">{storyName || '캐릭터'}</span>
                    </div>
                    <textarea
                      value={ex.assistant}
                      onChange={(e) => setExamples(p => p.map((item, j) => j === i ? { ...item, assistant: e.target.value.slice(0, 500) } : item))}
                      placeholder={`*지문* "대사" 형식으로 작성해주세요\n예) *미소를 지으며* "안녕! 오늘 어떤 일이 있었어?"`}
                      rows={4}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-gray-800 text-sm placeholder:text-gray-300 focus:outline-none focus:border-brand/40 resize-none transition-colors bg-white"
                    />
                    <p className="text-gray-300 text-xs text-right mt-1">{ex.assistant.length} / 500</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// CHAT INPUT BAR (extracted to avoid IIFE in JSX)
// ─────────────────────────────────────────────
type ChatValidation =
  | { type: 'required'; placeholder: string; errorMessage: string }
  | { type: 'optional'; message: string }
  | null;

function ChatInputBar({ validation, inputValue, setInputValue, onSend, onLockedClick, disabled }: {
  validation: ChatValidation;
  inputValue: string;
  setInputValue: (v: string) => void;
  onSend: (text: string) => void;
  onLockedClick?: (errorMessage: string) => void;
  disabled?: boolean;
}) {
  const isLocked = validation?.type === 'required';
  const inputPlaceholder = isLocked
    ? (validation as { type: 'required'; placeholder: string }).placeholder
    : '메시지를 입력하세요';

  const handleSend = () => {
    if (isLocked) {
      onLockedClick?.((validation as { type: 'required'; errorMessage: string }).errorMessage);
      return;
    }
    if (!inputValue.trim() || disabled) return;
    onSend(inputValue.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-shrink-0 px-4 py-3 border-t border-gray-100">
      <div
        className={cn(
          'flex items-center gap-2 px-4 py-3 rounded-2xl border bg-gray-50 transition-colors',
          isLocked ? 'border-gray-200 cursor-not-allowed' : 'border-gray-200 focus-within:border-gray-400'
        )}
        onClick={() => { if (isLocked) onLockedClick?.((validation as { type: 'required'; errorMessage: string }).errorMessage); }}
      >
        {isLocked && (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300 flex-shrink-0">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        )}
        <input
          type="text"
          value={isLocked ? '' : inputValue}
          onChange={e => { if (!isLocked) setInputValue(e.target.value); }}
          onKeyDown={handleKeyDown}
          readOnly={isLocked}
          disabled={disabled}
          placeholder={inputPlaceholder}
          className={cn(
            'flex-1 bg-transparent text-xs outline-none placeholder:text-gray-300',
            isLocked || disabled ? 'cursor-not-allowed text-gray-300 pointer-events-none' : 'text-gray-700'
          )}
        />
        <button
          onClick={e => { e.stopPropagation(); handleSend(); }}
          disabled={isLocked || disabled || !inputValue.trim()}
          className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0 disabled:opacity-30 transition-opacity"
        >
          {disabled ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="animate-spin">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="3"/>
              <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M5 12h14m-7-7l7 7-7 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CRACKER CHARGE MODAL
// ─────────────────────────────────────────────
const CRACKER_PACKAGES = [
  { id: 'cracker_200',   label: '200 크래커',    price: 2000,  crackers: 200,   bonus: 0,    popular: false },
  { id: 'cracker_500',   label: '500 크래커',    price: 4900,  crackers: 500,   bonus: 50,   popular: false },
  { id: 'cracker_1000',  label: '1,000 크래커',  price: 9600,  crackers: 1000,  bonus: 100,  popular: false },
  { id: 'cracker_3000',  label: '3,000 크래커',  price: 28000, crackers: 3000,  bonus: 500,  popular: true  },
  { id: 'cracker_5000',  label: '5,000 크래커',  price: 46000, crackers: 5000,  bonus: 1000, popular: false },
  { id: 'cracker_10000', label: '10,000 크래커', price: 90000, crackers: 10000, bonus: 3000, popular: false },
];

// ── 임시저장 내역 모달 ─────────────────────────────────────────────────────
function DraftHistoryModal({ onClose, currentStoryId }: { onClose: () => void; currentStoryId: string | null }) {
  const router = useRouter();
  const { reset } = useStoryDraftStore();
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.stories.my({ limit: 50 }).then((res: any) => {
      const all: any[] = res.data ?? [];
      setDrafts(all.filter((s: any) => s.status === 'DRAFT'));
    }).finally(() => setLoading(false));
  }, []);

  const handleOpen = (id: string) => {
    if (id === currentStoryId) { onClose(); return; }
    reset();
    router.push(`/creator/story/${id}/edit`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -8 }}
        transition={{ duration: 0.15 }}
        className="relative z-10 bg-white rounded-2xl shadow-2xl w-[480px] max-w-[calc(100vw-2rem)] mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-gray-900 font-bold text-base">임시저장 내역</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 안내 */}
        <div className="mx-4 mt-3 mb-2 px-3 py-2 bg-gray-50 rounded-xl flex items-center gap-2 text-xs text-gray-500">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
          미등록 스토리 1개당 총 50개까지 저장할 수 있어요
        </div>

        {/* 개수 */}
        <div className="flex items-center justify-between px-6 py-2">
          <span className="text-sm text-gray-500">총 <span className="font-semibold text-gray-800">{drafts.length}</span>개</span>
        </div>

        {/* 리스트 */}
        <div className="max-h-[360px] overflow-y-auto px-4 pb-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />
            </div>
          ) : drafts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="w-14 h-14 mb-3 text-gray-200 flex items-center justify-center">
                <svg viewBox="0 0 48 48" fill="none" className="w-12 h-12">
                  <rect x="6" y="8" width="28" height="36" rx="3" fill="#e5e7eb" />
                  <rect x="10" y="16" width="20" height="2.5" rx="1.25" fill="#9ca3af" />
                  <rect x="10" y="22" width="14" height="2.5" rx="1.25" fill="#9ca3af" />
                  <circle cx="36" cy="34" r="9" fill="#d1d5db" />
                  <path d="M33 34h6M36 31v6" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <p className="text-gray-400 text-sm">아직 임시저장한 스토리가 없어요</p>
            </div>
          ) : (
            <div className="space-y-2">
              {drafts.map((draft) => (
                <button
                  key={draft.id}
                  onClick={() => handleOpen(draft.id)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all hover:border-gray-300 hover:bg-gray-50',
                    draft.id === currentStoryId
                      ? 'border-blue-200 bg-blue-50'
                      : 'border-gray-100'
                  )}
                >
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    {draft.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={draft.coverUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {draft.title?.trim() || '제목 없음'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(draft.createdAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} 저장
                    </p>
                  </div>
                  {draft.id === currentStoryId && (
                    <span className="text-xs text-blue-500 font-medium flex-shrink-0">현재 편집 중</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function CrackerChargeModal({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState(CRACKER_PACKAGES[3].id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const pkg = CRACKER_PACKAGES.find(p => p.id === selected) ?? CRACKER_PACKAGES[3];

  const loadTossScript = (): Promise<void> =>
    new Promise((resolve, reject) => {
      if ((window as any).TossPayments) { resolve(); return; }
      const script = document.createElement('script');
      script.src = 'https://js.tosspayments.com/v1/payment';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Toss 결제 스크립트 로드 실패'));
      document.head.appendChild(script);
    });

  const handleTossPay = async () => {
    setLoading(true);
    setError('');
    try {
      const { api } = await import('../../lib/api');
      const { data } = await api.payments.initiateTosse(selected);
      await loadTossScript();
      const toss = (window as any).TossPayments(data.clientKey);
      await toss.requestPayment('카드', {
        amount: data.amount,
        orderId: data.orderId,
        orderName: data.orderName,
        successUrl: data.successUrl,
        failUrl: data.failUrl,
      });
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err?.code === 'PAY_PROCESS_CANCELED' || err?.code === 'USER_CANCEL') {
        setLoading(false);
        return;
      }
      setError(err?.message ?? '결제 초기화에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.15 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-lg">◆</span>
            <h2 className="text-gray-900 font-bold text-base">크래커 충전하기</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Package list */}
        <div className="px-6 py-4 space-y-2.5 max-h-[55vh] overflow-y-auto">
          {CRACKER_PACKAGES.map(p => (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className={cn(
                'w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 transition-all text-left',
                selected === p.id ? 'border-brand bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300'
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0', selected === p.id ? 'border-brand' : 'border-gray-300')}>
                  {selected === p.id && <div className="w-2 h-2 rounded-full bg-brand" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-900 font-semibold text-sm">◆ {p.crackers.toLocaleString()}</span>
                    {p.bonus > 0 && (
                      <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 text-[10px] font-bold rounded">+{p.bonus.toLocaleString()} 보너스</span>
                    )}
                    {p.popular && (
                      <span className="px-1.5 py-0.5 bg-brand text-white text-[10px] font-bold rounded">추천</span>
                    )}
                  </div>
                  {p.bonus > 0 && (
                    <p className="text-gray-400 text-xs mt-0.5">총 {(p.crackers + p.bonus).toLocaleString()}개 지급</p>
                  )}
                </div>
              </div>
              <span className="text-gray-900 font-bold text-sm">{p.price.toLocaleString()}원</span>
            </button>
          ))}
        </div>

        {error && (
          <div className="mx-6 mb-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-600 text-xs">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">선택 패키지</span>
            <span className="font-semibold text-gray-900">
              ◆ {pkg.crackers.toLocaleString()}
              {pkg.bonus > 0 && <span className="text-orange-500"> +{pkg.bonus.toLocaleString()}</span>}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">결제 금액</span>
            <span className="font-bold text-gray-900 text-base">{pkg.price.toLocaleString()}원</span>
          </div>
          <button
            onClick={handleTossPay}
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ backgroundColor: '#3182F6' }}
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                처리 중...
              </>
            ) : '토스페이로 결제하기'}
          </button>
          <p className="text-gray-400 text-[11px] text-center">결제는 토스페이먼츠를 통해 안전하게 처리됩니다</p>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN STORY CREATE FORM
// ─────────────────────────────────────────────
export function StoryCreateForm({ initialStoryId }: { initialStoryId?: string } = {}) {
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const router = useRouter();

  // ── 자동저장 훅 활성화 ─────────────────────────────────────────────────
  useAutoSave(initialStoryId);

  // ── Zustand draft store ────────────────────────────────────────────────
  const {
    storyId,
    saveStatus, setSaveStatus,
    activeTab, setActiveTab,
    name, setName,
    description, setDescription,
    squareImage, setSquareImage,
    verticalImage, setVerticalImage,
    systemPrompt, setSystemPrompt,
    startSettings, setStartSettings, activeStartSettingId, setActiveStartSettingId,
    stats, setStats,
    examples, setExamples,
    lastSavedAt,
    reset,
  } = useStoryDraftStore();

  const [showDraftHistory, setShowDraftHistory] = useState(false);
  const [publishErrors, setPublishErrors] = useState<string[]>([]);
  const [publishedStoryId, setPublishedStoryId] = useState<string | null>(null);
  const [registerVisibility, setRegisterVisibility] = useState<string>('private');
  const [isAlreadyPublished, setIsAlreadyPublished] = useState(false);

  // ── 편집 모드: 기존 스토리 데이터 로딩 ────────────────────────────────
  const [editDataLoaded, setEditDataLoaded] = useState(false);
  useEffect(() => {
    if (!initialStoryId || editDataLoaded) return;
    api.stories.getEditData(initialStoryId).then((res: any) => {
      const d = res.data;
      setName(d.title ?? '');
      setDescription(d.description ?? '');
      setSystemPrompt(d.systemPrompt ?? '');
      if (d.coverUrl) setSquareImage(d.coverUrl, d.coverKey ?? null);
      if (d.coverVerticalUrl) setVerticalImage(d.coverVerticalUrl, d.coverVerticalKey ?? null);
      if (d.startSettings?.length) {
        setStartSettings(d.startSettings);
        setActiveStartSettingId(d.startSettings[0].id);
      }
      if (d.examples?.length) setExamples(d.examples);
      if (d.status && d.status !== 'DRAFT') setIsAlreadyPublished(true);
      setEditDataLoaded(true);
    }).catch(() => {
      setEditDataLoaded(true); // 실패해도 빈 폼으로 진행
    });
  }, [initialStoryId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 현재 활성 시작설정에서 미리보기에 필요한 값 파생
  const activeStartSetting = startSettings.find(s => s.id === activeStartSettingId) ?? startSettings[0];
  const prologue = activeStartSetting?.prologue ?? '';
  const playGuide = activeStartSetting?.playGuide ?? '';
  const suggestedReplies = activeStartSetting?.suggestedReplies ?? [];

  // 채팅 미리보기 전용 로컬 상태 (저장 불필요)
  type PreviewMsg = { role: 'user' | 'assistant'; content: string; streaming?: boolean };
  const [previewMessages, setPreviewMessages] = useState<PreviewMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isPreviewStreaming, setIsPreviewStreaming] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ show: boolean; message: string; pendingText: string }>({ show: false, message: '', pendingText: '' });
  const [errorDialog, setErrorDialog] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  // AI model selector
  const [selectedModel, setSelectedModel] = useState<ChatModel>(CHAT_MODELS[2]);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  // 크래커 충전 모달
  const [crackerModalOpen, setCrackerModalOpen] = useState(false);

  const getChatValidation = (): ChatValidation => {
    if (!squareImage)
      return { type: 'required', placeholder: '[프로필 이미지]를 등록해주세요', errorMessage: '프로필 이미지를 먼저 등록해주세요' };
    if (!name.trim())
      return { type: 'required', placeholder: '[이름]을 입력해주세요', errorMessage: '이름을 입력해주세요' };
    if (/[\u3131-\u314e\u314f-\u3163]/.test(name) || /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(name))
      return { type: 'required', placeholder: '[이름]을 입력해주세요', errorMessage: '이름에는 특수문자, 이모지, 자음, 모음을\n사용할 수 없습니다' };
    if (!systemPrompt.trim())
      return { type: 'required', placeholder: '[스토리 설정]을 입력해주세요', errorMessage: '스토리 설정을 먼저 입력해주세요' };
    if (!prologue.trim())
      return { type: 'required', placeholder: '[프롤로그]를 입력해주세요', errorMessage: '프롤로그를 먼저 입력해주세요' };
    if (stats.length > 0 && stats.some((s: any) => !s.name.trim()))
      return { type: 'optional', message: '스탯 필수 정보가 제대로 입력되지 않아\n일부 스탯이 제외된 채팅방이 생성돼요' };
    return null;
  };

  // 추천 답변 클릭 → 입력창에 채우기만 (즉시 전송 X)
  const handleReplyClick = (reply: string) => {
    const v = getChatValidation();
    if (v?.type === 'required') { setErrorDialog({ show: true, message: v.errorMessage }); return; }
    setChatInput(reply);
  };

  // 실제 메시지 전송 → AI 스트리밍 응답
  const handlePreviewSend = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isPreviewStreaming) return;

    const v = getChatValidation();
    if (v?.type === 'required') { setErrorDialog({ show: true, message: v.errorMessage }); return; }
    if (v?.type === 'optional') {
      setConfirmDialog({ show: true, message: v.message, pendingText: trimmed });
      return;
    }
    doPreviewSend(trimmed);
  };

  const doPreviewSend = (text: string) => {
    setChatInput('');
    setPreviewMessages(prev => [...prev, { role: 'user', content: text }]);
    setIsPreviewStreaming(true);
    // streaming placeholder
    setPreviewMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }]);

    const { useAuthStore } = require('../../stores/auth.store') as typeof import('../../stores/auth.store');
    const token = useAuthStore.getState().accessToken ?? '';

    const { streamPreviewChat } = require('../../lib/api') as typeof import('../../lib/api');

    const history = previewMessages.filter(m => !m.streaming).map(m => ({ role: m.role, content: m.content }));

    streamPreviewChat(
      { systemPrompt, history, userMessage: text, characterName: name.trim() || undefined },
      token,
      {
        onDelta: (chunk) => {
          setPreviewMessages(prev =>
            prev.map(m => m.streaming ? { ...m, content: m.content + chunk } : m)
          );
        },
        onDone: () => {
          setPreviewMessages(prev =>
            prev.map(m => m.streaming ? { ...m, streaming: false } : m)
          );
          setIsPreviewStreaming(false);
        },
        onError: (msg) => {
          setPreviewMessages(prev => prev.filter(m => !m.streaming));
          setIsPreviewStreaming(false);
          setErrorDialog({ show: true, message: msg });
        },
      }
    );
  };

  // Shared start-settings list for media/keywords/ending tabs
  const startSettingsList = startSettings.map(s => ({ id: s.id, name: s.name }));

  // Grade distribution for the ending tab right panel
  const [endingGradeCounts, setEndingGradeCounts] = useState<Record<EndingGrade, number>>({ N: 0, R: 0, SR: 0, SSR: 0 });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login?redirect=/creator/story/new');
  }, [isAuthenticated, authLoading, router]);

  // ── 미저장 상태 이탈 경고 ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (saveStatus === 'saving') e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [saveStatus]);

  // 편집 모드에서 데이터 로딩 완료 전까지 폼 렌더 차단 (StorySettingsTab의 useState 초기값 보장)
  if (initialStoryId && !editDataLoaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm">스토리 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const currentTabIndex = TABS.findIndex(t => t.key === activeTab);

  const handleNext = () => {
    const nextTab = TABS[currentTabIndex + 1];
    if (nextTab) setActiveTab(nextTab.key);
  };

  const handlePrev = () => {
    const prevTab = TABS[currentTabIndex - 1];
    if (prevTab) setActiveTab(prevTab.key);
  };

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* 크래커 충전 모달 */}
      <AnimatePresence>
        {crackerModalOpen && (
          <CrackerChargeModal onClose={() => setCrackerModalOpen(false)} />
        )}
      </AnimatePresence>

      {/* 등록 성공 모달 */}
      <AnimatePresence>
        {publishedStoryId && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center" onClick={() => {}}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="relative z-10 bg-white rounded-2xl shadow-2xl w-[380px] mx-4 p-8 text-center"
            >
              <div className="text-5xl mb-4">🎉</div>
              <h2 className="text-gray-900 font-bold text-xl mb-2">스토리가 등록됐어요!</h2>
              <p className="text-gray-400 text-sm mb-8 leading-relaxed">
                독자들이 이제 이야기를 시작할 수 있어요.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    const id = publishedStoryId;
                    reset();
                    setPublishedStoryId(null);
                    window.location.href = `/story/${id}`;
                  }}
                  className="w-full py-3 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition-colors"
                >
                  스토리 바로 보기
                </button>
                <button
                  onClick={() => {
                    reset();
                    setPublishedStoryId(null);
                    window.location.href = '/creator';
                  }}
                  className="w-full py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  내 작품으로 가기
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 임시저장 내역 모달 */}
      <AnimatePresence>
        {showDraftHistory && (
          <DraftHistoryModal
            onClose={() => setShowDraftHistory(false)}
            currentStoryId={storyId}
          />
        )}
      </AnimatePresence>
      {/* ── TOP BAR ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-white z-20">
        {/* Left: back + title */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/creator')}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-gray-900 font-bold text-base">스토리 만들기</h1>
            <button type="button" className="text-gray-300 hover:text-gray-500 transition-colors">
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: save status + buttons */}
        <div className="flex items-center gap-2">
          {/* 자동저장 상태 인디케이터 */}
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium min-w-[100px] justify-center">
            {saveStatus === 'saving' && (
              <>
                <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />
                <span className="text-gray-400 text-xs">저장 중</span>
              </>
            )}
            {saveStatus === 'saved' && (
              <>
                <Check className="w-3.5 h-3.5 text-green-500" />
                <span className="text-green-600 text-xs">
                  {lastSavedAt ? `${new Date(lastSavedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 저장됨` : '저장됨'}
                </span>
              </>
            )}
            {saveStatus === 'error' && (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-red-500 text-xs">저장 실패</span>
              </>
            )}
            {saveStatus === 'idle' && (
              <>
                <Clock className="w-3.5 h-3.5 text-gray-300" />
                <span className="text-gray-400 text-xs">임시저장</span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowDraftHistory(true)}
            className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:bg-gray-50 transition-colors"
            title="임시저장 내역"
          >
            <History className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!storyId || saveStatus === 'saving'}
            onClick={async () => {
              if (!storyId) return;
              setPublishErrors([]);
              try {
                setSaveStatus('saving');
                const visMap: Record<string, string> = { public: 'PUBLIC', private: 'PRIVATE', link: 'UNLISTED' };
                await api.stories.updatePublishSettings(storyId, { visibility: visMap[registerVisibility] ?? 'PRIVATE' });
                if (!isAlreadyPublished) await api.stories.publish(storyId);
                setSaveStatus('saved');
                setPublishedStoryId(storyId);
              } catch (e: any) {
                setSaveStatus('error');
                const details: string[] = e?.response?.data?.details ?? [];
                const msg: string = e?.response?.data?.error ?? '등록에 실패했습니다.';
                setPublishErrors(details.length > 0 ? details : [msg]);
              }
            }}
            className="px-5 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            등록하기
          </button>
        </div>
      </div>

      {/* ── TAB NAV ── */}
      <div className="flex-shrink-0 flex items-center gap-0 px-6 border-b border-gray-100 overflow-x-auto scrollbar-hide bg-white">
        {TABS.map(({ key, label, required }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex items-center gap-0.5 px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-all',
              activeTab === key
                ? 'border-brand text-gray-900 font-semibold'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            )}
          >
            {label}
            {required && <span className="text-brand text-xs font-bold">*</span>}
          </button>
        ))}
      </div>

      {/* ── 등록 에러 배너 ── */}
      <AnimatePresence>
        {publishErrors.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex-shrink-0 bg-red-50 border-b border-red-100 px-6 py-3"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-600 text-xs font-semibold mb-1">등록 전 완성이 필요한 항목이 있어요</p>
                <ul className="space-y-0.5">
                  {publishErrors.map((e, i) => (
                    <li key={i} className="text-red-500 text-xs">• {e}</li>
                  ))}
                </ul>
              </div>
              <button onClick={() => setPublishErrors([])} className="text-red-300 hover:text-red-500 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MAIN SPLIT ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left form */}
        <div className="flex flex-col h-full" style={{ width: '58%', borderRight: '1px solid #f3f4f6' }}>
          {/* Keep-alive: 모든 탭 항상 마운트, 비활성 탭만 숨김 → 탭 전환 시 입력값 유지 */}
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div style={{ display: activeTab === 'profile' ? 'flex' : 'none' }} className="flex-col flex-1 min-h-0 overflow-hidden">
              <ProfileForm
                name={name}
                setName={setName}
                description={description}
                setDescription={setDescription}
                storyId={storyId}
                onNext={handleNext}
                onSquareImageChange={setSquareImage}
                onVerticalImageChange={setVerticalImage}
                squareImagePreview={squareImage}
                verticalImagePreview={verticalImage}
              />
            </div>
            <div style={{ display: activeTab === 'story-settings' ? 'flex' : 'none' }} className="flex-col flex-1 min-h-0 overflow-hidden">
              <StorySettingsTab
                storyName={name}
                storyDescription={description}
                initialSystemPrompt={systemPrompt}
                onSystemPromptChange={setSystemPrompt}
                initialExamples={examples}
                onExamplesChange={setExamples}
              />
            </div>
            <div style={{ display: activeTab === 'start-settings' ? 'flex' : 'none' }} className="flex-col flex-1 min-h-0 overflow-hidden">
              <StartSettingsTab
                storyName={name}
                systemPrompt={systemPrompt}
                initialSettings={startSettings as StartSetting[]}
                initialActiveId={activeStartSettingId}
                onSettingsChange={(s, id) => { useStoryDraftStore.getState().setStartSettings(s as any); useStoryDraftStore.getState().setActiveStartSettingId(id); }}
                onPrologueChange={(v) => { /* derived from store */ }}
                onPlayGuideChange={(v) => { /* derived from store */ }}
                onSuggestedRepliesChange={(v) => { /* derived from store */ }}
              />
            </div>
            <div style={{ display: activeTab === 'stat-settings' ? 'flex' : 'none' }} className="flex-col flex-1 min-h-0 overflow-hidden">
              <StatSettingsTab
                stats={stats as StatItem[]}
                setStats={(v) => setStats(typeof v === 'function' ? (v as (p: StatItem[]) => StatItem[])(stats as StatItem[]) as any : v as any)}
                storyName={name}
                storyDescription={description}
                systemPrompt={systemPrompt}
              />
            </div>
            <div style={{ display: activeTab === 'media' ? 'flex' : 'none' }} className="flex-col flex-1 min-h-0 overflow-hidden">
              <MediaTab startSettings={startSettingsList} />
            </div>
            <div style={{ display: activeTab === 'keywords' ? 'flex' : 'none' }} className="flex-col flex-1 min-h-0 overflow-hidden">
              <KeywordsTab startSettings={startSettingsList} />
            </div>
            <div style={{ display: activeTab === 'ending' ? 'flex' : 'none' }} className="flex-col flex-1 min-h-0 overflow-hidden">
              <EndingSettingsTab
                startSettings={startSettingsList}
                storyName={name}
                stats={stats as any}
                onGoToStats={() => setActiveTab('stat-settings')}
                onGradeCountChange={setEndingGradeCounts}
              />
            </div>
            <div style={{ display: activeTab === 'register' ? 'flex' : 'none' }} className="flex-col flex-1 min-h-0 overflow-hidden">
              <RegisterTab name={name} onVisibilityChange={setRegisterVisibility} />
            </div>
          </div>

          {/* Bottom nav buttons */}
          <div className="flex-shrink-0 flex items-center justify-between px-8 py-4 border-t border-gray-100 bg-white">
            {currentTabIndex > 0 ? (
              <button
                type="button"
                onClick={handlePrev}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                이전
              </button>
            ) : <div />}

            <button
              type="button"
              onClick={handleNext}
              disabled={currentTabIndex === TABS.length - 1}
              className="px-8 py-2.5 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              다음
            </button>
          </div>
        </div>

        {/* Right preview panel */}
        <div className="flex flex-col h-full overflow-hidden" style={{ width: '42%' }}>
          {activeTab === 'profile' ? (
            <>
              <div className="flex-shrink-0 text-center py-3 border-b border-gray-100">
                <p className="text-gray-400 text-xs">이 대화는 AI로 생성된 가상의 이야기입니다</p>
              </div>
              <RightPreviewPanel
                name={name}
                description={description}
                squareImage={squareImage}
                verticalImage={verticalImage}
              />
            </>
          ) : activeTab === 'ending' ? (
            /* Ending tab: Grade distribution panel */
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-shrink-0 px-4 py-3 border-b border-gray-100">
                <span className="text-gray-700 font-semibold text-sm">등급 부여 현황</span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
                {/* Grade status cards */}
                {(['N', 'R', 'SR', 'SSR'] as EndingGrade[]).map(grade => {
                  const { maxCount, unlockAt } = GRADE_LIMITS[grade];
                  const total = Object.values(endingGradeCounts).reduce((a, b) => a + b, 0);
                  const unlocked = total >= unlockAt;
                  const used = endingGradeCounts[grade];
                  const gradeColorMap: Record<EndingGrade, { bg: string; text: string; border: string; badge: string }> = {
                    N:   { bg: 'bg-gray-50',   text: 'text-gray-600',   border: 'border-gray-200', badge: 'bg-gray-200 text-gray-700' },
                    R:   { bg: 'bg-blue-50',   text: 'text-blue-600',   border: 'border-blue-200', badge: 'bg-blue-200 text-blue-700' },
                    SR:  { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200', badge: 'bg-purple-200 text-purple-700' },
                    SSR: { bg: 'bg-yellow-50', text: 'text-yellow-600', border: 'border-yellow-200', badge: 'bg-yellow-200 text-yellow-700' },
                  };
                  const c = gradeColorMap[grade];
                  return (
                    <div key={grade} className={cn('rounded-xl border p-3', c.bg, c.border, !unlocked && 'opacity-50')}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', c.badge)}>{grade}</span>
                          <span className={cn('text-xs font-semibold', c.text)}>
                            {grade === 'N' ? '노멀' : grade === 'R' ? '레어' : grade === 'SR' ? '슈퍼레어' : '슈퍼슈퍼레어'}
                          </span>
                        </div>
                        {unlocked ? (
                          <span className={cn('text-sm font-bold', c.text)}>{used} / {maxCount}</span>
                        ) : (
                          <span className="text-xs text-gray-400">엔딩 {unlockAt}개 필요</span>
                        )}
                      </div>
                      {unlocked && (
                        <div className="w-full bg-white rounded-full h-1.5 border border-gray-200 overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all', grade === 'N' ? 'bg-gray-400' : grade === 'R' ? 'bg-blue-400' : grade === 'SR' ? 'bg-purple-400' : 'bg-yellow-400')}
                            style={{ width: `${(used / maxCount) * 100}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* Total count */}
                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 font-medium">총 엔딩</span>
                    <span className="text-sm font-bold text-gray-700">
                      {Object.values(endingGradeCounts).reduce((a, b) => a + b, 0)} / 10
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
                    <div
                      className="h-full bg-gray-400 rounded-full transition-all"
                      style={{ width: `${(Object.values(endingGradeCounts).reduce((a, b) => a + b, 0) / 10) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">SR은 4개, SSR은 6개 이상 등록 시 해제됩니다</p>
                </div>
              </div>
            </div>
          ) : activeTab === 'register' ? (
            /* Register tab: story card preview */
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-shrink-0 px-4 py-3 border-b border-gray-100">
                <span className="text-gray-700 font-semibold text-sm">미리보기</span>
              </div>
              <RegisterPreviewPanel name={name} coverImage={squareImage} />
            </div>
          ) : (
            /* Chat preview for start/stat/other tabs */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Chat preview header bar */}
              <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
                <button className="flex items-center gap-1.5 text-gray-500 text-sm hover:text-gray-700 transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                  채팅 미리보기
                </button>
                <div className="flex items-center gap-2">
                  {/* Model selector */}
                  <div className="relative">
                    <button
                      onClick={() => setModelDropdownOpen(p => !p)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      <span style={{ color: selectedModel.iconColor }} className="text-sm leading-none">
                        {selectedModel.icon}
                      </span>
                      <span>{selectedModel.label}</span>
                      <ChevronDown className={cn('w-3 h-3 text-gray-400 transition-transform', modelDropdownOpen && 'rotate-180')} />
                    </button>

                    <AnimatePresence>
                      {modelDropdownOpen && (
                        <>
                          {/* Backdrop */}
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setModelDropdownOpen(false)}
                          />
                          <motion.div
                            initial={{ opacity: 0, y: -6, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -6, scale: 0.97 }}
                            transition={{ duration: 0.12 }}
                            className="absolute right-0 top-full mt-1.5 w-72 bg-white rounded-2xl border border-gray-200 shadow-xl z-50 overflow-hidden py-1"
                          >
                            {CHAT_MODELS.map(model => (
                              <button
                                key={model.value}
                                onClick={() => { setSelectedModel(model); setModelDropdownOpen(false); }}
                                className={cn(
                                  'w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors',
                                  selectedModel.value === model.value && 'bg-gray-50'
                                )}
                              >
                                {/* Icon */}
                                <span
                                  className="text-base leading-none mt-0.5 flex-shrink-0 w-5 text-center"
                                  style={{ color: model.iconColor }}
                                >
                                  {model.icon}
                                </span>

                                {/* Label + desc */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-gray-900 font-semibold text-sm">{model.label}</span>
                                    {model.coins !== null && (
                                      <span
                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold"
                                        style={{ backgroundColor: `${model.coinColor}15`, color: model.coinColor }}
                                      >
                                        ◆ {model.coins}개
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-gray-400 text-xs leading-relaxed">{model.description}</p>
                                </div>

                                {/* Checkmark */}
                                {selectedModel.value === model.value && (
                                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#E63325' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </button>
                            ))}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>

                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                    <MessageSquare className="w-3.5 h-3.5" />
                    채팅 내역
                  </button>
                </div>
              </div>

              {/* Stat bars (only in stat-settings tab) */}
              {activeTab === 'stat-settings' && stats.length > 0 && (
                <div className="flex-shrink-0 px-4 py-3 border-b border-gray-100 space-y-2">
                  {stats.slice(0, 3).map(stat => (
                    <div key={stat.id} className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 w-28 flex-shrink-0">
                        {stat.icon && <span className="text-sm">{stat.icon}</span>}
                        <span className="text-gray-600 text-xs font-medium truncate">
                          {stat.name || '스탯 이름'}
                        </span>
                      </div>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            backgroundColor: stat.color || '#E63325',
                            width: stat.maxValue
                              ? `${Math.round((Number(stat.defaultValue) - Number(stat.minValue)) / (Number(stat.maxValue) - Number(stat.minValue)) * 100)}%`
                              : '50%',
                          }}
                        />
                      </div>
                      <span className="text-gray-400 text-xs w-8 text-right flex-shrink-0">
                        {stat.defaultValue || 0}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* AI disclaimer */}
              <div className="flex-shrink-0 text-center py-3 border-b border-gray-100">
                <p className="text-gray-400 text-xs">이 대화는 AI로 생성된 가상의 이야기입니다</p>
              </div>

              {/* Chat area */}
              <div className="flex-1 overflow-y-auto p-4">
                {/* AI 메시지 버블 */}
                <div className="flex items-start gap-2.5 mb-4">
                  {/* 프로필 이미지 */}
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 mt-0.5 overflow-hidden">
                    {squareImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={squareImage} alt="profile" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0">
                    {/* 스토리 이름 */}
                    <p className="text-gray-500 text-xs mb-1.5 flex items-center gap-1">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                      </svg>
                      {name.trim() || '스토리 이름'}
                    </p>
                    {/* 프롤로그 말풍선 — 입력된 경우 모든 탭에서 표시 */}
                    {prologue.trim() ? (
                      <div className="max-w-xs px-4 py-3 bg-blue-50 rounded-2xl rounded-tl-sm text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
                        {prologue}
                      </div>
                    ) : (
                      <div className="h-10 w-48 bg-blue-50 rounded-2xl rounded-tl-sm" />
                    )}
                  </div>
                </div>

                {/* 플레이 가이드 */}
                {playGuide.trim() && (
                  <div className="mt-4 mx-1">
                    <p className="text-brand text-xs font-semibold mb-1.5">플레이 가이드</p>
                    <p className="text-gray-500 text-xs leading-relaxed whitespace-pre-wrap">{playGuide}</p>
                  </div>
                )}

                {/* 추천 답변 버튼 — 대화 시작 전에만 표시 */}
                {suggestedReplies.filter(r => r.trim()).length > 0 && previewMessages.length === 0 && (
                  <div className="mt-6">
                    <p className="text-gray-400 text-xs text-right mb-2 flex items-center justify-end gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3z"/></svg>
                      이렇게 답변할 수 있어요
                    </p>
                    <div className="flex flex-col items-end gap-2">
                      {suggestedReplies.filter(r => r.trim()).map((reply, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleReplyClick(reply)}
                          className="px-4 py-2 rounded-2xl border border-brand text-brand text-xs font-medium hover:bg-brand hover:text-white transition-colors max-w-[80%] text-right"
                        >
                          {reply}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 대화 메시지 내역 */}
                {previewMessages.map((msg, idx) => (
                  <div key={idx} className={cn('mt-4', msg.role === 'user' ? 'flex justify-end' : 'flex items-start gap-2.5')}>
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-full bg-gray-200 flex-shrink-0 mt-0.5 overflow-hidden">
                        {squareImage && <img src={squareImage} alt="profile" className="w-full h-full object-cover" />}
                      </div>
                    )}
                    <div className={cn('max-w-[75%]', msg.role === 'user' ? '' : 'min-w-0')}>
                      {msg.role === 'user' ? (
                        <div className="px-4 py-3 bg-gray-800 text-white rounded-2xl rounded-tr-sm text-sm leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                        </div>
                      ) : (
                        <div className="px-4 py-3 bg-blue-50 rounded-2xl rounded-tl-sm text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
                          {msg.content || (msg.streaming && (
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </span>
                          ))}
                          {msg.streaming && msg.content && <span className="inline-block w-0.5 h-3.5 bg-gray-500 ml-0.5 animate-pulse align-middle" />}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Chat input */}
              <ChatInputBar
                validation={getChatValidation()}
                inputValue={chatInput}
                setInputValue={setChatInput}
                onSend={handlePreviewSend}
                onLockedClick={(msg) => setErrorDialog({ show: true, message: msg })}
                disabled={isPreviewStreaming}
              />
            </div>
          )}
        </div>
      </div>

      {/* 임시 채팅방 생성 실패 다이얼로그 (필수 항목 미입력/잘못됨) */}
      {errorDialog.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-80 mx-4 overflow-hidden">
            <div className="px-6 pt-8 pb-6 text-center">
              <h3 className="text-gray-900 font-bold text-base mb-3">임시 채팅방 생성 실패</h3>
              <p className="text-red-500 text-sm leading-relaxed whitespace-pre-line">{errorDialog.message}</p>
            </div>
            <div className="px-4 pb-4">
              <button
                onClick={() => setErrorDialog({ show: false, message: '' })}
                className="w-full py-3 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition-colors flex items-center justify-center gap-1.5"
              >
                확인
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 테스트 채팅 확인 다이얼로그 (선택 항목 미입력) */}
      {confirmDialog.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-80 mx-4 overflow-hidden">
            <div className="px-6 pt-8 pb-6 text-center">
              <h3 className="text-gray-900 font-bold text-base mb-3">이대로 테스트할까요?</h3>
              <p className="text-gray-500 text-sm leading-relaxed whitespace-pre-line">{confirmDialog.message}</p>
            </div>
            <div className="px-4 pb-4 flex gap-2">
              <button
                onClick={() => setConfirmDialog({ show: false, message: '', pendingText: '' })}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  const text = confirmDialog.pendingText;
                  setConfirmDialog({ show: false, message: '', pendingText: '' });
                  if (text) doPreviewSend(text);
                }}
                className="flex-1 py-3 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
