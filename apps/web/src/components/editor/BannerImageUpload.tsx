'use client';

import { useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react';
import { ImageCropModal } from '../ui/image-crop-modal';
import { adminApi } from '../../lib/admin-api';

interface BannerImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  aspectRatio?: number; // 기본 16:5
  hint?: string;
}

// 배너: 16:5 (1280×400), 정사각형: 1:1
const ASPECT_LABELS: Record<string, string> = {
  '3.2': '16:5 배너 (1280×400)',
  '2.39': '2.39:1 시네마틱',
  '1.78': '16:9 와이드',
  '1': '1:1 정방형',
};

export function BannerImageUpload({
  value,
  onChange,
  aspectRatio = 16 / 5,
  hint,
}: BannerImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rawSrc, setRawSrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openFile = () => inputRef.current?.click();

  const handleFile = useCallback((file: File) => {
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
    if (!ALLOWED.includes(file.type)) {
      setError('JPG, PNG, WebP 파일만 업로드할 수 있어요');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('10MB 이하 파일만 업로드할 수 있어요');
      return;
    }
    setError(null);
    setRawSrc(URL.createObjectURL(file));
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleCropConfirm = async (_blobUrl: string, _dataUrl: string, blob: Blob) => {
    setRawSrc(null);
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', new File([blob], 'banner.jpg', { type: 'image/jpeg' }));
      const res = await adminApi.post('/posts/upload', formData, {
        headers: { 'Content-Type': undefined },
      });
      if (res.data.success) {
        onChange(res.data.data.url);
      } else {
        setError(res.data.error ?? '업로드 실패');
      }
    } catch {
      setError('업로드에 실패했습니다. 다시 시도해주세요');
    } finally {
      setUploading(false);
    }
  };

  const aspectLabel = ASPECT_LABELS[String(Math.round(aspectRatio * 100) / 100)] ?? `${aspectRatio.toFixed(2)}:1`;

  return (
    <>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleInputChange} />

      {value ? (
        /* 업로드된 이미지 미리보기 */
        <div className="relative group rounded-xl overflow-hidden border border-gray-200" style={{ aspectRatio: `${aspectRatio}` }}>
          <Image src={value} alt="배너 미리보기" fill className="object-cover" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
            <button type="button" onClick={openFile}
              className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-md transition-colors">
              <Upload className="w-4 h-4" />
              교체
            </button>
            <button type="button" onClick={() => onChange('')}
              className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 shadow-md transition-colors">
              <X className="w-4 h-4" />
              제거
            </button>
          </div>
          {uploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          )}
        </div>
      ) : (
        /* 업로드 영역 */
        <div
          onClick={openFile}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed cursor-pointer transition-all
            ${dragOver ? 'border-brand bg-brand/5' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}
            ${uploading ? 'pointer-events-none opacity-60' : ''}`}
          style={{ aspectRatio: `${aspectRatio}`, minHeight: 160 }}
        >
          {uploading ? (
            <>
              <Loader2 className="w-8 h-8 text-brand animate-spin mb-2" />
              <p className="text-sm text-gray-500">업로드 중...</p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
                <ImageIcon className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-700">클릭하거나 드래그해서 이미지 업로드</p>
              <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP · 최대 10MB</p>
              <p className="text-xs text-gray-400 mt-0.5">권장 비율: {hint ?? aspectLabel}</p>
            </>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}

      {/* 크롭 모달 */}
      {rawSrc && (
        <ImageCropModal
          imageSrc={rawSrc}
          aspect={aspectRatio}
          onConfirm={handleCropConfirm}
          onCancel={() => setRawSrc(null)}
        />
      )}
    </>
  );
}
