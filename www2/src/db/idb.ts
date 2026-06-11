// IndexedDB abstraction — mirrors www/_model_/services.js IDB factory
// All methods use expo-sqlite (works on iOS, Android, and web via WASM).

import { getDb } from './initDb';
import { QURAN_WORDS, modQWords, formattedAyaMark } from '../models/constants';

interface QRow {
  _id: number;
  txt: string;
  txtsym: string;
  sim1: number;
  sim2: number;
  sim3: number;
  sim1not2p1: string | null;
  aya: number | null;
}

export async function txt(
  start: number,
  len: number,
  params: string,
): Promise<string[]> {
  const db = await getDb();
  const limit = len || 1;
  const insertAyaMark = params.includes('ayaMark');
  const noSym = params.includes('noSym');

  let results: QRow[];
  if (start + limit > QURAN_WORDS) {
    // wrap-around: two ranges
    const part1 = await db.getAllAsync<QRow>(
      'SELECT * FROM q WHERE _id >= ? ORDER BY _id LIMIT ?',
      [start, QURAN_WORDS - start + 1],
    );
    const wrapEnd = modQWords(start + limit);
    const part2 = await db.getAllAsync<QRow>(
      'SELECT * FROM q WHERE _id < ? ORDER BY _id',
      [wrapEnd],
    );
    results = [...part1, ...part2];
  } else {
    results = await db.getAllAsync<QRow>(
      'SELECT * FROM q WHERE _id >= ? ORDER BY _id LIMIT ?',
      [start, limit],
    );
  }

  return results.map((x) => {
    if (noSym) return x.txt;
    if (insertAyaMark && x.aya != null) {
      return x.txtsym + formattedAyaMark(x.aya);
    }
    return x.txtsym;
  });
}

export async function txts(ids: number[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const db = await getDb();
  const placeholders = ids.map(() => '?').join(',');
  const rows = await db.getAllAsync<QRow>(
    `SELECT * FROM q WHERE _id IN (${placeholders})`,
    ids,
  );
  // preserve order including duplicates
  const map = new Map(rows.map((r) => [r._id, r.txtsym]));
  return ids.map((id) => map.get(id) ?? '');
}

export async function sim2cnt(idx: number): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ sim2: number }>(
    'SELECT sim2 FROM q WHERE _id = ?',
    [idx],
  );
  return row?.sim2 ?? 0;
}

export async function sim3cnt(idx: number): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ sim3: number }>(
    'SELECT sim3 FROM q WHERE _id = ?',
    [idx],
  );
  return row?.sim3 ?? 0;
}

export async function uniqueSim1Not2Plus1(idx: number): Promise<number[]> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ sim1not2p1: string | null }>(
    'SELECT sim1not2p1 FROM q WHERE _id = ?',
    [idx],
  );
  if (!row?.sim1not2p1) return [];
  try {
    return JSON.parse(row.sim1not2p1) as number[];
  } catch {
    return [];
  }
}

export async function randomUnique4NotMatching(
  idx: number,
): Promise<{ i: number; set: number[] }> {
  const db = await getDb();
  const randomStart = Math.ceil(Math.random() * (QURAN_WORDS - 201)) + 1;
  const wordRow = await db.getFirstAsync<{ txt: string }>(
    'SELECT txt FROM q WHERE _id = ?',
    [idx],
  );
  const wordTxt = wordRow?.txt ?? '';
  const rows = await db.getAllAsync<QRow>(
    'SELECT * FROM q WHERE _id >= ? AND txt != ? ORDER BY _id LIMIT 50',
    [randomStart, wordTxt],
  );
  const sampled = [1, 8, 13, 19].map((x) => rows[x]?._id ?? x);
  return { i: idx, set: sampled };
}

export async function ayaNumberOf(idx: number): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ aya: number }>(
    'SELECT aya FROM q WHERE _id >= ? AND aya IS NOT NULL ORDER BY _id LIMIT 1',
    [idx],
  );
  return row?.aya ?? 0;
}

export async function isAyaStart(idx: number): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ _id: number }>(
    'SELECT _id FROM q WHERE _id >= ? AND aya IS NOT NULL ORDER BY _id LIMIT 1',
    [idx - 1],
  );
  return row?._id === idx - 1;
}
