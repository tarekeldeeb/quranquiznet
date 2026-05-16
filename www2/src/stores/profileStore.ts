import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sura_idx, sura_name, last5_juz_idx, last5_juz_name, QuranWords } from '../models/constants';

type StudyPart = {
  start: number;
  length: number;
  numCorrect: number[]; // index 0..3
  numQuestions: number[];
  name: string;
  checked: boolean;
};

type CloudProfile = {
  uid: number;
  name: string;
  lastSeed: number;
  level: number;
  specialEnabled: boolean;
  parts: StudyPart[];
};

type ProfileState = {
  uid: number;
  name: string;
  lastSeed: number;
  level: number;
  specialEnabled: boolean;
  parts: StudyPart[];
  makeDefaultProfile: () => void;
  addCorrect: (partIndex: number, level: number, score?: number) => void;
  addIncorrect: (partIndex: number, level: number) => void;
  getTotalStudyLength: () => number;
  toCloudProfile: () => CloudProfile;
  applyCloudProfile: (profile: Partial<CloudProfile>) => void;
  setName: (name: string) => void;
};

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      uid: 0,
      name: '',
      lastSeed: Math.floor(Math.random() * (QuranWords - 1)),
      level: 1,
      specialEnabled: false,
      parts: [],
      makeDefaultProfile: () => {
        const parts: StudyPart[] = [];
        // First part: sura 0
        parts.push({ start: 1, length: sura_idx[0], numCorrect: [0, 0, 0, 0], numQuestions: [0, 0, 0, 0], name: 'سورة ' + sura_name[0], checked: true });
        for (let i = 1; i < 45; i++) {
          parts.push({ start: sura_idx[i - 1], length: sura_idx[i] - sura_idx[i - 1], numCorrect: [0, 0, 0, 0], numQuestions: [0, 0, 0, 0], name: 'سورة ' + sura_name[i], checked: false });
        }
        for (let i = 0; i < 5; i++) {
          parts.push({ start: last5_juz_idx[i], length: last5_juz_idx[i + 1] - last5_juz_idx[i], numCorrect: [0, 0, 0, 0], numQuestions: [0, 0, 0, 0], name: 'جزء ' + last5_juz_name[i], checked: false });
        }
        parts[49].checked = true; // Juz2 Amma
        set({ parts, lastSeed: Math.floor(Math.random() * (QuranWords - 1)) });
      },
      addCorrect: (partIndex: number, level: number, score = 0) => {
        set(state => {
          const parts = [...state.parts];
          if (partIndex >= 0 && partIndex < parts.length && level > 0) {
            if (level > 0) {
              parts[partIndex].numCorrect[level] += 1;
              parts[partIndex].numQuestions[level] += 1;
            }
          }
          return { parts } as any;
        });
      },
      addIncorrect: (partIndex: number, level: number) => {
        set(state => {
          const parts = [...state.parts];
          if (partIndex >= 0 && partIndex < parts.length && level > 0) {
            parts[partIndex].numQuestions[level] += 1;
          }
          return { parts } as any;
        });
      },
      getTotalStudyLength: () => {
        const parts = get().parts || [];
        return parts.reduce((acc, p) => acc + (p.checked ? p.length : 0), 0);
      },
      toCloudProfile: () => {
        const state = get();
        return {
          uid: state.uid,
          name: state.name,
          lastSeed: state.lastSeed,
          level: state.level,
          specialEnabled: state.specialEnabled,
          parts: state.parts,
        };
      },
      applyCloudProfile: (profile: Partial<CloudProfile>) => {
        set(state => {
          const next = { ...state } as any;
          if (profile.name !== undefined) next.name = profile.name;
          if (profile.lastSeed !== undefined) next.lastSeed = profile.lastSeed;
          if (profile.level !== undefined) next.level = profile.level;
          if (profile.specialEnabled !== undefined) next.specialEnabled = profile.specialEnabled;
          if (profile.parts !== undefined && Array.isArray(profile.parts) && profile.parts.length > 0) {
            next.parts = profile.parts;
          }
          return next as any;
        });
      },
      setName: (name: string) => set({ name }),
      getSparsePoint: (CntTot: number) => {
        const parts = get().parts || [];
        let Length = 0;
        for (let i = 0; i < parts.length; i++) {
          const pLength = parts[i].checked ? parts[i].length : 0;
          if (CntTot < Length + pLength) {
            return { idx: parts[i].start + CntTot - Length, part: i };
          } else {
            Length += pLength;
          }
        }
        // fallback
        const last = parts[parts.length - 1];
        return { idx: last ? last.start : 1, part: parts.length - 1 };
      },
    }),
    {
      name: 'qq-profile',
      storage: {
        getItem: (name: string) => AsyncStorage.getItem(name) as Promise<string | null>,
        setItem: (name: string, value: string) => AsyncStorage.setItem(name, value),
        removeItem: (name: string) => AsyncStorage.removeItem(name),
      } as any,
    }
  )
);
