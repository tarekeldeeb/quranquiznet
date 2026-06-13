// Questionnaire engine — ports www/_model_/questionnaire.js to TypeScript async/await.
// This is a module-level singleton so the seeded RNG state persists across questions.

import seedrandom, { type PRNG } from 'seedrandom';
import {
  QURAN_WORDS, SURA_IDX, SURA_NAME, SURA_AYAS,
  DAILYQUIZ_QPERPART_COUNT, DAILYQUIZ_QPERPART_DIST,
  getSuraIdx, modQWords, randperm, deepCopy,
  ANSWER_LENGTH,
} from '../models/constants';
import { Q_TYPE, QType, QuestionObject, makeEmptyQO } from '../models/questionnaire';
import * as idb from '../db/idb';

// ---------- singleton state ----------
let rand: PRNG | null = null;
export let qo: QuestionObject = makeEmptyQO();

// daily quiz state
let dailyStarts: number[] = [];
let dailyIndex = 0;

// Set to true by initDailyQuiz so the quiz screen knows to enter daily mode on next focus
export let pendingDailyStart = false;
export function clearPendingDailyStart() { pendingDailyStart = false; }

// ---------- public init ----------
export function initQuestionnaire(seed: number) {
  rand = seedrandom(String(seed));
  qo = makeEmptyQO();
}

function getRand(): PRNG {
  if (!rand) rand = seedrandom('0');
  return rand;
}

// ---------- score helpers ----------
export function getUpScore(): number {
  switch (qo.qType.id) {
    case Q_TYPE.NOTSPECIAL.id:   return Q_TYPE.NOTSPECIAL.score * qo.level;
    case Q_TYPE.SURANAME.id:     return Q_TYPE.SURANAME.score;
    case Q_TYPE.SURAAYACOUNT.id: return Q_TYPE.SURAAYACOUNT.score;
    case Q_TYPE.MAKKI.id:        return Q_TYPE.MAKKI.score;
    case Q_TYPE.AYANUMBER.id:    return Q_TYPE.AYANUMBER.score;
    default: return 0;
  }
}
export function getDownScore(): number {
  return qo.qType.id === Q_TYPE.NOTSPECIAL.id ? Q_TYPE.NOTSPECIAL.score * qo.level : 0;
}

// ---------- helpers ----------
function fillIncorrectRandomNonZeroIdx(correctIdx: number, mod: number) {
  const rndIdx = [-1, 1, 0, 5, -4];
  const perm = randperm(5);
  const base = mod + correctIdx - rndIdx[perm[0]];
  for (let i = 1; i < 5; i++) {
    if ((correctIdx + rndIdx[perm[i]]) === rndIdx[perm[0]]) rndIdx[i] = 2;
  }
  for (let i = 1; i < 5; i++) {
    qo.op[0][i] = (base + rndIdx[perm[i]]) % mod;
  }
}

function fillIncorrectRandomIdx(correctIdx: number, mod: number) {
  const rndIdx = [-1, 1, 0, 5, -4];
  const perm = randperm(5);
  const base = mod + correctIdx - rndIdx[perm[0]];
  for (let i = 1; i < 5; i++) {
    qo.op[0][i] = (base + rndIdx[perm[i]]) % mod;
  }
}

async function extraQLength(
  start: number, qLen: number, long_q: boolean, direction: number,
): Promise<{ start: number; qLen: number }> {
  let extra = 0;
  let q_sim3cnt = 1;
  const dir = long_q ? 1 : direction;
  let idx = start;
  while (q_sim3cnt > 0) {
    q_sim3cnt = await idb.sim3cnt(idx);
    if (q_sim3cnt > 0) extra++;
    idx += dir;
  }
  extra += 3 - qLen;
  if (long_q) {
    return { start, qLen: qLen + extra++ };
  }
  return { start: start + dir * extra++, qLen };
}

