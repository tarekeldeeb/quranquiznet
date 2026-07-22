import { findOwnRank, describeLiveRank, type LeaderboardEntry } from '../dailyRank';

const standings: LeaderboardEntry[] = [
  { uid: 'a', name: 'Abdallah', score: 90 },
  { uid: 'b', name: 'Oumama', score: 70 },
  { uid: 'c', name: 'Tarek', score: 50 },
];

describe('findOwnRank', () => {
  it('returns null without a uid', () => {
    expect(findOwnRank(standings, undefined)).toBeNull();
  });

  it('returns null when the uid has no entry', () => {
    expect(findOwnRank(standings, 'nope')).toBeNull();
  });

  it('finds rank, total, and neighbors', () => {
    const own = findOwnRank(standings, 'b');
    expect(own).toMatchObject({ rank: 2, total: 3 });
    expect(own?.entry.name).toBe('Oumama');
    expect(own?.above.map((e) => e.name)).toEqual(['Abdallah']);
    expect(own?.below.map((e) => e.name)).toEqual(['Tarek']);
  });

  it('is correct for the sole entry', () => {
    const own = findOwnRank([{ uid: 'a', name: 'Abdallah', score: 76.3 }], 'a');
    expect(own).toMatchObject({ rank: 1, total: 1 });
  });
});

describe('describeLiveRank', () => {
  it('returns null when the user has no entry today', () => {
    expect(describeLiveRank(standings, 'nope')).toBeNull();
  });

  it('celebrates the leader, alone or not', () => {
    expect(describeLiveRank(standings, 'a')).toBe('أنت متقدم على الجميع اليوم! 🏆');
    expect(describeLiveRank([{ uid: 'a', name: 'Abdallah', score: 76.3 }], 'a'))
      .toBe('أنت متقدم على الجميع اليوم! 🏆');
  });

  it('reports rank, total, and the gap to the closest better score', () => {
    // Arabic-Indic digits — i18next's interpolation formatter locale-formats
    // every numeric interpolation value (see src/i18n/index.ts).
    expect(describeLiveRank(standings, 'b')).toBe('ترتيبك اليوم: #٢ من ٣ — متأخر ٢٠ نقطة عن Abdallah');
  });
});
