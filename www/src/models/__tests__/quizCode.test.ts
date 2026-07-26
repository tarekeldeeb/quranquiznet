import { quizCodeOf } from '../quizCode';

describe('quizCodeOf', () => {
  it('is deterministic (same uid yields same code)', () => {
    const uid = 'user_abc_12345';
    const code1 = quizCodeOf(uid);
    const code2 = quizCodeOf(uid);
    expect(code1).toBe(code2);
    expect(code1).toHaveLength(8);
    expect(code1).toMatch(/^[0-9A-Z]{8}$/);
  });

  it('produces different codes for different uids', () => {
    const sampleUids = [
      'uid_alpha_1',
      'uid_beta_2',
      'uid_gamma_3',
      'user_998877665544',
      'another_random_uid_xyz',
    ];
    const codes = new Set(sampleUids.map((uid) => quizCodeOf(uid)));
    expect(codes.size).toBe(sampleUids.length);
    for (const code of codes) {
      expect(code).toHaveLength(8);
      expect(code).toMatch(/^[0-9A-Z]{8}$/);
    }
  });

  it('handles empty string gracefully', () => {
    const code = quizCodeOf('');
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[0-9A-Z]{8}$/);
  });
});
