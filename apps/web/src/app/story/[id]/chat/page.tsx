import { Suspense } from 'react';
import { StoryChatPage } from '../../../../components/story/story-chat-page';
import type { Metadata } from 'next';

interface Props {
  params: { id: string };
}

export const metadata: Metadata = {
  title: '스토리 채팅',
};

export default function StoryChatRoute({ params }: Props) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
      </div>
    }>
      <StoryChatPage storyId={params.id} />
    </Suspense>
  );
}
