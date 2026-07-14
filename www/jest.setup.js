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

// expo-av's native module isn't available in the Jest environment either
// (sound.ts uses Audio.Sound.createAsync/replayAsync for answer-feedback
// chimes) — stub just the Sound API surface actually used.
jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn().mockResolvedValue({ sound: { replayAsync: jest.fn() } }),
    },
  },
}));
