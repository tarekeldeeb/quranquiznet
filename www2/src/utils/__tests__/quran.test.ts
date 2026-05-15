import * as quran from '../quran';

describe('Quran Utils', () => {
  test('SURA_NAME has 114 suras', () => {
    expect(quran.SURA_NAME.length).toBe(114);
    expect(quran.SURA_NAME[0]).toBe('الفاتحة');
    expect(quran.SURA_NAME[113]).toBe('الناس');
  });

  test('SURA_AYAS has correct counts', () => {
    expect(quran.SURA_AYAS[0]).toBe(7); // Fatiha
    expect(quran.SURA_AYAS[1]).toBe(286); // Baqara
  });

  test('getSuraIdx returns correct index', () => {
    expect(quran.getSuraIdx(1)).toBe(0); // Before first boundary (30)
    expect(quran.getSuraIdx(31)).toBe(1); // After first boundary
    expect(quran.getSuraIdx(77877)).toBe(113); // Last sura
  });

  test('getPartNumberFromWordIdx returns correct parts', () => {
    expect(quran.getPartNumberFromWordIdx(1)).toBe(0); // Sura 1
    // LAST5_JUZ_IDX starts at SURA_IDX[44]
    const juzStart = quran.SURA_IDX[44];
    expect(quran.getPartNumberFromWordIdx(juzStart + 1)).toBe(45); // First Juz
  });

  test('randperm returns valid permutation', () => {
    const n = 10;
    const perm = quran.randperm(n);
    expect(perm.length).toBe(n);
    expect(new Set(perm).size).toBe(n);
    perm.forEach(val => {
      expect(val).toBeLessThan(n);
      expect(val).toBeGreaterThanOrEqual(0);
    });
  });
});
