// Types for the questionnaire engine — mirrors the original qTypeEnum and qo object

export const Q_TYPE = {
  NOTSPECIAL:  { id: 1, score: 10, txt: 'اختر التكملة الصحيحة' },
  SURANAME:    { id: 2, score: 5,  txt: 'اختر اسم السورة' },
  SURAAYACOUNT:{ id: 3, score: 25, txt: 'اختر عدد ايات السورة' },
  MAKKI:       { id: 4, score: 15, txt: 'اختر بيان السورة' },
  AYANUMBER:   { id: 5, score: 35, txt: 'اختر رقم الاية' },
} as const;

export type QType = typeof Q_TYPE[keyof typeof Q_TYPE];

export interface QuestionObject {
  level: number;
  rounds: number;        // 10 for normal, 1 for special
  validCount: number;    // number of correct options in round 0
  op: number[][];        // [rounds][5] word indices; op[r][0] = correct for round r
  startIdx: number;      // word index where this question starts
  qLen: number;          // words shown in question prompt
  oLen: number;          // words per option
  qType: QType;
  currentPart: number;   // index into Profile.parts
  txt: {
    question: string;
    answer: string;
    op: string[][];      // [rounds][5] display text
  };
}

export function makeEmptyQO(): QuestionObject {
  const op: number[][] = Array.from({ length: 10 }, () => []);
  const txtOp: string[][] = Array.from({ length: 10 }, () => []);
  return {
    level: 1,
    rounds: 10,
    validCount: 1,
    op,
    startIdx: 1,
    qLen: 3,
    oLen: 2,
    qType: Q_TYPE.NOTSPECIAL,
    currentPart: 0,
    txt: { question: '', answer: '', op: txtOp },
  };
}
