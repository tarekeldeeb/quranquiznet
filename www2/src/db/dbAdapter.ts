import { Platform } from 'react-native';
import qData from '../../../www/q.json';

const DB_NAME = 'qq.db';
const DB_VERSION = 1;
const STORE_Q = 'q';
const STORE_META = 'metadata';

export interface QRow {
  _id: number;
  txt: string;
  txtsym: string;
  sim1: number;
  sim2: number;
  sim3: number;
  sim1not2p1: string | null;
  aya: number | null;
}

export function isWeb(): boolean {
  return Platform.OS === 'web';
}

export function openDatabase(name: string) {
  if (isWeb()) {
    throw new Error('expo-sqlite is not supported on web; use web database APIs instead.');
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const SQLite = require('expo-sqlite');
  return SQLite.openDatabase(name);
}

export function getDb(name = DB_NAME) {
  return openDatabase(name);
}

function rowArrayToObject(row: any[]): QRow {
  return {
    _id: row[0],
    txt: row[1] || '',
    txtsym: row[2] || '',
    sim1: row[3] || 0,
    sim2: row[4] || 0,
    sim3: row[5] || 0,
    sim1not2p1: row[6] ? JSON.stringify(row[6]) : null,
    aya: row[7] || null,
  };
}

let webDbPromise: Promise<IDBDatabase> | null = null;

function openWebDb(): Promise<IDBDatabase> {
  if (webDbPromise) {
    return webDbPromise;
  }

  webDbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not available on this platform.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = event => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_Q)) {
        const qStore = db.createObjectStore(STORE_Q, { keyPath: '_id' });
        qStore.createIndex('aya', 'aya', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB open request was blocked.'));
  });

  return webDbPromise;
}

async function getWebMetaValue(key: string): Promise<any> {
  const db = await openWebDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const store = tx.objectStore(STORE_META);
    const request = store.get(key);

    request.onsuccess = () => {
      resolve(request.result?.value ?? null);
    };
    request.onerror = () => reject(request.error);
  });
}

async function putWebMetaValue(key: string, value: any): Promise<void> {
  const db = await openWebDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    const store = tx.objectStore(STORE_META);
    const request = store.put({ key, value });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function isWebDatabaseSeeded(): Promise<boolean> {
  const value = await getWebMetaValue('seeded');
  return value === '1';
}

export async function seedWebDatabaseIfNeeded(): Promise<void> {
  if (await isWebDatabaseSeeded()) {
    return;
  }

  const rows = qData?.objects?.[0]?.rows || [];
  const rowObjects = rows.map((row: any[]) => rowArrayToObject(row));

  const db = await openWebDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_Q, STORE_META], 'readwrite');
    const qStore = tx.objectStore(STORE_Q);
    const metaStore = tx.objectStore(STORE_META);

    const clearRequest = qStore.clear();
    clearRequest.onerror = () => reject(clearRequest.error);

    clearRequest.onsuccess = () => {
      for (const rowObject of rowObjects) {
        qStore.put(rowObject);
      }
      metaStore.put({ key: 'seeded', value: '1' });
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function queryRowsByRange(start: number, end: number): Promise<QRow[]> {
  const db = await openWebDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_Q, 'readonly');
    const store = tx.objectStore(STORE_Q);
    const range = IDBKeyRange.bound(start, end);
    const request = store.openCursor(range);
    const result: QRow[] = [];

    request.onsuccess = event => {
      const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null;
      if (cursor) {
        result.push(cursor.value as QRow);
        cursor.continue();
      }
    };

    request.onerror = () => reject(request.error);
    tx.oncomplete = () => resolve(result);
  });
}

export async function queryRowsByIds(ids: number[]): Promise<(QRow | null)[]> {
  const db = await openWebDb();
  return Promise.all(
    ids.map(
      id =>
        new Promise<QRow | null>((resolve, reject) => {
          const tx = db.transaction(STORE_Q, 'readonly');
          const store = tx.objectStore(STORE_Q);
          const request = store.get(id);
          request.onsuccess = () => resolve(request.result ?? null);
          request.onerror = () => reject(request.error);
        })
    )
  );
}

export async function queryFieldById<T extends keyof QRow>(id: number, field: T): Promise<QRow[T] | null> {
  const rows = await queryRowsByIds([id]);
  const row = rows[0];
  return row ? row[field] : null;
}

export async function findFirstAyaAfter(start: number): Promise<QRow | null> {
  const db = await openWebDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_Q, 'readonly');
    const store = tx.objectStore(STORE_Q);
    const range = IDBKeyRange.lowerBound(start);
    const request = store.openCursor(range);

    request.onsuccess = event => {
      const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null;
      if (!cursor) {
        resolve(null);
        return;
      }
      const value = cursor.value as QRow;
      if (value.aya != null) {
        resolve(value);
      } else {
        cursor.continue();
      }
    };

    request.onerror = () => reject(request.error);
  });
}

export async function findFirstAyaStart(start: number): Promise<boolean> {
  const row = await findFirstAyaAfter(start);
  return row ? row._id === start : false;
}
