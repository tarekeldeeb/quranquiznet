// Profile store — mirrors www/_model_/profile.js
// Persisted via AsyncStorage (replaces localStorage).

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SURA_IDX, SURA_NAME, LAST5_JUZ_IDX, LAST5_JUZ_NAME,
  QURAN_WORDS, JUZ2_AVG_WORDS, PART_WEIGHT_100,
  DAILYQUIZ_PARTS_COUNT, DAILYQUIZ_QPERPART_COUNT,
  DAILYQUIZ_MAXTIME, DAILYQUIZ_MINTIME,
  countedScore,
} from '../models/constants';

export interface StudyPart {
  start: number;
  length: number;
  numCorrect: [number, number, number, number];
  numQuestions: [number, number, number, number];
  name: string;
  checked: boolean;
}

export interface ScoreRecord {
  date: number;
  score: number;
}

export interface ProfileSocial {
  uid?: string;
  displayName?: string;
  photoURL?: string;
  email?: string;
  isAnonymous?: boolean;
}

export interface ProfileVersion {
  db: number;
  app: number;
  profile: number;
}

export interface QORef {
  level: number;
  qType: { id: number; score: number };
  currentPart: number;
  startIdx: number;
}

export const CORRECT_RATIO_RANGE = {
  EMPTY: 0,
  HIGH: 1,
  MID: 2,
  LOW: 3,
} as const;

function makeDefaultParts(): StudyPart[] {
  const parts: StudyPart[] = [];
  // First part: Al-Fatiha (full first sura)
  parts.push({
    start: 1,
    length: SURA_IDX[0],
    numCorrect: [0, 0, 0, 0],
    numQuestions: [0, 0, 0, 0],
    name: 'سورة ' + SURA_NAME[0],
    checked: true,
  });
  // Suras 1-44 (index 1..44)
  for (let i = 1; i < 45; i++) {
    parts.push({
      start: SURA_IDX[i - 1],
      length: SURA_IDX[i] - SURA_IDX[i - 1],
      numCorrect: [0, 0, 0, 0],
      numQuestions: [0, 0, 0, 0],
      name: 'سورة ' + SURA_NAME[i],
      checked: false,
    });
  }
  // Last 5 juz
  for (let i = 0; i < 5; i++) {
    parts.push({
      start: LAST5_JUZ_IDX[i],
      length: LAST5_JUZ_IDX[i + 1] - LAST5_JUZ_IDX[i],
      numCorrect: [0, 0, 0, 0],
      numQuestions: [0, 0, 0, 0],
      name: 'جزء ' + LAST5_JUZ_NAME[i],
      checked: false,
    });
  }
  parts[49].checked = true; // Juz 'Amma (last juz)
  return parts;
}

function calculatePartScore(p: StudyPart): number {
  return (
    p.numCorrect[0] +
    (2 * p.numCorrect[1] - p.numQuestions[1]) * 10 +
    (2 * p.numCorrect[2] - p.numQuestions[2]) * 20 +
    (2 * p.numCorrect[3] - p.numQuestions[3]) * 30
  );
}

function getCorrectRatio(p: StudyPart): number {
  const correct = p.numCorrect[1] + p.numCorrect[2] + p.numCorrect[3];
  const questions = p.numQuestions[1] + p.numQuestions[2] + p.numQuestions[3];
  return questions === 0 ? 0 : correct / questions;
}

interface ProfileState {
  // Data
  uid: string;
  lastUpdate: number;
  lastSync: number;
  lastSeed: number;
  level: number;
  specialEnabled: boolean;
  scores: ScoreRecord[];
  parts: StudyPart[];
  social: ProfileSocial;
  version: ProfileVersion;
  loaded: boolean;
  streak: number;
  lastPlayDate: string;
  lastDailyCompletedDate: string;   // 'YYYY-MM-DD' of the last completed daily quiz
  country: string;                  // 2-letter ISO country code detected from IP (not persisted)

  // Actions
  load(): Promise<boolean>;
  saveAll(): Promise<void>;
  saveParts(): Promise<void>;
  saveSettings(): Promise<void>;
  reset(): Promise<void>;
  delete(): Promise<void>;
  setSocial(social: ProfileSocial): Promise<void>;
  setLastSeed(seed: number): void;
  addCorrect(qo: QORef): Promise<void>;
  addIncorrect(qo: QORef): Promise<void>;
  recordPlay(): void;
  markDailyCompleted(): void;
  setCountry(code: string): void;

