import { Platform } from 'react-native';
import { openDatabase, seedWebDatabaseIfNeeded } from './dbAdapter';

// Importing the q.json from the repo root
// TypeScript resolves JSON because of resolveJsonModule in tsconfig
import qData from '../../../www/q.json';

const DB_NAME = 'qq.db';
const BATCH_SIZE = 1000; // insert rows in batches to avoid long transactions

export function getDb() {
  return openDatabase(DB_NAME);
}

function mapRowToInsertParams(row: any) {
  // Expected row layout similar to web: [ _id, txt, txtsym, sim1, sim2, sim3, sim1not2p1, aya ]
  return [
    row[0], // _id
    row[1] || '', // txt
    row[2] || '', // txtsym
    row[3] || 0, // sim1
    row[4] || 0, // sim2
    row[5] || 0, // sim3
    row[6] ? JSON.stringify(row[6]) : null, // sim1not2p1
    row[7] || null, // aya
  ];
}

export async function seedDatabaseIfNeeded() {
  if (Platform.OS === 'web') {
    return seedWebDatabaseIfNeeded();
  }

  const db = getDb();
  return new Promise<void>((resolve, reject) => {
    db.transaction((tx: any) => {
      // basic metadata table
      tx.executeSql(`CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT)`);

      tx.executeSql(`SELECT value FROM metadata WHERE key = ?`, ['seeded'], (_: any, result: any) => {
        if (result.rows.length > 0) {
          resolve();
          return;
        }

        // Create the 'q' table matching the original schema used by JsStore
        tx.executeSql(`DROP TABLE IF EXISTS q`);
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS q (
            _id INTEGER PRIMARY KEY NOT NULL,
            txt TEXT,
            txtsym TEXT,
            sim1 INTEGER,
            sim2 INTEGER,
            sim3 INTEGER,
            sim1not2p1 TEXT,
            aya INTEGER
          )`
        );

        // Insert rows in batches to avoid huge single-transaction load
        const objects = qData && qData.objects && Array.isArray(qData.objects) ? qData.objects : [];
        const rows = (objects[0] && objects[0].rows) || [];

        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE);
          const placeholders = batch.map(() => '(?,?,?,?,?,?,?,?)').join(',');
          const flatParams: any[] = [];
          batch.forEach((r: any) => flatParams.push(...mapRowToInsertParams(r)));
          // Use the same transaction but a separate executeSql per batch
          tx.executeSql(`INSERT OR REPLACE INTO q (_id, txt, txtsym, sim1, sim2, sim3, sim1not2p1, aya) VALUES ${placeholders}`, flatParams);
        }

        tx.executeSql(`INSERT INTO metadata (key, value) VALUES (?, ?)`, ['seeded', '1'], () => {
          resolve();
        }, (_: any, err: any) => { console.warn('metadata insert err', err); reject(err); return false as any; });
      }, (_: any, error: any) => {
        console.warn('metadata select error', error);
        reject(error);
        return false as any;
      });
    }, (err: any) => {
      console.error('DB transaction error', err);
      reject(err);
    });
  });
}
