import type { Metadata } from 'next';
import { StoryCreateForm } from '../../../../components/creator/story-create-form';

export const metadata: Metadata = { title: '스토리 만들기' };

export default function NewStoryPage() {
  return <StoryCreateForm />;
}
