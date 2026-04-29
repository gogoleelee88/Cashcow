import type { Metadata } from 'next';
import { MainLayout } from '../../components/layout/main-layout';
import { FavoritesContent } from '../../components/favorites/favorites-content';

export const metadata: Metadata = {
  title: '즐겨찾기 | Zacoo',
};

export default function FavoritesPage() {
  return (
    <MainLayout>
      <FavoritesContent />
    </MainLayout>
  );
}
