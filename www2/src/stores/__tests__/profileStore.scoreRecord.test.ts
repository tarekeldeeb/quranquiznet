// updateScoreRecord maintains the score-over-time series: one point per
// calendar day (today's point refreshed in place), bumps lastUpdate so the
// change syncs, and caps history length.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { useProfileStore, StudyPart, ScoreRecord } from '../profileStore';

const DAY = 86_400_000;
const store = () => useProfileStore.getState();

function scoredPart(correctL1: number): StudyPart {
  return {
    start: 1, length: 10,
    numCorrect: [0, correctL1, 0, 0], numQuestions: [0, correctL1, 0, 0],
    name: 'A', checked: true,
  };
}

beforeEach(() => {
  // 3 correct @L1 ⇒ getScore() === 30, deterministic for the record value.
  useProfileStore.setState({ parts: [scoredPart(3)], lastUpdate: 0 });
});

describe('updateScoreRecord', () => {
  it('appends a new point when the last record is from a previous day', () => {
    useProfileStore.setState({ scores: [{ date: Date.now() - 2 * DAY, score: 0 }] });
    store().updateScoreRecord();
    const { scores } = store();
    expect(scores).toHaveLength(2);
    expect(scores[scores.length - 1].score).toBe(30);
  });

  it("refreshes today's point in place instead of appending another", () => {
    useProfileStore.setState({ scores: [{ date: Date.now() - 2 * DAY, score: 0 }, { date: Date.now(), score: 5 }] });
    store().updateScoreRecord();
    const { scores } = store();
    expect(scores).toHaveLength(2);          // no new entry
    expect(scores[scores.length - 1].score).toBe(30); // updated to current score
  });

  it('bumps lastUpdate so the change is treated as newer (syncs up)', () => {
    useProfileStore.setState({ scores: [{ date: Date.now() - 2 * DAY, score: 0 }], lastUpdate: 0 });
    store().updateScoreRecord();
    expect(store().lastUpdate).toBeGreaterThan(0);
  });

  it('caps the history at 365 records', () => {
    const long: ScoreRecord[] = Array.from({ length: 365 }, (_, i) => ({
      date: Date.now() - (370 - i) * DAY, // all in the past, ascending
      score: i,
    }));
    useProfileStore.setState({ scores: long });
    store().updateScoreRecord(); // would make 366 → capped back to 365
    const { scores } = store();
    expect(scores).toHaveLength(365);
    expect(scores[scores.length - 1].score).toBe(30); // newest is today's point
  });
});
