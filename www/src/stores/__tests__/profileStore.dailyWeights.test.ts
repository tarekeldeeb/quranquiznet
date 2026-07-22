// Regression test for the "onboarding selections ignored on first daily quiz"
// bug: getDailyQuizStudyPartsWeights() used to require a checked part to
// already have prior attempt history (countedScore(numQuestions) !== 0)
// before granting it any daily-quiz weight. On a brand-new profile every part
// starts at numQuestions [0,0,0,0,0], so *every* checked part — including one
// just picked in onboarding — computed to zero weight, the total collapsed to
// 0, and the "no eligible parts" fallback silently locked all 10 daily
// questions to the last juz (Juz 'Amma), ignoring the user's actual
// selections. Eligibility must depend only on `checked`, matching the normal
// quiz path (getSparsePoint).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { useProfileStore } from '../profileStore';
import { DAILYQUIZ_PARTS_COUNT, DAILYQUIZ_QPERPART_COUNT } from '../../models/constants';

describe('getDailyQuizStudyPartsWeights', () => {
  beforeEach(async () => {
    // Fresh default profile: Al-Fatiha + Juz 'Amma checked, nothing attempted yet.
    await useProfileStore.getState().reset();
  });

  it('grants weight to a freshly-checked part with zero attempt history', () => {
    // Simulate onboarding: guest additionally selects Al-Baqara (parts[1]).
    const parts = useProfileStore.getState().parts
      .map((p, i) => (i === 1 ? { ...p, checked: true } : p));
    useProfileStore.setState({ parts });

    const weights = useProfileStore.getState().getDailyQuizStudyPartsWeights();

    expect(weights).toHaveLength(DAILYQUIZ_PARTS_COUNT);
    expect(weights.reduce((a, b) => a + b, 0)).toBe(DAILYQUIZ_QPERPART_COUNT);
    expect(weights[1]).toBeGreaterThan(0);
  });

  it('does not collapse to the last-juz-only fallback while a part is checked', () => {
    const parts = useProfileStore.getState().parts
      .map((p, i) => (i === 1 ? { ...p, checked: true } : p));
    useProfileStore.setState({ parts });

    const weights = useProfileStore.getState().getDailyQuizStudyPartsWeights();
    // Fallback would put all 10 on the last index and 0 everywhere else checked.
    const isFallback = weights[DAILYQUIZ_PARTS_COUNT - 1] === DAILYQUIZ_QPERPART_COUNT
      && weights[1] === 0;
    expect(isFallback).toBe(false);
  });
});
