// Flip-card component for a single quiz question.
// Front: question prompt + 5 options + score/timer + skip.
// Back:  answer text + sura info + action buttons.

import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  ScrollView, Modal, Image, Share, Platform, Alert,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, interpolate, Extrapolation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { QuestionObject } from '../models/questionnaire';
import { removeAyaNum, SURA_NAME, SURA_AYAS, getSuraIdx, getSuraTanzil, getPageURLFromSuraAyah } from '../models/constants';

const { width: SW } = Dimensions.get('window');
const CARD_W = SW - 24;

export interface CardData {
  index: number;
  qo: QuestionObject;
  answerAya: number;
  socialURL: string;
}

interface Props {
  card: CardData;
  isActive: boolean;           // last card = editable question
  score: number;
  scoreUp: number;
  scoreDown: number;
  isDailyMode: boolean;
  timerValue: number;
  timerMax: number;
  onSelectOption: (optionIndex: number) => void;
  onSkip: () => void;
  onScrollDown: () => void;
  onReport: (card: CardData) => void;
  round: number;               // current round (for progress dots)
  totalRounds: number;
  shuffledOptions: string[];   // 5 display-text options already shuffled
  flipTrigger: number;         // increment to trigger flip
  isCorrect: boolean;
}

export default function QuizCard({
  card, isActive, score, scoreUp, scoreDown, isDailyMode, timerValue, timerMax,
  onSelectOption, onSkip, onScrollDown, onReport, round, totalRounds,
  shuffledOptions, flipTrigger, isCorrect,
}: Props) {
  const flip = useSharedValue(0);
  const sura = getSuraIdx(card.qo.startIdx);
  const suraName = SURA_NAME[sura];
  const suraInfo = `${getSuraTanzil(card.qo.startIdx)} · اياتها ${SURA_AYAS[sura]}`;
  const [imgVisible, setImgVisible] = React.useState(false);
  const pageURL = getPageURLFromSuraAyah(sura, card.answerAya);

  useEffect(() => {
    if (flipTrigger > 0) {
      flip.value = withTiming(1, { duration: 450 });
    }
  }, [flipTrigger]);

  const frontAnim = useAnimatedStyle(() => ({
    backfaceVisibility: 'hidden',
    transform: [{ rotateY: `${interpolate(flip.value, [0, 1], [0, 180], Extrapolation.CLAMP)}deg` }],
  }));
  const backAnim = useAnimatedStyle(() => ({
    backfaceVisibility: 'hidden',
    position: 'absolute', top: 0, left: 0, width: CARD_W,
    transform: [{ rotateY: `${interpolate(flip.value, [0, 1], [180, 360], Extrapolation.CLAMP)}deg` }],
  }));

  const timerPct = timerMax > 0 ? timerValue / timerMax : 0;

  async function handleShare() {
    try {
      await Share.share({
        message: `نافسني في اختبار القرآن 😀\n${card.socialURL}`,
        url: card.socialURL,
      });
    } catch { /* ignore */ }
  }

  return (
    <View style={s.wrapper}>
      {/* FRONT */}
      <Animated.View style={[s.card, frontAnim]}>
        {/* Question text */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.questionBox}>
          <Text style={s.questionText} numberOfLines={1}>
            {removeAyaNum(card.qo.txt.question)}
          </Text>
        </ScrollView>

        {/* Options + meta column */}
        <View style={s.body}>
          {/* Options (67%) */}
          <View style={s.optionsCol}>
            {[0, 1, 2, 3, 4].map((i) => (
              <TouchableOpacity
                key={i}
                style={s.optionBtn}
                onPress={() => isActive && onSelectOption(i)}
                activeOpacity={isActive ? 0.7 : 1}
              >
                <Text style={s.optionText}>{shuffledOptions[i] ?? ''}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Meta column (33%) */}
          <View style={s.metaCol}>
            <Text style={s.instructionText}>{card.qo.qType.txt}</Text>

            {isDailyMode ? (
              <View style={s.timerBox}>
                <Text style={s.timerText}>{timerValue}ث</Text>
                <View style={s.timerTrack}>
                  <View style={[s.timerFill, { height: `${timerPct * 100}%` }]} />
                </View>
              </View>
            ) : (
              <View style={s.scoreBox}>
                <Text style={s.scoreMain}>{score}</Text>
                <View style={s.scoreRow}>
                  <Text style={s.scoreUp}>+{scoreUp} ↑</Text>
                  <Text style={s.scoreDown}>-{scoreDown} ↓</Text>
                </View>
              </View>
            )}

            <TouchableOpacity style={s.skipBtn} onPress={() => isActive && onSkip()}>
              <Ionicons name="sad-outline" size={16} color="#c0392b" />
              <Text style={s.skipText}> لا أعلم</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Round progress dots */}
        <View style={s.progressRow}>
          {Array.from({ length: totalRounds }, (_, i) => (
            <View key={i} style={[s.dot, i < round ? s.dotDone : s.dotPending]} />
          ))}
        </View>
      </Animated.View>

      {/* BACK */}
      <Animated.View style={[s.card, backAnim, { borderColor: isCorrect ? '#27ae60' : '#c0392b', borderWidth: 2 }]}>
        {/* Sura / aya header */}
        <View style={s.backHeader}>
          <Text style={s.backSura} numberOfLines={1}>
            الآية {card.answerAya} ﴾ سورة {suraName} ﴿
          </Text>
          <Text style={s.backSuraInfo}>{suraInfo}</Text>
        </View>

        {/* Answer text */}
        <ScrollView style={s.answerScroll} contentContainerStyle={s.answerContent}>
          <Text style={s.answerText}>{card.qo.txt.answer} ...</Text>
        </ScrollView>

        {/* Action buttons */}
        <View style={s.actionRow}>
          <TouchableOpacity style={[s.actionBtn, s.btnOk]} onPress={onScrollDown}>
            <Ionicons name="chevron-down" size={18} color="#fff" />
            <Text style={s.actionBtnText}> حسناً</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, s.btnView]} onPress={() => setImgVisible(true)}>
            <Ionicons name="book-outline" size={18} color="#555" />
            <Text style={[s.actionBtnText, { color: '#555' }]}> شاهد</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, s.btnShare]} onPress={handleShare}>
            <Ionicons name="people-outline" size={18} color="#555" />
            <Text style={[s.actionBtnText, { color: '#555' }]}> نافس</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.reportBtn} onPress={() => onReport(card)}>
            <Ionicons name="flag-outline" size={18} color="#c0392b" />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Quran page image modal */}
      <Modal visible={imgVisible} transparent animationType="fade" onRequestClose={() => setImgVisible(false)}>
        <View style={s.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setImgVisible(false)} />
          <Image source={{ uri: pageURL }} style={s.pageImage} resizeMode="contain" />
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: { width: CARD_W, marginHorizontal: 12, marginBottom: 16, minHeight: 420 },
  card: {
    width: CARD_W, backgroundColor: '#fff', borderRadius: 12,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
    overflow: 'hidden',
  },
  questionBox: {
    backgroundColor: '#f5f5f5', padding: 10, borderBottomWidth: 1, borderColor: '#ddd',
    maxHeight: 56,
  },
  questionText: {
    fontSize: 20, fontFamily: Platform.OS === 'web' ? 'AmiriQuranColored' : undefined,
    textAlign: 'right', writingDirection: 'rtl', color: '#1a1a1a', lineHeight: 34,
  },
  body: { flexDirection: 'row', padding: 10, gap: 8 },
  optionsCol: { flex: 3, gap: 6 },
  optionBtn: {
    backgroundColor: '#ecf0f1', borderRadius: 6, paddingVertical: 8, paddingHorizontal: 10,
  },
  optionText: {
    fontSize: 16, textAlign: 'right', writingDirection: 'rtl',
    fontFamily: Platform.OS === 'web' ? 'AmiriQuranColored' : undefined, color: '#2c3e50',
  },
  metaCol: { flex: 1.5, alignItems: 'center', gap: 8 },
  instructionText: { fontSize: 11, color: '#7f8c8d', textAlign: 'center', flexWrap: 'wrap' },
  scoreBox: { alignItems: 'center', borderWidth: 1, borderColor: '#bdc3c7', borderRadius: 6, padding: 6, width: '100%' },
  scoreMain: { fontSize: 22, fontWeight: 'bold', color: '#27ae60' },
  scoreRow: { flexDirection: 'row', gap: 4, marginTop: 2 },
  scoreUp: { color: '#27ae60', fontSize: 11 },
  scoreDown: { color: '#c0392b', fontSize: 11 },
  timerBox: { alignItems: 'center', gap: 4 },
  timerText: { fontSize: 18, fontWeight: 'bold', color: '#e74c3c' },
  timerTrack: { width: 8, height: 60, backgroundColor: '#ecf0f1', borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  timerFill: { backgroundColor: '#e74c3c', borderRadius: 4 },
  skipBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  skipText: { fontSize: 12, color: '#c0392b' },
  progressRow: {
    flexDirection: 'row', paddingHorizontal: 10, paddingBottom: 8, gap: 4,
    justifyContent: 'flex-end', flexWrap: 'wrap',
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotDone: { backgroundColor: '#27ae60' },
  dotPending: { backgroundColor: '#bdc3c7' },

  // Back
  backHeader: { padding: 10, borderBottomWidth: 1, borderColor: '#eee', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backSura: { fontSize: 16, fontWeight: '700', color: '#1a5276', textAlign: 'right', flex: 1 },
  backSuraInfo: { fontSize: 11, color: '#7f8c8d', textAlign: 'left', marginLeft: 8 },
  answerScroll: { maxHeight: 280 },
  answerContent: { padding: 14 },
  answerText: {
    fontSize: 20, lineHeight: 38, textAlign: 'right', writingDirection: 'rtl',
    fontFamily: Platform.OS === 'web' ? 'AmiriQuranColored' : undefined, color: '#1a1a1a',
  },
  actionRow: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#eee' },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  btnOk: { backgroundColor: '#1a5276' },
  btnView: { backgroundColor: '#f5f5f5' },
  btnShare: { backgroundColor: '#f5f5f5' },
  actionBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  reportBtn: { width: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5' },

  // Image modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  pageImage: { width: SW - 16, height: (SW - 16) * 1.4, borderRadius: 8 },
});
