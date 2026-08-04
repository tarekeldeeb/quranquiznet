// Pure decision logic for what the quiz screen should do when it gains focus.
// Extracted from the component so it can be unit-tested without rendering and
// without the questionnaire/db singletons.

import { QuestionObject } from './questionnaire';

export type FocusAction =
  | 'start-daily'   // a daily quiz was queued ⇒ start it
  | 'start-part'    // a fresh deep-link to a specific sura/juz ⇒ start it
  | 'resume'        // a live, answerable session ⇒ keep its cards
  | 'recover'       // session flagged active but nothing answerable ⇒ re-arm
  | 'chooser';      // nothing in progress ⇒ offer the start chooser

export interface FocusInput {
  pendingDailyStart: boolean;   // QS.pendingDailyStart
  freshDeepLink: boolean;       // params.customPart present with an unseen nonce
  forceChooser: boolean;        // user tapped "start a quiz" ⇒ show the chooser
  sessionActive: boolean;       // a run is flagged in progress
  answerable: boolean;          // there is a card AND the engine holds a real question
  activeCardAnswered: boolean;  // the on-screen card has already been answered (flipped)
}

// Priority order mirrors the screen's original branch order, with one addition:
// an "active" session that has nothing the user can answer must `recover`
// rather than silently `resume` into a blank, dead screen.
//
// A session can be "answerable" (engine holds a question) yet still need to
// recover: if the visible card has already been answered (flipped) and no
// successor question loaded, resuming would leave the user staring at a flipped
// card with nothing to do — e.g. answering, switching to /league, then back to
// /quiz. Such a session must `recover` (load the next question) instead.
export function decideFocusAction(i: FocusInput): FocusAction {
  if (i.pendingDailyStart) return 'start-daily';
  if (i.freshDeepLink) return 'start-part';
  // An explicit "start a quiz" request opens the chooser even if a single-sura
  // (or any) run is still active — otherwise it would silently resume that run.
  if (i.forceChooser) return 'chooser';
  if (i.sessionActive) {
    return (i.answerable && !i.activeCardAnswered) ? 'resume' : 'recover';
  }
  return 'chooser';
}

// Raw screen/session signals, before they're distilled into a FocusInput.
// Kept separate so the quiz screen can hand over primitives (params, refs,
// engine state) and the mapping itself stays pure and unit-testable.
export interface FocusContext {
  pendingDailyStart: boolean;     // QS.pendingDailyStart
  customPartParam?: string;       // params.customPart
  chooserParam?: string;          // params.chooser ("start a quiz" request)
  nonceParam?: string;            // params.nonce
  lastActedNonce?: string;        // the nonce we already acted on
  sessionActive: boolean;         // a run is flagged in progress
  hasActiveCard: boolean;         // a card is on screen
  engineAnswerable: boolean;      // isAnswerable(QS.qo)
  activeCardFlipTrigger: number;  // the active card's flipTrigger (0 = unanswered)
}

// Distil raw signals into the FocusInput consumed by decideFocusAction. A
// deep-link / chooser request is "fresh" only when it carries an unseen nonce;
// a card is "answered" once its flip has been triggered.
export function buildFocusInput(c: FocusContext): FocusInput {
  const freshNonce = !!(c.nonceParam && c.nonceParam !== c.lastActedNonce);
  return {
    pendingDailyStart: c.pendingDailyStart,
    freshDeepLink: !!(c.customPartParam && freshNonce),
    forceChooser: !!(c.chooserParam && freshNonce),
    sessionActive: c.sessionActive,
    answerable: c.hasActiveCard && c.engineAnswerable,
    activeCardAnswered: c.activeCardFlipTrigger > 0,
  };
}

// Convenience: full raw-signals → action in one call.
export function decideFocusFromContext(c: FocusContext): FocusAction {
  return decideFocusAction(buildFocusInput(c));
}

// When entering the daily quiz, a live *normal* run must be suspended (stashed
// with its own card stack) so it can reappear afterwards. A run that is already
// in daily mode, or no run at all, has nothing to suspend.
export function shouldSuspendNormalRun(sessionActive: boolean, inDailyMode: boolean): boolean {
  return sessionActive && !inDailyMode;
}

// After a daily quiz ends, a normal run that was suspended for it should be
// restored; otherwise there is nothing to bring back.
export function shouldRestoreNormalRunAfterDaily(hasSuspendedNormalRun: boolean): boolean {
  return hasSuspendedNormalRun;
}

// The post-session summary interrupts a *normal* run every Nth answered question
// (correct or incorrect). Daily mode never shows it (it has its own end screen).
export const SUMMARY_EVERY = 5;
export function shouldShowSummary(sessionAnswered: number, inDailyMode: boolean): boolean {
  return !inDailyMode && sessionAnswered > 0 && sessionAnswered % SUMMARY_EVERY === 0;
}

// A question the user can actually act on has its round-0 options populated.
// makeEmptyQO() leaves these empty, so a freshly-reset/lost engine reads as
// non-answerable.
export function isAnswerable(qo: QuestionObject): boolean {
  return Array.isArray(qo?.txt?.op?.[0]) && qo.txt.op[0].length > 0;
}

// Decides whether a `quiz_session_complete` beacon should fire, and how much
// of the running answered/correct tallies it should report.
//
// A "final" call (explicit exit: the chooser, a new session replacing this
// one, the summary sheet's Home button, or a component unmount) always ends
// the session. A non-final call is a best-effort beacon fired when the app
// backgrounds or the web tab is hidden — the only signal available when a
// session ends by the user just closing the tab/app rather than navigating
// within it — and leaves the session resumable so a user who comes back and
// keeps playing is still tracked as one run whenever they do exit for real.
//
// Reports a delta since the last beacon (not the running total) so a session
// interrupted by one or more backgroundings doesn't get double-counted across
// beacons. Daily mode carries its own absolute score (not a per-question
// delta) and always reports, even with nothing new answered, since its final
// call is the one place that score is recorded.
export interface SessionCompleteInput {
  sessionActive: boolean;
  isDaily: boolean;
  final: boolean;
  answered: number;        // sessionAnsweredRef.current
  correct: number;         // sessionCorrectRef.current
  flushedAnswered: number;  // already reported by a prior beacon this session
  flushedCorrect: number;
}
export interface SessionCompleteResult {
  fire: boolean;         // send the trackEvent call
  endSession: boolean;   // mark the session no longer active/resumable
  answeredDelta: number;
  correctDelta: number;
}
export function decideSessionComplete(input: SessionCompleteInput): SessionCompleteResult {
  if (!input.sessionActive) {
    return { fire: false, endSession: false, answeredDelta: 0, correctDelta: 0 };
  }
  const endSession = input.final;
  const answeredDelta = input.answered - input.flushedAnswered;
  if (!input.isDaily && answeredDelta <= 0) {
    return { fire: false, endSession, answeredDelta: 0, correctDelta: 0 };
  }
  return { fire: true, endSession, answeredDelta, correctDelta: input.correct - input.flushedCorrect };
}
