import IDB from '../db/idb';
import { useProfileStore } from '../stores/profileStore';
import { randInt } from '../models/utils';
import { QuranWords } from '../models/constants';

export type SimpleQ = {
  id: number;
  startIdx: number;
  text: string;
  choices: string[];
  answerIndex: number;
};

async function findValidStartNear(idx: number, maxLook = 500) {
  for (let d = 0; d <= maxLook; d++) {
    const forward = idx + d;
    const back = idx - d;
    if (forward > 0) {
      const s2 = await IDB.sim2cnt(forward);
      const s3 = await IDB.sim3cnt(forward);
      if ((s2 || s3) > 0) return forward;
    }
    if (back > 0) {
      const s2b = await IDB.sim2cnt(back);
      const s3b = await IDB.sim3cnt(back);
      if ((s2b || s3b) > 0) return back;
    }
  }
  return idx;
}

async function pickIncorrectOptions(correctStart: number, limit = 3): Promise<string[]> {
  const choices: string[] = [];
  const attempts = Math.max(limit * 3, 12);
  for (let i = 0; i < attempts && choices.length < limit; i++) {
    const candidate = Math.max(1, randInt(QuranWords));
    if (candidate === correctStart) continue;
    const row = await IDB.txt(candidate, 2, '');
    const text = row[0] || String(candidate);
    if (!choices.includes(text) && text.length > 0) {
      choices.push(text);
    }
  }
  while (choices.length < limit) {
    const fallback = `Option ${choices.length + 1}`;
    if (!choices.includes(fallback)) choices.push(fallback);
  }
  return choices;
}

export async function createQuestionFromProfile(): Promise<SimpleQ> {
  const profileState = useProfileStore.getState() as any;
  const total = profileState.getTotalStudyLength?.() ?? 1;
  const safeTotal = total || 1;
  const CntTot = Math.abs(randInt(safeTotal)) % safeTotal + 1;
  const sparse = profileState.getSparsePoint?.(CntTot) ?? { idx: 1, part: 0 };
  const startGuess = sparse.idx;
  const start = await findValidStartNear(startGuess);
  const txts = await IDB.txt(start, 3, 'ayaMark');
  const text = txts.join(' ');
  const incorrect = await pickIncorrectOptions(start, 3);
  const choices = [text, ...incorrect];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return {
    id: start,
    startIdx: start,
    text,
    choices,
    answerIndex: choices.findIndex(item => item === text),
  };
}

export async function createNQuestionsFromProfile(n = 5) {
  const qs: SimpleQ[] = [];
  for (let i = 0; i < n; i++) {
    qs.push(await createQuestionFromProfile());
  }
  return qs;
}

export default { createQuestionFromProfile, createNQuestionsFromProfile };
