'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { Mic, MicOff, X, MessageSquare, Volume2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface VoiceModeProps {
  characterName: string;
  characterAvatarUrl?: string | null;
  lastMessage?: string;
  isRecording: boolean;
  isPlaying: boolean;
  onMicClick: () => void;
  onClose: () => void;
}

export function VoiceMode({
  characterName,
  characterAvatarUrl,
  lastMessage,
  isRecording,
  isPlaying,
  onMicClick,
  onClose,
}: VoiceModeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  // 파형 애니메이션 (녹음 중 or 재생 중일 때)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const active = isRecording || isPlaying;
    if (!active) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    let frame = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const bars = 20;
      const barW = 4;
      const gap = (canvas.width - bars * barW) / (bars + 1);
      ctx.fillStyle = isRecording ? '#ef4444' : '#6366f1';
      for (let i = 0; i < bars; i++) {
        const h = 8 + Math.abs(Math.sin(frame * 0.08 + i * 0.5)) * 40;
        const x = gap + i * (barW + gap);
        const y = (canvas.height - h) / 2;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, h, 2);
        ctx.fill();
      }
      frame++;
      animRef.current = requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [isRecording, isPlaying]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-gray-950 text-white px-6 pb-10 pt-6">
      {/* 상단 버튼 */}
      <div className="w-full flex items-center justify-between">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          텍스트 모드
        </button>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 캐릭터 아바타 */}
      <div className="flex flex-col items-center gap-5">
        <div
          className={cn(
            'relative w-36 h-36 rounded-full overflow-hidden ring-4 transition-all duration-300',
            isPlaying ? 'ring-indigo-500 ring-offset-4 ring-offset-gray-950' :
            isRecording ? 'ring-red-500 ring-offset-4 ring-offset-gray-950' :
            'ring-gray-700'
          )}
        >
          {characterAvatarUrl ? (
            <Image src={characterAvatarUrl} alt={characterName} fill className="object-cover" unoptimized />
          ) : (
            <div className="w-full h-full bg-gray-800 flex items-center justify-center text-4xl font-bold text-gray-500">
              {characterName.charAt(0)}
            </div>
          )}
          {isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Volume2 className="w-8 h-8 text-white animate-pulse" />
            </div>
          )}
        </div>

        <div className="text-center">
          <p className="text-xl font-semibold">{characterName}</p>
          <p className="text-sm text-gray-400 mt-1">
            {isRecording ? '듣고 있어요...' : isPlaying ? '말하는 중...' : '눌러서 말하기'}
          </p>
        </div>

        {/* 파형 */}
        <canvas ref={canvasRef} width={280} height={60} className="opacity-80" />

        {/* 마지막 메시지 */}
        {lastMessage && (
          <p className="text-center text-sm text-gray-300 max-w-xs leading-relaxed line-clamp-3">
            "{lastMessage}"
          </p>
        )}
      </div>

      {/* 마이크 버튼 */}
      <button
        onClick={onMicClick}
        className={cn(
          'w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg',
          isRecording
            ? 'bg-red-500 hover:bg-red-600 scale-105'
            : 'bg-white hover:bg-gray-100'
        )}
      >
        {isRecording
          ? <MicOff className="w-8 h-8 text-white" />
          : <Mic className="w-8 h-8 text-gray-900" />
        }
      </button>
    </div>
  );
}
