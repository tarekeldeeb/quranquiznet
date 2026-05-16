import { clamp, randInt, randperm, shuffle, modQWords, formattedAyaMark } from '../models/utils';

describe('utils', () => {
  it('clamps values within a range', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('generates a random integer within bounds', () => {
    const values = Array.from({ length: 100 }, () => randInt(10));
    values.forEach(value => expect(value).toBeGreaterThanOrEqual(0));
    values.forEach(value => expect(value).toBeLessThan(10));
  });

  it('generates a random permutation', () => {
    const perm = randperm(5);
    expect(perm).toHaveLength(5);
    expect(new Set(perm).size).toBe(5);
    expect(perm.every(n => n >= 0 && n < 5)).toBe(true);
  });

  it('shuffles items according to a permutation', () => {
    const array = [1, 2, 3];
    const perm = [2, 0, 1];
    expect(shuffle(array, perm)).toEqual([3, 1, 2]);
  });

  it('wraps words greater than QuranWords', () => {
    expect(modQWords(77879)).toBe(1);
    expect(modQWords(1)).toBe(1);
  });

  it('formats aya marks correctly', () => {
    expect(formattedAyaMark(5, 3)).toBe('\u06DD');
    expect(formattedAyaMark(7, 2)).toBe('\u00A0\uFD3F7\uFD3E');
    expect(formattedAyaMark(9, 0)).toBe('\u00A09');
  });
});
