// Daily-quiz score (getDailyQuizScore) — the NEW-A formula:
//   score = 10*correct − speedPenalty − coveragePenalty,  clamp[0,100]
//   speedPenalty   = 5 * clamp((time − MINTIME)/(MAXTIME − MINTIME), 0, 1)
//   coveragePenalty = 5 * (1 − studyLength/QURAN_WORDS)
// with MINTIME=10s, MAXTIME=570s. These tests lock the two bug fixes over the
// old formula: (1) a sub-MINTIME run can't earn a bonus (penalty floored at 0),
// and (2) fast perfect full-coverage runs no longer all collapse/tie at 100.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { useProfileStore, StudyPart } from '../profileStore';
import { QURAN_WORDS } from '../../models/constants';

// One checked study part of a given word-length drives getTotalStudyLength().
function setCoverage(length: number) {
  const part: StudyPart = {
    start: 1, length,
    numCorrect: [0, 0, 0, 0], numQuestions: [0, 0, 0, 0],
    name: 'p', checked: true,
  };
  useProfileStore.setState({ parts: [part] });
}

const dailyScore = (correct: number, time: number) =>
  useProfileStore.getState().getDailyQuizScore(correct, time);

describe('getDailyQuizScore — NEW-A', () => {
  it('perfect, full coverage, fast run scores just under the cap', () => {
    setCoverage(QURAN_WORDS);              // coveragePenalty = 0
    expect(dailyScore(10, 30)).toBe(99.82); // 100 − 5*(20/560)
  });

  it('bug fix: a sub-MINTIME run earns no bonus (penalty floored at 0)', () => {
    setCoverage(QURAN_WORDS);
    // Both at/under MINTIME ⇒ identical, and never above the 100 base.
    expect(dailyScore(10, 0)).toBe(100);
    expect(dailyScore(10, 5)).toBe(100);
    expect(dailyScore(10, 5)).toBeLessThanOrEqual(100);
  });

  it('bug fix: fast perfect full-coverage runs no longer tie at 100', () => {
    setCoverage(QURAN_WORDS);
    const at30 = dailyScore(10, 30);
    const at60 = dailyScore(10, 60);
    expect(at30).not.toBe(at60);
    expect(at30).toBeGreaterThan(at60); // faster ⇒ strictly higher
    expect(at60).toBe(99.55);           // 100 − 5*(50/560)
  });

  it('an over-MAXTIME run subtracts no more than the full 5-pt speed penalty', () => {
    setCoverage(QURAN_WORDS);
    expect(dailyScore(10, 700)).toBe(95); // capped at speedFactor=1
    expect(dailyScore(10, 570)).toBe(95);
  });

  it('coverage penalty drops the score for a single small part', () => {
    setCoverage(779);                      // ≈1% of the Quran
    // 100 − 5*(20/560) − 5*(1 − 779/77878)
    expect(dailyScore(10, 30)).toBe(94.87);
  });

  it('never returns below 0', () => {
    setCoverage(779);
    expect(dailyScore(0, 700)).toBe(0);
    expect(dailyScore(0, 700)).toBeGreaterThanOrEqual(0);
  });
});
