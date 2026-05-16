export function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function randInt(max: number) {
  return Math.floor(Math.random() * Math.floor(max));
}

export function randperm(n: number): number[] {
  const o = Array.from({ length: n }, (_, i) => i);
  for (let i = o.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [o[i], o[j]] = [o[j], o[i]];
  }
  return o;
}

export function shuffle<T>(arr: T[], perm: number[]) {
  if (arr.length !== perm.length) throw new Error('Bad Shuffle');
  const o = new Array(arr.length) as T[];
  for (let i = 0; i < arr.length; i++) o[i] = arr[perm[i]];
  return o;
}

export function sCurve(ratio: number, max: number) {
  const y = [0.001, 0.11, 0.87, 0.98];
  let yp;
  if (ratio < 0.3 * max) yp = y[0] + (y[1] - y[0]) / (0.3 * max - 0) * (ratio - 0);
  else if (ratio < 0.7 * max) yp = y[1] + (y[2] - y[1]) / (0.7 * max - 0.3 * max) * (ratio - 0.3 * max);
  else if (ratio < max) yp = y[2] + (y[3] - y[2]) / (max - 0.7 * max) * (ratio - 0.7 * max);
  else yp = y[3] + 0.005 * (ratio - max);
  return yp;
}

export function modQWords(n: number, QuranWords = 77878) {
  return n > QuranWords ? n - QuranWords : n;
}

export function formattedAyaMark(ayaNum: number, fmt: number) {
  switch (fmt) {
    case 3:
      return '\u06DD';
    case 2:
      return '\u00A0\uFD3F' + ayaNum + '\uFD3E';
    default:
      return '\u00A0' + ayaNum;
  }
}

