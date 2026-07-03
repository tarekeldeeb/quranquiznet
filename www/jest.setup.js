// Global Jest setup (registered via the "setupFiles" jest config entry).

// AsyncStorage's native module isn't available in the Jest environment, so any
// module that imports it (firebase.ts auth persistence, the Zustand profile
// store) would throw at load time. Use the official in-memory mock the package
// ships for tests.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
