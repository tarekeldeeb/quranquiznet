import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useProfileStore = create()(
  persist(
    (set) => ({
      parts: Array(50).fill(0),
      scores: {},
      settings: {
        showAyaMarks: true,
        vibrate: true,
      },
      addCorrect: (partIdx: number) => set((state: any) => {
        const newParts = [...state.parts];
        newParts[partIdx] += 1;
        return { parts: newParts };
      }),
      setSetting: (key: string, value: any) => set((state: any) => ({
        settings: { ...state.settings, [key]: value }
      })),
    }),
    {
      name: 'profile-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
