jest.mock('../db/idb', () => ({
  txt: jest.fn(async (start: number, len: number) => Array.from({ length: len }, () => `word${start}`)),
  sim2cnt: jest.fn(async (idx: number) => (idx === 5 ? 1 : 0)),
  sim3cnt: jest.fn(async () => 0),
}));

jest.mock('../stores/profileStore', () => ({
  useProfileStore: {
    getState: () => ({
      getTotalStudyLength: () => 100,
      getSparsePoint: () => ({ idx: 5, part: 0 }),
    }),
  },
}));

import questionnaireService from '../services/questionnaireService';

describe('questionnaireService', () => {
  it('creates a question from profile with four choices', async () => {
    const question = await questionnaireService.createQuestionFromProfile();

    expect(question.text).toContain('word5');
    expect(question.choices).toHaveLength(4);
    expect(question.answerIndex).toBeGreaterThanOrEqual(0);
    expect(question.answerIndex).toBeLessThan(4);
  });

  it('creates a batch of questions', async () => {
    const questions = await questionnaireService.createNQuestionsFromProfile(3);
    expect(questions).toHaveLength(3);
    expect(questions.every(q => q.choices.length === 4)).toBe(true);
  });
});
