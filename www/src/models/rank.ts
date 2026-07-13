// Rank titles derived from total score — identity is the cheapest retention
// there is. Same score data the app already tracks; a title + next-rank
// progress just gives it a destination (Home hero, leaderboard rows).
export interface RankInfo {
  title: string;
  index: number;
  nextTitle: string | null;
  remaining: number;   // points to the next rank; 0 once at the top rank
  progress: number;    // 0..1 through the current band
}

export const RANK_TITLES = ['مبتدئ', 'مجتهد', 'حافظ', 'متقن'] as const;
export const RANK_THRESHOLDS = [0, 300, 1200, 3500] as const;

export function getRankInfo(score: number): RankInfo {
  let index = 0;
  for (let i = RANK_TITLES.length - 1; i >= 0; i--) {
    if (score >= RANK_THRESHOLDS[i]) { index = i; break; }
  }
  const isTop = index === RANK_TITLES.length - 1;
  const bandStart = RANK_THRESHOLDS[index];
  const bandEnd = isTop ? bandStart : RANK_THRESHOLDS[index + 1];
  const progress = isTop ? 1 : Math.max(0, Math.min(1, (score - bandStart) / (bandEnd - bandStart)));
  return {
    title: RANK_TITLES[index],
    index,
    nextTitle: isTop ? null : RANK_TITLES[index + 1],
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
  return RANK_TITLES.map((title, i) => ({
    title,
    threshold: RANK_THRESHOLDS[i],
    reached: score >= RANK_THRESHOLDS[i],
    current: i === currentIndex,
  }));
}
