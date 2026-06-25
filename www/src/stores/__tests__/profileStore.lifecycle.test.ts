// Lifecycle across states: daily-completion stamping, logout/delete clearing
// (and rendering safely on the resulting empty parts), and syncing a remote
// profile back down on login.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { useProfileStore, StudyPart, CORRECT_RATIO_RANGE } from '../profileStore';

const store = () => useProfileStore.getState();
const today = () => new Date().toISOString().split('T')[0];

function part(name: string, checked = true): StudyPart {
  return {
    start: 1, length: 10,
    numCorrect: [0, 0, 0, 0], numQuestions: [0, 0, 0, 0],
    name, checked,
  };
}

describe('daily completion gating', () => {
  it('markDailyCompleted stamps today (YYYY-MM-DD)', () => {
    useProfileStore.setState({ lastDailyCompletedDate: '' });
    store().markDailyCompleted();
    expect(store().lastDailyCompletedDate).toBe(today());
  });
});

describe('logout / delete', () => {
  it('clears parts, scores and social', async () => {
    useProfileStore.setState({
      parts: [part('A')],
      scores: [{ date: Date.now(), score: 99 }],
      social: { uid: 'u1', displayName: 'Tester', isAnonymous: false },
    });
    await store().delete();
    expect(store().parts).toEqual([]);
    expect(store().social).toEqual({});
    expect(store().loaded).toBe(false);
  });

  it('renders safely with empty parts (no crash mid-logout)', async () => {
    await store().delete(); // parts === []
    expect(store().getScore()).toBe(0);
    // getTopBadParts iterates 50 fixed indices over an empty array — must not throw
    expect(() => store().getTopBadParts()).not.toThrow();
    expect(store().getTopBadParts().every((n) => n === '-')).toBe(true);
    expect(store().getCorrectRatioRange(0)).toBe(CORRECT_RATIO_RANGE.EMPTY);
  });
});

describe('syncTo: restore a remote profile on login', () => {
  it('overwrites local with newer remote data (first sync)', async () => {
    useProfileStore.setState({
      uid: 'u1', lastSync: 0, lastUpdate: 0,
      level: 0, scores: [{ date: 1, score: 0 }], parts: [part('local')],
    });
    await store().syncTo({
      uid: 'u1',
      lastUpdate: 1_000_000,
      level: 2,
      scores: [{ date: 2, score: 250 }],
      parts: [part('remote-1'), part('remote-2')],
    });
    expect(store().level).toBe(2);
    expect(store().scores[store().scores.length - 1].score).toBe(250);
    expect(store().parts).toHaveLength(2);
  });

  it('ignores a remote profile belonging to a different uid', async () => {
    useProfileStore.setState({ uid: 'u1', level: 1, lastSync: 0 });
    await store().syncTo({ uid: 'OTHER', level: 2, lastUpdate: 9_999_999 });
    expect(store().level).toBe(1); // unchanged
  });

  it('does not overwrite newer local data with an older remote copy', async () => {
    useProfileStore.setState({
      uid: 'u1', lastSync: 123, lastUpdate: 5_000_000, level: 1,
    });
    await store().syncTo({ uid: 'u1', lastUpdate: 1_000_000, level: 2 });
    expect(store().level).toBe(1); // local is newer ⇒ kept
  });
});
