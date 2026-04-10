import { ImageGenerationPage } from '../../components/images/image-generation-page';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '이미지',
  description: 'AI 이미지 생성 — 원하는 스타일의 이미지를 만들어보세요.',
};

export default function ImagesPage() {
  return <ImageGenerationPage />;
}
