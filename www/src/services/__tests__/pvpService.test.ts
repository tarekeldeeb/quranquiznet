// PvP service invariants:
//   #1 Determinism — the whole live-1v1 design rests on two clients deriving
//      the identical match from {seed, level, scope}, so plans and bot
//      timelines must be pure functions of the seed.
//   #2 The bot race is consistent — progress folded from the timeline must
//      end exactly at the precomputed final result.
//   #3 Outcome ranking — correct count first, speed as tiebreak.

import {
  PVP_QUESTIONS, PVP_ROUNDS, MIN_SCOPE_WORDS, QUEUE_FRESHNESS_MS,
  scopeFromParts, makeMatchPlan, makeBotTimeline, botProgressAt, decideOutcome,
  intersectScope, totalScopeWords, isCompatibleCandidate, mayClaim,
  MatchScopePart, PvpQueueEntry,
} from '../pvpService';
import type { StudyPart } from '../../stores/profileStore';

function part(start: number, length: number, checked: boolean): StudyPart {
  return {
    start, length, checked,
    numCorrect: [0, 0, 0, 0, 0], numQuestions: [0, 0, 0, 0, 0], name: 'p',
  };
}

const SCOPE: MatchScopePart[] = [
  { start: 1, length: 29, partIndex: 0 },       // Al-Fatiha
  { start: 71997, length: 5881, partIndex: 49 }, // Juz 'Amma
];

describe('scopeFromParts', () => {
  it('keeps only checked, non-empty parts with their profile indices', () => {
    const parts = [part(1, 29, true), part(30, 100, false), part(130, 0, true), part(200, 50, true)];
    expect(scopeFromParts(parts)).toEqual([
      { start: 1, length: 29, partIndex: 0 },
      { start: 200, length: 50, partIndex: 3 },
    ]);
  });
});

describe('makeMatchPlan', () => {
  it('is deterministic for the same seed and differs across seeds', () => {
    const a = makeMatchPlan(12345, 1, SCOPE);
    const b = makeMatchPlan(12345, 1, SCOPE);
    const c = makeMatchPlan(54321, 1, SCOPE);
    expect(a.starts).toEqual(b.starts);
    expect(a.starts).not.toEqual(c.starts);
  });

  it('produces PVP_QUESTIONS starts, all inside the scope ranges', () => {
    const { starts } = makeMatchPlan(777, 1, SCOPE);
    expect(starts).toHaveLength(PVP_QUESTIONS);
    for (const s of starts) {
      const inside = SCOPE.some((p) => s >= p.start && s < p.start + p.length);
      expect(inside).toBe(true);
    }
  });
});

describe('makeBotTimeline / botProgressAt', () => {
  it('is deterministic for the same seed', () => {
    const a = makeBotTimeline(999, 0.7);
    const b = makeBotTimeline(999, 0.7);
    expect(a.events).toEqual(b.events);
    expect(a.final).toEqual(b.final);
  });

  it('progress starts empty and converges exactly to the final result', () => {
    const tl = makeBotTimeline(42, 0.6);
    const atStart = botProgressAt(tl, 0);
    expect(atStart.qIndex).toBe(0);
    expect(atStart.correct).toBe(0);
    expect(atStart.finished).toBe(false);

    const atEnd = botProgressAt(tl, Number.MAX_SAFE_INTEGER);
    expect(atEnd.finished).toBe(true);
    expect(atEnd.qIndex).toBe(PVP_QUESTIONS);
    expect(atEnd.correct).toBe(tl.final.correct);
    expect(atEnd.results.every((r) => r !== null)).toBe(true);
    expect(atEnd.results.filter((r) => r === true)).toHaveLength(tl.final.correct);
  });

  it('progress is monotonic over time', () => {
    const tl = makeBotTimeline(7, 0.5);
    let prevQ = 0;
    let prevCorrect = 0;
    for (let t = 0; t <= tl.final.timeMs + 1000; t += 1000) {
      const p = botProgressAt(tl, t);
      expect(p.qIndex).toBeGreaterThanOrEqual(prevQ);
      expect(p.correct).toBeGreaterThanOrEqual(prevCorrect);
      prevQ = p.qIndex;
      prevCorrect = p.correct;
    }
  });

  it('a question is only correct when all rounds pass', () => {
    const tl = makeBotTimeline(1234, 0.8);
    const wins = tl.events.filter((e) => e.correct && e.round === PVP_ROUNDS - 1).length;
    expect(wins).toBe(tl.final.correct);
  });

  it('an unknown player accuracy (0) still yields a playable bot', () => {
    const tl = makeBotTimeline(5, 0);
    expect(tl.final.correct).toBeGreaterThanOrEqual(0);
    expect(tl.final.correct).toBeLessThanOrEqual(PVP_QUESTIONS);
    expect(tl.final.timeMs).toBeGreaterThan(0);
  });
});

