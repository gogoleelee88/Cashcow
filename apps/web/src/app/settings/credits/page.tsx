import type { Metadata } from 'next';
import { MainLayout } from '../../../components/layout/main-layout';
import { CreditsContent } from '../../../components/settings/credits-content';

export const metadata: Metadata = {
  title: '크레딧 충전 | CharacterVerse',
};

export default function CreditsPage() {
  return (
    <MainLayout showSearch={false}>
      <CreditsContent />
    </MainLayout>
  );
}
