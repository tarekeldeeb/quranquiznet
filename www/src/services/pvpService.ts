// PvP service — deterministic match plans and the local virtual player («الحافظ»).
//
// Phase 1 (this file): offline matches against the bot. Everything runs on the
// client; no Firebase involved.
// Phase 2 (live 1v1 over RTDB) reuses MatchPlan unchanged: two clients that
// share {seed, level, scope} derive identical question sequences locally, so a
// match record never needs to carry question data.

import seedrandom from 'seedrandom';
import type { StudyPart } from '../stores/profileStore';

export const PVP_QUESTIONS = 10;
// Rounds per question. The full quiz runs 10 rounds per question, which makes a
// head-to-head match drag past 6 minutes — 3 keeps a match near 2 minutes.
export const PVP_ROUNDS = 3;
export const PVP_TIMER_FIRST = 12;  // seconds for a question's first round
export const PVP_TIMER_NEXT = 5;    // seconds for each later round
// How long an answered (flipped) card stays visible before auto-advancing.
export const PVP_ADVANCE_MS = 1600;

export const BOT_EMOJI = '🤖';

export type PvpOutcome = 'win' | 'loss' | 'draw';

export interface MatchScopePart {
  start: number;      // first word index of the part
  length: number;     // word count of the part
  partIndex: number;  // index into profile.parts (for stats attribution)
}

export interface MatchPlan {
  seed: number;
  level: number;
  starts: number[];   // PVP_QUESTIONS word indices, one per question
  scope: MatchScopePart[];
}

/** Checked study parts as a match scope. For a live match this becomes the
 *  intersection of both players' scopes; for a bot match it is the player's own. */
export function scopeFromParts(parts: StudyPart[]): MatchScopePart[] {
  return parts
    .map((p, partIndex) => ({ start: p.start, length: p.length, partIndex, checked: p.checked }))
    .filter((p) => p.checked && p.length > 0)
    .map(({ start, length, partIndex }) => ({ start, length, partIndex }));
}

/** Map an offset within the concatenated scope to an absolute word index. */
function wordAtScopeOffset(scope: MatchScopePart[], offset: number): number {
  let acc = 0;
  for (const p of scope) {
    if (offset < acc + p.length) return p.start + (offset - acc);
    acc += p.length;
  }
  return scope[scope.length - 1].start;
}

/**
 * Build a match plan: PVP_QUESTIONS deterministic question-start words drawn
 * uniformly across the scope. Same {seed, level, scope} ⇒ same plan on any client.
 */
export function makeMatchPlan(seed: number, level: number, scope: MatchScopePart[]): MatchPlan {
  const rng = seedrandom(`match:${seed}`);
  const totalLen = scope.reduce((acc, p) => acc + p.length, 0);
  const starts: number[] = [];
  for (let q = 0; q < PVP_QUESTIONS; q++) {
    starts.push(wordAtScopeOffset(scope, Math.floor(rng() * totalLen)));
  }
  return { seed, level, starts, scope };
}

export function newMatchSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

// ─── Virtual player («الحافظ») ────────────────────────────────────────────────
//
// The bot's whole match is precomputed as a timeline of round events at match
// start (deterministic from the seed). During play, the screen just folds the
// timeline against the elapsed wall clock — the race is real time, no reactivity.

export interface BotRoundEvent {
  t: number;        // ms since match start when this round gets answered
  qIndex: number;   // 0-based question index
  round: number;    // 0-based round within the question
  correct: boolean;
}

export interface BotProgress {
  qIndex: number;     // questions fully dealt with so far (answered or failed)
  correct: number;    // questions answered fully correctly
  roundsDone: number; // rounds completed within the current question
  finished: boolean;
  results: (boolean | null)[];  // per-question outcome; null = not reached yet
}

export interface BotTimeline {
  events: BotRoundEvent[];
  final: { correct: number; timeMs: number };
}

/**
 * Precompute the bot's match. `playerAccuracy` is the player's full-question
 * correct ratio in [0,1] (0 = no history). The bot targets slightly below the
 * player so the human wins a bit more often than not (~55–60%).
 */
export function makeBotTimeline(seed: number, playerAccuracy: number): BotTimeline {
  const rng = seedrandom(`bot:${seed}`);
  const pQuestion = playerAccuracy > 0
    ? Math.min(0.85, Math.max(0.35, playerAccuracy - 0.05))
    : 0.5;
  // The bot must clear every round to take the question.
  const pRound = pQuestion ** (1 / PVP_ROUNDS);

  const events: BotRoundEvent[] = [];
  let t = 1200 + rng() * 1500; // initial "reading" pause
  let correct = 0;

  for (let q = 0; q < PVP_QUESTIONS; q++) {
    let qCorrect = true;
    for (let round = 0; round < PVP_ROUNDS; round++) {
      t += (2000 + rng() * 4500); // human-like thinking time per round
      const ok = rng() < pRound;
      events.push({ t: Math.round(t), qIndex: q, round, correct: ok });
      if (!ok) { qCorrect = false; break; }
    }
    if (qCorrect) correct++;
    t += PVP_ADVANCE_MS; // mirrors the player's card-flip review pause
  }

  const last = events[events.length - 1];
  return { events, final: { correct, timeMs: last ? last.t : 0 } };
}

