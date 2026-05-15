import * as SQLite from 'expo-sqlite';
import { initDatabase } from '../database/init';

let db: any = null;

const getDb = async () => {
  if (!db) {
    db = await initDatabase();
  }
  return db;
};

export const getTxt = async (start: number, len: number = 1, params: string = '') => {
  const database = await getDb();
  const insertAyaMark = params.indexOf('ayaMark') !== -1;
  
  let results: any[] = [];
  if (start + len > 77878) {
    const r1 = await database.getAllAsync('SELECT * FROM q WHERE id >= ?', [start]);
    const r2 = await database.getAllAsync('SELECT * FROM q WHERE id < ?', [(start + len) % 77878]);
    results = [...r1, ...r2];
  } else {
    results = await database.getAllAsync('SELECT * FROM q WHERE id >= ? LIMIT ?', [start, len]);
  }

  return results.map((x: any) => {
    let t = x.txtsym;
    if (insertAyaMark && x.aya) {
      t += ' (' + x.aya + ')';
    }
    return t;
  });
};

export const getTxts = async (ids: number[]) => {
  const database = await getDb();
  const placeholders = ids.map(() => '?').join(',');
  const results: any[] = await database.getAllAsync('SELECT * FROM q WHERE id IN (' + placeholders + ')', ids);
  const resultMap = new Map(results.map((r: any) => [r.id, r.txtsym]));
  return ids.map((id: number) => resultMap.get(id) || '');
};

export const getSim2Cnt = async (idx: number) => {
  const database = await getDb();
  const result: any = await database.getFirstAsync('SELECT sim2 FROM q WHERE id = ?', [idx]);
  return result ? result.sim2 : 0;
};

export const getSim3Cnt = async (idx: number) => {
  const database = await getDb();
  const result: any = await database.getFirstAsync('SELECT sim3 FROM q WHERE id = ?', [idx]);
  return result ? result.sim3 : 0;
};

export const getUniqueSim1Not2Plus1 = async (idx: number) => {
  const database = await getDb();
  const result: any = await database.getFirstAsync('SELECT sim1not2p1 FROM q WHERE id = ?', [idx]);
  if (!result || !result.sim1not2p1) return [];
  try {
    return JSON.parse(result.sim1not2p1);
  } catch (e) {
    return [];
  }
};

export const getAyaNumberOf = async (idx: number) => {
  const database = await getDb();
  const result: any = await database.getFirstAsync('SELECT aya FROM q WHERE id >= ? AND aya > 0 LIMIT 1', [idx]);
  return result ? result.aya : 0;
};

export const checkAyaStart = async (idx: number) => {
  const database = await getDb();
  const result: any = await database.getFirstAsync('SELECT id FROM q WHERE id >= ? AND aya > 0 LIMIT 1', [idx]);
  return result ? result.id === idx : false;
};
