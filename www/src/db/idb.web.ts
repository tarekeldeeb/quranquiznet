// Web in-memory implementation of the idb query layer.
// Metro resolves this file instead of idb.ts when bundling for web.

import { rows } from './webStore';
import { QURAN_WORDS, modQWords, formattedAyaMark } from '../models/constants';

function get(id: number) {
  return rows[id];
}

export async function txt(start: number, len: number, params: string): Promise<string[]> {
  const limit = len || 1;
  const insertAyaMark = params.includes('ayaMark');
  const noSym = params.includes('noSym');
  const result: string[] = [];

  for (let i = 0; i < limit; i++) {
    const id = modQWords(start + i);
    const row = get(id);
    if (!row) continue;
    if (noSym) {
      result.push(row.txt);
    } else if (insertAyaMark && row.aya != null) {
      result.push(row.txtsym + formattedAyaMark(row.aya));
    } else {
      result.push(row.txtsym);
    }
  }
  return result;
}

export async function txts(ids: number[]): Promise<string[]> {
  return ids.map((id) => get(id)?.txtsym ?? '');
}

export async function sim2cnt(idx: number): Promise<number> {
  return get(idx)?.sim2 ?? 0;
}

export async function sim3cnt(idx: number): Promise<number> {
  return get(idx)?.sim3 ?? 0;
}

export async function uniqueSim1Not2Plus1(idx: number): Promise<number[]> {
  const raw = get(idx)?.sim1not2p1;
  if (!raw) return [];
  try {
    return JSON.parse(raw) as number[];
  } catch {
    return [];
  }
}

export async function randomUnique4NotMatching(
  idx: number,
): Promise<{ i: number; set: number[] }> {
  const wordTxt = get(idx)?.txt ?? '';
  const randomStart = Math.ceil(Math.random() * (QURAN_WORDS - 201)) + 1;
  const candidates: number[] = [];
  for (let id = randomStart; id <= QURAN_WORDS && candidates.length < 50; id++) {
    const row = get(id);
    if (row && row.txt !== wordTxt) candidates.push(id);
  }
  const sampled = [1, 8, 13, 19].map((x) => candidates[x] ?? x);
  return { i: idx, set: sampled };
}

export async function ayaNumberOf(idx: number): Promise<number> {
  // Walk forward from idx to find the next aya boundary
  for (let id = idx; id <= QURAN_WORDS + 20; id++) {
    const row = get(id);
    if (row?.aya != null) return row.aya;
  }
  return 0;
}

// 1-based position of word `idx` within its own aya (counts from the aya start).
// Walks back to the previous aya-ending word; this aya starts right after it.
export async function wordOffsetInAya(idx: number): Promise<number> {
  let ayaStart = 1;
  for (let id = idx - 1; id >= 1; id--) {
    if (get(id)?.aya != null) { ayaStart = id + 1; break; }
  }
  return idx - ayaStart + 1;
}

export async function isAyaStart(idx: number): Promise<boolean> {
  // The word before idx (i.e. idx-1) ends an aya
  return get(idx - 1)?.aya != null;
}
