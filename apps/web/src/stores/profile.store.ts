import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Profile } from '@characterverse/types';

interface ProfileState {
  activeProfile: Profile | null;
  setActiveProfile: (profile: Profile | null) => void;
  clearProfile: () => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      activeProfile: null,
      setActiveProfile: (profile) => set({ activeProfile: profile }),
      clearProfile: () => set({ activeProfile: null }),
    }),
    {
      name: 'cv-profile',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined'
          ? sessionStorage  // 브라우저 닫으면 초기화 (Netflix 동일 방식)
          : { getItem: () => null, setItem: () => {}, removeItem: () => {} }
      ),
    }
  )
);
