import { ImageGenerationPage } from '../../components/images/image-generation-page';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '포토카드',
  description: 'AI 포토카드 생성 — 원하는 스타일의 포토카드를 만들어보세요.',
};

export default function ImagesPage() {
  return <ImageGenerationPage />;
}