  // Computed getters (call these as functions)
  getScore(): number;
  getTotalStudyLength(): number;
  getTotalCorrect(): number;
  getPercentTotalStudy(): string;
  getPercentTotalRatio(): string;
  getSparsePoint(cntTot: number): { idx: number; part: number };
  getCorrectRatioRange(i: number): number;
  isSurasSpecialQuestionEligible(): boolean;
  getDailyQuizStudyPartsWeights(): number[];
  getDailyQuizScore(correct: number, time: number): number;
  getTopGoodParts(): string[];
  getTopBadParts(): string[];
  getPartIndexOf(wordIdx: number): number;
  updateScoreRecord(): boolean;
  syncTo(remote: Partial<ProfileState>): Promise<void>;

  levels: { value: number; text: string; comment: string; disabled: boolean }[];
}

const KEYS = {
  uid: 'prf_uid',
  lastUpdate: 'prf_lastUpdate',
  lastSync: 'prf_lastSync',
  lastSeed: 'prf_lastSeed',
  level: 'prf_level',
  specialEnabled: 'prf_specialEnabled',
  scores: 'prf_scores',
  parts: 'prf_parts',
  version: 'prf_version',
  social: 'prf_social',
  streak: 'prf_streak',
  lastPlayDate: 'prf_lastPlayDate',
  lastDailyCompletedDate: 'prf_lastDailyDate',
};

