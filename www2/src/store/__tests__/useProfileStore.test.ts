import { useProfileStore } from '../useProfileStore';

// Note: In a real environment, we'd mock @react-native-async-storage/async-storage
// For basic logic testing, we can check the store actions.

describe('Profile Store', () => {
  test('initial state', () => {
    const state = useProfileStore.getState();
    expect(state.parts.length).toBe(50);
    expect(state.parts.every(p => p === 0)).toBe(true);
    expect(state.settings.showAyaMarks).toBe(true);
  });

  test('addCorrect increments part score', () => {
    const { addCorrect } = useProfileStore.getState();
    addCorrect(5);
    const state = useProfileStore.getState();
    expect(state.parts[5]).toBe(1);
  });

  test('setSetting updates setting', () => {
    const { setSetting } = useProfileStore.getState();
    setSetting('showAyaMarks', false);
    const state = useProfileStore.getState();
    expect(state.settings.showAyaMarks).toBe(false);
  });
});
