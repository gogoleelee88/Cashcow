import { MainLayout } from '../../../components/layout/main-layout';
import { StoryDetailContent } from '../../../components/story/story-detail-content';
import type { Metadata } from 'next';

interface Props {
  params: { id: string };
}

export const metadata: Metadata = {
  title: '스토리',
};

export default function StoryDetailPage({ params }: Props) {
  return (
    <MainLayout showSearch={false}>
      <StoryDetailContent storyId={params.id} />
    </MainLayout>
  );
}
