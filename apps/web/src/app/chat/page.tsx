import type { Metadata } from 'next';
import { ChatPageContent } from '../../components/chat/chat-page-content';

export const metadata: Metadata = {
  title: '채팅',
  description: 'AI 캐릭터와 대화하세요',
};

export default function ChatPage() {
  return <ChatPageContent />;
}
