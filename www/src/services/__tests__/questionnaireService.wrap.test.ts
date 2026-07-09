// End-of-Quran wrap-around invariants for the questionnaire engine:
//   #1 A question near the end of An-Nas rotates into Al-Fatiha — its text and its
//      correct option continue with بسم الله... instead of stopping (or wrapping to
//      garbage ids), reproducing the shared-link case /quiz?start=77880.
//   #2 The valid-start search terminates for ANY start id, including the last words
//      of the Quran — the legacy sentinel (QURAN_WORDS - 1) never triggered for a
//      start beyond it and walked past the table forever.
//   #3 The sim-distractor lookup uses the wrapped predecessor of a correct option
//      that landed on word 1 (i.e. 77881, the last word), never id 0.

import { QURAN_WORDS } from '../../models/constants';

// A tiny synthetic word table covering only the wrap boundary: the last words of
// An-Nas (77874..77881, mirroring the real sim values except where noted) and the
// start of Al-Fatiha. Everything else reads as "no such row", like the real DB.
interface FakeRow { txt: string; sim2: number; sim3: number; aya: number | null }
const mockTable = new Map<number, FakeRow>([
  [77874, { txt: 'الذى',    sim2: 0, sim3: 0, aya: null }],
  [77875, { txt: 'يوسوس',   sim2: 0, sim3: 0, aya: null }],
  [77876, { txt: 'فى',      sim2: 2, sim3: 0, aya: null }],
  [77877, { txt: 'صدور',    sim2: 0, sim3: 0, aya: null }],
  [77878, { txt: 'الناس',   sim2: 14, sim3: 0, aya: 5 }],
  // sim3 = 0 here (really 2) so the start survives extraQLength unmoved and the
  // correct option lands exactly on word 1 — the lastCorrect wrap case (#3).
  [77879, { txt: 'من',      sim2: 6, sim3: 0, aya: null }],
  [77880, { txt: 'الجنة',   sim2: 2, sim3: 0, aya: null }],
  [77881, { txt: 'والناس',  sim2: 0, sim3: 0, aya: 6 }],
  [1,     { txt: 'بسم',     sim2: 114, sim3: 113, aya: null }],
  [2,     { txt: 'الله',    sim2: 113, sim3: 113, aya: null }],
  [3,     { txt: 'الرحمن',  sim2: 117, sim3: 4, aya: null }],
  [4,     { txt: 'الرحيم',  sim2: 4, sim3: 4, aya: 1 }],
  [5,     { txt: 'الحمد',   sim2: 20, sim3: 3, aya: null }],
  [6,     { txt: 'لله',     sim2: 3, sim3: 0, aya: null }],
]);

const mockSimCalls: number[] = [];

jest.mock('../../db/idb', () => ({
  txt: jest.fn(async (start: number, len: number) => {
    const words: string[] = [];
    for (let i = 0; i < len; i++) {
      const id = ((start + i - 1) % 77881) + 1;
      const row = mockTable.get(id);
      if (row) words.push(row.txt);
    }
    return words;
  }),
  txts: jest.fn(async (ids: number[]) => ids.map((id) => mockTable.get(id)?.txt ?? '')),
  sim2cnt: jest.fn(async (idx: number) => mockTable.get(idx)?.sim2 ?? 0),
  sim3cnt: jest.fn(async (idx: number) => mockTable.get(idx)?.sim3 ?? 0),
  uniqueSim1Not2Plus1: jest.fn(async (idx: number) => { mockSimCalls.push(idx); return []; }),
  randomUnique4NotMatching: jest.fn(async () => ({ i: 0, set: [100, 200, 300, 400] })),
  isAyaStart: jest.fn(async (idx: number) => mockTable.get(idx - 1)?.aya != null),
  ayaNumberOf: jest.fn(async () => 6),
}));

import { initQuestionnaire, createNormalQ, qo } from '../questionnaireService';

const sparse = (n: number) => ({ idx: n, part: 49 });
const totalStudy = () => QURAN_WORDS;
const partIndexOf = () => 49;

describe('end-of-Quran wrap-around', () => {
  beforeEach(() => {
    initQuestionnaire(1234);
    mockSimCalls.length = 0;
  });

  it('a ?start=77880 question wraps its text and correct option into Al-Fatiha', async () => {
    await createNormalQ(77880, sparse, totalStudy, 1, 1, partIndexOf);
    expect(qo.startIdx).toBe(77880);
    // Question: الجنة والناس + the wrapped بسم; the answer keeps rotating into Al-Fatiha.
    expect(qo.txt.question).toBe('الجنة والناس بسم');
    expect(qo.txt.answer.startsWith('الجنة والناس بسم الله الرحمن الرحيم الحمد')).toBe(true);
    // Correct option continues after the question's wrapped بسم.
    expect(qo.op[0][0]).toBe(2);
    expect(qo.txt.op[0][0]).toBe('الله الرحمن');
  });

  it('terminates and stays in range for a start at the very last word', async () => {
    await createNormalQ(77881, sparse, totalStudy, 1, 1, partIndexOf);
    expect(qo.startIdx).toBeGreaterThanOrEqual(1);
    expect(qo.startIdx).toBeLessThanOrEqual(QURAN_WORDS);
    expect(qo.txt.op[0][0]).not.toBe('');
  });

  it('looks up sim distractors at the wrapped predecessor (77881), never id 0', async () => {
    await createNormalQ(77879, sparse, totalStudy, 1, 1, partIndexOf);
    // startIdx 77879 + qLen 3 wraps the correct option to word 1 (بسم).
    expect(qo.startIdx).toBe(77879);
    expect(qo.op[0][0]).toBe(1);
    expect(qo.txt.op[0][0]).toBe('بسم الله');
    expect(mockSimCalls[0]).toBe(QURAN_WORDS);
    expect(mockSimCalls).not.toContain(0);
  });
});
