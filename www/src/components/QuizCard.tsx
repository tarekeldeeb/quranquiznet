import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  ScrollView, Modal, Image, Share, Platform,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, interpolate, Extrapolation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { QuestionObject, Q_TYPE } from '../models/questionnaire';
import {
  removeAyaNum, SURA_AYAS, SURA_IDX, QURAN_WORDS, getSuraIdx,
  getSuraTanzil, getPageURLFromSuraAyah, suraNameLocalized,
} from '../models/constants';
import QuranText from './QuranText';
import PressScale from './PressScale';
import { useTheme, arNum, localeNum, radii } from '../theme/tokens';
import { useDirection, rowDir, alignDir } from '../theme/direction';
import { hapticTick } from '../services/haptics';

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
// and the answer options) so they all visually match. (Native intentionally
// keeps falling back to the system Arabic font here — UthmanTN's diacritic
// mark positioning depends on OpenType shaping that native text engines don't
// apply the same way a WebView does; this is a tested workaround, not a gap.)
const QURAN_FONT = Platform.OS === 'web' ? 'UthmanTN' : undefined;
// Amiri is the "ceremony" face — reserved for the sura-name reveal on the
// back of the card. Loads on every platform now (see app/_layout.tsx).
const AMIRI_FONT = 'Amiri-Regular';

// How long the post-answer reveal (correct/picked-wrong markers + score fly)
// stays on the front face before the card flips to show the full ayah.
const REVEAL_DELAY = 700;

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
  // Which shuffled-option index is the correct answer / which one the player
  // picked — drives the post-answer reveal. Only meaningful for the live
  // (isActive) card; historical cards fall back to the plain flip.
  correctIndex?: number;
  pickedIndex?: number | null;
}

