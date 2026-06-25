import { loadStore } from './webStore';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getDb(): Promise<any> {
  return null;
}

export async function initDb(onProgress?: (pct: number) => void): Promise<void> {
  await loadStore(onProgress);
}
