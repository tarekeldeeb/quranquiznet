// Post-win rank comparison — turns a raw leaderboard cohort + the user's own
// daily score into a single human-readable line ("you're N points behind X",
// or a celebration if nobody beat them). Pure/no framework deps so it's cheap
// to unit test and reusable from both the daily-end modal and the me.tsx idle
// "already done today" card.

export interface LeaderboardEntry {
  name?: string;
  score?: number;
  uid?: string;
}

/**
 * Find the closest better score in `entries` and describe the gap. Returns
 * null when there's no usable data (empty cohort) so callers can hide the line
 * entirely instead of showing a hollow message.
 */
export function describeRankGap(entries: LeaderboardEntry[], myScore: number): string | null {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const better = entries
    .filter((e): e is Required<Pick<LeaderboardEntry, 'score'>> & LeaderboardEntry =>
      typeof e?.score === 'number' && e.score > myScore)
    .sort((a, b) => a.score - b.score);
  if (better.length === 0) return 'أنت متقدم على الجميع اليوم! 🏆';
  const target = better[0];
  const diff = Math.max(1, Math.round((target.score - myScore) * 100) / 100);
  const name = target.name?.trim() || 'زائر(ة)';
  return `أنت متأخر ${diff} نقطة عن ${name} فقط`;
}
