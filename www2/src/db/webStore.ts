// Shared in-memory Quran word store for the web platform.
// Loaded once from q.json; all idb.web.ts queries read from here.

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

// 1-indexed sparse array (index 0 unused)
export const rows: (QRow | undefined)[] = [];
export let loaded = false;

export async function loadStore(onProgress?: (pct: number) => void): Promise<void> {
  if (loaded) { onProgress?.(1); return; }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const qData = require('../../assets/q.json') as {
    objects: [{ rows: (string | number | null)[][] }];
  };
  const rawRows = qData.objects[0].rows;
  const total = rawRows.length;

  for (let i = 0; i < total; i++) {
    const r = rawRows[i];
    const id = r[0] as number;
    rows[id] = {
      _id: id,
      txt: r[1] as string,
      txtsym: r[2] as string,
      sim1: (r[3] ?? 1) as number,
      sim2: (r[4] ?? 0) as number,
      sim3: (r[5] ?? 0) as number,
      sim1not2p1: r[6] as string | null,
      aya: r[7] as number | null,
    };
    // Yield every 5k rows so the UI can update progress
    if (i % 5000 === 4999) {
      onProgress?.((i + 1) / total * 0.99);
      await new Promise<void>((res) => setTimeout(res, 0));
    }
  }

  loaded = true;
  onProgress?.(1);
}
