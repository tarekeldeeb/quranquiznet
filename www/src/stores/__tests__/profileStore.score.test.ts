// Scoring rules: wrong answers never reduce the score (they only affect a
// part's accuracy/quality), the total never goes negative, and level weights
// are L0=+5, L1=+10, L2=+20, L3=+30 per correct answer.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { useProfileStore, StudyPart, QORef, CORRECT_RATIO_RANGE } from '../profileStore';

function part(name: string, checked = true): StudyPart {
  return {
    start: 1, length: 10,
    numCorrect: [0, 0, 0, 0], numQuestions: [0, 0, 0, 0],
    name, checked,
  };
}

function qref(over: Partial<QORef> = {}): QORef {
  return { level: 1, qType: { id: 1, score: 10 }, currentPart: 1, startIdx: 0, ...over };
}

const store = () => useProfileStore.getState();

beforeEach(() => {
  useProfileStore.setState({ parts: [part('الفاتحة'), part('البقرة')] });
});

describe('score: wrong answers never decrease it', () => {
  it('a correct answer adds points, a following wrong answer leaves the score unchanged', async () => {
    await store().addCorrect(qref({ level: 1 }));
    const afterCorrect = store().getScore();
    await store().addIncorrect(qref({ level: 1 }));
    const afterWrong = store().getScore();

    expect(afterCorrect).toBe(10);
    expect(afterWrong).toBe(10);
  });

  it('a part with only wrong answers contributes 0 (never negative)', () => {
    useProfileStore.setState({
      parts: [{ ...part('A'), numQuestions: [0, 50, 0, 0], numCorrect: [0, 0, 0, 0] }],
    });
    expect(store().getScore()).toBe(0);
    expect(store().getScore()).toBeGreaterThanOrEqual(0);
  });
});

describe('score: level weights', () => {
  it('level 0 awards a flat +5 per correct', async () => {
    await store().addCorrect(qref({ level: 0 }));
    expect(store().getScore()).toBe(5);
  });

  it('levels 1/2/3 award 10/20/30 per correct', async () => {
    await store().addCorrect(qref({ level: 1 }));
    await store().addCorrect(qref({ level: 2 }));
    await store().addCorrect(qref({ level: 3 }));
    expect(store().getScore()).toBe(60);
  });
});

describe('beginner (level 0) progress is recorded per sura', () => {
  const partCorrect = (i: number) => {
    const p = store().parts[i];
    return (p.numCorrect[1] ?? 0) + (p.numCorrect[2] ?? 0) + (p.numCorrect[3] ?? 0) + (p.numCorrect[4] ?? 0);
  };
  const partQuestions = (i: number) => {
    const p = store().parts[i];
    return (p.numQuestions[1] ?? 0) + (p.numQuestions[2] ?? 0) + (p.numQuestions[3] ?? 0) + (p.numQuestions[4] ?? 0);
  };

  it('a level-0 correct shows in the sura’s correct/total AND adds +5 to score', async () => {
    await store().addCorrect(qref({ level: 0, currentPart: 1 }));
    expect(partCorrect(1)).toBe(1);
    expect(partQuestions(1)).toBe(1);
    expect(store().getScore()).toBe(5);
  });

  it('a level-0 wrong answer counts toward the total but not the score', async () => {
    await store().addIncorrect(qref({ level: 0, currentPart: 1 }));
    expect(partCorrect(1)).toBe(0);
    expect(partQuestions(1)).toBe(1);
    expect(store().getScore()).toBe(0);
  });

  it('level-0 correct then wrong yields MID accuracy (1 of 2) for the sura', async () => {
    await store().addCorrect(qref({ level: 0, currentPart: 1 }));
    await store().addIncorrect(qref({ level: 0, currentPart: 1 }));
    expect(store().getCorrectRatioRange(1)).toBe(CORRECT_RATIO_RANGE.MID);
  });

  it('a level-0 correct makes the sura count toward the study % (كم الحفظ)', async () => {
    // A sura large enough that its words round to ≥1% of the Quran.
    useProfileStore.setState({ parts: [{ ...part('كبيرة'), length: 1600 }] });
    expect(store().getPercentTotalStudy()).toBe('0%'); // nothing answered yet
    await store().addCorrect(qref({ level: 0, currentPart: 0 }));
    expect(store().getPercentTotalStudy()).not.toBe('0%'); // now counted as studied
  });
});

describe('quality: wrong answers still count toward a part’s accuracy', () => {
  it('one correct + one wrong at level 1 yields a MID accuracy range', async () => {
    await store().addCorrect(qref({ level: 1, currentPart: 1 }));
    await store().addIncorrect(qref({ level: 1, currentPart: 1 }));
    // ratio = 1 correct / 2 questions = 0.5 ⇒ MID
    expect(store().getCorrectRatioRange(1)).toBe(CORRECT_RATIO_RANGE.MID);
  });

  it('all-correct yields a HIGH accuracy range', async () => {
    await store().addCorrect(qref({ level: 1, currentPart: 1 }));
    await store().addCorrect(qref({ level: 1, currentPart: 1 }));
    expect(store().getCorrectRatioRange(1)).toBe(CORRECT_RATIO_RANGE.HIGH);
  });
});
