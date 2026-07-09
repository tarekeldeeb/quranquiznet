// Main quiz screen — mirrors www/quiz/quizCtrl.js + www/one/oneCtrl.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, FlatList, ActivityIndicator, Alert, StyleSheet, Text,
  TouchableOpacity, Modal, TextInput, ScrollView, Platform, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import AsyncStorage from '@react-native-async-storage/async-storage';
import QuizCard, { CardData } from '../../src/components/QuizCard';
import QuizSettingsBar, { ScopeMode } from '../../src/components/QuizSettingsBar';
import { useProfileStore } from '../../src/stores/profileStore';
import * as QS from '../../src/services/questionnaireService';
import * as FB from '../../src/services/firebase';
import { trackEvent } from '../../src/services/analytics';
import { requestPermission, scheduleStreakReminder } from '../../src/services/notifications';
import {
  randperm, shuffleByPerm, deepCopy,
  DAILYQUIZ_CHECKEVERY, DAILYQUIZ_CHECKAFTER, DAILYQUIZ_QPERPART_COUNT,
  DEFAULT_GUEST_NAME,
} from '../../src/models/constants';
import { ayaNumberOf, wordOffsetInAya } from '../../src/db/idb';
import { QuestionObject } from '../../src/models/questionnaire';
import {
  decideFocusFromContext, isAnswerable, shouldSuspendNormalRun,
  shouldShowSummary, shouldRestoreNormalRunAfterDaily,
} from '../../src/models/quizFlow';
import { describeRankGap } from '../../src/models/dailyRank';

interface ActiveCard {
  round: number;
  shuffle: number[];           // perm of 0-4; shuffle[i]=0 means option i is correct
  shuffledOptions: string[];
  flipTrigger: number;
  isCorrect: boolean;
}

function makeActive(qo: QuestionObject, round = 0): ActiveCard {
  const shuffle = randperm(5);
  return {
    round,
    shuffle,
    shuffledOptions: shuffleByPerm(qo.txt.op[round] ?? ['', '', '', '', ''], shuffle),
    flipTrigger: 0,
    isCorrect: false,
  };
}

// Ask for notification permission the first time the user finishes a quiz
// session — a proven-engaged moment, not a jarring cold-launch prompt. Gated by
// an AsyncStorage flag so it only ever runs once; no-op (false) on web.
const NOTIF_PROMPT_KEY = 'notif_prompt_shown';
async function maybeRequestNotificationPermission() {
  try {
    const shown = await AsyncStorage.getItem(NOTIF_PROMPT_KEY);
    if (shown) return;
    await AsyncStorage.setItem(NOTIF_PROMPT_KEY, '1');
    const granted = await requestPermission();
    if (granted) scheduleStreakReminder(useProfileStore.getState().streak);
  } catch { /* permission prompt is best-effort */ }
}

// Module-level session cache. expo-router can unmount an inactive tab on web, so
// component state/refs do NOT survive leaving to another tab (e.g. Me) and back.
// This module object outlives remounts, letting us resume the in-progress run.
interface SessionCache {
  active: boolean;       // a run is in progress and resumable
  dailyMode: boolean;
  dailyEnded: boolean;
  cards: CardData[];
  activeCard: ActiveCard | null;
  score: number;
  cardCounter: number;
  sessionCorrect: number;
  sessionAnswered: number;   // questions answered this run (correct + incorrect)
  dailyScore: number;
  dailyTime: number;
  lastNonce: string | undefined;   // consumed deep-link nonce (survives remount)
  lastStart: string | undefined;   // consumed ?start=<wordIdx> deep-link (shared question)
  customPart: number | null;       // selected sura/juz part index, or null = whole profile
  // A normal (non-daily) session suspended while a daily quiz runs. The daily
  // quiz uses its own empty card stack; this lets the normal run reappear after.
  normalSnapshot: NormalSnapshot | null;
}
// Suspended normal session — its own card stack plus the engine state (active
// question + seed) needed to keep answering where it left off.
interface NormalSnapshot {
  cards: CardData[];
  active: ActiveCard | null;
  cardCounter: number;
  sessionCorrect: number;
  sessionAnswered: number;
  customPart: number | null;
  qo: QuestionObject;   // the live question when the normal run was suspended
  seed: number;         // questionnaire seed at suspension (= active question idx)
}
const sessionCache: SessionCache = {
  active: false, dailyMode: false, dailyEnded: false,
  cards: [], activeCard: null, score: 0,
  cardCounter: 0, sessionCorrect: 0, sessionAnswered: 0, dailyScore: 0, dailyTime: 0,
  lastNonce: undefined, lastStart: undefined, customPart: null, normalSnapshot: null,
};

