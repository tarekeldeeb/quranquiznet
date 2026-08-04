import {
  decideFocusAction, isAnswerable, shouldSuspendNormalRun, FocusInput,
  buildFocusInput, decideFocusFromContext, FocusContext,
  shouldRestoreNormalRunAfterDaily, shouldShowSummary, SUMMARY_EVERY,
  decideSessionComplete, SessionCompleteInput,
} from '../quizFlow';
import { makeEmptyQO, QuestionObject } from '../questionnaire';

const base: FocusInput = {
  pendingDailyStart: false,
  freshDeepLink: false,
  forceChooser: false,
  sessionActive: false,
  answerable: false,
  activeCardAnswered: false,
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

  it('resumes a live, answerable session with an unanswered card', () => {
    expect(decideFocusAction({ ...base, sessionActive: true, answerable: true })).toBe('resume');
  });

  // The reported bug: returning to /quiz with an "active" session but no
  // answerable question must recover, not resume into a dead screen.
  it('recovers a stranded active session with nothing answerable', () => {
    expect(decideFocusAction({ ...base, sessionActive: true, answerable: false })).toBe('recover');
  });

  // Repro: answer a card (it flips), navigate to /league, then back to /quiz.
  // The engine still reads "answerable", but the visible card is already
  // answered with no successor → must recover, not resume into a flipped card.
  it('recovers when the active card is already answered (flipped)', () => {
    expect(decideFocusAction({
      ...base, sessionActive: true, answerable: true, activeCardAnswered: true,
    })).toBe('recover');
  });

  // Repro: practice a single sura (active session), go back to /me, tap "ابدأ
  // اختباراً الآن". That must open the chooser, not resume the single-sura run.
  it('opens the chooser on an explicit start request even with an active session', () => {
    expect(decideFocusAction({
      ...base, forceChooser: true, sessionActive: true, answerable: true,
    })).toBe('chooser');
  });

  it('a queued daily or fresh deep-link still wins over a chooser request', () => {
    expect(decideFocusAction({ ...base, forceChooser: true, pendingDailyStart: true })).toBe('start-daily');
    expect(decideFocusAction({ ...base, forceChooser: true, freshDeepLink: true })).toBe('start-part');
  });

  it('offers the chooser when nothing is in progress', () => {
    expect(decideFocusAction(base)).toBe('chooser');
    // not active ⇒ chooser regardless of a stale answerable flag
    expect(decideFocusAction({ ...base, sessionActive: false, answerable: true })).toBe('chooser');
  });
});

// ── Raw signals → FocusInput → action, mirroring the quiz screen on focus.
// These model real navigation transitions between states.
const ctx = (over: Partial<FocusContext> = {}): FocusContext => ({
  pendingDailyStart: false,
  customPartParam: undefined,
  nonceParam: undefined,
  lastActedNonce: undefined,
  sessionActive: false,
  hasActiveCard: false,
  engineAnswerable: false,
  activeCardFlipTrigger: 0,
  ...over,
});

describe('buildFocusInput', () => {
  it('marks a deep-link fresh only when the nonce is unseen', () => {
    expect(buildFocusInput(ctx({ customPartParam: '3', nonceParam: 'n1' })).freshDeepLink).toBe(true);
    // same nonce already acted on ⇒ not fresh
    expect(buildFocusInput(ctx({ customPartParam: '3', nonceParam: 'n1', lastActedNonce: 'n1' })).freshDeepLink).toBe(false);
    // customPart without a nonce ⇒ not a fresh deep-link
    expect(buildFocusInput(ctx({ customPartParam: '3' })).freshDeepLink).toBe(false);
  });

  it('is answerable only when a card exists AND the engine holds a question', () => {
    expect(buildFocusInput(ctx({ hasActiveCard: true, engineAnswerable: true })).answerable).toBe(true);
    expect(buildFocusInput(ctx({ hasActiveCard: false, engineAnswerable: true })).answerable).toBe(false);
    expect(buildFocusInput(ctx({ hasActiveCard: true, engineAnswerable: false })).answerable).toBe(false);
  });

  it('treats a flipped card (flipTrigger > 0) as answered', () => {
    expect(buildFocusInput(ctx({ activeCardFlipTrigger: 0 })).activeCardAnswered).toBe(false);
    expect(buildFocusInput(ctx({ activeCardFlipTrigger: 1 })).activeCardAnswered).toBe(true);
    expect(buildFocusInput(ctx({ activeCardFlipTrigger: 3 })).activeCardAnswered).toBe(true);
  });

  it('flags forceChooser only for a chooser request with an unseen nonce', () => {
    expect(buildFocusInput(ctx({ chooserParam: '1', nonceParam: 'n1' })).forceChooser).toBe(true);
    expect(buildFocusInput(ctx({ chooserParam: '1', nonceParam: 'n1', lastActedNonce: 'n1' })).forceChooser).toBe(false);
    expect(buildFocusInput(ctx({ chooserParam: '1' })).forceChooser).toBe(false); // no nonce
  });
});

