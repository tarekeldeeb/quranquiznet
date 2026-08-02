// 30-juz roll-up of the 50 StudyParts — the data behind the me-screen mini
// map (components/JuzMap.tsx). Juz 26–30 boundaries are exact
// (LAST5_JUZ_IDX); juz 1–25 split the words before juz 26 evenly. That
// approximation is deliberate: the profile's parts are whole suras there,
// so a juz cell is already blurred to sura granularity — deriving exact
// boundaries from q.json would not change what a cell can honestly claim.
import { LAST5_JUZ_IDX } from './constants';
import type { MasteryTier } from './milestones';

export const JUZ_COUNT = 30;

export interface JuzCell {
  /** 0..1 — fraction of this juz's words inside checked study parts. */
  coverage: number;
  /** Dominant tier (by word overlap) among the checked parts covering it;
   *  null when nothing overlaps (the grey "outside the plan" cell). */
  tier: MasteryTier | null;
}

interface PartLike {
  start: number;
  length: number;
  checked: boolean;
}

/** Exclusive upper word bound of 0-based juz `j` (same convention as SURA_IDX). */
function juzEnd(j: number): number {
  if (j >= 25) return LAST5_JUZ_IDX[j - 24];
  return 1 + Math.round(((LAST5_JUZ_IDX[0] - 1) * (j + 1)) / 25);
}

// Tie-break order: a needs-review juz must never hide behind an equally-sized
// mastered neighbor, so the weaker tier wins an exact tie.
const TIE_ORDER: MasteryTier[] = ['LOW', 'MID', 'HIGH', 'EMPTY'];

// Compact wire format for publishing a JuzCell[] to a friend-readable RTDB
// node (see firebase.ts pushPublicStats / PublicStats.juzMap): a 30-char
// tier string (one of HMLE, 'O' = outside the study plan / no tier) plus a
// parallel 0-100 coverage array — RTDB drops null fields outright, so `tier:
// null` can't round-trip directly and needs the 'O' sentinel instead.
export interface PublicJuzMap {
  tiers: string;
  coverage: number[];
}

const TIER_CHAR: Record<MasteryTier, string> = { HIGH: 'H', MID: 'M', LOW: 'L', EMPTY: 'E' };
const CHAR_TIER: Record<string, MasteryTier> = { H: 'HIGH', M: 'MID', L: 'LOW', E: 'EMPTY' };

export function encodePublicJuzMap(cells: JuzCell[]): PublicJuzMap {
  return {
    tiers: cells.map((c) => (c.tier ? TIER_CHAR[c.tier] : 'O')).join(''),
    coverage: cells.map((c) => Math.round(c.coverage * 100)),
  };
}

export function decodePublicJuzMap(pub: PublicJuzMap): JuzCell[] {
  return pub.tiers.split('').map((ch, i) => ({
    tier: CHAR_TIER[ch] ?? null,
    coverage: (pub.coverage[i] ?? 0) / 100,
  }));
}

export function computeJuzMap(
  parts: PartLike[],
  tierOf: (partIndex: number) => MasteryTier,
): JuzCell[] {
  const cells: JuzCell[] = [];
  for (let j = 0; j < JUZ_COUNT; j++) {
    const lo = j === 0 ? 1 : juzEnd(j - 1);
    const hi = juzEnd(j);
    let covered = 0;
    const weight: Record<MasteryTier, number> = { EMPTY: 0, LOW: 0, MID: 0, HIGH: 0 };
    parts.forEach((p, i) => {
      if (!p.checked) return;
      const overlap = Math.min(hi, p.start + p.length) - Math.max(lo, p.start);
      if (overlap <= 0) return;
      covered += overlap;
      weight[tierOf(i)] += overlap;
    });
    if (covered === 0) {
      cells.push({ coverage: 0, tier: null });
      continue;
    }
    let tier: MasteryTier = 'EMPTY';
    let best = -1;
    for (const t of TIE_ORDER) {
      if (weight[t] > best) { best = weight[t]; tier = t; }
    }
    // Checked parts can overlap (e.g. a sura inside a re-checked juz), so cap
    // at 1 rather than trusting the raw sum.
    cells.push({ coverage: Math.min(covered / (hi - lo), 1), tier });
  }
  return cells;
}
