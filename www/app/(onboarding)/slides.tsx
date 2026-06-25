import { useRef, useState, ReactNode } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Dimensions, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width: SW } = Dimensions.get('window');

// Match QuizCard: Amiri renders on web, native falls back to the system Arabic.
const QURAN_FONT = Platform.OS === 'web' ? 'AmiriQuranColored' : undefined;
const AMIRI_FONT = Platform.OS === 'web' ? 'Amiri-Regular' : undefined;

// ─────────────────────────────────────────────────────────────────────────────
// Preview components — faithful mini-versions of the real app screens, used to
// illustrate each onboarding slide. They are display-only (no interaction).
// ─────────────────────────────────────────────────────────────────────────────

// Mini quiz card — mirrors src/components/QuizCard.tsx (front face).
function QuizPreview() {
  const options = ['ٱلْعَٰلَمِينَ', 'ٱلنَّاسِ', 'ٱلْمَلِكِ', 'ٱلرَّحِيمِ', 'ٱلْكَرِيمِ'];
  return (
    <View style={p.card}>
      <View style={p.topBar}>
        <Text style={p.instruction}>اختر الكلمة التالية</Text>
        <View style={p.dotsRow}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={[p.qDot, i < 1 ? p.qDotDone : i === 1 ? p.qDotCurrent : p.qDotPending]}
            />
          ))}
        </View>
      </View>

      <View style={p.questionBox}>
        <Text style={p.questionText}>ٱلْحَمْدُ لِلَّهِ رَبِّ …</Text>
      </View>

      <View style={p.body}>
        <View style={p.optionsCol}>
          {options.map((o, i) => (
            <View key={i} style={[p.optionBtn, i === 0 && p.optionBtnRight]}>
              <Text style={p.optionText}>{o}</Text>
            </View>
          ))}
        </View>
        <View style={p.metaCol}>
          <View style={p.scoreBox}>
            <Text style={p.scoreMain}>140</Text>
            <Text style={p.scoreUp}>+20</Text>
          </View>
          <View style={p.skipBtn}>
            <Ionicons name="remove-circle-outline" size={16} color="#c0392b" />
            <Text style={p.skipText}>لا أعلم</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// Mini daily-challenge card — mirrors app/(app)/daily.tsx "available" state.
function DailyPreview() {
  return (
    <View style={p.dailyCard}>
      <View style={p.dailyTimer}>
        <Text style={p.dailyTimerNum}>8</Text>
        <Text style={p.dailyTimerUnit}>ث</Text>
      </View>
      <Ionicons name="star" size={34} color="#f39c12" />
      <Text style={p.dailyTitle}>اختبار اليوم جاهز!</Text>
      <Text style={p.dailyBody}>١٠ أسئلة بمؤقّت — أجب بسرعة ودقّة</Text>
      <View style={p.dailyStartBtn}>
        <Ionicons name="play" size={16} color="#fff" />
        <Text style={p.dailyStartTxt}> ابدأ الاختبار</Text>
      </View>
    </View>
  );
}

