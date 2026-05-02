import type { Metadata } from 'next';
import { CharacterCreateForm } from '../../../components/creator/character-create-form';

export const metadata: Metadata = { title: '캐릭터 만들기' };

export default function NewCharacterPage() {
  return <CharacterCreateForm />;
}
