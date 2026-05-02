'use client';

import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { X, ZoomIn, ZoomOut } from 'lucide-react';

interface CropArea { x: number; y: number; width: number; height: number }

export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: CropArea
): Promise<{ blobUrl: string; dataUrl: string; blob: Blob }> {
  const image = new Image();
  image.src = imageSrc;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('image load failed'));
  });

  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, pixelCrop.width, pixelCrop.height
  );

  const MAX = 400;
  const scale = Math.min(1, MAX / Math.max(pixelCrop.width, pixelCrop.height));
  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = Math.round(pixelCrop.width * scale);
  thumbCanvas.height = Math.round(pixelCrop.height * scale);
  const thumbCtx = thumbCanvas.getContext('2d')!;
  thumbCtx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
  const dataUrl = thumbCanvas.toDataURL('image/jpeg', 0.75);

  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.95);
  });
  const blobUrl = URL.createObjectURL(blob);

  return { blobUrl, dataUrl, blob };
}

export function ImageCropModal({
  imageSrc,
  aspect,
  onConfirm,
  onCancel,
}: {
  imageSrc: string;
  aspect: number;
  onConfirm: (blobUrl: string, dataUrl: string, blob: Blob) => void;
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
      const { blobUrl, dataUrl, blob } = await getCroppedImg(imageSrc, croppedAreaPixels);
      onConfirm(blobUrl, dataUrl, blob);
    } finally {
      setApplying(false);
    }
  };

  const label = Math.abs(aspect - 1) < 0.01 ? '1:1 정방형' : '2:3 세로형';

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
              cropAreaStyle: { border: '2px solid #00D96B' },
            }}
          />
        </div>

        {/* Zoom slider */}
        <div className="flex-shrink-0 px-5 py-3 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setZoom(z => Math.max(1, z - 0.1))}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
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
            <button
              type="button"
              onClick={() => setZoom(z => Math.min(3, z + 0.1))}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
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
