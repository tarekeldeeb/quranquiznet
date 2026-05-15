import * as db from './database';
import { randperm, modQWords } from '../utils/quran';

export const QuestionType = {
  NOTSPECIAL: 1,
  SURANAME: 2,
  AYANUMBER: 5,
};

export async function createNormalQ(startIdx: number) {
  let currentIdx = startIdx;
  
  if (currentIdx < 0) {
    currentIdx = Math.floor(Math.random() * 77878);
  }

  const rounds: any[] = [];
  let roundIdx = currentIdx;

  for (let r = 0; r < 10; r++) {
    const correctIdx = modQWords(roundIdx + 3);
    const correctTxt = (await db.getTxt(correctIdx, 1))[0];
    
    let options = [correctTxt];
    const simList = await db.getUniqueSim1Not2Plus1(correctIdx - 1);
    
    if (simList.length >= 4) {
      const perm = randperm(simList.length);
      const simTxts = await db.getTxts(perm.slice(0, 4).map(i => simList[i]));
      options = [...options, ...simTxts];
    } else {
      for (let i = 0; i < 4; i++) {
        const randIdx = Math.floor(Math.random() * 77878);
        const randTxt = (await db.getTxt(randIdx, 1))[0];
        options.push(randTxt);
      }
    }

    const finalOptions = options.slice(0, 5);
    const perm = randperm(5);
    const shuffledOptions = perm.map(i => finalOptions[i]);
    const correctPos = perm.indexOf(0);

    const questionTxt = (await db.getTxt(roundIdx, 3)).join(' ');

    rounds.push({
      question: questionTxt,
      options: shuffledOptions,
      correctIndex: correctPos,
    });

    roundIdx = modQWords(correctIdx + 1);
  }

  return {
    rounds,
    type: QuestionType.NOTSPECIAL,
  };
}
