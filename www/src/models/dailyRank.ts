// Live rank comparison — turns today's actual (unbounded) standings + the
// user's uid into a single human-readable line: an ordinal rank among
// today's real participants, plus the point-gap to whoever's just ahead.
// Pure/no framework deps so it's cheap to unit test and reusable from the
// daily-end modal, the me.tsx idle "already done today" card, and the league
// screen — all three read the same live cohort, so they never disagree.

export interface LeaderboardEntry {
  name?: string;
  score: number;
  uid?: string;
  country?: string;
}

export interface RankedEntry extends LeaderboardEntry { rank: number }

export interface OwnRank {
  rank: number;
  total: number;
  entry: RankedEntry;
  above: RankedEntry[];
  below: RankedEntry[];
}

/**
 * Find the signed-in user's position in a full, best-first-sorted standings
 * list, plus their immediate neighbors above/below — so they see where they
 * stand even when far outside the visible top 10.
 */
export function findOwnRank(sorted: LeaderboardEntry[], uid: string | undefined, neighborCount = 2): OwnRank | null {
  if (!uid) return null;
  const ranked: RankedEntry[] = sorted.map((e, i) => ({ ...e, rank: i + 1 }));
  const idx = ranked.findIndex((e) => e.uid === uid);
  if (idx === -1) return null;
  return {
    rank: idx + 1,
    total: ranked.length,
    entry: ranked[idx],
    above: ranked.slice(Math.max(0, idx - neighborCount), idx),
    below: ranked.slice(idx + 1, idx + 1 + neighborCount),
  };
}

/**
 * Describe today's live rank as a single line, computed from the same
 * standings the league screen's اليوم tab shows. Returns null when the user
 * has no entry yet (cohort not loaded, or they haven't submitted today).
 */
export function describeLiveRank(sorted: LeaderboardEntry[], uid: string | undefined): string | null {
  const own = findOwnRank(sorted, uid, 1);
  if (!own) return null;
  if (own.rank === 1) return 'أنت متقدم على الجميع اليوم! 🏆';
  const better = own.above[own.above.length - 1];
  const diff = Math.max(1, Math.round((better.score - own.entry.score) * 100) / 100);
  const name = better.name?.trim() || 'زائر(ة)';
  return `ترتيبك اليوم: #${own.rank} من ${own.total} — متأخر ${diff} نقطة عن ${name}`;
}
