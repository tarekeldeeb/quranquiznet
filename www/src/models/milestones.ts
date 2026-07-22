// Progress milestones — cheap, derived-only detection of "meaningful moments"
// worth celebrating with a toast. No new backend/state: every input here is
// already computed from the existing numCorrect/numQuestions per study part
// (see profileStore.getCorrectRatioRange / getCorrectRatio).
//
// Deliberately decoupled from profileStore's CORRECT_RATIO_RANGE enum (a
// models/ file staying independent of stores/) — callers translate the
// numeric range into this string tier before calling detectMilestones().

import i18n from '../i18n';

export type MasteryTier = 'EMPTY' | 'LOW' | 'MID' | 'HIGH';

export interface MilestoneInput {
  partName: string;
  beforeCorrect: number;
  afterCorrect: number;
  beforeTier: MasteryTier;
  afterTier: MasteryTier;
}

export interface Milestone {
  key: string;   // stable id, useful for de-duplication if ever persisted
  text: string;  // ready-to-show Arabic toast text
}

// Round numbers worth celebrating per sura/juz — cheap to check (just a
// threshold crossing), no per-milestone persistence needed since we only ever
// compare a single "before" vs "after" snapshot around one answer.
const CORRECT_THRESHOLDS = [50, 100, 250, 500, 1000];

/**
 * Compare a study part's state immediately before and after a single correct
 * answer, and return any milestones that were just crossed (usually 0, rarely
 * more than 1). Cheap: pure arithmetic over numbers the store already tracks.
 */
export function detectMilestones(input: MilestoneInput): Milestone[] {
  const milestones: Milestone[] = [];

  for (const threshold of CORRECT_THRESHOLDS) {
    if (input.beforeCorrect < threshold && input.afterCorrect >= threshold) {
      milestones.push({
        key: `correct:${input.partName}:${threshold}`,
        text: i18n.t('milestones.correctThreshold', { threshold, partName: input.partName }),
      });
    }
  }

  if (input.beforeTier !== 'HIGH' && input.afterTier === 'HIGH') {
    milestones.push({
      key: `mastery:${input.partName}`,
      text: i18n.t('milestones.mastery', { partName: input.partName }),
    });
  }

  return milestones;
}
