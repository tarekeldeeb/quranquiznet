import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!_db) {
    _db = await SQLite.openDatabaseAsync('quranquiz.db');
  }
  return _db;
}

export async function initDb(
  onProgress?: (pct: number) => void,
): Promise<void> {
  const db = await getDb();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS q (
      _id          INTEGER PRIMARY KEY,
      txt          TEXT NOT NULL,
      txtsym       TEXT NOT NULL,
      sim1         INTEGER NOT NULL DEFAULT 1,
      sim2         INTEGER NOT NULL DEFAULT 0,
      sim3         INTEGER NOT NULL DEFAULT 0,
      sim1not2p1   TEXT,
      aya          INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_q_sim2 ON q(sim2);
  `);

  const row = await db.getFirstAsync<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM q',
  );
  if (row && row.cnt > 0) {
    onProgress?.(1);
    return;
  }

  // First-run: import q.json bundled asset
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const qData = require('../../assets/q.json') as {
    objects: [{ rows: (string | number | null)[][] }];
  };
  const rows = qData.objects[0].rows;
  const BATCH = 2000;
  const total = rows.length;

  for (let i = 0; i < total; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await db.withExclusiveTransactionAsync(async (txn) => {
      for (const r of batch) {
        await txn.runAsync(
          'INSERT INTO q(_id,txt,txtsym,sim1,sim2,sim3,sim1not2p1,aya) VALUES(?,?,?,?,?,?,?,?)',
          [r[0], r[1], r[2], r[3] ?? 1, r[4] ?? 0, r[5] ?? 0, r[6] ?? null, r[7] ?? null],
        );
      }
    });
    onProgress?.(Math.min((i + BATCH) / total, 0.99));
  }
  onProgress?.(1);
}
