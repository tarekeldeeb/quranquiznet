// ?lang=ar|en on a web URL (shared/campaign links) must override both the
// persisted preference and the device locale, and stick like an explicit
// in-app choice — see getUrlLang() in profileStore.ts. jest-expo defaults
// Platform.OS to 'ios' (see Analytics.test.tsx), so these tests force 'web'
// to exercise that path.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

// expo-localization mocked ar-SA globally in jest.setup.js — a Chinese device
// locale here would prove the URL param wins over it, but jest.setup.js's
// mock is fixed, so these tests only need to prove it wins over the
// *persisted* value, which is enough to cover the override branch.

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProfileStore } from '../profileStore';

const store = () => useProfileStore.getState();

describe('load(): ?lang= URL override (web only)', () => {
  const originalOS = Platform.OS;
  let originalWindow: unknown;

  beforeEach(() => {
    Platform.OS = 'web';
    originalWindow = (global as { window?: unknown }).window;
  });

  afterEach(async () => {
    Platform.OS = originalOS;
    (global as { window?: unknown }).window = originalWindow;
    await AsyncStorage.clear();
  });

  it('overrides an already-persisted language preference', async () => {
    await AsyncStorage.setItem('prf_language', JSON.stringify('en'));
    (global as { window?: unknown }).window = { location: { search: '?lang=ar' } };

    await store().load();

    expect(store().language).toBe('ar');
    expect(JSON.parse((await AsyncStorage.getItem('prf_language'))!)).toBe('ar');
  });

  it('persists the override so it survives a later load with no param', async () => {
    (global as { window?: unknown }).window = { location: { search: '?lang=ar' } };
    await store().load();

    (global as { window?: unknown }).window = { location: { search: '' } };
    await store().load();

    expect(store().language).toBe('ar');
  });

  it('ignores an unrecognized lang value and falls back to the stored preference', async () => {
    await AsyncStorage.setItem('prf_language', JSON.stringify('en'));
    (global as { window?: unknown }).window = { location: { search: '?lang=fr' } };

    await store().load();

    expect(store().language).toBe('en');
  });
});