export default function QuizScreen() {
  const params = useLocalSearchParams<{ customPart?: string; dailyMode?: string; nonce?: string; chooser?: string; start?: string; lvl?: string }>();
  const profile = useProfileStore();
  const router = useRouter();

  const [cards, setCards] = useState<CardData[]>(() => sessionCache.cards);
  const [active, setActive] = useState<ActiveCard | null>(() => sessionCache.activeCard);
  const [score, setScore] = useState(() => sessionCache.score);
  const [loading, setLoading] = useState(true);
  const [dailyMode, setDailyMode] = useState(() => params.dailyMode === '1' || sessionCache.dailyMode);
  const [timerValue, setTimerValue] = useState(0);
  const [timerMax, setTimerMax] = useState(0);
  const [reportVisible, setReportVisible] = useState(false);
  const [reportCard, setReportCard] = useState<CardData | null>(null);
  const [reportMsg, setReportMsg] = useState('');
  const [dailyEndVisible, setDailyEndVisible] = useState(false);
  const [dailyFinalScore, setDailyFinalScore] = useState(0);
  // Post-win engagement: a rank-comparison line against yesterday's/all-time
  // leaderboard, fetched once the daily quiz ends (null while loading/unavailable).
  const [dailyRankLine, setDailyRankLine] = useState<string | null>(null);
  // Session chooser — shown when no mode or part is pre-set
  const [chooserVisible, setChooserVisible] = useState(
    params.dailyMode !== '1' && !params.customPart && !params.start,
  );
  // Post-session summary
  const [summaryVisible, setSummaryVisible] = useState(false);
  // Mirror of customPartRef as state, so the read-only settings strip re-renders
  // when the active scope changes (refs alone don't trigger a render).
  const [customPartIndex, setCustomPartIndex] = useState<number | null>(() => sessionCache.customPart);

  const listRef = useRef<FlatList>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cardCounterRef = useRef(sessionCache.cardCounter);
  const sessionCorrectRef = useRef(sessionCache.sessionCorrect);
  const sessionAnsweredRef = useRef(sessionCache.sessionAnswered);
  const dailyScoreRef = useRef(sessionCache.dailyScore);
  const dailyTimeRef = useRef(sessionCache.dailyTime);
  const dailyTimeInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  // Guard: prevents loadNextQuestion from re-entering after daily quiz ends
  const dailyEndedRef = useRef(sessionCache.dailyEnded);
  // Prevents loadNextQuestion from re-entering while a load is already in flight.
  const loadingNextRef = useRef(false);
  // An answered card is owed its next question (auto-advance scheduled). Lets
  // "حسناً" advance immediately and dedupes with the timer.
  const advancePendingRef = useRef(false);
  // True between the Nth-correct answer and the summary modal appearing, so the
  // OK-button stall-recovery doesn't skip past the pending summary.
  const summaryPendingRef = useRef(false);

  // Tracks the last navigation nonce we acted on, so a tab refocus (no new nonce)
  // does not restart a stale deep-linked sura. Restored from cache so a remount
  // doesn't treat a still-present nonce as a fresh deep-link.
  const lastNonceRef = useRef<string | undefined>(sessionCache.lastNonce);
  // Same idea for the shared-question link (/quiz?start=<wordIdx>): track the last
  // ?start value we acted on so a tab refocus doesn't restart it.
  const lastStartRef = useRef<string | undefined>(sessionCache.lastStart);
  // Word index for the *next* question to start at exactly (a shared question),
  // consumed once by loadNextQuestion; null ⇒ normal random selection.
  const pendingStartIdxRef = useRef<number | null>(null);
  // Level the shared question was created at (from ?lvl), so it reproduces exactly
  // regardless of the viewer's own level; null ⇒ use the viewer's level.
  const pendingStartLevelRef = useRef<number | null>(null);
  // True while a quiz run is in progress (and resumable). Lets us tell a genuine
  // in-progress session (return from the Me tab) apart from a fresh entry.
  const sessionActiveRef = useRef(sessionCache.active);
  // Mirror of dailyMode for use inside the focus callback (avoids stale closure).
  const dailyModeRef = useRef(sessionCache.dailyMode);
  // Selected sura/juz part for "custom part" mode. null ⇒ random across the
  // profile's enabled parts. When set, questions are drawn at random from within
  // this single part's word range only (bypassing the profile's part selection).
  const customPartRef = useRef<number | null>(sessionCache.customPart);

  // Mirror the visible session into the module cache so it survives a remount.
  useEffect(() => {
    sessionCache.cards = cards;
    sessionCache.activeCard = active;
    sessionCache.score = score;
    sessionCache.dailyMode = dailyMode;
  }, [cards, active, score, dailyMode]);

  // Reset all per-session state, then start a fresh run.
  //   { daily: true }        → daily quiz
  //   { partIndex: i }       → "custom part": random questions within sura/juz i
  //   { startIdx: w,         → shared question: first question starts at word w
  //     startLevel: n }        (at level n, if given), then random thereafter
  //   {}                     → random across the profile's enabled parts
  function startSession(opts: { daily?: boolean; partIndex?: number | null; startIdx?: number; startLevel?: number }) {
    const daily = !!opts.daily;
    if (daily) {
      // Entering the daily quiz: if a normal run is live, suspend it (with its
      // own card stack + engine state) so it can reappear once the daily ends.
      if (shouldSuspendNormalRun(sessionActiveRef.current, dailyModeRef.current)) {
        sessionCache.normalSnapshot = {
          cards: sessionCache.cards,
          active: sessionCache.activeCard,
          cardCounter: cardCounterRef.current,
          sessionCorrect: sessionCorrectRef.current,
          sessionAnswered: sessionAnsweredRef.current,
          customPart: customPartRef.current,
          qo: deepCopy(QS.qo),
          seed: profile.lastSeed,
        };
      }
    } else {
      // A fresh normal run replaces any previously suspended one.
      sessionCache.normalSnapshot = null;
    }
    clearTimers();
    setChooserVisible(false);
    setCards([]);
    setActive(null);
    setDailyMode(daily);
    dailyModeRef.current = daily;
    customPartRef.current = opts.partIndex ?? null;
    setCustomPartIndex(opts.partIndex ?? null);
    // A shared question forces the first question's start word (and level);
    // cleared after use.
    pendingStartIdxRef.current = opts.startIdx ?? null;
    pendingStartLevelRef.current = opts.startLevel ?? null;
    sessionActiveRef.current = true;
    cardCounterRef.current = 0;
    sessionCorrectRef.current = 0;
    sessionAnsweredRef.current = 0;
    dailyScoreRef.current = 0;
    dailyTimeRef.current = 0;
    dailyEndedRef.current = false;
    syncCacheFlags();
    trackEvent('quiz_start', {
      mode: daily ? 'daily' : opts.startIdx != null ? 'shared' : opts.partIndex != null ? 'custom' : 'random',
      level: profile.level,
      part: opts.partIndex ?? undefined,
    });
    profile.recordPlay();
    // Re-arm the "don't lose your streak" reminder for tomorrow evening now that
    // today's play is recorded (no-op without permission, cleared if streak is 0).
    scheduleStreakReminder(useProfileStore.getState().streak);
    QS.initQuestionnaire(profile.lastSeed);
    setScore(profile.getScore());
    if (daily) {
      startDailyTimeTracker();
    }
    loadNextQuestion();
  }

  // Resume an in-progress session left running on this (persistent) tab — e.g.
  // after popping over to the Me tab to toggle suras. Cards + the current
  // question are preserved; any sura changes apply to subsequent questions.
  function resumeSession() {
    setLoading(false);
    setScore(profile.getScore());
    if (dailyModeRef.current && !dailyEndedRef.current) {
      // Daily is timed: re-arm the elapsed-time tracker and the question timer.
      startDailyTimeTracker();
      startTimer(12);
    }
  }

  // Recover a session that is flagged active but has no answerable question
  // (e.g. the first/next question failed to load earlier, or the engine's `qo`
  // was lost). Re-arms the engine and generates a question so the screen is
  // usable again rather than dead.
  function recoverStrandedSession() {
    if (dailyModeRef.current) {
      if (dailyEndedRef.current) { openChooser(); return; }
      // Daily still in progress but lost its question → re-arm and generate.
      setLoading(true);
      if (dailyTimeInterval.current == null) {
        startDailyTimeTracker();
      }
      loadNextQuestion();
      return;
    }
    // Normal session: re-seat the engine from the saved seed, then load.
    setLoading(true);
    QS.initQuestionnaire(profile.lastSeed);
    loadNextQuestion();
  }

  // Reset to the start chooser (random / specific sura).
  function openChooser() {
    clearTimers();
    setCards([]);
    setActive(null);
    setDailyMode(false);
    dailyModeRef.current = false;
    customPartRef.current = null;
    setCustomPartIndex(null);
    sessionActiveRef.current = false;
    dailyEndedRef.current = false;
    syncCacheFlags();
    setScore(profile.getScore());
    setChooserVisible(true);
  }

  // Bring back a normal run that was suspended for a daily quiz. Restores its
  // card stack and the engine state (active question + seed) so the user can
  // keep answering. Returns true if a suspended run existed.
  function restoreNormalSession(): boolean {
    const snap = sessionCache.normalSnapshot;
    if (!snap) return false;
    sessionCache.normalSnapshot = null;
    clearTimers();
    // Re-seat the questionnaire engine on the suspended normal question.
    QS.initQuestionnaire(snap.seed);
    QS.setQo(snap.qo);
    profile.setLastSeed(snap.seed);

    dailyModeRef.current = false;
    customPartRef.current = snap.customPart;
    sessionActiveRef.current = true;
    dailyEndedRef.current = false;
    cardCounterRef.current = snap.cardCounter;
    sessionCorrectRef.current = snap.sessionCorrect;
    sessionAnsweredRef.current = snap.sessionAnswered;
    dailyScoreRef.current = 0;
    dailyTimeRef.current = 0;

    setDailyMode(false);
    setCustomPartIndex(snap.customPart);
    setCards(snap.cards);
    setActive(snap.active);
    setScore(profile.getScore());

    // Write through to the cache so a remount (web tab unmount) restores it too.
    sessionCache.cards = snap.cards;
    sessionCache.activeCard = snap.active;
    sessionCache.score = profile.getScore();
    sessionCache.dailyMode = false;
    syncCacheFlags();
    return true;
  }

  // Push the ref-held flags/counters into the module cache (refs alone don't
  // trigger the state-sync effect above).
  function syncCacheFlags() {
    sessionCache.active = sessionActiveRef.current;
    sessionCache.dailyMode = dailyModeRef.current;
    sessionCache.dailyEnded = dailyEndedRef.current;
    sessionCache.cardCounter = cardCounterRef.current;
    sessionCache.sessionCorrect = sessionCorrectRef.current;
    sessionCache.sessionAnswered = sessionAnsweredRef.current;
    sessionCache.dailyScore = dailyScoreRef.current;
    sessionCache.dailyTime = dailyTimeRef.current;
    sessionCache.customPart = customPartRef.current;
  }

  // ── on focus: decide what to show every time the screen is entered ─────────
  // Persistent tab ⇒ component stays mounted, so this is the only reliable hook
  // for re-offering the chooser / resuming / starting on re-entry.
  useFocusEffect(useCallback(() => {
    // Fresh shared-question link (/quiz?start=<wordIdx>). Acted on once per value
    // so a tab refocus (same URL) doesn't restart it — then it falls through to
    // the normal session logic (which will `resume`).
    if (params.start && params.start !== lastStartRef.current) {
      lastStartRef.current = params.start;
      sessionCache.lastStart = params.start;
      const idx = parseInt(params.start, 10);
      if (isFinite(idx) && idx > 0) {
        const lvl = params.lvl != null ? parseInt(params.lvl, 10) : NaN;
        const startLevel = isFinite(lvl) && lvl >= 0 && lvl <= 3 ? lvl : undefined;
        startSession({ startIdx: idx, startLevel });
        return () => { clearTimers(); };
      }
    }
    const action = decideFocusFromContext({
      pendingDailyStart: QS.pendingDailyStart,
      customPartParam: params.customPart,
      chooserParam: params.chooser,
      nonceParam: params.nonce,
      lastActedNonce: lastNonceRef.current,
      sessionActive: sessionActiveRef.current,
      hasActiveCard: !!sessionCache.activeCard,
      // Guards the dead-screen case where the engine's qo was reset/lost.
      engineAnswerable: isAnswerable(QS.qo),
      // A flipped card (flipTrigger > 0) has already been answered; resuming it
      // would strand the user, so treat it as needing recovery.
      activeCardFlipTrigger: sessionCache.activeCard?.flipTrigger ?? 0,
    });
    switch (action) {
      case 'start-daily':
        QS.clearPendingDailyStart();
        startSession({ daily: true });
        break;
      case 'start-part':
        // Fresh deep-link to a specific sura/juz (from home weak-sura or the Me list).
        lastNonceRef.current = params.nonce;
        sessionCache.lastNonce = params.nonce;
        startSession({ partIndex: parseInt(params.customPart!) });
        break;
      case 'resume':
        // Returning to a live session (e.g. from the Me tab) ⇒ keep the scroll.
        resumeSession();
        break;
      case 'recover':
        // Session flagged active but nothing to answer ⇒ re-arm instead of
        // stranding the user on a blank screen with no question.
        recoverStrandedSession();
        break;
      case 'chooser':
        // Plain entry with no live session, or an explicit "start a quiz"
        // request. Record the nonce so a tab refocus doesn't reopen the chooser
        // and wipe a session the user starts from it.
        lastNonceRef.current = params.nonce;
        sessionCache.lastNonce = params.nonce;
        openChooser();
        break;
    }
    return () => { clearTimers(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.customPart, params.nonce, params.chooser, params.start, params.lvl]));

  function clearTimers() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (dailyTimeInterval.current) clearInterval(dailyTimeInterval.current);
  }

  // Daily elapsed-time tracker — accumulates the time the daily score is graded
  // against. Paused while the user reviews a flipped card (between answering and
  // pressing "حسناً"), so review time isn't counted; resumed on the next question.
  function startDailyTimeTracker() {
    if (dailyTimeInterval.current) clearInterval(dailyTimeInterval.current);
    dailyTimeInterval.current = setInterval(() => {
      dailyTimeRef.current += 1000;
      sessionCache.dailyTime = dailyTimeRef.current;
    }, 1000);
  }
  function stopDailyTimeTracker() {
    if (dailyTimeInterval.current) { clearInterval(dailyTimeInterval.current); dailyTimeInterval.current = null; }
  }

  // ── load next question ────────────────────────────────────────────────────
  // Source of truth is the refs (dailyModeRef / customPartRef), set before each
  // call — avoids stale-closure issues with state.
  // Advance to the next question, deduped: whichever of the auto-advance timer
  // or the "حسناً" button fires first wins; the other becomes a no-op.
  function tryAdvance() {
    if (!advancePendingRef.current || loadingNextRef.current) return;
    advancePendingRef.current = false;
    loadNextQuestion();
  }

  async function loadNextQuestion() {
    const daily = dailyModeRef.current;
    // Guard: once the daily quiz has ended, the timer must not restart the loop
    if (daily && dailyEndedRef.current) return;
    if (loadingNextRef.current) return; // a load is already in flight
    loadingNextRef.current = true;
    setLoading(true);
    try {
      if (daily) {
        const hasMore = await QS.createNextDailyQ(
          profile.getSparsePoint.bind(profile),
          profile.getTotalStudyLength.bind(profile),
          profile.level,
          profile.getPartIndexOf.bind(profile),
        );
        if (!hasMore) {
          dailyEndedRef.current = true;
          await endDailyQuiz();
          return;
        }
      } else if (customPartRef.current != null) {
        // Custom Sura/Juz: draw a random word from within this part's range only.
        const pi = customPartRef.current;
        const part = profile.parts[pi];
        const sparsePoint = (n: number) => ({
          idx: part.start + ((n - 1) % part.length),
          part: pi,
        });
        const total = () => part.length;
        await QS.createNextQ(
          undefined,
          sparsePoint,
          total,
          profile.level,
          profile.specialEnabled,
          profile.isSurasSpecialQuestionEligible(),
          profile.getPartIndexOf.bind(profile),
        );
      } else if (pendingStartIdxRef.current != null) {
        // Shared question (/quiz?start=<wordIdx>): reproduce the exact question at
        // this word. Use createNormalQ directly so it can't be swapped for a
        // random "special" question. Consumed once — later questions go random.
        const startIdx = pendingStartIdxRef.current;
        const startLevel = pendingStartLevelRef.current;
        pendingStartIdxRef.current = null;
        pendingStartLevelRef.current = null;
        await QS.createNormalQ(
          startIdx,
          profile.getSparsePoint.bind(profile),
          profile.getTotalStudyLength.bind(profile),
          profile.level,
          startLevel ?? undefined,   // reproduce at the shared level when provided
          profile.getPartIndexOf.bind(profile),
        );
      } else {
        await QS.createNextQ(
          undefined,
          profile.getSparsePoint.bind(profile),
          profile.getTotalStudyLength.bind(profile),
          profile.level,
          profile.specialEnabled,
          profile.isSurasSpecialQuestionEligible(),
          profile.getPartIndexOf.bind(profile),
        );
      }
      profile.setLastSeed(QS.qo.startIdx);
      const aya = await ayaNumberOf(QS.qo.startIdx);
      const wordOffset = await wordOffsetInAya(QS.qo.startIdx);
      const newCard: CardData = {
        index: cards.length,
        qo: deepCopy(QS.qo),
        answerAya: aya,
        wordOffset,
        socialURL: `https://quranquiz.net/quiz?start=${QS.qo.startIdx}&lvl=${QS.qo.level}`,
      };
      setCards((prev) => [...prev, newCard]);
      setActive(makeActive(QS.qo));
      advancePendingRef.current = false; // a fresh, unanswered question is now active
      cardCounterRef.current++;
      syncCacheFlags();
      const cc = cardCounterRef.current;
      if (!daily && (cc - DAILYQUIZ_CHECKAFTER) % DAILYQUIZ_CHECKEVERY === 0) {
        checkForDailyQuiz();
      }
      // Start the per-question timer only after a question was successfully loaded,
      // and resume the elapsed-time tracker (paused while reviewing the prior card).
      if (daily) { startTimer(12); startDailyTimeTracker(); }
    } catch (e) {
      console.error('loadNextQuestion error:', e);
      // If the failure left the screen with nothing to answer, don't strand the
      // user — drop back to the chooser so there is always an available action.
      if (sessionCache.cards.length === 0) {
        sessionActiveRef.current = false;
        syncCacheFlags();
        setChooserVisible(true);
      }
    } finally {
      loadingNextRef.current = false;
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 200);
    }
  }

  // ── option selection ──────────────────────────────────────────────────────
  function selectOption(optionIndex: number) {
    if (!active) return;
    const isWrong = active.shuffle[optionIndex] !== 0;
    const isLastRound = active.round + 1 === QS.qo.rounds;

    if (isWrong) {
      handleIncorrect();
    } else if (isLastRound) {
      handleCorrect();
    } else {
      // advance round
      const newRound = active.round + 1;
      const newShuffle = randperm(5);
      const questionSoFar = QS.qo.txt.answer
        .split(' ')
        .slice(0, QS.qo.qLen + QS.qo.oLen * newRound)
        .join(' ');
      // update the last card's question text
      setCards((prev) => {
        const next = [...prev];
        const last = { ...next[next.length - 1] };
        last.qo = { ...last.qo, txt: { ...last.qo.txt, question: questionSoFar } };
        next[next.length - 1] = last;
        return next;
      });
      setActive({
        round: newRound,
        shuffle: newShuffle,
        shuffledOptions: shuffleByPerm(QS.qo.txt.op[newRound] ?? [], newShuffle),
        flipTrigger: 0,
        isCorrect: false,
      });
      // The question grew a line — scroll so the options stay in view.
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      if (dailyMode) startTimer(5);
    }
  }

  // Shared tail for both answer handlers: bump the answered counter, then either
  // break for the post-session summary (every Nth answered question) or schedule
  // the auto-advance to the next card.
  function afterAnswer() {
    sessionAnsweredRef.current++;
    syncCacheFlags();
    // The card is now flipped (answered). Stop the daily per-question timer so it
    // can't fire skipQ() on the already-answered card while we wait for the user,
    // and pause the elapsed-time tracker so card-review time isn't graded.
    clearTimer();
    if (dailyMode) stopDailyTimeTracker();
    if (shouldShowSummary(sessionAnsweredRef.current, dailyMode)) {
      profile.updateScoreRecord();
      trackEvent('quiz_complete', {
        mode: customPartRef.current != null ? 'custom' : 'random',
        correct: sessionCorrectRef.current,
        answered: sessionAnsweredRef.current,
        score: profile.getScore(),
      });
      maybeRequestNotificationPermission();
      summaryPendingRef.current = true;
      setTimeout(() => { summaryPendingRef.current = false; setSummaryVisible(true); }, 650);
    } else {
      // Do NOT auto-create the next question. The next questionnaire is generated
      // only once the user reviews the flipped card and presses "حسناً" (OK),
      // which routes through onScrollDown → tryAdvance. Applies to both the normal
      // quiz and the daily quiz.
      advancePendingRef.current = true;
    }
  }

  function handleCorrect() {
    profile.addCorrect(QS.qo);
    setScore(profile.getScore());
    if (dailyMode) dailyScoreRef.current++;
    sessionCorrectRef.current++;
    syncCacheFlags();
    // Store wasCorrect in the card so historical cards keep the right border color
    setCards((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      next[next.length - 1] = { ...next[next.length - 1], wasCorrect: true };
      return next;
    });
    setActive((a) => a ? { ...a, flipTrigger: a.flipTrigger + 1, isCorrect: true } : null);
    afterAnswer();
  }

  function handleIncorrect() {
    profile.addIncorrect(QS.qo);
    setScore(profile.getScore());
    setCards((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      next[next.length - 1] = { ...next[next.length - 1], wasCorrect: false };
      return next;
    });
    setActive((a) => a ? { ...a, flipTrigger: a.flipTrigger + 1, isCorrect: false } : null);
    afterAnswer();
  }

  function skipQ() { handleIncorrect(); }

  // ── daily quiz ────────────────────────────────────────────────────────────
  async function checkForDailyQuiz() {
    try {
      // Don't re-offer today's daily quiz to someone who already completed it.
      const today = new Date().toISOString().split('T')[0];
      if (profile.lastDailyCompletedDate === today) return;
      const head = await FB.getDailyHead();
      if (!head) return;
      const begin = () => {
        const weights = profile.getDailyQuizStudyPartsWeights();
        QS.initDailyQuiz(head.daily_random, profile.parts, weights);
        // pendingDailyStart is now set; useFocusEffect won't re-fire since we're
        // already on this screen — handle directly:
        QS.clearPendingDailyStart();
        startSession({ daily: true });
      };
      const msg = 'الاختبار يتكون من 10 أسئلة في نطاق حفظك وعليك الإجابة بشكل صحيح وسريع';
      // RN Alert is a no-op on react-native-web, so use the browser confirm there.
      if (Platform.OS === 'web') {
        if (typeof window === 'undefined' || window.confirm(`اختبار اليوم جاهز\n\n${msg}`)) begin();
        return;
      }
      Alert.alert('اختبار اليوم جاهز', msg, [
        { text: 'لا', style: 'cancel' },
        { text: 'نعم', onPress: begin },
      ]);
    } catch (e) {
      console.error('checkForDailyQuiz error:', e);
    }
  }

  async function endDailyQuiz() {
    clearTimers();
    setDailyMode(false);
    dailyModeRef.current = false;
    sessionActiveRef.current = false;
    dailyEndedRef.current = true;
    syncCacheFlags();
    const finalScore = profile.getDailyQuizScore(
      dailyScoreRef.current,
      dailyTimeRef.current / 1000,
    );
    profile.markDailyCompleted(finalScore);
    profile.updateScoreRecord();
    setDailyFinalScore(finalScore);
    setDailyRankLine(null);
    const social = profile.social;
    await FB.submitDailyResult({
      score: finalScore,
      // A guest's own nickname (stored as displayName like a social user's)
      // takes priority over the generic default — first word only, matching
      // how a social display name is already truncated below.
      name: (social.displayName || DEFAULT_GUEST_NAME).split(' ')[0],
      uid: profile.uid,
      country: profile.country || undefined,
    });
    trackEvent('daily_quiz_submit', {
      score: finalScore,
      correct: dailyScoreRef.current,
      time_sec: Math.round(dailyTimeRef.current / 1000),
    });
    setDailyEndVisible(true);
    // Best-effort rank comparison — submitted after the score post so the fresh
    // result has a chance of being reflected; falls back gracefully if not.
    FB.getComparisonReport()
      .then((entries) => setDailyRankLine(describeRankGap(entries as never[], finalScore)))
      .catch(() => setDailyRankLine(null));
  }

  async function shareScoreDaily() {
    try {
      await Share.share({
        message: `حصلت على ${dailyFinalScore} نقطة في اختبار اليوم على شبكة اختبار القرآن! جرّب حظك:\nhttps://quranquiz.net`,
        url: 'https://quranquiz.net',
      });
    } catch { /* ignore */ }
  }

  function practiceWeakestSura() {
    const weak = profile.getWeakCheckedParts(1)[0];
    if (!weak) return;
    setDailyEndVisible(false);
    router.push({ pathname: '/(app)/quiz', params: { customPart: String(weak.index), nonce: String(Date.now()) } });
  }

  // ── timer ─────────────────────────────────────────────────────────────────
  function startTimer(seconds: number) {
    clearTimer();
    setTimerMax(seconds);
    setTimerValue(seconds);
    timerRef.current = setInterval(() => {
      setTimerValue((v) => {
        if (v <= 1) {
          clearTimer();
          skipQ();
          return 0;
        }
        return v - 1;
      });
    }, 1000);
  }

  function clearTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  function onScrollDown() {
    listRef.current?.scrollToEnd({ animated: true });
    if (dailyMode) startTimer(12);
    if (advancePendingRef.current) {
      // "حسناً" pressed before the auto-advance fired → advance now (deduped).
      tryAdvance();
    } else if (
      sessionActiveRef.current && !dailyEndedRef.current && !summaryVisible
      && !summaryPendingRef.current && !loadingNextRef.current
      && (active?.flipTrigger ?? 0) > 0
    ) {
      // Stall recovery: the visible card is answered but nothing will advance it
      // (auto-advance already consumed/failed). Don't dead-end — load the next.
      loadNextQuestion();
    }
  }

  // ── report ────────────────────────────────────────────────────────────────
  function openReport(card: CardData) {
    setReportCard(card);
    setReportMsg('');
    setReportVisible(true);
  }

  async function submitReport() {
    if (reportCard) await FB.reportQuestion({ card: reportCard, msg: reportMsg });
    setReportVisible(false);
  }

  // ── render ────────────────────────────────────────────────────────────────
  // Read-only summary of the settings driving the current run.
  const scopeMode: ScopeMode = dailyMode ? 'daily' : customPartIndex != null ? 'custom' : 'random';
  const levelText = profile.levels.find((l) => l.value === profile.level)?.text ?? '';
  const scopeNames =
    scopeMode === 'daily' ? []
    : scopeMode === 'custom' ? [profile.parts[customPartIndex!]?.name ?? '—']
    : profile.parts.filter((p) => p.checked).map((p) => p.name);
  const showSettingsBar = !chooserVisible && cards.length > 0;

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {loading && cards.length === 0 && (
        <View style={s.loadingOverlay}>
          <ActivityIndicator size="large" color="#0d2d4e" />
        </View>
      )}

      {showSettingsBar && (
        <QuizSettingsBar
          levelText={levelText}
          specialEnabled={profile.specialEnabled}
          scopeNames={scopeNames}
          scopeMode={scopeMode}
          dailyCurrent={cards.length}
          dailyTotal={DAILYQUIZ_QPERPART_COUNT}
        />
      )}

      <FlatList
        ref={listRef}
        data={cards}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item, index }) => {
          const isLast = index === cards.length - 1;
          return (
            <QuizCard
              card={item}
              isActive={isLast}
              score={score}
              scoreUp={QS.getUpScore()}
              isDailyMode={dailyMode}
              timerValue={timerValue}
              timerMax={timerMax}
              onSelectOption={isLast ? selectOption : () => {}}
              onSkip={isLast ? skipQ : () => {}}
              onScrollDown={onScrollDown}
              onReport={openReport}
              round={isLast ? (active?.round ?? 0) : (QS.qo.rounds - 1)}
              totalRounds={item.qo.rounds}
              shuffledOptions={isLast ? (active?.shuffledOptions ?? []) : (item.qo.txt.op[0] ?? [])}
              flipTrigger={isLast ? (active?.flipTrigger ?? 0) : 1}
              isCorrect={isLast ? (active?.isCorrect ?? false) : (item.wasCorrect ?? true)}
            />
          );
        }}
        contentContainerStyle={s.listContent}
        centerContent
        showsVerticalScrollIndicator={false}
      />

      {/* Report modal */}
      <Modal visible={reportVisible} transparent animationType="slide" onRequestClose={() => setReportVisible(false)}>
        <View style={s.modalBg}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>الإبلاغ عن خطأ</Text>
            <TextInput
              style={s.reportInput}
              placeholder="برجاء توضيح الخطأ ..."
              value={reportMsg}
              onChangeText={setReportMsg}
              textAlign="right"
            />
            <View style={s.modalRow}>
              <TouchableOpacity style={s.btnCancel} onPress={() => setReportVisible(false)}>
                <Text style={s.btnCancelText}>لا</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnConfirm} onPress={submitReport}>
                <Text style={s.btnConfirmText}>نعم</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Daily quiz end modal */}
      <Modal visible={dailyEndVisible} transparent animationType="fade" onRequestClose={() => setDailyEndVisible(false)}>
        <View style={s.modalBg}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>شكراً لاشتراكك في اختبار اليوم</Text>
            <Text style={s.modalBody}>حصلت على:</Text>
            <Text style={s.bigScore}>{dailyFinalScore} نقطة</Text>
            {dailyRankLine && <Text style={s.rankLine}>{dailyRankLine}</Text>}
            <Text style={s.modalBody}>فضلاً قم بمراجعة محفوظك من القرآن وسيكون لديك اختبار جديد غداً بمشيئة الله.</Text>
            <View style={s.postWinRow}>
              <TouchableOpacity style={s.postWinBtn} onPress={shareScoreDaily}>
                <Ionicons name="share-social-outline" size={16} color="#1a5276" />
                <Text style={s.postWinBtnTxt}>شارك النتيجة</Text>
              </TouchableOpacity>
              {profile.getWeakCheckedParts(1).length > 0 && (
                <TouchableOpacity style={s.postWinBtn} onPress={practiceWeakestSura}>
                  <Ionicons name="book-outline" size={16} color="#1a5276" />
                  <Text style={s.postWinBtnTxt}>تدرّب على أضعف سورة</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity style={s.btnConfirm} onPress={() => {
              setDailyEndVisible(false);
              if (shouldRestoreNormalRunAfterDaily(!!sessionCache.normalSnapshot)) restoreNormalSession();
              router.replace('/(app)/me');
            }}>
              <Text style={s.btnConfirmText}>حسناً</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Session chooser modal */}
      <Modal visible={chooserVisible} transparent animationType="slide" onRequestClose={() => {}}>
        <View style={s.modalBg}>
          <View style={[s.modalBox, { maxHeight: '80%' }]}>
            <Text style={s.modalTitle}>ابدأ اختباراً</Text>
            <TouchableOpacity
              style={s.chooserOption}
              onPress={() => startSession({})}
            >
              <Text style={s.chooserOptionTxt}>˖ ݁𖥔 ݁ اختبار عشوائي</Text>
            </TouchableOpacity>
            <Text style={[s.modalBody, { marginTop: 12 }]}>أو راجع سورة تحتاج تحسيناً:</Text>
            <ScrollView style={s.chooserList}>
              {profile.getWeakCheckedParts(3).map(({ index, name }) => (
                <TouchableOpacity
                  key={index}
                  style={[s.chooserOption, s.chooserSuraBtn]}
                  onPress={() => startSession({ partIndex: index })}
                >
                  <Text style={s.chooserOptionTxt}>{name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Post-session summary modal */}
      <Modal visible={summaryVisible} transparent animationType="fade" onRequestClose={() => { setSummaryVisible(false); loadNextQuestion(); }}>
        <View style={s.modalBg}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>ممتاز! 🎉</Text>
            <Text style={s.modalBody}>أجبت على {sessionCorrectRef.current} سؤال صحيح في هذه الجلسة</Text>
            <Text style={s.bigScore}>{score.toLocaleString()}</Text>
            <Text style={[s.modalBody, { textAlign: 'center', marginBottom: 16 }]}>نقطة إجمالية</Text>
            {profile.getTopBadParts()[0] !== '-' && (
              <Text style={[s.modalBody, { color: '#f39c12' }]}>
                💡 {profile.getTopBadParts()[0]} تحتاج مراجعة
              </Text>
            )}
            <View style={s.modalRow}>
              <TouchableOpacity style={s.btnCancel} onPress={() => { setSummaryVisible(false); router.replace('/(app)/me'); }}>
                <Text style={s.btnCancelText}>الرئيسية</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnConfirm} onPress={() => { setSummaryVisible(false); loadNextQuestion(); }}>
                <Text style={s.btnConfirmText}>واصل</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#edf1f5' },
  listContent: { paddingTop: 8, paddingBottom: 24, alignItems: 'center' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 10, backgroundColor: '#edf1f5' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalBox: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '100%', maxWidth: 432 },
  modalTitle: { fontSize: 17, fontWeight: '700', textAlign: 'right', marginBottom: 12, color: '#0d2d4e' },
  modalBody: { fontSize: 14, textAlign: 'right', color: '#444', marginBottom: 8 },
  bigScore: { fontSize: 36, fontWeight: 'bold', color: '#27ae60', textAlign: 'center', marginVertical: 12 },
  rankLine: { fontSize: 13, fontWeight: '700', color: '#b7770d', textAlign: 'center', marginBottom: 10 },
  postWinRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  postWinBtn: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f5f7fa',
  },
  postWinBtnTxt: { fontSize: 12, fontWeight: '700', color: '#1a5276', textAlign: 'center' },
  reportInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 16, textAlign: 'right' },
  modalRow: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  btnCancel: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#ecf0f1' },
  btnCancelText: { color: '#555', fontWeight: '600' },
  btnConfirm: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#0d2d4e', marginTop: 8 },
  btnConfirmText: { color: '#fff', fontWeight: '700', textAlign: 'center' },
  chooserOption: {
    backgroundColor: '#d8e8f2',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d6eaf8',
  },
  chooserOptionTxt: { fontSize: 16, fontWeight: '700', color: '#0d2d4e' },
  chooserList: { maxHeight: 300, marginTop: 4 },
  chooserSuraBtn: { marginTop: 8 },
});
