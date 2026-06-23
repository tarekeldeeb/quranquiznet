import {
  decideFocusAction, isAnswerable, shouldSuspendNormalRun, FocusInput,
} from '../quizFlow';
import { makeEmptyQO, QuestionObject } from '../questionnaire';

const base: FocusInput = {
  pendingDailyStart: false,
  freshDeepLink: false,
  sessionActive: false,
  answerable: false,
};

describe('decideFocusAction', () => {
  it('starts the daily quiz when one is queued (highest priority)', () => {
    expect(decideFocusAction({ ...base, pendingDailyStart: true })).toBe('start-daily');
    // queued daily wins even over an active answerable session
    expect(decideFocusAction({
      ...base, pendingDailyStart: true, sessionActive: true, answerable: true,
    })).toBe('start-daily');
  });

  it('starts a specific part on a fresh deep-link', () => {
    expect(decideFocusAction({ ...base, freshDeepLink: true })).toBe('start-part');
    // deep-link wins over a resumable session but not over a queued daily
    expect(decideFocusAction({
      ...base, freshDeepLink: true, sessionActive: true, answerable: true,
    })).toBe('start-part');
    expect(decideFocusAction({
      ...base, pendingDailyStart: true, freshDeepLink: true,
    })).toBe('start-daily');
  });

  it('resumes a live, answerable session', () => {
    expect(decideFocusAction({ ...base, sessionActive: true, answerable: true })).toBe('resume');
  });

  // The reported bug: returning to /quiz with an "active" session but no
  // answerable question must recover, not resume into a dead screen.
  it('recovers a stranded active session with nothing answerable', () => {
    expect(decideFocusAction({ ...base, sessionActive: true, answerable: false })).toBe('recover');
  });

  it('offers the chooser when nothing is in progress', () => {
    expect(decideFocusAction(base)).toBe('chooser');
    // not active ⇒ chooser regardless of a stale answerable flag
    expect(decideFocusAction({ ...base, sessionActive: false, answerable: true })).toBe('chooser');
  });
});

describe('shouldSuspendNormalRun', () => {
  it('suspends a live normal run when entering the daily quiz', () => {
    expect(shouldSuspendNormalRun(true, false)).toBe(true);
  });
  it('does not suspend when already in daily mode', () => {
    expect(shouldSuspendNormalRun(true, true)).toBe(false);
  });
  it('does not suspend when there is no live run', () => {
    expect(shouldSuspendNormalRun(false, false)).toBe(false);
  });
});

describe('isAnswerable', () => {
  it('treats a freshly reset / lost question as non-answerable', () => {
    expect(isAnswerable(makeEmptyQO())).toBe(false);
  });

  it('treats a question with round-0 options as answerable', () => {
    const qo = makeEmptyQO();
    qo.txt.op[0] = ['أ', 'ب', 'ج', 'د', 'هـ'];
    expect(isAnswerable(qo)).toBe(true);
  });

  it('is robust to malformed question objects', () => {
    expect(isAnswerable({} as unknown as QuestionObject)).toBe(false);
    expect(isAnswerable({ txt: {} } as unknown as QuestionObject)).toBe(false);
    expect(isAnswerable({ txt: { op: [] } } as unknown as QuestionObject)).toBe(false);
  });
});