async function getValidStartNear(start: number): Promise<void> {
  let dir = 1;
  let shadow = start - dir;
  let searching = true;
  while (searching) {
    shadow += dir;
    if (shadow === 0 || shadow === QURAN_WORDS - 1) {
      shadow = start;
      dir = -dir;
      continue;
    }
    if (qo.level === 0) {
      qo.validCount = 1;
      qo.qLen = 3;
      qo.oLen = 2;
      const isStart = await idb.isAyaStart(shadow);
      searching = !isStart;
    } else {
      const s2 = await idb.sim2cnt(shadow);
      searching = s2 === 0;
      if (!searching) {
        if (qo.level === 1 || qo.level === 2) {
          qo.validCount = 1;
          qo.qLen = qo.level === 1 ? 3 : 2;
          qo.oLen = qo.level === 1 ? 2 : 1;
          const extra = await extraQLength(shadow, qo.qLen, false, 1);
          qo.qLen = extra.qLen;
          shadow = extra.start;
          searching = false;
        }
        // Level 3: non-unique answers (not fully ported — falls back to level 2 behavior)
      }
    }
  }
  qo.startIdx = shadow;
}

function fillCorrectOptions() {
  qo.op[0][0] = modQWords(qo.startIdx + qo.qLen);
  for (let k = 1; k < qo.rounds; k++) {
    qo.op[k][0] = modQWords(qo.op[k - 1][0] + qo.oLen);
  }
}

async function fillIncorrectOptions() {
  for (let i = 0; i < 10; i++) {
    const lastCorrect = qo.op[i][0] - 1;
    const diffList = await idb.uniqueSim1Not2Plus1(lastCorrect);
    const uniq = diffList.length;
    if (uniq > 3) {
      const perm = randperm(uniq);
      for (let j = 1; j < 5; j++) {
        qo.op[i][j] = diffList[perm[j - 1]];
      }
    } else {
      const randList = await idb.randomUnique4NotMatching(qo.op[i][0]);
      if (uniq > 0) {
        const perm = randperm(uniq);
        for (let j = 1; j < uniq + 1; j++) qo.op[i][j] = diffList[perm[j - 1]];
        for (let j = uniq + 1; j < 5; j++) qo.op[i][j] = randList.set[j - uniq - 1] ?? j;
      } else {
        for (let j = 1; j < 5; j++) qo.op[i][j] = randList.set[j - 1] ?? j;
      }
    }
  }
}

async function fillText() {
  const words = await idb.txt(qo.startIdx, ANSWER_LENGTH, 'ayaMark');
  qo.txt.question = words.slice(0, qo.qLen).join(' ');
  qo.txt.answer   = words.slice(0, ANSWER_LENGTH).join(' ');

  if (qo.qType.id === Q_TYPE.NOTSPECIAL.id) {
    const ids: number[] = [];
    for (let k = 0; k < qo.rounds; k++) {
      for (let l = 0; l < 5; l++) {
        for (let m = 0; m < qo.oLen; m++) {
          ids.push(modQWords(qo.op[k][l] + m));
        }
      }
    }
    const texts = await idb.txts(ids);
    for (let k = 0; k < qo.rounds; k++) {
      for (let l = 0; l < 5; l++) {
        qo.txt.op[k][l] = texts
          .slice((5 * k + l) * qo.oLen, (5 * k + l + 1) * qo.oLen)
          .join(' ');
      }
    }
  } else if (qo.qType.id === Q_TYPE.SURANAME.id) {
    for (let l = 0; l < 5; l++) qo.txt.op[0][l] = 'سورة ' + SURA_NAME[qo.op[0][l]];
  } else if (qo.qType.id === Q_TYPE.SURAAYACOUNT.id) {
    for (let l = 0; l < 5; l++) qo.txt.op[0][l] = 'ايات السورة ' + qo.op[0][l];
  } else if (qo.qType.id === Q_TYPE.AYANUMBER.id) {
    for (let l = 0; l < 5; l++) qo.txt.op[0][l] = 'رقم الاية ' + qo.op[0][l];
  }
}

// ---------- createNormalQ ----------
export async function createNormalQ(
  start: number,
  profileSparsePoint: (n: number) => { idx: number; part: number },
  profileTotalStudy: () => number,
  profileLevel: number,
  forcedLevel?: number,
): Promise<void> {
  qo = makeEmptyQO();
  qo.rounds = 10;
  qo.qType = Q_TYPE.NOTSPECIAL;
  qo.level = forcedLevel !== undefined ? forcedLevel : profileLevel;

  let sparsed: { idx: number; part: number };
  if (start < 0) {
    const total = profileTotalStudy();
    sparsed = profileSparsePoint((Math.abs(getRand().int32()) % total) + 1);
  } else {
    sparsed = { idx: start, part: getSuraIdx(start) };
  }
  qo.currentPart = sparsed.part;

  await getValidStartNear(sparsed.idx);
  fillCorrectOptions();
  await fillIncorrectOptions();
  await fillText();
}

