import { MainLayout } from '../components/layout/main-layout';
import { CharacterPageContent } from '../components/characters/character-page-content';

export default function HomePage() {
  return (
    <MainLayout>
      <CharacterPageContent />
    </MainLayout>
  );
}