async function saveKey(key: string, value: unknown) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}
async function loadKey<T>(key: string, def: T): Promise<T> {
  const v = await AsyncStorage.getItem(key);
  if (v === null) return def;
  try { return JSON.parse(v) as T; } catch { return def; }
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  uid: '0',
  lastUpdate: 0,
  lastSync: 0,
  lastSeed: 0,
  level: 1,
  specialEnabled: false,
  scores: [{ date: Date.now(), score: 0 }],
  parts: [],
  social: {},
  version: { db: 1.0, app: 2.0, profile: 1.0 },
  loaded: false,
  streak: 0,
  lastPlayDate: '',
  lastDailyCompletedDate: '',
  country: '',

  levels: [
    { value: 0, text: 'مستوى ابتدائي', comment: 'يبدأ السؤال من رأس الاية، ولا يزيد النقاط', disabled: false },
    { value: 1, text: 'مستوى أولي',   comment: 'السؤال من ثلاث كلمات، يزيد النقاط بعشرة', disabled: false },
    { value: 2, text: 'مستوى ثانوي',  comment: 'السؤال من كلمتين، يزيد النقاط بعشرين', disabled: false },
    { value: 3, text: 'مستوى متقدم',  comment: 'أكثر من اجابة صحيحة، يزيد النقاط بثلاثين', disabled: true },
  ],

  async load() {
    const uid = await loadKey<string>(KEYS.uid, '-1');
    if (uid === '-1') {
      const parts = makeDefaultParts();
      const seed = Math.floor(Math.random() * (QURAN_WORDS - 1));
      set({ parts, lastSeed: seed, loaded: true });
      await get().saveAll();
      return false;
    }
    const [lastUpdate, lastSync, lastSeed, level, specialEnabled, scores, parts, version, social, streak, lastPlayDate, lastDailyCompletedDate] =
      await Promise.all([
        loadKey<number>(KEYS.lastUpdate, 0),
        loadKey<number>(KEYS.lastSync, 0),
        loadKey<number>(KEYS.lastSeed, 0),
        loadKey<number>(KEYS.level, 1),
        loadKey<boolean>(KEYS.specialEnabled, false),
        loadKey<ScoreRecord[]>(KEYS.scores, [{ date: Date.now(), score: 0 }]),
        loadKey<StudyPart[]>(KEYS.parts, makeDefaultParts()),
        loadKey<ProfileVersion>(KEYS.version, { db: 1, app: 2, profile: 1 }),
        loadKey<ProfileSocial>(KEYS.social, {}),
        loadKey<number>(KEYS.streak, 0),
        loadKey<string>(KEYS.lastPlayDate, ''),
        loadKey<string>(KEYS.lastDailyCompletedDate, ''),
      ]);
    set({ uid, lastUpdate, lastSync, lastSeed, level, specialEnabled, scores, parts, version, social, streak, lastPlayDate, lastDailyCompletedDate, loaded: true });
    return true;
  },

  async saveAll() {
    const s = get();
    await AsyncStorage.multiSet([
      [KEYS.uid,            JSON.stringify(s.uid)],
      [KEYS.lastUpdate,     JSON.stringify(s.lastUpdate)],
      [KEYS.lastSync,       JSON.stringify(s.lastSync)],
      [KEYS.lastSeed,       JSON.stringify(s.lastSeed)],
      [KEYS.level,          JSON.stringify(s.level)],
      [KEYS.specialEnabled, JSON.stringify(s.specialEnabled)],
      [KEYS.scores,         JSON.stringify(s.scores)],
      [KEYS.parts,          JSON.stringify(s.parts)],
      [KEYS.version,        JSON.stringify(s.version)],
      [KEYS.social,         JSON.stringify(s.social)],
      [KEYS.streak,                    JSON.stringify(s.streak)],
      [KEYS.lastPlayDate,              JSON.stringify(s.lastPlayDate)],
      [KEYS.lastDailyCompletedDate,     JSON.stringify(s.lastDailyCompletedDate)],
    ]);
  },

  async saveParts() {
    await saveKey(KEYS.parts, get().parts);
  },

  async saveSettings() {
    await Promise.all([
      saveKey(KEYS.level, get().level),
      saveKey(KEYS.specialEnabled, get().specialEnabled),
    ]);
  },

  async reset() {
    const parts = makeDefaultParts();
    const seed = Math.floor(Math.random() * (QURAN_WORDS - 1));
    set({ parts, lastSeed: seed, scores: [{ date: Date.now(), score: 0 }] });
    await get().saveAll();
  },

  async delete() {
    await AsyncStorage.multiRemove(Object.values(KEYS));
    set({
      uid: '0',
      lastUpdate: 0, lastSync: 0, lastSeed: 0,
      level: 1, specialEnabled: false,
      scores: [{ date: Date.now(), score: 0 }],
      parts: [],
      social: {},
      streak: 0, lastPlayDate: '',
      lastDailyCompletedDate: '',
      loaded: false,
    });
  },

  async setSocial(social: ProfileSocial) {
    set({ social, uid: social.uid ?? get().uid });
    await Promise.all([saveKey(KEYS.social, social), saveKey(KEYS.uid, get().uid)]);
  },

  setLastSeed(seed: number) {
    set({ lastSeed: seed });
    saveKey(KEYS.lastSeed, seed);
  },

  recordPlay() {
    const today = new Date().toISOString().split('T')[0];
    const { lastPlayDate, streak } = get();
    if (lastPlayDate === today) return;
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const newStreak = lastPlayDate === yesterday ? streak + 1 : 1;
    set({ streak: newStreak, lastPlayDate: today });
    saveKey(KEYS.streak, newStreak);
    saveKey(KEYS.lastPlayDate, today);
  },

  markDailyCompleted() {
    const today = new Date().toISOString().split('T')[0];
    set({ lastDailyCompletedDate: today });
    saveKey(KEYS.lastDailyCompletedDate, today);
  },

  setCountry(code: string) {
    set({ country: code });
  },

  async addCorrect(qo: QORef) {
    const cp = qo.currentPart;
    const oldParts = get().parts;
    if (cp < oldParts.length && qo.level > 0) {
      const p = oldParts[cp];
      const nc = [...p.numCorrect] as [number, number, number, number];
      const nq = [...p.numQuestions] as [number, number, number, number];
      if (qo.qType.id > 1) {
        nc[0] += qo.qType.score;
        nq[0] += 1;
      } else {
        nc[qo.level] += 1;
        nq[qo.level] += 1;
      }
      const now = Date.now();
      const parts = oldParts.map((x, i) =>
        i === cp ? { ...x, numCorrect: nc, numQuestions: nq } : x,
      );
      set({ parts, lastUpdate: now });
      await Promise.all([
        saveKey(KEYS.parts, parts),
        saveKey(KEYS.lastUpdate, now),
      ]);
    }
  },

  async addIncorrect(qo: QORef) {
    const cp = qo.currentPart;
    const oldParts = get().parts;
    if (cp < oldParts.length && qo.level > 0) {
      const p = oldParts[cp];
      const nq = [...p.numQuestions] as [number, number, number, number];
      if (qo.qType.id > 1) {
        nq[0] += 1;
      } else {
        nq[qo.level] += 1;
      }
      const now = Date.now();
      const parts = oldParts.map((x, i) =>
        i === cp ? { ...x, numQuestions: nq } : x,
      );
      set({ parts, lastUpdate: now });
      await Promise.all([
        saveKey(KEYS.parts, parts),
        saveKey(KEYS.lastUpdate, now),
      ]);
    }
  },

  getScore() {
    // Matches the original profile.js: score may be negative (accuracy below 50%
    // subtracts). Do NOT clamp to 0 — that hid every decrease and made the score
    // appear permanently zero.
    return Math.round(get().parts.reduce((acc, p) => acc + calculatePartScore(p), 0));
  },

  getTotalStudyLength() {
    return get().parts.reduce((acc, p) => acc + (p.checked ? p.length : 0), 0);
  },

  getTotalCorrect() {
    return get().parts.reduce(
      (acc, p) => acc + (p.checked ? p.numCorrect.reduce((a, b) => a + b, 0) : 0), 0,
    );
  },

  getPercentTotalStudy() {
    const tot = get().parts.reduce(
      (acc, p) => acc + (p.numCorrect.reduce((a, b) => a + b, 0) > 0 ? p.length : 0), 0,
    );
    return Math.round((tot * 100) / QURAN_WORDS) + '%';
  },

  getPercentTotalRatio() {
    let totCorrect = 0, totQuestions = 0;
    for (const p of get().parts) {
      totCorrect  += p.numCorrect[1]  + p.numCorrect[2]  + p.numCorrect[3];
      totQuestions += p.numQuestions[1] + p.numQuestions[2] + p.numQuestions[3];
    }
    return Math.round(totQuestions === 0 ? 0 : (100 * totCorrect) / totQuestions) + '%';
  },

  getSparsePoint(cntTot: number) {
    const parts = get().parts;
    let length = 0;
    for (let i = 0; i < parts.length; i++) {
      const pLength = parts[i].checked ? parts[i].length : 0;
      if (cntTot < length + pLength) {
        return { idx: parts[i].start + cntTot - length, part: i };
      }
      length += pLength;
    }
    const last = parts.length - 1;
    return { idx: parts[last].start, part: last };
  },

  getCorrectRatioRange(i: number) {
    const p = get().parts[i];
    if (!p) return CORRECT_RATIO_RANGE.EMPTY;
    const questions = countedScore(p.numQuestions as unknown as number[]);
    if (questions === 0) return CORRECT_RATIO_RANGE.EMPTY;
    const ratio = getCorrectRatio(p);
    if (ratio >= 0.8) return CORRECT_RATIO_RANGE.HIGH;
    if (ratio >= 0.5) return CORRECT_RATIO_RANGE.MID;
    return CORRECT_RATIO_RANGE.LOW;
  },

  isSurasSpecialQuestionEligible() {
    const parts = get().parts;
    for (let i = parts.length - 1; i >= parts.length - 5; i--) {
      if (parts[i]?.checked) return true;
    }
    let s = 0;
    for (let j = parts.length - 6; j > 0; j--) {
      if (parts[j]?.checked) s++;
      if (s >= 7) return true;
    }
    return false;
  },

  getDailyQuizStudyPartsWeights() {
    const { parts } = get();
    const sparse: number[] = new Array(DAILYQUIZ_PARTS_COUNT).fill(0);
    const totalStudyLength = get().getTotalStudyLength();
    const totalStudyWeight = Math.ceil(totalStudyLength / JUZ2_AVG_WORDS);
    console.warn('[DAILY] getDailyQuizStudyPartsWeights: totalStudyLength=', totalStudyLength,
      'totalStudyWeight=', totalStudyWeight, 'checkedParts=',
      parts.filter(p => p.checked).map(p => p.name));
    let sum = 0;
    for (let i = 0; i < DAILYQUIZ_PARTS_COUNT; i++) {
      const qs = countedScore(parts[i]?.numQuestions as unknown as number[]);
      if (i === 0 || qs === 0 || !parts[i]?.checked) {
        if (i > 0 && parts[i]?.checked && qs === 0) {
          console.warn(`[DAILY] part[${i}] (${parts[i]?.name}) is checked but has 0 answered questions → weight=0`);
        }
        sparse[i] = 0;
      } else {
        const Wn = Math.ceil((DAILYQUIZ_QPERPART_COUNT * PART_WEIGHT_100[i]) / (totalStudyWeight * 100));
        sparse[i] = Wn > 0 ? Wn : 0;
      }
      sum += sparse[i];
    }
    console.warn('[DAILY] weights sum=', sum, '(0 means fallback to last juz)');
    if (sum === 0) {
      console.warn('[DAILY] WARNING: all weights are 0 — falling back to last part only');
      sparse[DAILYQUIZ_PARTS_COUNT - 1] = DAILYQUIZ_QPERPART_COUNT;
      return sparse;
    }
    const correction = DAILYQUIZ_QPERPART_COUNT - sum;
    if (correction !== 0) {
      for (let i = DAILYQUIZ_PARTS_COUNT - 1; i >= 0; i--) {
        if (sparse[i] !== 0) { sparse[i] += correction; break; }
      }
    }
    return sparse;
  },

  getDailyQuizScore(correct: number, time: number) {
    let score = 10 * correct;
    score -= 5 * (time - DAILYQUIZ_MINTIME) / (DAILYQUIZ_MAXTIME - DAILYQUIZ_MINTIME);
    score -= 5 * (1 - get().getTotalStudyLength() / QURAN_WORDS);
    score = Math.min(Math.max(score, 0), 100);
    return parseFloat(score.toFixed(2));
  },

  getTopGoodParts() {
    const top = Array<string>(5).fill('-');
    const { parts } = get();
    Array.from({ length: 50 }, (_, i) => i)
      .map((i) => ({ i, ratio: getCorrectRatio(parts[i]), range: get().getCorrectRatioRange(i) }))
      .filter((o) => o.range === CORRECT_RATIO_RANGE.HIGH)
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 5)
      .forEach((o, i) => { top[i] = parts[o.i].name; });
    return top;
  },

  getTopBadParts() {
    const top = Array<string>(5).fill('-');
    const { parts } = get();
    Array.from({ length: 50 }, (_, i) => i)
      .map((i) => ({ i, ratio: getCorrectRatio(parts[i]), range: get().getCorrectRatioRange(i) }))
      .filter((o) => o.range === CORRECT_RATIO_RANGE.MID || o.range === CORRECT_RATIO_RANGE.LOW)
      .sort((a, b) => a.ratio - b.ratio)
      .slice(0, 5)
      .forEach((o, i) => { top[i] = parts[o.i].name; });
    return top;
  },

  getPartIndexOf(wordIdx: number): number {
    const { parts } = get();
    for (let i = 0; i < parts.length; i++) {
      if (wordIdx >= parts[i].start && wordIdx < parts[i].start + parts[i].length) {
        return i;
      }
    }
    return parts.length - 1;
  },

  updateScoreRecord() {
    const { scores } = get();
    const now = Date.now();
    const isOld = (t: number) => now - t > 86400000;
    if (scores.length === 0 || isOld(scores[scores.length - 1].date)) {
      const next = [...scores, { date: now, score: get().getScore() }];
      set({ scores: next });
      saveKey(KEYS.scores, next);
      return true;
    }
    return false;
  },

  async syncTo(remote) {
    if (!remote.uid || remote.uid !== get().uid) return;
    const remoteUpdate = (remote.lastUpdate ?? 0);
    const localUpdate = get().lastUpdate;
    // Only overwrite local if never synced, OR remote data is genuinely newer than local.
    // This prevents a session's quiz answers (saved locally) from being overwritten by
    // the older Firebase copy when the app restarts before the next push.
    if (get().lastSync === 0 || remoteUpdate > localUpdate) {
      const now = Date.now();
      set({
        lastUpdate: remoteUpdate, lastSync: now,
        lastSeed: remote.lastSeed ?? get().lastSeed,
        level: remote.level ?? get().level,
        specialEnabled: remote.specialEnabled ?? get().specialEnabled,
        scores: remote.scores ?? get().scores,
        parts: remote.parts ?? get().parts,
      });
      await get().saveAll();
    }
  },
}));
