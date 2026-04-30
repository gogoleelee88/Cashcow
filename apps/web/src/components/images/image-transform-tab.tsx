'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { api } from '../../lib/api';
import { Upload, Download, ChevronRight, Sparkles, RotateCcw, ZoomIn } from 'lucide-react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

const TRANSFORM_COST = 190;

interface Props {
  ratio: string;
  count: number;
  credits: number;
  onNeedPayment: () => void;
}

// ── 업로드 일러스트 placeholder ──────────────────────────────────────────────
function UploadIllustration() {
  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <Image src="/char-upload.png" alt="" width={96} height={96} className="object-contain" />
    </div>
  );
}

function ResultIllustration() {
  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <Image src="/char-result.jpg" alt="" width={96} height={96} className="object-contain rounded-full" />
    </div>
  );
}

// ── 스켈레톤 ────────────────────────────────────────────────────────────────
function Skeleton({ count }: { count: number }) {
  return (
    <div className={cn('grid gap-3', count === 1 ? 'grid-cols-1' : count <= 2 ? 'grid-cols-2' : 'grid-cols-2')}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="aspect-square rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 animate-pulse relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
        </div>
      ))}
    </div>
  );
}

// ── 결과 이미지 카드 ──────────────────────────────────────────────────────────
function ResultCard({ url, index }: { url: string; index: number }) {
  const [hover, setHover] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  const handleDownload = async () => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `transformed_${index + 1}.png`;
    a.target = '_blank';
    a.click();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 0.08 }}
        className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 cursor-pointer group"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => setLightbox(true)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={`결과 ${index + 1}`} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />

        <AnimatePresence>
          {hover && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 flex items-end justify-between p-3"
            >
              <button
                onClick={e => { e.stopPropagation(); handleDownload(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 text-gray-800 text-xs font-semibold hover:bg-white transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                다운로드
              </button>
              <button
                onClick={e => { e.stopPropagation(); setLightbox(true); }}
                className="w-8 h-8 rounded-xl bg-white/90 flex items-center justify-center hover:bg-white transition-colors"
              >
                <ZoomIn className="w-3.5 h-3.5 text-gray-800" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* 라이트박스 */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6"
            onClick={() => setLightbox(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative max-w-2xl max-h-[85vh] rounded-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-contain" />
              <button
                onClick={handleDownload}
                className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/90 text-gray-800 text-sm font-semibold hover:bg-white transition-colors shadow-lg"
              >
                <Download className="w-4 h-4" />
                다운로드
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export function ImageTransformTab({ ratio, count, credits, onNeedPayment }: Props) {
  const [prompt, setPrompt] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading]       = useState(false);
  const [loadingStage, setLoadingStage] = useState<'uploading' | 'processing'>('uploading');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef      = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current); }, []);

  const cost = count * TRANSFORM_COST;

  const handleFile = useCallback((file: File) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      setError('jpg, jpeg, png, webp, gif 형식만 지원합니다.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('5MB 이하의 파일만 업로드할 수 있어요.');
      return;
    }
    setError(null);
    setUploadedFile(file);
    setUploadedPreview(URL.createObjectURL(file));
    setResults([]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleTransform = async () => {
    if (!uploadedFile) { setError('이미지를 먼저 업로드해 주세요.'); return; }
    if (!prompt.trim()) { setError('바꾸고 싶은 내용을 입력해 주세요.'); return; }
    if (credits < cost) { onNeedPayment(); return; }

    setLoading(true);
    setLoadingStage('uploading');
    setError(null);
    setResults([]);

    try {
      const formData = new FormData();
      formData.append('image', uploadedFile);
      formData.append('prompt', prompt);
      formData.append('count', String(count));
      formData.append('ratio', ratio);

      const res = await api.images.transform(formData);
      const { imageId } = res.data;
      setLoadingStage('processing');

      const poll = async () => {
        try {
          const jobRes = await api.images.pollJob(imageId);
          const { status, urls, errorMsg } = jobRes.data;
          if (status === 'COMPLETED') {
            setResults(urls);
            setLoading(false);
          } else if (status === 'FAILED') {
            setError(errorMsg ?? '이미지 변형에 실패했습니다.');
            setLoading(false);
          } else {
            pollRef.current = setTimeout(poll, 2500);
          }
        } catch {
          pollRef.current = setTimeout(poll, 3500);
        }
      };
      pollRef.current = setTimeout(poll, 2000);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? '이미지 변형에 실패했습니다. 다시 시도해 주세요.';
      setError(msg);
      setLoading(false);
    }
  };

  const reset = () => {
    setUploadedFile(null);
    setUploadedPreview(null);
    setResults([]);
    setError(null);
    setPrompt('');
  };

  return (
    <div className="max-w-4xl">
      {/* ── 프롬프트 입력 ── */}
      <div className="mb-6">
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value.slice(0, 1000))}
            placeholder="바꾸고 싶은 부분을 자연스럽게 적어 보세요&#10;(예: 배경을 벚꽃이 날리는 봄날로 바꿔줘, 머리색을 하늘색으로 바꿔줘)"
            rows={3}
            className="w-full px-5 py-4 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none resize-none"
          />
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
            <span className="text-gray-300 text-xs">{prompt.length}/1000</span>
            <button
              onClick={handleTransform}
              disabled={loading || !uploadedFile || !prompt.trim()}
              className={cn(
                'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all',
                loading || !uploadedFile || !prompt.trim()
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-900 text-white hover:bg-gray-800'
              )}
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {loadingStage === 'uploading' ? '업로드 중...' : '변형 중...'}
                </>
              ) : (
                <>
                  <span>🔑</span>
                  이미지 생성 {cost}
                </>
              )}
            </button>
          </div>
        </div>

        {/* 에러 메시지 */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-2 text-xs text-red-500 px-1"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* ── 업로드 / 결과 패널 ── */}
      <div className="flex gap-4 items-stretch">

        {/* 왼쪽: 업로드 존 */}
        <div
          className={cn(
            'flex-1 min-h-[340px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all duration-200 relative overflow-hidden',
            isDragging
              ? 'border-brand bg-brand/5 scale-[1.01]'
              : uploadedPreview
                ? 'border-gray-200 bg-gray-50 p-0'
                : 'border-gray-200 bg-gray-50/50 hover:border-gray-300 hover:bg-gray-50'
          )}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          {uploadedPreview ? (
            /* 이미지 프리뷰 */
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={uploadedPreview}
                alt="업로드된 이미지"
                className="w-full h-full object-cover rounded-2xl"
                style={{ minHeight: 340 }}
              />
              <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors rounded-2xl flex items-center justify-center opacity-0 hover:opacity-100 group">
                <div className="flex gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/90 text-gray-800 text-xs font-semibold hover:bg-white transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    교체
                  </button>
                  <button
                    onClick={reset}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/90 text-gray-800 text-xs font-semibold hover:bg-white transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    초기화
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* 빈 업로드 존 */
            <div className="flex flex-col items-center text-center px-8 py-10">
              <UploadIllustration />
              <p className="text-gray-800 font-bold text-sm mt-4 mb-1">이미지를 업로드하거나 선택하세요</p>
              <p className="text-gray-400 text-xs leading-relaxed mb-5">
                jpg, jpeg, png, webp, gif 형식을 지원하며,<br />
                최대 5MB까지 첨부할 수 있어요.
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2 rounded-xl border border-gray-300 text-gray-600 text-xs font-semibold hover:bg-white hover:border-gray-400 transition-all"
              >
                업로드
              </button>
            </div>
          )}
        </div>

        {/* 중앙 화살표 */}
        <div className="flex items-center flex-shrink-0">
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center transition-colors',
            loading ? 'bg-brand/10' : 'bg-gray-100'
          )}>
            {loading
              ? <Sparkles className="w-4 h-4 text-brand animate-pulse" />
              : <ChevronRight className="w-4 h-4 text-gray-400" />
            }
          </div>
        </div>

        {/* 오른쪽: 결과 존 */}
        <div className="flex-1 min-h-[340px] rounded-2xl border border-gray-200 bg-gray-50/50 overflow-hidden">
          {loading ? (
            <div className="p-4 h-full">
              <Skeleton count={count} />
            </div>
          ) : results.length > 0 ? (
            <div className={cn(
              'p-4 grid gap-3 h-full',
              results.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
            )}>
              {results.map((url, i) => (
                <ResultCard key={url} url={url} index={i} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center px-8 py-10 h-full">
              <ResultIllustration />
              <p className="text-gray-800 font-bold text-sm mt-4 mb-1">이미지 결과가 이곳에 나타나요</p>
              <p className="text-gray-400 text-xs leading-relaxed">
                다양한 결과를 확인하고,<br />
                마음에 드는 이미지를 선택해 보세요.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 히든 파일 인풋 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
