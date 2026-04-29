import type { Metadata } from 'next';
import { MainLayout } from '../../components/layout/main-layout';
import { SettingsContent } from '../../components/settings/settings-content';

export const metadata: Metadata = {
  title: '설정 | Zacoo',
};

export default function SettingsPage() {
  return (
    <MainLayout showSearch={false}>
      <SettingsContent />
    </MainLayout>
  );
}
