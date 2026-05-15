import * as SQLite from 'expo-sqlite';

const DB_NAME = 'quran.db';

export const initDatabase = async () => {
  const db = await SQLite.openDatabaseAsync(DB_NAME);

  await db.execAsync("CREATE TABLE IF NOT EXISTS q (id INTEGER PRIMARY KEY, txt TEXT, txtsym TEXT, sim1 INTEGER, sim2 INTEGER, sim3 INTEGER, sim1not2p1 TEXT, aya INTEGER);");
  
  return db;
};