export default function QuizCard({
  card, isActive, score, scoreUp, isDailyMode, timerValue, timerMax,
  onSelectOption, onSkip, onScrollDown, onReport, round, totalRounds,
  shuffledOptions, flipTrigger, isCorrect, correctIndex, pickedIndex,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { isRTL, language } = useDirection();
  // paper and card sit close together by design in both palettes (a warm
  // cream-vs-white step in light, a subtle navy-vs-navy step in dark) — the
  // card was relying entirely on a fixed, light-mode-tuned shadow
  // (rgba(0,0,0,0.08)) for edge definition, which reads as basically nothing
  // against an already-dark background. A themed border (colors.line, tuned
  // per palette) plus colors.shadow (9% in light, a much stronger 40% in
  // dark to compensate for shadows barely registering there) gives the card
  // a visible edge in both modes instead of blending into the screen.
  const cardSurface = {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    boxShadow: `0px 2px 8px ${colors.shadow}`,
  };
  const flip = useSharedValue(0);
  const [imgVisible, setImgVisible] = React.useState(false);
  // Once the flip completes we swap which face is in normal flow, so the
  // wrapper collapses to the (shorter) back height instead of keeping the
  // taller front height. Safe because a card never flips back.
  const [flipped, setFlipped] = React.useState(false);

  const sura     = getSuraIdx(card.qo.startIdx);
  const suraName = suraNameLocalized(sura);
  const suraInfo = `${getSuraTanzil(card.qo.startIdx)} · ${t('quizCard.ayahCount', { count: SURA_AYAS[sura] })}`;
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
      // Let the reveal (correct/picked-wrong markers + score fly) play on the
      // front face before flipping to the full-ayah back.
      const t0 = setTimeout(() => { flip.value = withTiming(1, { duration: 420 }); }, REVEAL_DELAY);
      const t1 = setTimeout(() => setFlipped(true), REVEAL_DELAY + 430);
      return () => { clearTimeout(t0); clearTimeout(t1); };
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

  // ── Timer bar (peripheral top bar, not a side column) ──────────────────────
  const timerPct = timerMax > 0 ? timerValue / timerMax : 0;
  const timerShared = useSharedValue(timerPct);
  useEffect(() => {
    timerShared.value = withTiming(timerPct, { duration: 950 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerPct]);
  const timerUrgent = isDailyMode && timerValue > 0 && timerValue <= 3;
  const timerBarStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(1, timerShared.value)) * 100}%`,
  }));
  useEffect(() => {
    if (timerUrgent && isActive) hapticTick();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerValue, timerUrgent, isActive]);

  // ── Post-answer reveal + score fly/count-up (live card only) ───────────────
  const showReveal = isActive && flipTrigger > 0 && correctIndex != null && correctIndex >= 0;
  const [displayScore, setDisplayScore] = useState(score);
  const flyOpacity = useSharedValue(0);
  const flyTranslateY = useSharedValue(0);
  const flyStyle = useAnimatedStyle(() => ({
    opacity: flyOpacity.value,
    transform: [{ translateY: flyTranslateY.value }],
  }));

  useEffect(() => {
    if (isActive && flipTrigger > 0 && isCorrect) {
      const from = Math.max(0, score - scoreUp);
      const to = score;
      const duration = 500;
      const start = Date.now();
      let raf: ReturnType<typeof requestAnimationFrame> | undefined;
      const tick = () => {
        const t = Math.min(1, (Date.now() - start) / duration);
        const eased = 1 - (1 - t) ** 3;
        setDisplayScore(Math.round(from + (to - from) * eased));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      flyOpacity.value = 1;
      flyTranslateY.value = 0;
      flyOpacity.value = withTiming(0, { duration: 650 });
      flyTranslateY.value = withTiming(-26, { duration: 650 });
      return () => { if (raf) cancelAnimationFrame(raf); };
    }
    setDisplayScore(score);
    return undefined;
  // Deliberately keyed on flipTrigger alone: the count-up should replay only
  // when a new answer lands, not on every incidental `score`/`isCorrect` churn.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipTrigger]);

  const borderColor = isCorrect ? colors.correct : colors.wrong;

  async function handleShare() {
    try {
      await Share.share({
        message: t('quizCard.shareMsg', {
          appName: t('common.appName'),
          url: card.socialURL,
        }),
        url: card.socialURL,
      });
    } catch { /* ignore */ }
  }

  return (
    <View style={s.wrapper}>
      {/* ── FRONT ─────────────────────────────────────────────────────────── */}
      {/* pointerEvents: backfaceVisibility only hides the flipped-away face
          visually — on iOS/Android it still receives touches, so the stacked
          (absolute) face silently swallowed taps meant for the face underneath
          (e.g. most option buttons while the shorter back face sat on top).
          Explicitly disabling events on whichever face isn't in flow fixes it. */}
      <Animated.View
        testID="quiz-card-front"
        style={[s.card, cardSurface, frontStyle, flipped && s.faceAbsolute]}
        pointerEvents={flipped ? 'none' : 'auto'}
      >

        {/* Instruction + progress dots — colors.card (not paper) so this
            reads as the card's own header, not a strip that blends into the
            page background sitting behind the card. */}
        <View style={[s.topBar, { backgroundColor: colors.card, borderColor: colors.line, flexDirection: rowDir(isRTL) }]}>
          <Text style={[s.instruction, { color: colors.inkSoft, textAlign: alignDir(isRTL) }]}>{t(card.qo.qType.txt)}</Text>
          <View style={[s.dotsRow, { flexDirection: rowDir(isRTL) }]}>
            {Array.from({ length: totalRounds }, (_, i) => (
              <View
                key={i}
                style={[
                  s.dot,
                  i < round ? { backgroundColor: colors.correct }
                    : i === round ? { backgroundColor: colors.navySoft }
                    : { backgroundColor: colors.line },
                ]}
              />
            ))}
          </View>
        </View>

        {/* Depleting timer bar — peripheral, not a side column. Gold → red in
            the last 3 seconds, the color shift itself is the urgency cue. */}
        {isDailyMode && (
          <View style={[s.timerTrack, { backgroundColor: colors.goldPale }]}>
            <Animated.View style={[s.timerFill, timerBarStyle, { backgroundColor: timerUrgent ? colors.wrong : colors.gold }]} />
          </View>
        )}

        {/* Question text — render directly so the box grows with the text
            (a ScrollView here collapsed and cropped the diacritics). */}
        <View style={[s.questionBox, { backgroundColor: colors.paper, borderColor: colors.line }]}>
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
              style={[s.questionText, { color: colors.ink }]}
            />
          ) : (
            <Text style={[s.questionText, { color: colors.ink }]}>{questionTxt}</Text>
          )}
        </View>

        {/* Body: options + meta */}
        <View style={s.body}>
          {/* Options */}
          <View style={s.optionsCol}>
            {[0, 1, 2, 3, 4].map((i) => {
              const isCorrectOpt = showReveal && i === correctIndex;
              const isPickedWrong = showReveal && pickedIndex != null && i === pickedIndex && i !== correctIndex;
              return (
                <PressScale
                  key={i}
                  style={[
                    s.optionBtn,
                    { backgroundColor: colors.paper, borderColor: colors.line },
                    !isActive && { opacity: 0.7 },
                    isCorrectOpt && { backgroundColor: colors.correctPale, borderColor: colors.correct },
                    isPickedWrong && { backgroundColor: colors.wrongPale, borderColor: colors.wrong },
                  ]}
                  onPress={() => isActive && onSelectOption(i)}
                  disabled={!isActive}
                  accessibilityRole="button"
                >
                  <Text style={[s.optionText, { color: colors.ink }, !isActive && { color: colors.inkSoft }]}>
                    {shuffledOptions[i] ?? ''}
                  </Text>
                  {isCorrectOpt && <Text style={[s.optionMark, { color: colors.correct }]}>{t('quizCard.correctMark')}</Text>}
                  {isPickedWrong && <Text style={[s.optionMark, { color: colors.wrong }]}>{t('quizCard.pickedWrongMark')}</Text>}
                </PressScale>
              );
            })}
          </View>

          {/* Meta: score (always) + the live fly/count-up badge */}
          <View style={s.metaCol}>
            <View style={[s.scoreBox, { borderColor: colors.line }]}>
              <Text style={[s.scoreMain, { color: colors.ink }]}>{arNum(displayScore)}</Text>
              <View style={s.scoreUpWrap}>
                <Text style={[s.scoreUp, { color: colors.correct }]}>+{arNum(scoreUp)}</Text>
                {showReveal && isCorrect && (
                  <Animated.Text style={[s.scoreFly, { color: colors.correct }, flyStyle]}>
                    +{arNum(scoreUp)} ↗
                  </Animated.Text>
                )}
              </View>
            </View>

            <PressScale style={s.skipBtn} onPress={() => isActive && onSkip()} disabled={!isActive}>
              <Ionicons name="remove-circle-outline" size={18} color={isActive ? colors.wrong : colors.line} />
              <Text style={[s.skipText, { color: isActive ? colors.wrong : colors.line }]}>{t('quizCard.skip')}</Text>
            </PressScale>
          </View>
        </View>
      </Animated.View>

      {/* ── BACK ──────────────────────────────────────────────────────────── */}
      <Animated.View
        testID="quiz-card-back"
        style={[s.card, cardSurface, backStyle, !flipped && s.faceAbsolute, { borderColor, borderWidth: 2 }]}
        pointerEvents={flipped ? 'auto' : 'none'}
      >

        {/* Sura / aya header — name+aya leads (reading-start), info trails */}
        <View style={[s.backHeader, { backgroundColor: colors.paper, borderBottomColor: borderColor, borderBottomWidth: 2, flexDirection: rowDir(isRTL) }]}>
          <Text style={[s.backSuraName, { color: colors.ink, fontFamily: AMIRI_FONT, textAlign: alignDir(isRTL) }]}>{t('quizCard.answerOption.sura', { name: suraName })} · {t('quizCard.ayahLabel', { number: localeNum(card.answerAya, language) })}</Text>
          <View style={s.backHeaderInfo}>
            <Text style={[s.backSuraInfo, { color: colors.inkSoft }]}>{suraInfo}</Text>
          </View>
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
              style={[s.answerText, { color: colors.ink }]}
            />
          ) : (
            <Text style={[s.answerText, { color: colors.ink }]}>{card.qo.txt.answer} …</Text>
          )}
        </ScrollView>

        {/* Action row */}
        <View style={[s.actionRow, { borderColor: colors.line }]}>
          <PressScale style={[s.actionBtn, { backgroundColor: colors.navy }]} onPress={onScrollDown}>
            <Ionicons name="chevron-down" size={16} color="#fff" />
            <Text style={s.actionBtnTxt}> {t('quizCard.ok')}</Text>
          </PressScale>
          <PressScale style={[s.actionBtn, { backgroundColor: colors.paper }]} onPress={() => setImgVisible(true)}>
            <Ionicons name="book-outline" size={16} color={colors.ink} />
            <Text style={[s.actionBtnTxt, { color: colors.ink }]}> {t('quizCard.view')}</Text>
          </PressScale>
          {/* Share links to /quiz?start=<word>, which only reproduces normal
              "complete the verse" questions — so hide it on special questions. */}
          {card.qo.qType.id === Q_TYPE.NOTSPECIAL.id && (
            <PressScale style={[s.actionBtn, { backgroundColor: colors.paper }]} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={16} color={colors.ink} />
              <Text style={[s.actionBtnTxt, { color: colors.ink }]}> {t('quizCard.compete')}</Text>
            </PressScale>
          )}
          <PressScale style={[s.reportBtn, { backgroundColor: colors.wrongPale }]} onPress={() => onReport(card)}>
            <Ionicons name="flag-outline" size={17} color={colors.wrong} />
          </PressScale>
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
    borderRadius: radii.lg,
    elevation: 3,
    overflow: 'hidden',
  },
  // The out-of-flow face: stacked on top, so only the in-flow face drives the
  // wrapper height (front before the flip, back after it).
  faceAbsolute: { position: 'absolute', top: 0, left: 0 },

  // ── FRONT ────────────────────────────────────────────────────────────────
  topBar: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
  },
  instruction: {
    fontSize: 11,
    flexShrink: 1,
  },
  dotsRow: {
    gap: 4,
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    maxWidth: '55%',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },

  timerTrack: { height: 4, width: '100%', overflow: 'hidden' },
  timerFill: { height: 4, borderRadius: 2 },

  questionBox: {
    borderBottomWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    minHeight: 60,
  },
  questionText: {
    fontSize: 22,
    fontFamily: QURAN_FONT,
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

  optionsCol: { flex: 2, gap: 6 },
  optionBtn: {
    borderRadius: radii.sm,
    // Bigger touch targets — 9px was below the 44pt floor on small phones.
    paddingVertical: 13,
    paddingHorizontal: 10,
    borderWidth: 1,
  },
  optionText: {
    fontSize: 17,
    fontFamily: QURAN_FONT,
    textAlign: 'center',
    writingDirection: 'rtl',
    lineHeight: 28,
  },
  optionMark: {
    fontSize: 10,
    fontFamily: 'PlexArabic-SemiBold',
    textAlign: 'center',
    marginTop: 2,
  },

  metaCol: {
    width: 68,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  scoreBox: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingVertical: 8,
    paddingHorizontal: 6,
    width: '100%',
    gap: 2,
  },
  scoreMain: { fontSize: 20, fontFamily: 'PlexArabic-Bold' },
  scoreUpWrap: { alignItems: 'center' },
  scoreUp:   { fontSize: 12, fontFamily: 'PlexArabic-SemiBold' },
  scoreFly: {
    position: 'absolute',
    top: -2,
    fontSize: 12,
    fontFamily: 'PlexArabic-Bold',
  },

  skipBtn: { alignItems: 'center', gap: 3, paddingVertical: 4 },
  skipText: { fontSize: 11 },

  // ── BACK ─────────────────────────────────────────────────────────────────
  backHeader: {
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backHeaderInfo: { alignItems: 'flex-start' },
  backSuraName: {
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
  },
  backSuraInfo: {
    fontSize: 12,
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
  },

  actionRow: {
    flexDirection: 'row-reverse',
    borderTopWidth: 1,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    gap: 2,
  },
  actionBtnTxt: { color: '#fff', fontFamily: 'PlexArabic-SemiBold', fontSize: 13 },
  reportBtn: {
    width: 44, alignItems: 'center', justifyContent: 'center',
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
