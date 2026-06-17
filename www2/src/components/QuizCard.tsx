import React, { useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  ScrollView, Modal, Image, Share, Platform,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, interpolate, Extrapolation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { QuestionObject } from '../models/questionnaire';
import {
  removeAyaNum, SURA_NAME, SURA_AYAS, getSuraIdx,
  getSuraTanzil, getPageURLFromSuraAyah,
} from '../models/constants';

const { width: SW } = Dimensions.get('window');
// Cap card width so it's not absurdly wide on desktop/tablet
const CARD_W = Math.min(SW - 32, 480);

// Font families: Amiri works on web; native falls back to system Arabic
const QURAN_FONT = Platform.OS === 'web' ? 'AmiriQuranColored' : undefined;
const AMIRI_FONT  = Platform.OS === 'web' ? 'Amiri-Regular'     : undefined;

export interface CardData {
  index: number;
  qo: QuestionObject;
  answerAya: number;
  socialURL: string;
  wasCorrect?: boolean;   // set when card is answered; undefined = still active
}

interface Props {
  card: CardData;
  isActive: boolean;
  score: number;
  scoreUp: number;
  scoreDown: number;
  isDailyMode: boolean;
  timerValue: number;
  timerMax: number;
  onSelectOption: (i: number) => void;
  onSkip: () => void;
  onScrollDown: () => void;
  onReport: (card: CardData) => void;
  round: number;
  totalRounds: number;
  shuffledOptions: string[];
  flipTrigger: number;
  isCorrect: boolean;
}

export default function QuizCard({
  card, isActive, score, scoreUp, scoreDown, isDailyMode, timerValue, timerMax,
  onSelectOption, onSkip, onScrollDown, onReport, round, totalRounds,
  shuffledOptions, flipTrigger, isCorrect,
}: Props) {
  const flip = useSharedValue(0);
  const [imgVisible, setImgVisible] = React.useState(false);

  const sura     = getSuraIdx(card.qo.startIdx);
  const suraName = SURA_NAME[sura];
  const suraInfo = `${getSuraTanzil(card.qo.startIdx)} · ${SURA_AYAS[sura]} آية`;
  const pageURL  = getPageURLFromSuraAyah(sura, card.answerAya);

  useEffect(() => {
    if (flipTrigger > 0) flip.value = withTiming(1, { duration: 420 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipTrigger]);

  const frontStyle = useAnimatedStyle(() => ({
    backfaceVisibility: 'hidden',
    transform: [{ rotateY: `${interpolate(flip.value, [0, 1], [0, 180], Extrapolation.CLAMP)}deg` }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    backfaceVisibility: 'hidden',
    position: 'absolute', top: 0, left: 0, width: CARD_W,
    transform: [{ rotateY: `${interpolate(flip.value, [0, 1], [180, 360], Extrapolation.CLAMP)}deg` }],
  }));

  const timerPct    = timerMax > 0 ? timerValue / timerMax : 0;
  const borderColor = isCorrect ? '#27ae60' : '#e74c3c';

  async function handleShare() {
    try {
      await Share.share({ message: `نافسني في اختبار القرآن\n${card.socialURL}`, url: card.socialURL });
    } catch { /* ignore */ }
  }

  return (
    <View style={s.wrapper}>
      {/* ── FRONT ─────────────────────────────────────────────────────────── */}
      <Animated.View style={[s.card, frontStyle]}>

        {/* Instruction + progress dots */}
        <View style={s.topBar}>
          <Text style={s.instruction}>{card.qo.qType.txt}</Text>
          <View style={s.dotsRow}>
            {Array.from({ length: totalRounds }, (_, i) => (
              <View key={i} style={[s.dot, i < round ? s.dotDone : i === round ? s.dotCurrent : s.dotPending]} />
            ))}
          </View>
        </View>

        {/* Question text */}
        <View style={s.questionBox}>
          <ScrollView contentContainerStyle={s.questionScroll}>
            <Text style={s.questionText}>{removeAyaNum(card.qo.txt.question)}</Text>
          </ScrollView>
        </View>

        {/* Body: options + meta */}
        <View style={s.body}>
          {/* Options */}
          <View style={s.optionsCol}>
            {[0, 1, 2, 3, 4].map((i) => (
              <TouchableOpacity
                key={i}
                style={[s.optionBtn, !isActive && s.optionBtnInactive]}
                onPress={() => isActive && onSelectOption(i)}
                activeOpacity={isActive ? 0.65 : 1}
              >
                <Text style={[s.optionText, !isActive && s.optionTextInactive]}>
                  {shuffledOptions[i] ?? ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Meta */}
          <View style={s.metaCol}>
            {isDailyMode ? (
              <View style={s.timerBox}>
                <Text style={s.timerText}>{timerValue}</Text>
                <Text style={s.timerUnit}>ث</Text>
                <View style={s.timerTrack}>
                  <View style={[s.timerFill, { height: `${timerPct * 100}%` as unknown as number }]} />
                </View>
              </View>
            ) : (
              <View style={s.scoreBox}>
                <Text style={s.scoreMain}>{score}</Text>
                <Text style={s.scoreUp}>+{scoreUp}</Text>
                <Text style={s.scoreDown}>−{scoreDown}</Text>
              </View>
            )}

            <TouchableOpacity style={s.skipBtn} onPress={() => isActive && onSkip()} activeOpacity={isActive ? 0.7 : 1}>
              <Ionicons name="remove-circle-outline" size={18} color={isActive ? '#c0392b' : '#ccc'} />
              <Text style={[s.skipText, !isActive && { color: '#ccc' }]}>لا أعلم</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* ── BACK ──────────────────────────────────────────────────────────── */}
      <Animated.View style={[s.card, backStyle, { borderColor, borderWidth: 2 }]}>

        {/* Sura / aya header */}
        <View style={[s.backHeader, { borderBottomColor: borderColor, borderBottomWidth: 2 }]}>
          <View style={s.backHeaderLeft}>
            <Text style={s.backSuraInfo}>{suraInfo}</Text>
          </View>
          <Text style={s.backSuraName}>سورة {suraName} · آية {card.answerAya}</Text>
        </View>

        {/* Answer text */}
        <ScrollView style={s.answerScroll} contentContainerStyle={s.answerContent}>
          <Text style={s.answerText}>{card.qo.txt.answer} …</Text>
        </ScrollView>

        {/* Action row */}
        <View style={s.actionRow}>
          <TouchableOpacity style={[s.actionBtn, s.btnOk]} onPress={onScrollDown}>
            <Ionicons name="chevron-down" size={16} color="#fff" />
            <Text style={s.actionBtnTxt}> حسناً</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, s.btnSecondary]} onPress={() => setImgVisible(true)}>
            <Ionicons name="book-outline" size={16} color="#1a5276" />
            <Text style={[s.actionBtnTxt, { color: '#1a5276' }]}> شاهد</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, s.btnSecondary]} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={16} color="#1a5276" />
            <Text style={[s.actionBtnTxt, { color: '#1a5276' }]}> نافس</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.reportBtn} onPress={() => onReport(card)}>
            <Ionicons name="flag-outline" size={17} color="#c0392b" />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Quran page modal */}
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
  wrapper: {
    width: CARD_W,
    alignSelf: 'center',
    marginBottom: 8,
  },
  card: {
    width: CARD_W,
    backgroundColor: '#fff',
    borderRadius: 14,
    boxShadow: '0px 2px 8px rgba(0,0,0,0.08)',
    elevation: 3,
    overflow: 'hidden',
  },

  // ── FRONT ────────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#f0f4f8',
    borderBottomWidth: 1,
    borderColor: '#e0e6ed',
  },
  instruction: {
    fontSize: 11,
    color: '#7f8c8d',
    fontFamily: AMIRI_FONT,
    textAlign: 'right',
    flexShrink: 1,
  },
  dotsRow: {
    flexDirection: 'row-reverse',
    gap: 4,
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    maxWidth: '55%',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotDone:    { backgroundColor: '#27ae60' },
  dotCurrent: { backgroundColor: '#1a5276' },
  dotPending: { backgroundColor: '#d5dce5' },

  questionBox: {
    backgroundColor: '#fdfaf5',
    borderBottomWidth: 1,
    borderColor: '#e8e0d0',
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 54,
  },
  questionScroll: { flexGrow: 1 },
  questionText: {
    fontSize: 22,
    fontFamily: QURAN_FONT,
    color: '#1a1a1a',
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 38,
  },

  body: { flexDirection: 'row', padding: 10, gap: 8 },

  optionsCol: { flex: 2, gap: 5 },
  optionBtn: {
    backgroundColor: '#eef2f7',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#dde4ed',
  },
  optionBtnInactive: {
    backgroundColor: '#f7f9fb',
    borderColor: '#eaecef',
  },
  optionText: {
    fontSize: 17,
    fontFamily: QURAN_FONT,
    textAlign: 'right',
    writingDirection: 'rtl',
    color: '#2c3e50',
    lineHeight: 28,
  },
  optionTextInactive: { color: '#95a5a6' },

  metaCol: {
    width: 68,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  scoreBox: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d5dce5',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
    width: '100%',
    gap: 2,
  },
  scoreMain: { fontSize: 20, fontWeight: '700', color: '#1a5276' },
  scoreUp:   { color: '#27ae60', fontSize: 12, fontWeight: '600' },
  scoreDown: { color: '#e74c3c', fontSize: 12, fontWeight: '600' },

  timerBox: { alignItems: 'center', gap: 2 },
  timerText: { fontSize: 22, fontWeight: '700', color: '#e74c3c' },
  timerUnit: { fontSize: 12, color: '#e74c3c' },
  timerTrack: {
    width: 8, height: 56,
    backgroundColor: '#fadbd8', borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end',
  },
  timerFill: { backgroundColor: '#e74c3c', borderRadius: 4 },

  skipBtn: { alignItems: 'center', gap: 3, paddingVertical: 4 },
  skipText: { fontSize: 11, color: '#c0392b', fontFamily: AMIRI_FONT },

  // ── BACK ─────────────────────────────────────────────────────────────────
  backHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fafafa',
  },
  backHeaderLeft: { alignItems: 'flex-start' },
  backSuraName: {
    fontSize: 16,
    fontFamily: AMIRI_FONT,
    fontWeight: '700',
    color: '#1a5276',
    textAlign: 'right',
    flexShrink: 1,
  },
  backSuraInfo: {
    fontSize: 12,
    fontFamily: AMIRI_FONT,
    color: '#7f8c8d',
  },

  answerScroll: { maxHeight: 260 },
  answerContent: { padding: 14 },
  answerText: {
    fontSize: 22,
    fontFamily: QURAN_FONT,
    lineHeight: 42,
    textAlign: 'right',
    writingDirection: 'rtl',
    color: '#1a1a1a',
  },

  actionRow: {
    flexDirection: 'row-reverse',
    borderTopWidth: 1,
    borderColor: '#eee',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    gap: 2,
  },
  btnOk:        { backgroundColor: '#1a5276' },
  btnSecondary: { backgroundColor: '#f5f7fa' },
  actionBtnTxt: { color: '#fff', fontWeight: '600', fontSize: 13, fontFamily: AMIRI_FONT },
  reportBtn: {
    width: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fdf0f0',
  },

  // ── Modal ─────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center', alignItems: 'center',
  },
  // The page PNG has a transparent background, so it needs a white backing —
  // otherwise the black text renders on the dark overlay and is unreadable.
  pageImage: {
    width: SW - 24, height: (SW - 24) * 1.42,
    borderRadius: 6, maxWidth: 480, maxHeight: 680,
    backgroundColor: '#fff',
  },
});
