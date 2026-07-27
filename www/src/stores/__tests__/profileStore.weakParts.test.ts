// getWeakCheckedParts drives the quiz chooser: only enabled (checked) parts,
// ordered worst-quality first, capped to `limit`. Index 0 is always Al-Fatiha
// (see makeDefaultParts) and is excluded — too short for a good review quiz.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { useProfileStore, StudyPart } from '../profileStore';

function part(
  name: string,
  checked: boolean,
  correct: number,
  questions: number,
): StudyPart {
  return {
    start: 1,
    length: 10,
    // put all activity on level 1; getCorrectRatio sums levels 1..3
    numCorrect: [0, correct, 0, 0],
    numQuestions: [0, questions, 0, 0],
    name,
    checked,
  };
}

describe('getWeakCheckedParts', () => {
  beforeEach(() => {
    useProfileStore.setState({
      parts: [
        part('الفاتحة', true, 0, 0), // index 0 = Al-Fatiha, always excluded
        part('A', true, 9, 10),   // ratio 0.9  (checked, strong)
        part('B', false, 1, 10),  // ratio 0.1  (UNchecked → excluded)
        part('C', true, 2, 10),   // ratio 0.2  (checked, weak)
        part('D', true, 0, 0),    // ratio 0    (checked, unattempted)
        part('E', true, 5, 10),   // ratio 0.5  (checked, mid)
      ],
    });
  });

  it('returns only checked parts, ordered worst-quality first', () => {
    const result = useProfileStore.getState().getWeakCheckedParts(5);
    expect(result.map((r) => r.name)).toEqual(['D', 'C', 'E', 'A']);
    // 'B' is unchecked and must never appear
    expect(result.find((r) => r.name === 'B')).toBeUndefined();
  });

  it('caps the result to the requested limit (chooser shows 3)', () => {
    const result = useProfileStore.getState().getWeakCheckedParts(3);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.name)).toEqual(['D', 'C', 'E']);
  });

  it('returns the part index so the chooser can start the right sura', () => {
    const result = useProfileStore.getState().getWeakCheckedParts(3);
    // D is index 4, C is index 3, E is index 5 in the parts array above
    expect(result.map((r) => r.index)).toEqual([4, 3, 5]);
  });

  it('excludes index 0 (Al-Fatiha) even though it is checked and unattempted', () => {
    const result = useProfileStore.getState().getWeakCheckedParts(5);
    expect(result.find((r) => r.index === 0)).toBeUndefined();
  });

  it('returns an empty list when no parts are checked', () => {
    useProfileStore.setState({
      parts: [part('X', false, 1, 10), part('Y', false, 2, 10)],
    });
    expect(useProfileStore.getState().getWeakCheckedParts(3)).toEqual([]);
  });
});