describe('decideFocusFromContext — state-to-state transitions', () => {
  it('Me → Quiz (no live run) ⇒ chooser', () => {
    expect(decideFocusFromContext(ctx())).toBe('chooser');
  });

  it('Me → Quiz via daily start ⇒ start-daily', () => {
    expect(decideFocusFromContext(ctx({ pendingDailyStart: true }))).toBe('start-daily');
  });

  it('Me → Quiz via weak-sura/part deep link ⇒ start-part', () => {
    expect(decideFocusFromContext(ctx({ customPartParam: '7', nonceParam: 'n9' }))).toBe('start-part');
  });

  it('Quiz active → League → back ⇒ resume (cards kept)', () => {
    expect(decideFocusFromContext(ctx({
      sessionActive: true, hasActiveCard: true, engineAnswerable: true, activeCardFlipTrigger: 0,
    }))).toBe('resume');
  });

  it('Quiz answered → League → back ⇒ recover (the reported stall)', () => {
    expect(decideFocusFromContext(ctx({
      sessionActive: true, hasActiveCard: true, engineAnswerable: true, activeCardFlipTrigger: 1,
    }))).toBe('recover');
  });

  it('Quiz active but engine lost the question ⇒ recover', () => {
    expect(decideFocusFromContext(ctx({
      sessionActive: true, hasActiveCard: true, engineAnswerable: false,
    }))).toBe('recover');
  });

  it('daily start wins over a resumable session and a deep link', () => {
    expect(decideFocusFromContext(ctx({
      pendingDailyStart: true, sessionActive: true, hasActiveCard: true, engineAnswerable: true,
      customPartParam: '2', nonceParam: 'n',
    }))).toBe('start-daily');
  });

  it('a re-seen deep-link nonce does not restart; falls through to session/chooser', () => {
    // same nonce already acted on, no live run ⇒ chooser (not start-part)
    expect(decideFocusFromContext(ctx({ customPartParam: '2', nonceParam: 'n', lastActedNonce: 'n' }))).toBe('chooser');
    // same nonce, but a live answerable run ⇒ resume
    expect(decideFocusFromContext(ctx({
      customPartParam: '2', nonceParam: 'n', lastActedNonce: 'n',
      sessionActive: true, hasActiveCard: true, engineAnswerable: true,
    }))).toBe('resume');
  });
});

describe('shouldShowSummary — normal-mode every-Nth-correct', () => {
  it('does not fire in daily mode', () => {
    expect(shouldShowSummary(SUMMARY_EVERY, true)).toBe(false);
    expect(shouldShowSummary(SUMMARY_EVERY * 2, true)).toBe(false);
  });

  it('fires exactly on multiples of SUMMARY_EVERY in normal mode', () => {
    expect(shouldShowSummary(SUMMARY_EVERY, false)).toBe(true);
    expect(shouldShowSummary(SUMMARY_EVERY * 3, false)).toBe(true);
  });

  it('does not fire between multiples or at zero', () => {
    expect(shouldShowSummary(0, false)).toBe(false);
    expect(shouldShowSummary(SUMMARY_EVERY - 1, false)).toBe(false);
    expect(shouldShowSummary(SUMMARY_EVERY + 1, false)).toBe(false);
  });
});