// ---------- createSpecialQ ----------
export async function createSpecialQ(
  profileSparsePoint: (n: number) => { idx: number; part: number },
  profileTotalStudy: () => number,
  profileLevel: number,
  isSurasEligible: boolean,
): Promise<void> {
  qo = makeEmptyQO();
  qo.rounds = 1;
  qo.level = profileLevel;

  // Pick question type
  if (isSurasEligible) {
    const r = Math.random();
    if (r > 0.5)      qo.qType = Q_TYPE.SURANAME;
    else if (r > 0.3) qo.qType = Q_TYPE.SURAAYACOUNT;
    else              qo.qType = Q_TYPE.AYANUMBER;
  } else {
    qo.qType = Q_TYPE.AYANUMBER;
  }

  const total = profileTotalStudy();
  const sparsed = profileSparsePoint((Math.abs(getRand().int32()) % total) + 1);
  qo.currentPart = sparsed.part;

  await getValidStartNear(sparsed.idx);

  qo.validCount = 1;
  qo.qLen = profileLevel === 1 ? 3 : 2;
  qo.oLen = 1;

  if (qo.qType.id === Q_TYPE.SURANAME.id) {
    qo.op[0][0] = getSuraIdx(qo.startIdx);
    fillIncorrectRandomIdx(qo.op[0][0], 114);
  } else if (qo.qType.id === Q_TYPE.SURAAYACOUNT.id) {
    qo.op[0][0] = SURA_AYAS[getSuraIdx(qo.startIdx)];
    fillIncorrectRandomNonZeroIdx(qo.op[0][0], 50);
  } else {
    const aya = await idb.ayaNumberOf(qo.startIdx);
    qo.op[0][0] = aya;
    fillIncorrectRandomNonZeroIdx(qo.op[0][0], 50);
  }

  await fillText();
}

// ---------- createNextQ (main entry point) ----------
export async function createNextQ(
  start: number | undefined,
  profileSparsePoint: (n: number) => { idx: number; part: number },
  profileTotalStudy: () => number,
  profileLevel: number,
  specialEnabled: boolean,
  isSurasEligible: boolean,
): Promise<void> {
  const isSpecial = specialEnabled && selectSpecial(profileLevel, isSurasEligible);
  if (isSpecial) {
    return createSpecialQ(profileSparsePoint, profileTotalStudy, profileLevel, isSurasEligible);
  }
  return createNormalQ(
    start !== undefined && isFinite(start) && start > 0 ? start : -1,
    profileSparsePoint, profileTotalStudy, profileLevel,
  );
}

function selectSpecial(level: number, isSurasEligible: boolean): boolean {
  if (level === 0) return false;
  return Math.random() < (isSurasEligible ? 0.2 : 0.05);
}

// ---------- daily quiz ----------
export function initDailyQuiz(
  dailyRandom: number,
  parts: Array<{ start: number; length: number }>,
  weights: number[],
) {
  if (isNaN(dailyRandom)) dailyRandom = 100;
  dailyStarts = [];
  dailyIndex = 0;
  pendingDailyStart = true;
  for (let i = 1; i < weights.length; i++) {
    const partLength = parts[i]?.length ?? 0;
    const partStart  = parts[i]?.start ?? 0;
    for (let j = 0; j < weights[i]; j++) {
      const offset = Math.round(DAILYQUIZ_QPERPART_DIST[j] * partLength + dailyRandom) % partLength;
      dailyStarts.push(partStart + offset);
    }
  }
}

export function hasNextDailyQ(): boolean {
  return dailyIndex <= 9;
}

export async function createNextDailyQ(
  profileSparsePoint: (n: number) => { idx: number; part: number },
  profileTotalStudy: () => number,
  profileLevel: number,
): Promise<boolean> {
  if (dailyIndex > 9) return false;
  await createNormalQ(dailyStarts[dailyIndex++], profileSparsePoint, profileTotalStudy, profileLevel, 1);
  return true;
}
