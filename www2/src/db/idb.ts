import { Platform } from 'react-native';
import {
  getDb,
  queryRowsByIds,
  queryRowsByRange,
  queryFieldById,
  findFirstAyaAfter,
  findFirstAyaStart,
} from './dbAdapter';

function mapResultRow(row: any, insertAyaMark: boolean) {
  let t = row.txtsym || '';
  if (insertAyaMark && row.aya != null) {
    t = t + '\uFD3F' + row.aya + '\uFD3E';
  }
  return t;
}

export async function txt(start: number, len = 1, params = ''): Promise<string[]> {
  const insertAyaMark = params.indexOf('ayaMark') > -1;
  const limit = len;
  const end = start + limit - 1;

  if (Platform.OS === 'web') {
    const rows = await queryRowsByRange(start, end);
    const out = rows.map(row => mapResultRow(row, insertAyaMark));
    if (out.length < limit) {
      const remaining = limit - out.length;
      const wrapRows = await queryRowsByRange(1, remaining);
      out.push(...wrapRows.map(row => mapResultRow(row, insertAyaMark)));
    }
    return out;
  }

  const db = getDb();
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      const q = `SELECT txtsym, aya FROM q WHERE _id >= ? AND _id <= ? ORDER BY _id ASC`;
      tx.executeSql(q, [start, end], (_: any, result: any) => {
        const out: string[] = [];
        for (let i = 0; i < result.rows.length; i++) {
          const row = result.rows.item(i);
          out.push(mapResultRow(row, insertAyaMark));
        }
        if (out.length < limit) {
          const remaining = limit - out.length;
          tx.executeSql(`SELECT txtsym, aya FROM q WHERE _id <= ? ORDER BY _id ASC`, [remaining], (_: any, r2: any) => {
            for (let j = 0; j < r2.rows.length; j++) {
              out.push(mapResultRow(r2.rows.item(j), insertAyaMark));
            }
            resolve(out);
          });
        } else {
          resolve(out);
        }
      }, (_: any, err: any) => { reject(err); return false as any; });
    });
  });
}

export async function txts(ids: number[]): Promise<string[]> {
  if (!ids || ids.length === 0) return [];

  if (Platform.OS === 'web') {
    const rows = await queryRowsByIds(ids);
    return rows.map(row => (row ? row.txtsym : ''));
  }

  const db = getDb();
  return new Promise((resolve, reject) => {
    const placeholders = ids.map(() => '?').join(',');
    const q = `SELECT txtsym, _id FROM q WHERE _id IN (${placeholders}) ORDER BY CASE ${ids
      .map((id, idx) => `WHEN _id=${id} THEN ${idx}`)
      .join(' ')} END`;
    db.transaction((tx: any) => {
      tx.executeSql(q, ids, (_: any, result: any) => {
        const out: string[] = [];
        for (let i = 0; i < result.rows.length; i++) out.push(result.rows.item(i).txtsym);
        resolve(out);
      }, (_: any, err: any) => { reject(err); return false as any; });
    });
  });
}

export async function sim2cnt(idx: number): Promise<number> {
  if (Platform.OS === 'web') {
    const value = await queryFieldById(idx, 'sim2');
    return value ?? 0;
  }

  const db = getDb();
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql(`SELECT sim2 FROM q WHERE _id = ?`, [idx], (_: any, result: any) => {
        if (result.rows.length === 0) return resolve(0);
        resolve(result.rows.item(0).sim2 || 0);
      }, (_: any, err: any) => { reject(err); return false as any; });
    });
  });
}

export async function sim3cnt(idx: number): Promise<number> {
  if (Platform.OS === 'web') {
    const value = await queryFieldById(idx, 'sim3');
    return value ?? 0;
  }

  const db = getDb();
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql(`SELECT sim3 FROM q WHERE _id = ?`, [idx], (_: any, result: any) => {
        if (result.rows.length === 0) return resolve(0);
        resolve(result.rows.item(0).sim3 || 0);
      }, (_: any, err: any) => { reject(err); return false as any; });
    });
  });
}

export async function ayaNumberOf(idx: number): Promise<number|null> {
  if (Platform.OS === 'web') {
    const row = await findFirstAyaAfter(idx);
    return row ? row.aya : null;
  }

  const db = getDb();
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql(`SELECT aya FROM q WHERE _id >= ? AND aya IS NOT NULL LIMIT 1`, [idx], (_: any, result: any) => {
        if (result.rows.length === 0) return resolve(null);
        resolve(result.rows.item(0).aya);
      }, (_: any, err: any) => { reject(err); return false as any; });
    });
  });
}

export async function isAyaStart(idx: number): Promise<boolean> {
  if (Platform.OS === 'web') {
    return findFirstAyaStart(idx);
  }

  const db = getDb();
  return new Promise((resolve, reject) => {
    db.transaction((tx: any) => {
      tx.executeSql(`SELECT _id FROM q WHERE _id >= ? AND aya IS NOT NULL LIMIT 1`, [idx], (_: any, result: any) => {
        if (result.rows.length === 0) return resolve(false);
        resolve(result.rows.item(0)._id === idx);
      }, (_: any, err: any) => { reject(err); return false as any; });
    });
  });
}

export default { txt, txts, sim2cnt, sim3cnt, ayaNumberOf, isAyaStart };
