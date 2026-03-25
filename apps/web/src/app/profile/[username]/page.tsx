import type { Metadata } from 'next';
import { MainLayout } from '../../../components/layout/main-layout';
import { ProfileContent } from '../../../components/profile/profile-content';

export const metadata: Metadata = {
  title: '프로필 | CharacterVerse',
};

export default function ProfilePage({ params }: { params: { username: string } }) {
  return (
    <MainLayout showSearch={false}>
      <ProfileContent username={params.username} />
    </MainLayout>
  );
}
