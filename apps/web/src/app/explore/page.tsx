import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MainLayout } from '../../components/layout/main-layout';
import { ExploreContent } from '../../components/explore/explore-content';

export const metadata: Metadata = { title: '탐색' };

export default function ExplorePage() {
  return (
    <MainLayout>
      <Suspense>
        <ExploreContent />
      </Suspense>
    </MainLayout>
  );
}
