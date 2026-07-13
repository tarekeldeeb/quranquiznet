import { useRef, useState, ReactNode } from 'react';
import {
  View, Text, FlatList, StyleSheet, Dimensions, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, arNum, radii } from '../../src/theme/tokens';
import PressScale from '../../src/components/PressScale';

const { width: SW } = Dimensions.get('window');

// Same native caveat as QuizCard: UthmanTN's diacritic shaping depends on a
// browser's OpenType support, so native intentionally falls back to the
// system Arabic font here rather than showing malformed marks.
const QURAN_FONT = Platform.OS === 'web' ? 'UthmanTN' : undefined;

// ─────────────────────────────────────────────────────────────────────────────
// Preview components — faithful mini-versions of the real app screens, used to
// illustrate each onboarding slide. QuizPreview is genuinely answerable — the
// strongest hook a quiz game can offer during onboarding is a real answer.
// ─────────────────────────────────────────────────────────────────────────────

// Mini quiz card — mirrors src/components/QuizCard.tsx (front face), and is
// actually answerable: tap an option, see the same green/red reveal the real
// quiz card uses, then continue.
function QuizPreview() {
  const { colors } = useTheme();
  const options = ['ٱلْعَٰلَمِينَ', 'ٱلنَّاسِ', 'ٱلْمَلِكِ', 'ٱلرَّحِيمِ', 'ٱلْكَرِيمِ'];
  const correctIndex = 0;
  const [picked, setPicked] = useState<number | null>(null);
  const isCorrect = picked === correctIndex;

  return (
    <View style={[p.card, { backgroundColor: colors.card }]}>
      <View style={[p.topBar, { backgroundColor: colors.paper, borderColor: colors.line }]}>
        <Text style={[p.instruction, { color: colors.inkSoft }]}>اختر الكلمة التالية</Text>
        <View style={p.dotsRow}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={[p.qDot, { backgroundColor: i < 1 ? colors.correct : i === 1 ? colors.navySoft : colors.line }]}
            />
          ))}
        </View>
      </View>

      <View style={[p.questionBox, { backgroundColor: colors.paper, borderColor: colors.line }]}>
        <Text style={[p.questionText, { color: colors.ink }]}>ٱلْحَمْدُ لِلَّهِ رَبِّ …</Text>
      </View>

      <View style={p.body}>
        <View style={p.optionsCol}>
          {options.map((o, i) => {
            const showCorrect = picked != null && i === correctIndex;
            const showWrong = picked != null && i === picked && i !== correctIndex;
            return (
              <PressScale
                key={i}
                style={[
                  p.optionBtn,
                  { backgroundColor: colors.paper, borderColor: colors.line },
                  showCorrect && { backgroundColor: colors.correctPale, borderColor: colors.correct },
                  showWrong && { backgroundColor: colors.wrongPale, borderColor: colors.wrong },
                ]}
                onPress={() => picked == null && setPicked(i)}
                disabled={picked != null}
              >
                <Text style={[p.optionText, { color: colors.ink }]}>{o}</Text>
              </PressScale>
            );
          })}
        </View>
        <View style={p.metaCol}>
          <View style={[p.scoreBox, { borderColor: colors.line }]}>
            <Text style={[p.scoreMain, { color: colors.ink }]}>{arNum(picked == null ? 140 : isCorrect ? 160 : 140)}</Text>
            <Text style={[p.scoreUp, { color: colors.correct }]}>+٢٠</Text>
          </View>
          <View style={p.skipBtn}>
            <Ionicons name="remove-circle-outline" size={16} color={colors.wrong} />
            <Text style={[p.skipText, { color: colors.wrong }]}>لا أعلم</Text>
          </View>
        </View>
      </View>

      {picked != null && (
        <Text style={[p.feedbackTxt, { color: isCorrect ? colors.correct : colors.goldDeep, borderColor: colors.line }]}>
          {isCorrect ? 'أحسنت! هكذا تبدو الأسئلة 🎉' : 'قريب — الصحيحة: ٱلْعَٰلَمِينَ'}
        </Text>
      )}
    </View>
  );
}

