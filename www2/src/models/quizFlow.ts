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
  sessionActive: boolean;       // a run is flagged in progress
  answerable: boolean;          // there is a card AND the engine holds a real question
}

// Priority order mirrors the screen's original branch order, with one addition:
// an "active" session that has nothing the user can answer must `recover`
// rather than silently `resume` into a blank, dead screen.
export function decideFocusAction(i: FocusInput): FocusAction {
  if (i.pendingDailyStart) return 'start-daily';
  if (i.freshDeepLink) return 'start-part';
  if (i.sessionActive) return i.answerable ? 'resume' : 'recover';
  return 'chooser';
}

// When entering the daily quiz, a live *normal* run must be suspended (stashed
// with its own card stack) so it can reappear afterwards. A run that is already
// in daily mode, or no run at all, has nothing to suspend.
export function shouldSuspendNormalRun(sessionActive: boolean, inDailyMode: boolean): boolean {
  return sessionActive && !inDailyMode;
}

// A question the user can actually act on has its round-0 options populated.
// makeEmptyQO() leaves these empty, so a freshly-reset/lost engine reads as
// non-answerable.
export function isAnswerable(qo: QuestionObject): boolean {
  return Array.isArray(qo?.txt?.op?.[0]) && qo.txt.op[0].length > 0;
}
