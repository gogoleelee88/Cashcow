import type { Metadata } from 'next';
import { MainLayout } from '../../components/layout/main-layout';
import { MyWorksPage } from '../../components/creator/my-works-page';

export const metadata: Metadata = { title: '내 작품' };

export default function CreatorPage() {
  return (
    <MainLayout>
      <MyWorksPage />
    </MainLayout>
  );
}
