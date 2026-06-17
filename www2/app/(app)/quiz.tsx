// Main quiz screen — mirrors www/quiz/quizCtrl.js + www/one/oneCtrl.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, FlatList, ActivityIndicator, Alert, StyleSheet, Text,
  TouchableOpacity, Modal, TextInput, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';

import QuizCard, { CardData } from '../../src/components/QuizCard';
import { useProfileStore } from '../../src/stores/profileStore';
import * as QS from '../../src/services/questionnaireService';
import * as FB from '../../src/services/firebase';
import {
  randperm, shuffleByPerm, deepCopy,
  DAILYQUIZ_CHECKEVERY, DAILYQUIZ_CHECKAFTER,
} from '../../src/models/constants';
import { ayaNumberOf } from '../../src/db/idb';
import { QuestionObject } from '../../src/models/questionnaire';

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
  dailyScore: number;
  dailyTime: number;
  lastNonce: string | undefined;   // consumed deep-link nonce (survives remount)
}
const sessionCache: SessionCache = {
  active: false, dailyMode: false, dailyEnded: false,
  cards: [], activeCard: null, score: 0,
  cardCounter: 0, sessionCorrect: 0, dailyScore: 0, dailyTime: 0,
  lastNonce: undefined,
};

export default function QuizScreen() {
  const params = useLocalSearchParams<{ customStart?: string; dailyMode?: string; nonce?: string }>();
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
  // Session chooser — shown when no mode or customStart is pre-set
  const [chooserVisible, setChooserVisible] = useState(
    params.dailyMode !== '1' && !params.customStart,
  );
  // Post-session summary
  const [summaryVisible, setSummaryVisible] = useState(false);

  const listRef = useRef<FlatList>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cardCounterRef = useRef(sessionCache.cardCounter);
  const sessionCorrectRef = useRef(sessionCache.sessionCorrect);
  const dailyScoreRef = useRef(sessionCache.dailyScore);
  const dailyTimeRef = useRef(sessionCache.dailyTime);
  const dailyTimeInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  // Guard: prevents loadNextQuestion from re-entering after daily quiz ends
  const dailyEndedRef = useRef(sessionCache.dailyEnded);

  // Tracks the last navigation nonce we acted on, so a tab refocus (no new nonce)
  // does not restart a stale deep-linked sura. Restored from cache so a remount
  // doesn't treat a still-present nonce as a fresh deep-link.
  const lastNonceRef = useRef<string | undefined>(sessionCache.lastNonce);
  // True while a quiz run is in progress (and resumable). Lets us tell a genuine
  // in-progress session (return from the Me tab) apart from a fresh entry.
  const sessionActiveRef = useRef(sessionCache.active);
  // Mirror of dailyMode for use inside the focus callback (avoids stale closure).
  const dailyModeRef = useRef(sessionCache.dailyMode);

  // Mirror the visible session into the module cache so it survives a remount.
  useEffect(() => {
    sessionCache.cards = cards;
    sessionCache.activeCard = active;
    sessionCache.score = score;
    sessionCache.dailyMode = dailyMode;
  }, [cards, active, score, dailyMode]);

  // Reset all per-session state, then start a fresh quiz/daily run.
  function startSession(start: number | undefined, daily: boolean) {
    clearTimers();
    setChooserVisible(false);
    setCards([]);
    setActive(null);
    setDailyMode(daily);
    dailyModeRef.current = daily;
    sessionActiveRef.current = true;
    cardCounterRef.current = 0;
    sessionCorrectRef.current = 0;
    dailyScoreRef.current = 0;
    dailyTimeRef.current = 0;
    dailyEndedRef.current = false;
    syncCacheFlags();
    profile.recordPlay();
    QS.initQuestionnaire(profile.lastSeed);
    setScore(profile.getScore());
    if (daily) {
      dailyTimeInterval.current = setInterval(() => { dailyTimeRef.current += 1000; sessionCache.dailyTime = dailyTimeRef.current; }, 1000);
    }
    loadNextQuestion(start, daily);
  }

  // Resume an in-progress session left running on this (persistent) tab — e.g.
  // after popping over to the Me tab to toggle suras. Cards + the current
  // question are preserved; any sura changes apply to subsequent questions.
  function resumeSession() {
    setLoading(false);
    setScore(profile.getScore());
    if (dailyModeRef.current && !dailyEndedRef.current) {
      // Daily is timed: re-arm the elapsed-time tracker and the question timer.
      dailyTimeInterval.current = setInterval(() => { dailyTimeRef.current += 1000; sessionCache.dailyTime = dailyTimeRef.current; }, 1000);
      startTimer(12);
    }
  }

  // Reset to the start chooser (random / specific sura).
  function openChooser() {
    clearTimers();
    setCards([]);
    setActive(null);
    setDailyMode(false);
    dailyModeRef.current = false;
    sessionActiveRef.current = false;
    dailyEndedRef.current = false;
    syncCacheFlags();
    setScore(profile.getScore());
    setChooserVisible(true);
  }

  // Push the ref-held flags/counters into the module cache (refs alone don't
  // trigger the state-sync effect above).
  function syncCacheFlags() {
    sessionCache.active = sessionActiveRef.current;
    sessionCache.dailyMode = dailyModeRef.current;
    sessionCache.dailyEnded = dailyEndedRef.current;
    sessionCache.cardCounter = cardCounterRef.current;
    sessionCache.sessionCorrect = sessionCorrectRef.current;
    sessionCache.dailyScore = dailyScoreRef.current;
    sessionCache.dailyTime = dailyTimeRef.current;
  }

  // ── on focus: decide what to show every time the screen is entered ─────────
  // Persistent tab ⇒ component stays mounted, so this is the only reliable hook
  // for re-offering the chooser / resuming / starting on re-entry.
  useFocusEffect(useCallback(() => {
    if (QS.pendingDailyStart) {
      QS.clearPendingDailyStart();
      startSession(undefined, true);
    } else if (params.customStart && params.nonce && params.nonce !== lastNonceRef.current) {
      // Fresh deep-link to a specific sura (from home weak-sura or the Me list).
      lastNonceRef.current = params.nonce;
      sessionCache.lastNonce = params.nonce;
      startSession(parseInt(params.customStart), false);
    } else if (sessionActiveRef.current) {
      // Returning to a live session (e.g. from the Me tab) ⇒ keep the scroll.
      resumeSession();
    } else {
      // Plain entry with no live session ⇒ offer the chooser.
      openChooser();
    }
    return () => { clearTimers(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.customStart, params.nonce]));

  function clearTimers() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (dailyTimeInterval.current) clearInterval(dailyTimeInterval.current);
  }

  // ── load next question ────────────────────────────────────────────────────
  // isDaily can be passed explicitly to avoid stale closure when entering daily mode
  async function loadNextQuestion(start?: number, isDaily?: boolean) {
    const daily = isDaily ?? dailyMode;
    // Guard: once the daily quiz has ended, the timer must not restart the loop
    if (daily && dailyEndedRef.current) return;
    console.warn('[QUIZ] loadNextQuestion: daily=', daily, 'start=', start,
      'dailyMode state=', dailyMode, 'isDaily param=', isDaily);
    setLoading(true);
    try {
      if (daily) {
        console.warn('[QUIZ] calling createNextDailyQ...');
        const hasMore = await QS.createNextDailyQ(
          profile.getSparsePoint.bind(profile),
          profile.getTotalStudyLength.bind(profile),
          profile.level,
          profile.getPartIndexOf.bind(profile),
        );
        console.warn('[QUIZ] createNextDailyQ returned hasMore=', hasMore);
        if (!hasMore) {
          console.warn('[QUIZ] daily quiz ended → calling endDailyQuiz');
          dailyEndedRef.current = true;
          await endDailyQuiz();
          return;
        }
      } else {
        await QS.createNextQ(
          start,
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
      const newCard: CardData = {
        index: cards.length,
        qo: deepCopy(QS.qo),
        answerAya: aya,
        socialURL: `https://quranquiz.net/#/ahlan/${QS.qo.startIdx}`,
      };
      setCards((prev) => [...prev, newCard]);
      setActive(makeActive(QS.qo));
      cardCounterRef.current++;
      syncCacheFlags();
      const cc = cardCounterRef.current;
      if (!daily && (cc - DAILYQUIZ_CHECKAFTER) % DAILYQUIZ_CHECKEVERY === 0) {
        checkForDailyQuiz();
      }
      // Start the per-question timer only after a question was successfully loaded
      if (daily) startTimer(12);
    } catch (e) {
      console.error('loadNextQuestion error:', e);
    } finally {
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
      if (dailyMode) startTimer(5);
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
    if (!dailyMode && sessionCorrectRef.current % 10 === 0) {
      profile.updateScoreRecord();
      setTimeout(() => setSummaryVisible(true), 650);
    } else {
      setTimeout(() => loadNextQuestion(), 600);
    }
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
    setTimeout(() => loadNextQuestion(), 600);
  }

  function skipQ() { handleIncorrect(); }

  // ── daily quiz ────────────────────────────────────────────────────────────
  async function checkForDailyQuiz() {
    try {
      const head = await FB.getDailyHead();
      if (!head) return;
      Alert.alert(
        'اختبار اليوم جاهز',
        'الاختبار يتكون من 10 أسئلة في نطاق حفظك وعليك الإجابة بشكل صحيح وسريع',
        [
          { text: 'لا', style: 'cancel' },
          {
            text: 'نعم',
            onPress: () => {
              const weights = profile.getDailyQuizStudyPartsWeights();
              QS.initDailyQuiz(head.daily_random, profile.parts, weights);
              // pendingDailyStart is now set; useFocusEffect won't re-fire since we're
              // already on this screen — handle directly:
              QS.clearPendingDailyStart();
              startSession(undefined, true);
            },
          },
        ],
      );
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
    profile.markDailyCompleted();
    profile.updateScoreRecord();
    const finalScore = profile.getDailyQuizScore(
      dailyScoreRef.current,
      dailyTimeRef.current / 1000,
    );
    setDailyFinalScore(finalScore);
    const social = profile.social;
    await FB.submitDailyResult({
      score: finalScore,
      name: social.isAnonymous ? 'مجهول/ة' : (social.displayName ?? 'مجهول').split(' ')[0],
      uid: profile.uid,
      country: profile.country || undefined,
    });
    setDailyEndVisible(true);
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
  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {loading && cards.length === 0 && (
        <View style={s.loadingOverlay}>
          <ActivityIndicator size="large" color="#0d2d4e" />
        </View>
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
              scoreDown={QS.getDownScore()}
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
            <Text style={s.modalBody}>فضلاً قم بمراجعة محفوظك من القرآن وسيكون لديك اختبار جديد غداً بمشيئة الله.</Text>
            <TouchableOpacity style={s.btnConfirm} onPress={() => { setDailyEndVisible(false); router.replace('/(app)/home'); }}>
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
              onPress={() => {
                setChooserVisible(false);
                loadNextQuestion(undefined);
              }}
            >
              <Text style={s.chooserOptionTxt}>🎲 اختبار عشوائي</Text>
            </TouchableOpacity>
            <Text style={[s.modalBody, { marginTop: 12 }]}>أو اختر سورة:</Text>
            <ScrollView style={s.chooserList}>
              {profile.parts.map((p, i) => (
                <TouchableOpacity
                  key={i}
                  style={s.chooserItem}
                  onPress={() => {
                    setChooserVisible(false);
                    loadNextQuestion(p.start);
                  }}
                >
                  <Text style={s.chooserItemTxt}>{p.name}</Text>
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
              <TouchableOpacity style={s.btnCancel} onPress={() => { setSummaryVisible(false); router.replace('/(app)/home'); }}>
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
  modalBox: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '100%' },
  modalTitle: { fontSize: 17, fontWeight: '700', textAlign: 'right', marginBottom: 12, color: '#0d2d4e' },
  modalBody: { fontSize: 14, textAlign: 'right', color: '#444', marginBottom: 8 },
  bigScore: { fontSize: 36, fontWeight: 'bold', color: '#27ae60', textAlign: 'center', marginVertical: 12 },
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
  chooserItem: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
  },
  chooserItemTxt: { fontSize: 14, color: '#333', textAlign: 'right' },
});
