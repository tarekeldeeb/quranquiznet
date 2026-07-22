// Rank titles derived from total score — identity is the cheapest retention
// there is. Same score data the app already tracks; a title + next-rank
// progress just gives it a destination (Home hero, leaderboard rows).
import i18n from '../i18n';

export interface RankInfo {
  title: string;
  index: number;
  nextTitle: string | null;
  remaining: number;   // points to the next rank; 0 once at the top rank
  progress: number;    // 0..1 through the current band
}

// Translation keys, not display text — call rankTitle(i) to resolve.
const RANK_TITLE_KEYS = ['rank.beginner', 'rank.diligent', 'rank.hafiz', 'rank.master'] as const;
export const RANK_THRESHOLDS = [0, 300, 1200, 3500] as const;

function rankTitle(index: number): string {
  return i18n.t(RANK_TITLE_KEYS[index]);
}

export function getRankInfo(score: number): RankInfo {
  let index = 0;
  for (let i = RANK_TITLE_KEYS.length - 1; i >= 0; i--) {
    if (score >= RANK_THRESHOLDS[i]) { index = i; break; }
  }
  const isTop = index === RANK_TITLE_KEYS.length - 1;
  const bandStart = RANK_THRESHOLDS[index];
  const bandEnd = isTop ? bandStart : RANK_THRESHOLDS[index + 1];
  const progress = isTop ? 1 : Math.max(0, Math.min(1, (score - bandStart) / (bandEnd - bandStart)));
  return {
    title: rankTitle(index),
    index,
    nextTitle: isTop ? null : rankTitle(index + 1),
    remaining: isTop ? 0 : Math.max(0, bandEnd - score),
    progress,
  };
}

export interface RankLadderEntry {
  title: string;
  threshold: number;
  reached: boolean;   // score already clears this rank's threshold
  current: boolean;   // the rank the player is in right now
}

/** The full ladder (all 4 ranks) for a "how to reach each rank" view — see
 * getRankInfo() for the single-rank summary used on the Home hero. */
export function getRankLadder(score: number): RankLadderEntry[] {
  const { index: currentIndex } = getRankInfo(score);
  return RANK_TITLE_KEYS.map((_, i) => ({
    title: rankTitle(i),
    threshold: RANK_THRESHOLDS[i],
    reached: score >= RANK_THRESHOLDS[i],
    current: i === currentIndex,
  }));
}