/** Bot progress at `elapsedMs` into the match. */
export function botProgressAt(timeline: BotTimeline, elapsedMs: number): BotProgress {
  const results: (boolean | null)[] = new Array(PVP_QUESTIONS).fill(null);
  let qIndex = 0;
  let correct = 0;
  let roundsDone = 0;
  for (const e of timeline.events) {
    if (e.t > elapsedMs) break;
    if (!e.correct) {
      results[e.qIndex] = false;
      qIndex = e.qIndex + 1;
      roundsDone = 0;
    } else if (e.round === PVP_ROUNDS - 1) {
      results[e.qIndex] = true;
      qIndex = e.qIndex + 1;
      correct++;
      roundsDone = 0;
    } else {
      roundsDone = e.round + 1;
    }
  }
  return { qIndex, correct, roundsDone, finished: qIndex >= PVP_QUESTIONS, results };
}

/** Compare two finished sides: more correct wins; equal correct is a draw.
 *  `timeMs` isn't used as a tiebreaker — it's a real wall-clock timestamp, so
 *  it's essentially never exactly equal between two independent finishes,
 *  which made a tied score resolve to a win/loss on a coin-flip-ish
 *  millisecond difference instead of the draw a tied score should be. */
export function decideOutcome(
  me: { correct: number; timeMs: number },
  opp: { correct: number; timeMs: number },
): PvpOutcome {
  if (me.correct !== opp.correct) return me.correct > opp.correct ? 'win' : 'loss';
  return 'draw';
}

// ─── Live matchmaking (Phase 2) ────────────────────────────────────────────────
//
// A live match reuses MatchPlan unchanged: two clients that agree on
// {seed, level, scope} derive identical questions locally, so RTDB only ever
// carries progress numbers, never question content. Matchmaking is client-driven
// (no server component) — see firebase.ts for the RTDB read/write helpers and
// pvp.tsx for the queue/claim/presence flow built on top of them.

/** Below this word count, two players' checked-part overlap is judged too thin to
 *  race on without repeating the same handful of questions — fall back to the bot. */
export const MIN_SCOPE_WORDS = 300;

/** A queue entry older than this is considered stale and ignored as a candidate. */
export const QUEUE_FRESHNESS_MS = 60_000;

/** Intersection of two players' checked-part scopes, keyed by the shared
 *  partIndex — every profile's 50 study parts share the same fixed start/length
 *  (see makeDefaultParts in profileStore.ts), so this is a plain set intersection. */
export function intersectScope(a: MatchScopePart[], b: MatchScopePart[]): MatchScopePart[] {
  const bIdx = new Set(b.map((p) => p.partIndex));
  return a.filter((p) => bIdx.has(p.partIndex));
}

export function totalScopeWords(scope: MatchScopePart[]): number {
  return scope.reduce((acc, p) => acc + p.length, 0);
}

export interface PvpQueueEntry {
  name: string;
  photoURL?: string;
  country?: string;
  level: number;
  /** Absent when the player had no checked parts — RTDB stores an empty array
   *  as nothing at all. */
  scope?: MatchScopePart[];
  ts: number;
  /** Written by a claimer. RTDB never stores nulls, so an unclaimed entry reads
   *  back with this key absent — never a literal null. */
  matchId?: string;
}

export interface PvpMatchMeta {
  seed: number;
  level: number;
  scope: MatchScopePart[];
  rounds: number;
  createdAt: number;
  creator: string;
}

export interface PvpPlayerState {
  name: string;
  photoURL?: string;
  country?: string;
  connected: boolean;
  lastSeen: number;
  qIndex: number;
  correct: number;
  results: (boolean | null)[];
  finished: boolean;
  timeMs?: number;
}

export interface PvpMatchResult {
  winnerUid: string | null;   // null = draw
  reason: 'score' | 'forfeit';
}

/** Level of a cross-level match: the easier (lower) of the two, so the weaker
 *  player isn't forced above their level. Both clients derive questions from
 *  this shared value (it lands in the match meta), never their own level. */
export function commonLevel(a: number, b: number): number {
  return Math.min(a, b);
}

/** Is `candidate` a viable live opponent for a player with `mine`'s scope?
 *  Levels don't need to match — a cross-level match runs at commonLevel(). */
export function isCompatibleCandidate(
  mine: { level: number; scope: MatchScopePart[] },
  candidate: PvpQueueEntry,
  nowMs: number,
): boolean {
  // != null on purpose: we write matchId as null, but RTDB drops nulls, so an
  // unclaimed entry reads back with the key absent (undefined). A strict
  // !== null here rejected every real candidate and no live match ever formed.
  if (candidate.matchId != null) return false;
  if (nowMs - candidate.ts > QUEUE_FRESHNESS_MS) return false;
  return totalScopeWords(intersectScope(mine.scope, candidate.scope ?? [])) >= MIN_SCOPE_WORDS;
}

/** Anti-race claim rule: legal only against an entry strictly "older" than mine
 *  (ts, tie-broken on uid), so between any pair at most one direction can claim —
 *  exactly one match forms even if both sides see each other simultaneously. */
export function mayClaim(mine: { ts: number; uid: string }, candidate: { ts: number; uid: string }): boolean {
  if (candidate.ts !== mine.ts) return candidate.ts < mine.ts;
  return candidate.uid < mine.uid;
}
