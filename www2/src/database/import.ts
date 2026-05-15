import * as SQLite from 'expo-sqlite';
import qData from '../../www/q.json';

export const importData = async (db: SQLite.SQLiteDatabase) => {
  console.log('Starting data import...');
  const rows = qData.objects[0].rows;
  
  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      await db.runAsync(
        'INSERT INTO q (id, txt, txtsym, sim1, sim2, sim3, sim1not2p1, aya) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [row[0], row[1], row[2], row[3], row[4], row[5], row[6] ? JSON.stringify(row[6]) : null, row[7]]
      );
    }
  });
  console.log('Import complete!');
};
