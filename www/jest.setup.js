// Global Jest setup (registered via the "setupFiles" jest config entry).

// AsyncStorage's native module isn't available in the Jest environment, so any
// module that imports it (firebase.ts auth persistence, the Zustand profile
// store) would throw at load time. Use the official in-memory mock the package
// ships for tests.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// react-native-webview's native module isn't available in the Jest environment
// either (QuranText.native.tsx uses it to render the Quran text) — the package
// ships no official jest mock, so stand in a bare View (extra props like
// `source`/`onMessage` are simply ignored, same as any other unknown prop).
jest.mock('react-native-webview', () => {
  const { View } = require('react-native');
  return { WebView: View };
});

// expo-audio's native module isn't available in the Jest environment either
// (sound.ts uses createAudioPlayer/seekTo/play for answer-feedback chimes) —
// stub just the AudioPlayer API surface actually used, pre-loaded so
// ensureLoaded() resolves without waiting on a playbackStatusUpdate event.
jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({
    isLoaded: true,
    seekTo: jest.fn().mockResolvedValue(undefined),
    play: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  })),
}));

// expo-localization's native module isn't available in the Jest environment
// either (src/i18n/index.ts and profileStore.ts's load() use getLocales() to
// guess the initial UI language from the device locale) — mock a fixed Arabic
// locale so language-dependent screens render deterministically, matching
// every other test in this suite that was written assuming Arabic (the app's
// only language before the EN/AR rollout) rather than whatever locale the
// host machine/CI runner happens to report.
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'ar', languageTag: 'ar-SA', textDirection: 'rtl' }],
}));