describe('shouldRestoreNormalRunAfterDaily', () => {
  it('restores only when a normal run was suspended', () => {
    expect(shouldRestoreNormalRunAfterDaily(true)).toBe(true);
    expect(shouldRestoreNormalRunAfterDaily(false)).toBe(false);
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

// Regression: `quiz_session_complete` used to fire only on an explicit in-app
// exit, so a user who just closed the tab/app mid-quiz was never counted as
// having completed a session at all — the GA4 funnel read as near-total
// abandonment. A non-final ("beacon") call on backgrounding/tab-hide fixes
// this without double-counting a session interrupted by one or more of them.
describe('decideSessionComplete', () => {
  const base: SessionCompleteInput = {
    sessionActive: true,
    isDaily: false,
    final: true,
    answered: 0,
    correct: 0,
    flushedAnswered: 0,
    flushedCorrect: 0,
  };

  it('does nothing when there is no active session', () => {
    expect(decideSessionComplete({ ...base, sessionActive: false, answered: 5, correct: 3 }))
      .toEqual({ fire: false, endSession: false, answeredDelta: 0, correctDelta: 0 });
  });

  it('a final exit with progress fires and ends the session', () => {
    expect(decideSessionComplete({ ...base, final: true, answered: 5, correct: 3 }))
      .toEqual({ fire: true, endSession: true, answeredDelta: 5, correctDelta: 3 });
  });

  it('a final exit with nothing answered ends the session but does not fire', () => {
    expect(decideSessionComplete({ ...base, final: true, answered: 0, correct: 0 }))
      .toEqual({ fire: false, endSession: true, answeredDelta: 0, correctDelta: 0 });
  });

  it('a background/tab-hide beacon (non-final) fires without ending the session', () => {
    expect(decideSessionComplete({ ...base, final: false, answered: 2, correct: 1 }))
      .toEqual({ fire: true, endSession: false, answeredDelta: 2, correctDelta: 1 });
  });

  it('a beacon with nothing new since the last one is a silent no-op', () => {
    expect(decideSessionComplete({ ...base, final: false, answered: 0, correct: 0 }))
      .toEqual({ fire: false, endSession: false, answeredDelta: 0, correctDelta: 0 });
  });

  it('a later beacon/exit reports only the delta since the last beacon, not the running total', () => {
    // e.g. answered 5 total, a prior beacon already reported the first 3
    expect(decideSessionComplete({
      ...base, final: false, answered: 5, correct: 4, flushedAnswered: 3, flushedCorrect: 2,
    })).toEqual({ fire: true, endSession: false, answeredDelta: 2, correctDelta: 2 });

    expect(decideSessionComplete({
      ...base, final: true, answered: 5, correct: 4, flushedAnswered: 3, flushedCorrect: 2,
    })).toEqual({ fire: true, endSession: true, answeredDelta: 2, correctDelta: 2 });
  });

  it('a final exit right after a beacon flushed everything ends the session without an empty re-fire', () => {
    expect(decideSessionComplete({
      ...base, final: true, answered: 5, correct: 4, flushedAnswered: 5, flushedCorrect: 4,
    })).toEqual({ fire: false, endSession: true, answeredDelta: 0, correctDelta: 0 });
  });

  it('daily mode always fires on a final exit, even with nothing newly answered (absolute score, not a delta)', () => {
    expect(decideSessionComplete({ ...base, isDaily: true, final: true, answered: 0, correct: 0 }))
      .toEqual({ fire: true, endSession: true, answeredDelta: 0, correctDelta: 0 });
  });

  it('daily mode ignores the flushed baseline (a background beacon never fires for daily by construction, but the pure function stays consistent if called)', () => {
    expect(decideSessionComplete({
      ...base, isDaily: true, final: true, answered: 10, correct: 8, flushedAnswered: 10, flushedCorrect: 8,
    })).toEqual({ fire: true, endSession: true, answeredDelta: 0, correctDelta: 0 });
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
