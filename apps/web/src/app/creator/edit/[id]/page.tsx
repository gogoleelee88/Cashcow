'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CharacterCreateForm } from '../../../../components/creator/character-create-form';
import { api } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth.store';

export default function EditCharacterPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [initialData, setInitialData] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    api.characters.getMyOne(id)
      .then((res) => {
        if (res.success) setInitialData(res.data);
        else setError('캐릭터를 불러올 수 없습니다.');
      })
      .catch(() => setError('캐릭터를 불러올 수 없습니다.'));
  }, [id, isAuthenticated, router]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen text-center">
        <div>
          <p className="text-lg font-semibold text-gray-700">{error}</p>
          <button onClick={() => router.back()} className="mt-4 px-4 py-2 bg-brand text-white rounded-xl text-sm">
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (!initialData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <CharacterCreateForm characterId={id} initialData={initialData} />;
}
