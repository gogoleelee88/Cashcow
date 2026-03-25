import type { Metadata } from 'next';
import { MainLayout } from '../../components/layout/main-layout';
import { NotificationsContent } from '../../components/notifications/notifications-content';

export const metadata: Metadata = {
  title: '알림 | CharacterVerse',
};

export default function NotificationsPage() {
  return (
    <MainLayout showSearch={false}>
      <NotificationsContent />
    </MainLayout>
  );
}
