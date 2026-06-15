// Main quiz screen — mirrors www/quiz/quizCtrl.js + www/one/oneCtrl.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, FlatList, ActivityIndicator, Alert, StyleSheet, Text,
  TouchableOpacity, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';

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

export default function QuizScreen() {
  const params = useLocalSearchParams<{ customStart?: string; dailyMode?: string }>();
  const profile = useProfileStore();

  const [cards, setCards] = useState<CardData[]>([]);
  const [active, setActive] = useState<ActiveCard | null>(null);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dailyMode, setDailyMode] = useState(params.dailyMode === '1');
  const [timerValue, setTimerValue] = useState(0);
  const [timerMax, setTimerMax] = useState(0);
  const [reportVisible, setReportVisible] = useState(false);
  const [reportCard, setReportCard] = useState<CardData | null>(null);
  const [reportMsg, setReportMsg] = useState('');
  const [dailyEndVisible, setDailyEndVisible] = useState(false);
  const [dailyFinalScore, setDailyFinalScore] = useState(0);

  const listRef = useRef<FlatList>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cardCounterRef = useRef(0);
  const dailyScoreRef = useRef(0);
  const dailyTimeRef = useRef(0);
  const dailyTimeInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const isInitialized = useRef(false);

  // ── first mount: start normal quiz ────────────────────────────────────────
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;
    QS.initQuestionnaire(profile.lastSeed);
    setScore(profile.getScore());
    const start = params.customStart ? parseInt(params.customStart) : undefined;
    loadNextQuestion(start);
    return () => { clearTimers(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── on focus: detect pending daily start from Daily tab ───────────────────
  useFocusEffect(useCallback(() => {
    if (!QS.pendingDailyStart) return;
    QS.clearPendingDailyStart();
    clearTimers();
    setCards([]);
    setActive(null);
    setDailyMode(true);
    dailyScoreRef.current = 0;
    dailyTimeRef.current = 0;
    cardCounterRef.current = 0;
    dailyTimeInterval.current = setInterval(() => { dailyTimeRef.current += 1000; }, 1000);
    loadNextQuestion(undefined, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  function clearTimers() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (dailyTimeInterval.current) clearInterval(dailyTimeInterval.current);
  }

  // ── load next question ────────────────────────────────────────────────────
  // isDaily can be passed explicitly to avoid stale closure when entering daily mode
  async function loadNextQuestion(start?: number, isDaily?: boolean) {
    const daily = isDaily ?? dailyMode;
    setLoading(true);
    try {
      if (daily) {
        const hasMore = await QS.createNextDailyQ(
          profile.getSparsePoint.bind(profile),
          profile.getTotalStudyLength.bind(profile),
          profile.level,
        );
        if (!hasMore) {
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
      const cc = cardCounterRef.current;
      if (!daily && (cc - DAILYQUIZ_CHECKAFTER) % DAILYQUIZ_CHECKEVERY === 0) {
        checkForDailyQuiz();
      }
    } catch (e) {
      console.error('loadNextQuestion error:', e);
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 200);
      if (daily) startTimer(12);
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
    // Store wasCorrect in the card so historical cards keep the right border color
    setCards((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      next[next.length - 1] = { ...next[next.length - 1], wasCorrect: true };
      return next;
    });
    setActive((a) => a ? { ...a, flipTrigger: a.flipTrigger + 1, isCorrect: true } : null);
    setTimeout(() => loadNextQuestion(), 600);
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
              clearTimers();
              setCards([]);
              setActive(null);
              setDailyMode(true);
              dailyScoreRef.current = 0;
              dailyTimeRef.current = 0;
              cardCounterRef.current = 0;
              dailyTimeInterval.current = setInterval(() => { dailyTimeRef.current += 1000; }, 1000);
              loadNextQuestion(undefined, true);
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
          <ActivityIndicator size="large" color="#1a5276" />
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
            <TouchableOpacity style={s.btnConfirm} onPress={() => setDailyEndVisible(false)}>
              <Text style={s.btnConfirmText}>حسناً</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  listContent: { paddingTop: 8, paddingBottom: 24, alignItems: 'center' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 10, backgroundColor: '#f0f4f8' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalBox: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '100%' },
  modalTitle: { fontSize: 17, fontWeight: '700', textAlign: 'right', marginBottom: 12, color: '#1a5276' },
  modalBody: { fontSize: 14, textAlign: 'right', color: '#444', marginBottom: 8 },
  bigScore: { fontSize: 36, fontWeight: 'bold', color: '#27ae60', textAlign: 'center', marginVertical: 12 },
  reportInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 16, textAlign: 'right' },
  modalRow: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  btnCancel: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#ecf0f1' },
  btnCancelText: { color: '#555', fontWeight: '600' },
  btnConfirm: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#1a5276', marginTop: 8 },
  btnConfirmText: { color: '#fff', fontWeight: '700', textAlign: 'center' },
});
