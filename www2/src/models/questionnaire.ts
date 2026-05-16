import { randInt } from './utils';
import IDB from '../db/idb';

export type Question = {
  id: number;
  text: string;
  choices: string[];
  answerIndex: number;
};

export function generateSimpleQuestions(count = 10): Question[] {
  const qs: Question[] = [];
  for (let i = 0; i < count; i++) {
    const correct = randInt(1000).toString();
    const choices = [correct, randInt(1000).toString(), randInt(1000).toString(), randInt(1000).toString()];
    qs.push({ id: i + 1, text: `What is ${i + 1}?`, choices, answerIndex: 0 });
  }
  return qs;
}

export async function generateQuestionsFromStarts(starts: number[]): Promise<Question[]> {
  const qs: Question[] = [];
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const txts = await IDB.txt(start, 3, 'ayaMark');
    const text = txts.join(' ');
    const choices = [text, randInt(1000).toString(), randInt(1000).toString(), randInt(1000).toString()];
    qs.push({ id: i + 1, text: text, choices, answerIndex: 0 });
  }
  return qs;
}
