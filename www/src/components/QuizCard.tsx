import React, { useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  ScrollView, Modal, Image, Share, Platform,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, interpolate, Extrapolation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { QuestionObject, Q_TYPE } from '../models/questionnaire';
import {
  removeAyaNum, SURA_NAME, SURA_AYAS, SURA_IDX, QURAN_WORDS, getSuraIdx,
  getSuraTanzil, getPageURLFromSuraAyah,
} from '../models/constants';
import QuranText from './QuranText';

// Word count of an Arabic snippet, ignoring aya-end markers in either form
// (raw ﴿123﴾ or the ۝ glyph removeAyaNum produces) — quran-madina-html does not
// count those markers as words, so neither must we.
function wordCount(text: string): number {
  return text
    .replace(/﴿[0-9]+﴾/g, ' ')
    .replace(/۝/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

// True once an excerpt (qq flat word indices, inclusive) whose range contains a sura's
// first word has also covered at least one of that sura's real (post-basmala) words —
// not just its basmala or a bare boundary. Only then is showing its name informative
// rather than a label with nothing of that sura under it yet. Applies both to excerpts
// that cross into a later sura and to ones that start right at a sura's head.
export function reachesNewSuraContent(qqStart: number, qqEnd: number): boolean {
  // A range running past the last word wraps around into Al-Fatiha (the Madina renderer's
  // words= walk wraps the same way). Its name is earned as soon as the wrap covers any of
  // its words: Al-Fatiha's basmala IS its real aya 1, and a bare بسم reveals nothing (every
  // basmala reads the same), so no post-basmala gating applies.
  if (qqEnd > QURAN_WORDS) return true;
  const endSura = getSuraIdx(qqEnd);
  const suraFirstWord = endSura === 0 ? 1 : SURA_IDX[endSura - 1];
  // Sura head not in range ⇒ the renderer draws no decoration line to gate.
  if (qqStart > suraFirstWord) return false;
  const hasBasmala = endSura !== 0 && endSura !== 8; // Al-Fatiha / At-Tawba have none
  return qqEnd >= suraFirstWord + (hasBasmala ? 4 : 0);
}

const { width: SW } = Dimensions.get('window');
// Cap card width so it's not absurdly wide on desktop/tablet
const CARD_W = Math.min(SW - 32, 480);

// Font families: Amiri/Uthman work on web; native falls back to system Arabic.
// QURAN_FONT is the same Uthman-script face quran-madina-html uses for the
// question text — used for every plain-text Quran fallback (question, answer,
// and the answer options) so they all visually match.
const QURAN_FONT = Platform.OS === 'web' ? 'UthmanTN' : undefined;
const AMIRI_FONT  = Platform.OS === 'web' ? 'Amiri-Regular'     : undefined;

export interface CardData {
  index: number;
  qo: QuestionObject;
  answerAya: number;
  wordOffset: number;     // 1-based position of startIdx within its aya (Madina renderer)
  socialURL: string;
  wasCorrect?: boolean;   // set when card is answered; undefined = still active
}

interface Props {
  card: CardData;
  isActive: boolean;
  score: number;
  scoreUp: number;
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
  card, isActive, score, scoreUp, isDailyMode, timerValue, timerMax,
  onSelectOption, onSkip, onScrollDown, onReport, round, totalRounds,
  shuffledOptions, flipTrigger, isCorrect,
}: Props) {
  const flip = useSharedValue(0);
  const [imgVisible, setImgVisible] = React.useState(false);
  // Once the flip completes we swap which face is in normal flow, so the
  // wrapper collapses to the (shorter) back height instead of keeping the
  // taller front height. Safe because a card never flips back.
  const [flipped, setFlipped] = React.useState(false);

  const sura     = getSuraIdx(card.qo.startIdx);
  const suraName = SURA_NAME[sura];
  const suraInfo = `${getSuraTanzil(card.qo.startIdx)} · ${SURA_AYAS[sura]} آية`;
  const pageURL  = getPageURLFromSuraAyah(sura, card.answerAya);

  // Madina renderer (web only — see QuranText.web.tsx) applies to real Quran
  // continuations; the special question types (sura name / aya count / number)
  // are not Quran text, so they keep the plain Text rendering.
  const useMadina  = card.qo.qType.id === Q_TYPE.NOTSPECIAL.id;
  const suraNum    = sura + 1;   // 1-based for quran-madina-html
  const questionTxt = removeAyaNum(card.qo.txt.question);
  // quran-madina-html >= 0.9.3 counts the basmala as 4 real words everywhere — including
  // the anchor sura's own basmala when the excerpt starts inside its first aya — same as
  // quranquiz's word DB, so card.wordOffset needs no adjustment before being used as-is.
  // (0.9.0–0.9.2 only counted crossed-into basmalas: questions starting in the first aya
  // of a basmala sura rendered 4 words late — common in the short suras near the end.)
  const qqStart    = card.qo.startIdx;
  const frontEnd   = qqStart + wordCount(questionTxt) - 1;
  const backEnd    = qqStart + wordCount(card.qo.txt.answer) - 1;
  const frontWords = `${card.wordOffset}-${card.wordOffset + wordCount(questionTxt) - 1}`;
  const backWords  = `${card.wordOffset}-${card.wordOffset + wordCount(card.qo.txt.answer) - 1}`;
  const frontHideTitle = !reachesNewSuraContent(qqStart, frontEnd);
  const backHideTitle  = !reachesNewSuraContent(qqStart, backEnd);

  useEffect(() => {
    if (flipTrigger > 0) {
      flip.value = withTiming(1, { duration: 420 });
      const t = setTimeout(() => setFlipped(true), 430);
      return () => clearTimeout(t);
    }
    // Unanswered/active card (incl. a component instance reused for a new
    // question): always reset to the front face. Without this a leftover
    // flipped state shows a "completed" back face with no answer options.
    flip.value = 0;
    setFlipped(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipTrigger]);

  const frontStyle = useAnimatedStyle(() => ({
    backfaceVisibility: 'hidden',
    transform: [{ rotateY: `${interpolate(flip.value, [0, 1], [0, 180], Extrapolation.CLAMP)}deg` }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    backfaceVisibility: 'hidden',
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
      <Animated.View testID="quiz-card-front" style={[s.card, frontStyle, flipped && s.faceAbsolute]}>

        {/* Instruction + progress dots */}
        <View style={s.topBar}>
          <Text style={s.instruction}>{card.qo.qType.txt}</Text>
          <View style={s.dotsRow}>
            {Array.from({ length: totalRounds }, (_, i) => (
              <View key={i} style={[s.dot, i < round ? s.dotDone : i === round ? s.dotCurrent : s.dotPending]} />
            ))}
          </View>
        </View>

        {/* Question text — render directly so the box grows with the text
            (a ScrollView here collapsed and cropped the diacritics). */}
        <View style={s.questionBox}>
          {/* Render directly (no ScrollView — it collapsed and cropped the
              diacritics). useMadina picks the quran-madina-html renderer for real
              Quran ayat; everything else stays plain Text. */}
          {useMadina ? (
            <QuranText
              text={questionTxt}
              sura={suraNum}
              aya={card.answerAya}
              words={frontWords}
              hideTitle={frontHideTitle}
              style={s.questionText}
            />
          ) : (
            <Text style={s.questionText}>{questionTxt}</Text>
          )}
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
      <Animated.View testID="quiz-card-back" style={[s.card, backStyle, !flipped && s.faceAbsolute, { borderColor, borderWidth: 2 }]}>

        {/* Sura / aya header */}
        <View style={[s.backHeader, { borderBottomColor: borderColor, borderBottomWidth: 2 }]}>
          <View style={s.backHeaderLeft}>
            <Text style={s.backSuraInfo}>{suraInfo}</Text>
          </View>
          <Text style={s.backSuraName}>سورة {suraName} · آية {card.answerAya}</Text>
        </View>

        {/* Answer text */}
        <ScrollView style={s.answerScroll} contentContainerStyle={s.answerContent}>
          {useMadina ? (
            <QuranText
              text={`${card.qo.txt.answer} …`}
              sura={suraNum}
              aya={card.answerAya}
              words={backWords}
              hideTitle={backHideTitle}
              style={s.answerText}
            />
          ) : (
            <Text style={s.answerText}>{card.qo.txt.answer} …</Text>
          )}
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
          {/* Share links to /quiz?start=<word>, which only reproduces normal
              "complete the verse" questions — so hide it on special questions. */}
          {card.qo.qType.id === Q_TYPE.NOTSPECIAL.id && (
            <TouchableOpacity style={[s.actionBtn, s.btnSecondary]} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={16} color="#1a5276" />
              <Text style={[s.actionBtnTxt, { color: '#1a5276' }]}> نافس</Text>
            </TouchableOpacity>
          )}
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
    marginBottom: 16,
  },
  card: {
    width: CARD_W,
    backgroundColor: '#fff',
    borderRadius: 14,
    boxShadow: '0px 2px 8px rgba(0,0,0,0.08)',
    elevation: 3,
    overflow: 'hidden',
  },
  // The out-of-flow face: stacked on top, so only the in-flow face drives the
  // wrapper height (front before the flip, back after it).
  faceAbsolute: { position: 'absolute', top: 0, left: 0 },

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
    paddingVertical: 14,
    paddingHorizontal: 12,
    minHeight: 60,
  },
  questionText: {
    fontSize: 22,
    fontFamily: QURAN_FONT,
    color: '#1a1a1a',
    textAlign: 'right',
    writingDirection: 'rtl',
    // Overrides QuranText's default edge-hugging alignment (see QuranText.web.tsx)
    // so the quran-madina-html block centers within questionBox instead of
    // sitting flush right with blank space on the other side.
    alignItems: 'center',
    // Generous line height so the Quran diacritics are not clipped.
    lineHeight: 46,
  },

  // RTL: options on the right, score/timer meta on the left (forceRTL does not
  // flip flexbox on react-native-web, so reverse it explicitly).
  body: { flexDirection: 'row-reverse', padding: 10, gap: 8 },

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
    textAlign: 'center',
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
    lineHeight: 46,
    textAlign: 'right',
    writingDirection: 'rtl',
    // Same QuranText edge-hugging override as questionText — centers the
    // quran-madina-html block within the answer scroll area.
    alignItems: 'center',
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
