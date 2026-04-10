import type { Metadata } from 'next';
import { StoryCreateForm } from '../../../../../components/creator/story-create-form';

export const metadata: Metadata = { title: '스토리 수정' };

interface Props {
  params: { id: string };
}

export default function EditStoryPage({ params }: Props) {
  return <StoryCreateForm initialStoryId={params.id} />;
}
