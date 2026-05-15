import { createNormalQ } from '../questionnaire';
import * as db from '../database';

jest.mock('../database', () => ({
  getTxt: jest.fn().mockResolvedValue(['word']),
  getTxts: jest.fn().mockResolvedValue(['opt1', 'opt2', 'opt3', 'opt4']),
  getUniqueSim1Not2Plus1: jest.fn().mockResolvedValue([1, 2, 3, 4]),
}));

describe('Questionnaire Service', () => {
  test('createNormalQ returns 10 rounds', async () => {
    const quiz = await createNormalQ(100);
    expect(quiz.rounds.length).toBe(10);
    expect(quiz.rounds[0]).toHaveProperty('question');
    expect(quiz.rounds[0]).toHaveProperty('options');
    expect(quiz.rounds[0].options.length).toBe(5);
    expect(quiz.rounds[0]).toHaveProperty('correctIndex');
  });
});
