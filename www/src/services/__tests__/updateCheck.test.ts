jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
// Pins the "installed" version useUpdateAvailable compares against.
jest.mock('expo-constants', () => ({ expoConfig: { version: '2.4.1' } }));

import { renderHook, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isNewerVersion, fetchLatestVersions, useUpdateAvailable, forceUpdateBanner } from '../updateCheck';

// setTimeout (a macrotask) runs after every pending microtask, so awaiting
// one reliably drains the fetch -> json -> isNewerVersion chain inside
// useUpdateAvailable's effect. A single `await Promise.resolve()` is not
// enough hops and would let a "no update" assertion pass against the
// pre-effect initial null state even if the comparison logic were broken.
const flushEffects = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

function mockRemote(ios: string, android: string) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ ios, android }),
  }) as unknown as typeof fetch;
}

describe('isNewerVersion', () => {
  it('detects a newer patch/minor/major segment', () => {
    expect(isNewerVersion('2.4.2', '2.4.1')).toBe(true);
    expect(isNewerVersion('2.5.0', '2.4.9')).toBe(true);
    expect(isNewerVersion('3.0.0', '2.9.9')).toBe(true);
  });

  it('compares numerically, not lexically (2.10.0 > 2.9.0)', () => {
    expect(isNewerVersion('2.10.0', '2.9.0')).toBe(true);
  });

  it('returns false for equal or older versions', () => {
    expect(isNewerVersion('2.4.1', '2.4.1')).toBe(false);
    expect(isNewerVersion('2.4.0', '2.4.1')).toBe(false);
  });

  it('treats missing segments as zero', () => {
    expect(isNewerVersion('2.5', '2.4.9')).toBe(true);
    expect(isNewerVersion('2.4', '2.4.0')).toBe(false);
  });
});

describe('fetchLatestVersions', () => {
  it('returns the parsed ios/android versions on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ios: '2.4.1', android: '2.4.0' }),
    }) as unknown as typeof fetch;
    await expect(fetchLatestVersions()).resolves.toEqual({ ios: '2.4.1', android: '2.4.0' });
  });

  it('returns null on a non-ok response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
    await expect(fetchLatestVersions()).resolves.toBeNull();
  });

  it('returns null on malformed JSON shape', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ios: '2.4.1' }),
    }) as unknown as typeof fetch;
    await expect(fetchLatestVersions()).resolves.toBeNull();
  });

  it('returns null instead of throwing when the network fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    await expect(fetchLatestVersions()).resolves.toBeNull();
  });
});

describe('useUpdateAvailable', () => {
  // jest-expo runs with Platform.OS === 'ios' (see notifications.taps.test.ts),
  // and expo-constants is mocked above to report the installed version as 2.4.1.
  it('does not surface an update when version.json reports an older version', async () => {
    mockRemote('2.3.0', '2.3.0');
    const { result } = renderHook(() => useUpdateAvailable());
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    await flushEffects();
    expect(result.current.update).toBeNull();
  });

  it('does not surface an update when version.json reports the same version', async () => {
    mockRemote('2.4.1', '2.4.1');
    const { result } = renderHook(() => useUpdateAvailable());
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    await flushEffects();
    expect(result.current.update).toBeNull();
  });

  it('surfaces an update with the store link when version.json reports a newer version', async () => {
    mockRemote('2.5.0', '2.5.0');
    const { result } = renderHook(() => useUpdateAvailable());
    await waitFor(() => expect(result.current.update).not.toBeNull());
    expect(result.current.update).toEqual({
      version: '2.5.0',
      storeUrl: 'https://apps.apple.com/app/id6790435986',
    });
  });
});

describe('forceUpdateBanner (console debug command)', () => {
  // devForcedUpdate is module-level state shared across every test in this
  // file — clear it after each test so a forced override never leaks into
  // an unrelated test (e.g. one of the "no update" cases above). Wrapped in
  // act() because this runs before RTL's own auto-cleanup unmounts the
  // previous test's renderHook instance (inner afterEach hooks run before
  // outer ones), so it's still updating a mounted component's state.
  afterEach(() => act(() => forceUpdateBanner(null)));

  it('is installed on globalThis under __DEV__, matching the console-command name', () => {
    expect((globalThis as unknown as { forceUpdateBanner: unknown }).forceUpdateBanner).toBe(forceUpdateBanner);
  });

  it('makes every mounted useUpdateAvailable() report the forced update immediately', () => {
    mockRemote('2.4.1', '2.4.1'); // real check would report no update
    const { result } = renderHook(() => useUpdateAvailable());
    expect(result.current.update).toBeNull();

    act(() => forceUpdateBanner('9.9.9'));

    expect(result.current.update).toEqual({
      version: '9.9.9',
      storeUrl: 'https://apps.apple.com/app/id6790435986',
    });
  });

  it('defaults to a 9.9.9 placeholder version when called with no arguments', () => {
    const { result } = renderHook(() => useUpdateAvailable());
    act(() => forceUpdateBanner());
    expect(result.current.update?.version).toBe('9.9.9');
  });

  it('dismiss() clears a forced override without touching the real dismissal storage key', async () => {
    const { result } = renderHook(() => useUpdateAvailable());
    act(() => forceUpdateBanner('9.9.9'));
    expect(result.current.update).not.toBeNull();

    act(() => result.current.dismiss());

    expect(result.current.update).toBeNull();
    await expect(AsyncStorage.getItem('qqn_dismissed_update_version')).resolves.toBeNull();
  });

  it('forceUpdateBanner(null) clears the override and falls back to the real check', async () => {
    mockRemote('2.5.0', '2.5.0'); // real check: newer version genuinely available
    const { result } = renderHook(() => useUpdateAvailable());
    act(() => forceUpdateBanner('9.9.9'));
    expect(result.current.update?.version).toBe('9.9.9');

    act(() => forceUpdateBanner(null));
    // Falls straight back to whatever the real effect already resolved.
    await waitFor(() => expect(result.current.update?.version).toBe('2.5.0'));
  });
});
