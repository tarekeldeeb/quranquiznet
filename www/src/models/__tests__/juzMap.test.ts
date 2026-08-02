// computeJuzMap — the 30-juz roll-up behind the me-screen mini map.
import { computeJuzMap, JUZ_COUNT } from '../juzMap';
import { SURA_IDX, LAST5_JUZ_IDX } from '../constants';
import type { MasteryTier } from '../milestones';

interface P { start: number; length: number; checked: boolean }
const part = (start: number, length: number, checked = true): P => ({ start, length, checked });
const tiers = (map: Record<number, MasteryTier>) => (i: number): MasteryTier => map[i] ?? 'EMPTY';

describe('computeJuzMap', () => {
  it('returns 30 empty cells when nothing is checked', () => {
    const cells = computeJuzMap([part(1, 30, false)], tiers({}));
    expect(cells).toHaveLength(JUZ_COUNT);
    cells.forEach((c) => {
      expect(c.coverage).toBe(0);
      expect(c.tier).toBeNull();
    });
  });

  it('spreads البقرة across the first three ajzāʾ', () => {
    const baqarah = part(SURA_IDX[0], SURA_IDX[1] - SURA_IDX[0]);
    const cells = computeJuzMap([baqarah], tiers({ 0: 'HIGH' }));
    expect(cells[0].coverage).toBeGreaterThan(0.95);
    expect(cells[0].tier).toBe('HIGH');
    expect(cells[1].coverage).toBe(1);
    expect(cells[2].coverage).toBeGreaterThan(0.2);
    expect(cells[2].coverage).toBeLessThan(0.6);
    expect(cells[3].coverage).toBe(0);
    expect(cells[3].tier).toBeNull();
  });

  it('maps juz عم exactly onto the last cell', () => {
    const amma = part(LAST5_JUZ_IDX[4], LAST5_JUZ_IDX[5] - LAST5_JUZ_IDX[4]);
    const cells = computeJuzMap([amma], tiers({ 0: 'MID' }));
    expect(cells[29]).toEqual({ coverage: 1, tier: 'MID' });
    for (let j = 25; j < 29; j++) expect(cells[j].coverage).toBe(0);
  });

  it('picks the dominant tier by word overlap', () => {
    // Juz 27 (cell index 26) covered 60% by a LOW part, 40% by a HIGH part.
    const lo = LAST5_JUZ_IDX[1];
    const hi = LAST5_JUZ_IDX[2];
    const split = lo + Math.round((hi - lo) * 0.6);
    const cells = computeJuzMap(
      [part(lo, split - lo), part(split, hi - split)],
      tiers({ 0: 'LOW', 1: 'HIGH' }),
    );
    expect(cells[26].tier).toBe('LOW');
    expect(cells[26].coverage).toBe(1);
  });

  it('clamps coverage when checked parts overlap the same words', () => {
    const lo = LAST5_JUZ_IDX[4];
    const cells = computeJuzMap(
      [part(lo, LAST5_JUZ_IDX[5] - lo), part(lo, LAST5_JUZ_IDX[5] - lo)],
      tiers({ 0: 'HIGH', 1: 'HIGH' }),
    );
    expect(cells[29].coverage).toBe(1);
  });
});
