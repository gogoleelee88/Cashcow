import { MainLayout } from '../../components/layout/main-layout';
import { StoryListContent } from '../../components/story/story-list-content';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '스토리',
  description: 'AI와 함께하는 인터랙티브 스토리 — 나만의 이야기를 만들어보세요.',
};

export default function StoryPage() {
  return (
    <MainLayout>
      <StoryListContent />
    </MainLayout>
  );
}
