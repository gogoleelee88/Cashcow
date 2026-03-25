import type { Metadata } from 'next';
import { MainLayout } from '../../components/layout/main-layout';
import { ExploreContent } from '../../components/explore/explore-content';

export const metadata: Metadata = { title: '탐색' };

export default function ExplorePage() {
  return (
    <MainLayout title="캐릭터 탐색">
      <ExploreContent />
    </MainLayout>
  );
}
