import { detectMilestones, MilestoneInput } from '../milestones';

const base: MilestoneInput = {
  partName: 'سورة البقرة',
  beforeCorrect: 0,
  afterCorrect: 0,
  beforeTier: 'EMPTY',
  afterTier: 'EMPTY',
};

describe('detectMilestones', () => {
  it('fires a correct-count milestone when a threshold is crossed', () => {
    const result = detectMilestones({ ...base, beforeCorrect: 99, afterCorrect: 100 });
    // Arabic-Indic digits — i18next's interpolation formatter locale-formats
    // every numeric interpolation value (see src/i18n/index.ts).
    expect(result).toEqual([
      { key: 'correct:سورة البقرة:100', text: '💯 ١٠٠ إجابة صحيحة في سورة البقرة!' },
    ]);
  });

  it('does not fire when no threshold is crossed', () => {
    expect(detectMilestones({ ...base, beforeCorrect: 40, afterCorrect: 41 })).toEqual([]);
  });

  it('fires a mastery milestone the first time a part reaches HIGH', () => {
    const result = detectMilestones({ ...base, beforeTier: 'MID', afterTier: 'HIGH' });
    expect(result).toEqual([
      { key: 'mastery:سورة البقرة', text: '🏅 أتقنت سورة البقرة!' },
    ]);
  });

  it('does not re-fire mastery once already HIGH', () => {
    expect(detectMilestones({ ...base, beforeTier: 'HIGH', afterTier: 'HIGH' })).toEqual([]);
  });

  it('can fire both a correct-count and a mastery milestone at once', () => {
    const result = detectMilestones({
      ...base, beforeCorrect: 49, afterCorrect: 50, beforeTier: 'MID', afterTier: 'HIGH',
    });
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.key)).toEqual([
      'correct:سورة البقرة:50',
      'mastery:سورة البقرة',
    ]);
  });

  it('fires every threshold newly crossed in one jump', () => {
    // A big single jump (e.g. bulk-imported progress) could cross multiple
    // thresholds at once — all of them should fire, oldest-to-newest.
    const result = detectMilestones({ ...base, beforeCorrect: 40, afterCorrect: 260 });
    expect(result.map((m) => m.key)).toEqual([
      'correct:سورة البقرة:50',
      'correct:سورة البقرة:100',
      'correct:سورة البقرة:250',
    ]);
  });
});
