/**
 * Story Draft Store
 * - 스토리 만들기 폼의 모든 상태 관리
 * - 폼 진입 시 서버에 DRAFT 레코드 생성 → storyId 보관
 * - 탭별 변경사항 debounce 800ms 후 서버 자동저장
 * - localStorage에도 병행 저장 (새로고침·탭 전환 복구)
 * - publish 완료 또는 명시적 reset 시에만 초기화
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ── 타입 ──────────────────────────────────────────────────────────────────
export interface DraftStartSetting {
  id: string;
  name: string;
  prologue: string;
  situation: string;
  playGuide: string;
  suggestedReplies: string[];
}

export interface DraftStatLevel {
  id: string;
  label: string;
  min: string;
  max: string;
}

export interface DraftStatItem {
  id: string;
  name: string;
  icon: string;
  color: string;
  minValue: string;
  maxValue: string;
  defaultValue: string;
  unit: string;
  description: string;
  collapsed: boolean;
  levels: DraftStatLevel[];
}

export interface DraftExample {
  /** 로컬 임시 id (서버 저장 전) 또는 서버 id */
  id: string;
  user: string;
  assistant: string;
}

export interface DraftKeywordNote {
  id: string;
  settingId: string;
  title: string;
  keywords: string; // 쉼표 구분 문자열 (UI용)
  content: string;
  expanded: boolean;
  editing: boolean;
}

export type StoryTab =
  | 'profile'
  | 'story-settings'
  | 'start-settings'
  | 'stat-settings'
  | 'media'
  | 'keywords'
  | 'ending'
  | 'register';

// ── 저장 상태 ──────────────────────────────────────────────────────────────
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// ── 상태 인터페이스 ────────────────────────────────────────────────────────
interface StoryDraftState {
  // 서버에 생성된 draft의 storyId (null = 아직 서버 미생성)
  storyId: string | null;

  // 저장 상태 (UI 표시용)
  saveStatus: SaveStatus;
  lastSavedAt: number | null;

  // 활성 탭
  activeTab: StoryTab;

  // 프로필 탭
  name: string;
  description: string;
  squareImage: string | null;
  verticalImage: string | null;
  squareCoverKey: string | null;
  verticalCoverKey: string | null;

  // 스토리 설정 탭
  systemPrompt: string;
  examples: DraftExample[];

  // 시작 설정 탭
  startSettings: DraftStartSetting[];
  activeStartSettingId: string;

  // 스탯 설정 탭
  stats: DraftStatItem[];

  // 키워드북 탭
  keywordNotes: DraftKeywordNote[];

  // ── 액션 ────────────────────────────────────────────────────────────────
  setStoryId: (id: string) => void;
  setSaveStatus: (s: SaveStatus) => void;
  setActiveTab: (tab: StoryTab) => void;

  setName: (v: string) => void;
  setDescription: (v: string) => void;
  setSquareImage: (v: string | null, key?: string | null) => void;
  setVerticalImage: (v: string | null, key?: string | null) => void;

  setSystemPrompt: (v: string) => void;
  setExamples: (v: DraftExample[]) => void;

  setStartSettings: (v: DraftStartSetting[]) => void;
  setActiveStartSettingId: (v: string) => void;

  setStats: (v: DraftStatItem[]) => void;
  setKeywordNotes: (v: DraftKeywordNote[]) => void;

  touch: () => void;
  reset: () => void;
}

// ── 초기값 ────────────────────────────────────────────────────────────────
const DEFAULT_START_SETTINGS: DraftStartSetting[] = [
  { id: '1', name: '기본 설정', prologue: '', situation: '', playGuide: '', suggestedReplies: [] },
];

const initialState = {
  storyId: null as string | null,
  saveStatus: 'idle' as SaveStatus,
  lastSavedAt: null as number | null,
  activeTab: 'profile' as StoryTab,
  name: '',
  description: '',
  squareImage: null as string | null,
  verticalImage: null as string | null,
  squareCoverKey: null as string | null,
  verticalCoverKey: null as string | null,
  systemPrompt: '',
  examples: [{ id: '1', user: '', assistant: '' }] as DraftExample[],
  startSettings: DEFAULT_START_SETTINGS,
  activeStartSettingId: '1',
  stats: [] as DraftStatItem[],
  keywordNotes: [] as DraftKeywordNote[],
};

// ── 스토어 생성 ────────────────────────────────────────────────────────────
export const useStoryDraftStore = create<StoryDraftState>()(
  persist(
    (set) => ({
      ...initialState,

      setStoryId:    (storyId)    => set({ storyId }),
      setSaveStatus: (saveStatus) => set({ saveStatus }),
      setActiveTab:  (activeTab)  => set({ activeTab }),

      setName:        (name)        => set({ name,        lastSavedAt: Date.now() }),
      setDescription: (description) => set({ description, lastSavedAt: Date.now() }),
      setSquareImage:   (squareImage, squareCoverKey = null)     => set({ squareImage,   squareCoverKey,   lastSavedAt: Date.now() }),
      setVerticalImage: (verticalImage, verticalCoverKey = null) => set({ verticalImage, verticalCoverKey, lastSavedAt: Date.now() }),

      setSystemPrompt: (systemPrompt) => set({ systemPrompt, lastSavedAt: Date.now() }),
      setExamples:     (examples)     => set({ examples,     lastSavedAt: Date.now() }),

      setStartSettings:        (startSettings)        => set({ startSettings,        lastSavedAt: Date.now() }),
      setActiveStartSettingId: (activeStartSettingId) => set({ activeStartSettingId }),

      setStats:        (stats)        => set({ stats,        lastSavedAt: Date.now() }),
      setKeywordNotes: (keywordNotes) => set({ keywordNotes, lastSavedAt: Date.now() }),

      touch: () => set({ lastSavedAt: Date.now() }),
      reset: () => set({ ...initialState }),
    }),
    {
      name: 'cv-story-draft-v2',
      storage: createJSONStorage(() => localStorage),
      // base64 이미지 미저장 (용량 문제), saveStatus는 세션마다 초기화
      partialize: (state) => ({
        ...state,
        squareImage:  null,
        verticalImage: null,
        saveStatus:   'idle' as SaveStatus,
      }),
    }
  )
);