describe('decideOutcome', () => {
  it('more correct answers win regardless of time', () => {
    expect(decideOutcome({ correct: 7, timeMs: 90_000 }, { correct: 6, timeMs: 10_000 })).toBe('win');
    expect(decideOutcome({ correct: 3, timeMs: 10_000 }, { correct: 6, timeMs: 90_000 })).toBe('loss');
  });
  it('equal scores tie-break on speed', () => {
    expect(decideOutcome({ correct: 5, timeMs: 60_000 }, { correct: 5, timeMs: 70_000 })).toBe('win');
    expect(decideOutcome({ correct: 5, timeMs: 70_000 }, { correct: 5, timeMs: 60_000 })).toBe('loss');
  });
  it('identical score and time is a draw', () => {
    expect(decideOutcome({ correct: 5, timeMs: 60_000 }, { correct: 5, timeMs: 60_000 })).toBe('draw');
  });
});

// ─── Live matchmaking (Phase 2) ────────────────────────────────────────────────

function queueEntry(overrides: Partial<PvpQueueEntry> = {}): PvpQueueEntry {
  return {
    name: 'صديق', level: 1, scope: SCOPE, ts: Date.now(), matchId: null,
    ...overrides,
  };
}

describe('intersectScope / totalScopeWords', () => {
  it('keeps only parts present in both scopes, by partIndex', () => {
    const mine: MatchScopePart[] = [
      { start: 1, length: 29, partIndex: 0 },
      { start: 100, length: 200, partIndex: 5 },
    ];
    const theirs: MatchScopePart[] = [
      { start: 1, length: 29, partIndex: 0 },
      { start: 900, length: 400, partIndex: 9 },
    ];
    expect(intersectScope(mine, theirs)).toEqual([{ start: 1, length: 29, partIndex: 0 }]);
  });

  it('totals the word length across a scope', () => {
    expect(totalScopeWords(SCOPE)).toBe(29 + 5881);
    expect(totalScopeWords([])).toBe(0);
  });
});

describe('isCompatibleCandidate', () => {
  const mine = { level: 1, scope: SCOPE };
  const now = Date.now();

  it('rejects a candidate already claimed by someone else', () => {
    const c = queueEntry({ matchId: 'm1', ts: now });
    expect(isCompatibleCandidate(mine, c, now)).toBe(false);
  });

  it('rejects a different level', () => {
    const c = queueEntry({ level: 2, ts: now });
    expect(isCompatibleCandidate(mine, c, now)).toBe(false);
  });

  it('rejects a stale queue entry', () => {
    const c = queueEntry({ ts: now - QUEUE_FRESHNESS_MS - 1 });
    expect(isCompatibleCandidate(mine, c, now)).toBe(false);
  });

  it('rejects too little scope overlap', () => {
    const c = queueEntry({ ts: now, scope: [{ start: 1, length: MIN_SCOPE_WORDS - 1, partIndex: 0 }] });
    expect(isCompatibleCandidate(mine, c, now)).toBe(false);
  });

  it('accepts a fresh, same-level candidate with enough overlap', () => {
    const c = queueEntry({ ts: now });
    expect(isCompatibleCandidate(mine, c, now)).toBe(true);
  });
});

describe('mayClaim', () => {
  it('may claim an entry strictly older than mine', () => {
    expect(mayClaim({ ts: 1000, uid: 'a' }, { ts: 500, uid: 'b' })).toBe(true);
    expect(mayClaim({ ts: 500, uid: 'a' }, { ts: 1000, uid: 'b' })).toBe(false);
  });

  it('breaks a timestamp tie on uid so exactly one direction is legal', () => {
    expect(mayClaim({ ts: 1000, uid: 'b' }, { ts: 1000, uid: 'a' })).toBe(true);
    expect(mayClaim({ ts: 1000, uid: 'a' }, { ts: 1000, uid: 'b' })).toBe(false);
  });
});