// Mini leaderboard — mirrors app/(app)/league.tsx rows.
function LeaguePreview() {
  const rows = [
    { medal: '🥇', flag: '🇸🇦', name: 'أبو محمد', score: 980, me: false },
    { medal: '🥈', flag: '🇪🇬', name: 'حفصة', score: 940, me: false },
    { medal: '🥉', flag: '🇲🇦', name: 'يوسف', score: 910, me: false },
    { medal: '4', flag: '🇩🇿', name: 'أنت', score: 870, me: true },
  ];
  return (
    <View style={p.boardCard}>
      <Text style={p.boardTitle}>المتصدّرون اليوم</Text>
      {rows.map((r, i) => (
        <View key={i} style={[p.boardRow, r.me && p.boardRowMe]}>
          <Text style={p.boardMedal}>{r.medal}</Text>
          <Text style={p.boardFlag}>{r.flag}</Text>
          <Text style={[p.boardName, r.me && p.boardNameMe]} numberOfLines={1}>{r.name}</Text>
          <Text style={[p.boardScore, r.me && p.boardScoreMe]}>{r.score}</Text>
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
  const items = [
    { icon: 'help-circle' as const, label: 'اختبار' },
    { icon: 'star' as const, label: 'تحدٍّ يومي' },
    { icon: 'trophy' as const, label: 'ترتيب' },
  ];
  return (
    <View style={p.badgesRow}>
      {items.map((it, i) => (
        <View key={i} style={p.badge}>
          <Ionicons name={it.icon} size={26} color="#f39c12" />
          <Text style={p.badgeLabel}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

export default function SlidesScreen() {
  const router = useRouter();
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
      style={s.container}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && w !== frameW) setFrameW(w);
      }}
    >
      <View style={s.header}>
        {current > 0 ? (
          <TouchableOpacity style={s.backBtn} onPress={goBack}>
            <Ionicons name="chevron-forward" size={22} color="#9bbdd4" />
          </TouchableOpacity>
        ) : <View style={s.backBtn} />}
        <TouchableOpacity style={s.skipBtn} onPress={skip}>
          <Text style={s.skipTxt}>تخطي</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        style={s.list}
        extraData={frameW}
        getItemLayout={(_, index) => ({ length: frameW, offset: frameW * index, index })}
        renderItem={({ item }) => (
          <View style={[s.slide, { width: frameW }]}>
            <Text style={s.title}>{item.title}</Text>
            <Text style={s.body}>{item.body}</Text>
            {item.points && (
              <View style={s.points}>
                {item.points.map((pt: string, i: number) => (
                  <View key={i} style={s.pointRow}>
                    <Text style={s.pointText}>{pt}</Text>
                    <Ionicons name="checkmark-circle" size={18} color="#f39c12" />
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
          <View key={i} style={[s.dot, i === current && s.dotActive]} />
        ))}
      </View>

      <TouchableOpacity style={s.nextBtn} onPress={goNext}>
        <Text style={s.nextTxt}>
          {current < SLIDES.length - 1 ? 'التالي' : 'ابدأ'}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d2d4e', alignItems: 'center' },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  backBtn: { padding: 16, width: 54 },
  skipBtn: { padding: 16 },
  skipTxt: { color: '#9bbdd4', fontSize: 14 },
  list: { flex: 1, width: '100%' },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 16,
  },
  title: { fontSize: 26, fontWeight: '700', color: '#fff', textAlign: 'center' },
  body: {
    fontSize: 15,
    color: '#c4d8e8',
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
  dots: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { backgroundColor: '#f39c12', width: 24 },
  nextBtn: {
    backgroundColor: '#f39c12',
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 30,
    marginBottom: 32,
  },
  nextTxt: { fontSize: 18, fontWeight: '700', color: '#0d2d4e' },
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
  instruction: { fontSize: 10, color: '#7f8c8d', fontFamily: AMIRI_FONT, textAlign: 'right' },
  dotsRow: { flexDirection: 'row-reverse', gap: 3 },
  qDot: { width: 6, height: 6, borderRadius: 3 },
  qDotDone: { backgroundColor: '#27ae60' },
  qDotCurrent: { backgroundColor: '#1a5276' },
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
  optionBtnRight: { backgroundColor: '#eafaf1', borderColor: '#27ae60' },
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
  scoreMain: { fontSize: 16, fontWeight: '700', color: '#1a5276' },
  scoreUp: { color: '#27ae60', fontSize: 11, fontWeight: '600' },
  skipBtn: { alignItems: 'center', gap: 2, paddingVertical: 2 },
  skipText: { fontSize: 10, color: '#c0392b', fontFamily: AMIRI_FONT },

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
  dailyTimerNum: { fontSize: 18, fontWeight: '700', color: '#e74c3c' },
  dailyTimerUnit: { fontSize: 10, color: '#e74c3c' },
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
  boardScoreMe: { color: '#f39c12' },

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