// Mini daily-challenge card — mirrors app/(app)/daily.tsx "available" state.
function DailyPreview() {
  const { colors } = useTheme();
  return (
    <View style={[p.dailyCard, { backgroundColor: colors.card }]}>
      <View style={p.dailyTimer}>
        <Text style={[p.dailyTimerNum, { color: colors.wrong }]}>٨</Text>
        <Text style={[p.dailyTimerUnit, { color: colors.wrong }]}>ث</Text>
      </View>
      <Ionicons name="star" size={34} color={colors.gold} />
      <Text style={[p.dailyTitle, { color: colors.ink }]}>اختبار اليوم جاهز!</Text>
      <Text style={[p.dailyBody, { color: colors.inkSoft }]}>١٠ أسئلة بمؤقّت — أجب بسرعة ودقّة</Text>
      <View style={[p.dailyStartBtn, { backgroundColor: colors.navy }]}>
        <Ionicons name="play" size={16} color="#fff" />
        <Text style={p.dailyStartTxt}> ابدأ الاختبار</Text>
      </View>
    </View>
  );
}

// Mini leaderboard — mirrors app/(app)/league.tsx rows.
function LeaguePreview() {
  const { colors } = useTheme();
  const rows = [
    { medal: '🥇', flag: '🇸🇦', name: 'أبو محمد', score: 980, me: false },
    { medal: '🥈', flag: '🇪🇬', name: 'حفصة', score: 940, me: false },
    { medal: '🥉', flag: '🇲🇦', name: 'يوسف', score: 910, me: false },
    { medal: '٤', flag: '🇩🇿', name: 'أنت', score: 870, me: true },
  ];
  return (
    <View style={[p.boardCard, { backgroundColor: colors.card }]}>
      <Text style={[p.boardTitle, { color: colors.ink, borderColor: colors.line }]}>المتصدّرون اليوم</Text>
      {rows.map((r, i) => (
        <View key={i} style={[p.boardRow, { borderColor: colors.line }, r.me && { backgroundColor: colors.goldPale }]}>
          <Text style={p.boardMedal}>{r.medal}</Text>
          <Text style={p.boardFlag}>{r.flag}</Text>
          <Text style={[p.boardName, { color: colors.ink }, r.me && { color: colors.goldDeep, fontFamily: 'PlexArabic-Bold' }]} numberOfLines={1}>{r.name}</Text>
          <Text style={[p.boardScore, { color: colors.ink }, r.me && { color: colors.goldDeep }]}>{arNum(r.score)}</Text>
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface Slide {
  title: string;
  body: string;
  points?: string[];
  visual: ReactNode;
}

const SLIDES: Slide[] = [
  {
    title: 'اختبر حفظك',
    body: 'تطبيق يختبر حفظك للقرآن الكريم بأسئلة اختيار من متعدد، وتنافس مع حفّاظ من حول العالم.',
    points: ['أسئلة على نطاق حفظك أنت', 'تحدٍّ يومي بالمؤقّت', 'ترتيب عالمي للمتصدّرين'],
    visual: <FeatureBadges />,
  },
  {
    title: 'كيف يعمل؟',
    body: 'يظهر لك مقطع من آية، فتختار الكلمة التالية الصحيحة من بين خمسة خيارات. كل إجابة صحيحة ترفع نقاطك، وإن أخطأت نكشف لك الآية كاملة وموضعها في المصحف.',
    visual: <QuizPreview />,
  },
  {
    title: 'التحدي اليومي',
    body: '١٠ أسئلة جديدة كل يوم ضمن نطاق حفظك، مع مؤقّت زمني. أجب بسرعة ودقّة لتجمع أعلى عدد من النقاط قبل انتهاء الوقت.',
    visual: <DailyPreview />,
  },
  {
    title: 'تصدّر الترتيب',
    body: 'قارن نتيجتك مع الحفّاظ حول العالم في لوحة المتصدّرين — ترتيب اليوم وترتيب كل الأوقات. اجمع النقاط وتسلّق القائمة.',
    visual: <LeaguePreview />,
  },
];

// Small feature row for the welcome slide.
function FeatureBadges() {
  const { colors } = useTheme();
  const items = [
    { icon: 'help-circle' as const, label: 'اختبار' },
    { icon: 'star' as const, label: 'تحدٍّ يومي' },
    { icon: 'trophy' as const, label: 'ترتيب' },
  ];
  return (
    <View style={p.badgesRow}>
      {items.map((it, i) => (
        <View key={i} style={[p.badge, { borderColor: `${colors.gold}59` }]}>
          <Ionicons name={it.icon} size={26} color={colors.gold} />
          <Text style={p.badgeLabel}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

export default function SlidesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [current, setCurrent] = useState(0);
  // Width of the actual rendered column (the web frame caps it at ~512px),
  // NOT the full browser window. Measured via onLayout so each slide and the
  // paging offsets match the visible container instead of overflowing it.
  const [frameW, setFrameW] = useState(SW);
  const listRef = useRef<FlatList>(null);

  function goNext() {
    if (current < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: current + 1, animated: true });
      setCurrent(current + 1);
    } else {
      router.replace('/(onboarding)/setup');
    }
  }

  function goBack() {
    if (current > 0) {
      listRef.current?.scrollToIndex({ index: current - 1, animated: true });
      setCurrent(current - 1);
    }
  }

  function skip() {
    router.replace('/(onboarding)/setup');
  }

  return (
    <SafeAreaView
      style={[s.container, { backgroundColor: colors.navy }]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && w !== frameW) setFrameW(w);
      }}
    >
      <View style={s.header}>
        {current > 0 ? (
          <PressScale style={s.backBtn} onPress={goBack}>
            <Ionicons name="chevron-forward" size={22} color={colors.navySoft} />
          </PressScale>
        ) : <View style={s.backBtn} />}
        <PressScale style={s.skipBtn} onPress={skip}>
          <Text style={[s.skipTxt, { color: colors.navySoft }]}>تخطي</Text>
        </PressScale>
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        horizontal
        inverted
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        style={s.list}
        extraData={frameW}
        getItemLayout={(_, index) => ({ length: frameW, offset: frameW * index, index })}
        renderItem={({ item }) => (
          <View style={[s.slide, { width: frameW }]}>
            <Text style={s.title}>{item.title}</Text>
            <Text style={[s.body, { color: colors.navySoft }]}>{item.body}</Text>
            {item.points && (
              <View style={s.points}>
                {item.points.map((pt: string, i: number) => (
                  <View key={i} style={s.pointRow}>
                    <Text style={s.pointText}>{pt}</Text>
                    <Ionicons name="checkmark-circle" size={18} color={colors.gold} />
                  </View>
                ))}
              </View>
            )}
            <View style={s.visualWrap}>{item.visual}</View>
          </View>
        )}
      />

      <View style={s.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[s.dot, i === current && { backgroundColor: colors.gold, width: 24 }]} />
        ))}
      </View>

      <PressScale style={[s.nextBtn, { backgroundColor: colors.gold, shadowColor: colors.goldDeep }]} onPress={goNext}>
        <Text style={[s.nextTxt, { color: colors.navy }]}>
          {current < SLIDES.length - 1 ? 'التالي' : 'ابدأ'}
        </Text>
      </PressScale>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  header: {
    width: '100%',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  backBtn: { padding: 16, width: 54 },
  skipBtn: { padding: 16 },
  skipTxt: { fontSize: 14 },
  list: { flex: 1, width: '100%' },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 16,
  },
  title: { fontSize: 26, fontFamily: 'PlexArabic-Bold', color: '#fff', textAlign: 'center' },
  body: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 26,
    writingDirection: 'rtl',
  },
  points: { gap: 8, alignSelf: 'stretch', paddingHorizontal: 8 },
  pointRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  pointText: { color: '#e8f0f7', fontSize: 14, textAlign: 'right', flexShrink: 1 },
  visualWrap: { marginTop: 8, alignItems: 'center' },
  dots: { flexDirection: 'row-reverse', gap: 8, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  nextBtn: {
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: radii.pill,
    marginBottom: 32,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  nextTxt: { fontSize: 18, fontFamily: 'PlexArabic-Bold' },
});

// Preview styles — kept close to the real screens but scaled down.
const PREVIEW_W = Math.min(SW - 72, 300);

const p = StyleSheet.create({
  // ── Quiz card ──────────────────────────────────────────────────────────────
  card: {
    width: PREVIEW_W,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0px 2px 8px rgba(0,0,0,0.18)',
    elevation: 3,
  },
  topBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f0f4f8',
    borderBottomWidth: 1,
    borderColor: '#e0e6ed',
  },
  instruction: { fontSize: 10, color: '#7f8c8d', textAlign: 'right' },
  dotsRow: { flexDirection: 'row-reverse', gap: 3 },
  qDot: { width: 6, height: 6, borderRadius: 3 },
  qDotDone: { backgroundColor: '#2f7d5d' },
  qDotCurrent: { backgroundColor: '#0d2d4e' },
  qDotPending: { backgroundColor: '#d5dce5' },
  questionBox: {
    backgroundColor: '#fdfaf5',
    borderBottomWidth: 1,
    borderColor: '#e8e0d0',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  questionText: {
    fontSize: 18,
    fontFamily: QURAN_FONT,
    color: '#1a1a1a',
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 36,
  },
  body: { flexDirection: 'row-reverse', padding: 8, gap: 6 },
  optionsCol: { flex: 2, gap: 4 },
  optionBtn: {
    backgroundColor: '#eef2f7',
    borderRadius: 7,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#dde4ed',
  },
  optionText: {
    fontSize: 14,
    fontFamily: QURAN_FONT,
    textAlign: 'center',
    writingDirection: 'rtl',
    color: '#2c3e50',
    lineHeight: 24,
  },
  metaCol: { width: 56, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 },
  scoreBox: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d5dce5',
    borderRadius: 7,
    paddingVertical: 6,
    paddingHorizontal: 4,
    width: '100%',
    gap: 1,
  },
  scoreMain: { fontSize: 16, fontWeight: '700', color: '#0d2d4e' },
  scoreUp: { color: '#2f7d5d', fontSize: 11, fontWeight: '600' },
  skipBtn: { alignItems: 'center', gap: 2, paddingVertical: 2 },
  skipText: { fontSize: 10, color: '#c0392b' },
  feedbackTxt: { fontSize: 12, fontFamily: 'PlexArabic-SemiBold', textAlign: 'center', padding: 8, borderTopWidth: 1 },

  // ── Daily card ─────────────────────────────────────────────────────────────
  dailyCard: {
    width: PREVIEW_W,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
    boxShadow: '0px 2px 8px rgba(0,0,0,0.18)',
    elevation: 3,
  },
  dailyTimer: {
    position: 'absolute',
    top: 10,
    left: 12,
    flexDirection: 'row-reverse',
    alignItems: 'baseline',
    gap: 1,
  },
  dailyTimerNum: { fontSize: 18, fontWeight: '700', color: '#b3473d' },
  dailyTimerUnit: { fontSize: 10, color: '#b3473d' },
  dailyTitle: { fontSize: 17, fontWeight: '700', color: '#0d2d4e', textAlign: 'center' },
  dailyBody: { fontSize: 12, color: '#666', textAlign: 'center' },
  dailyStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d2d4e',
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 8,
    marginTop: 2,
  },
  dailyStartTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // ── Leaderboard ────────────────────────────────────────────────────────────
  boardCard: {
    width: PREVIEW_W,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0px 2px 8px rgba(0,0,0,0.18)',
    elevation: 3,
  },
  boardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0d2d4e',
    textAlign: 'right',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
  },
  boardRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderColor: '#f5f5f5',
  },
  boardRowMe: { backgroundColor: '#d8e8f2' },
  boardMedal: { width: 24, fontSize: 14, textAlign: 'center' },
  boardFlag: { fontSize: 15, width: 22, textAlign: 'center' },
  boardName: { flex: 1, fontSize: 13, color: '#333', textAlign: 'right' },
  boardNameMe: { fontWeight: '700', color: '#0d2d4e' },
  boardScore: { fontSize: 14, fontWeight: '700', color: '#0d2d4e', minWidth: 38, textAlign: 'left' },
  boardScoreMe: { color: '#c8973a' },

  // ── Welcome feature badges ───────────────────────────────────────────────────
  badgesRow: { flexDirection: 'row-reverse', gap: 14, marginTop: 4 },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(243,156,18,0.35)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 6,
    width: 92,
  },
  badgeLabel: { color: '#e8f0f7', fontSize: 12, fontWeight: '600' },
});
