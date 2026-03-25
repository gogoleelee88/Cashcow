import type { Metadata } from 'next';
import { MainLayout } from '../../components/layout/main-layout';
import { CreatorStudio } from '../../components/creator/creator-studio';

export const metadata: Metadata = { title: '크리에이터 스튜디오' };

export default function CreatorPage() {
  return (
    <MainLayout title="크리에이터 스튜디오">
      <CreatorStudio />
    </MainLayout>
  );
}
