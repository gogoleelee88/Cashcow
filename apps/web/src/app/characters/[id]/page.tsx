import type { Metadata } from 'next';
import { MainLayout } from '../../../components/layout/main-layout';
import { CharacterDetailContent } from '../../../components/characters/character-detail';

export const metadata: Metadata = {
  title: '캐릭터',
};

export default function CharacterDetailPage({ params }: { params: { id: string } }) {
  return (
    <MainLayout showSearch={false}>
      <CharacterDetailContent characterId={params.id} />
    </MainLayout>
  );
}
