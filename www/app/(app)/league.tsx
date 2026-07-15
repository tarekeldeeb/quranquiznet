import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, Alert, FlatList, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getDailyHead, subscribeYesterdayReport, subscribeMonthlyTopReport, subscribeTodayStandings,
  type DailyHead, type LeaderboardEntry,
} from '../../src/services/firebase';
import { findOwnRank, type RankedEntry } from '../../src/models/dailyRank';
import { useProfileStore } from '../../src/stores/profileStore';
import * as QS from '../../src/services/questionnaireService';
import { flagEmoji } from '../../src/models/constants';
import { useTheme, arNum, radii } from '../../src/theme/tokens';
import PressScale from '../../src/components/PressScale';

type Tab = 'today' | 'yesterday' | 'month';
type Status = 'loading' | 'available' | 'empty' | 'error';

const MEDAL = ['🥇', '🥈', '🥉'];
const PODIUM_TINTS = ['#c8973a', '#8a99a8', '#b06a3a']; // gold / silver / bronze accents

/** First-letter circle avatar — leaderboard entries carry no photo. */
function InitialAvatar({ name, size, tint, colors }: { name: string; size: number; tint?: string; colors: ReturnType<typeof useTheme>['colors'] }) {
  const letter = (name || '؟').trim().charAt(0);
  return (
    <View style={[s.initAvatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: tint ?? colors.goldPale }]}>
      <Text style={[s.initAvatarTxt, { fontSize: size * 0.42, color: tint ? '#fff' : colors.goldDeep }]}>{letter}</Text>
    </View>
  );
}

export default function LeagueScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const profile = useProfileStore();

  const [tab, setTab] = useState<Tab>('today');
  const [status, setStatus] = useState<Status>('loading');
  const [head, setHead] = useState<DailyHead | null>(null);
  const [yday, setYday] = useState<LeaderboardEntry[]>([]);
  const [monthTop, setMonthTop] = useState<LeaderboardEntry[]>([]);
  const [ydayLoaded, setYdayLoaded] = useState(false);
  const [monthLoaded, setMonthLoaded] = useState(false);
  // Today's live, unbounded standings (every submission so far today) — the
  // only feed with full participant coverage, so it's what powers "your rank"
  // and the اليوم tab.
  const [todayStandings, setTodayStandings] = useState<LeaderboardEntry[]>([]);

  const today = new Date().toISOString().split('T')[0];
  const dailyDone = profile.lastDailyCompletedDate === today;

  const checkDaily = useCallback(async () => {
    setStatus('loading');
    try {
      const h = await getDailyHead();
      if (h && h.daily_random != null) {
        setHead(h);
        setStatus('available');
      } else {
        setStatus('empty');
      }
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => { checkDaily(); }, [checkDaily]);

  // Live subscriptions — independent of daily-head status, so the leaderboard
  // still shows even if today's quiz itself isn't published yet. Ranks update
  // in place while the screen is open instead of needing a re-open to refresh.
  useEffect(() => {
    let cancelled = false;
    let unsubYday: (() => void) | undefined;
    subscribeYesterdayReport((entries) => {
      setYday(entries);
      setYdayLoaded(true);
    }).then((unsub) => { if (cancelled) unsub(); else unsubYday = unsub; });
    const unsubMonth = subscribeMonthlyTopReport((entries) => {
      setMonthTop(entries.slice(0, 10));
      setMonthLoaded(true);
    });
    const unsubToday = subscribeTodayStandings(setTodayStandings);
    return () => {
      cancelled = true;
      unsubYday?.();
      unsubMonth();
      unsubToday();
    };
  }, []);

  // Reclaim the header: the month name instead of the app's repeated name.
  useEffect(() => {
    const monthName = new Date().toLocaleDateString('ar-EG', { month: 'long' });
    navigation.setOptions({
      headerTitle: () => <Text style={{ color: '#fff', fontSize: 16, fontFamily: 'PlexArabic-Bold' }}>البطولة · {monthName}</Text>,
    });
  }, [navigation]);

  function startDaily() {
    if (!head) return;
    const begin = () => {
      const weights = profile.getDailyQuizStudyPartsWeights();
      QS.initDailyQuiz(head.daily_random, profile.parts, weights);
      router.push({ pathname: '/(app)/quiz', params: { dailyMode: '1' } });
    };
    const msg = 'الاختبار يتكون من 10 أسئلة في نطاق حفظك وعليك الإجابة بشكل صحيح وسريع';
    // RN Alert is a no-op on react-native-web, so use the browser confirm there.
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || window.confirm(`اختبار اليوم\n\n${msg}`)) begin();
      return;
    }
    Alert.alert('اختبار اليوم', msg, [
      { text: 'لا', style: 'cancel' },
      { text: 'ابدأ', onPress: begin },
    ]);
  }

  const listData = tab === 'today' ? todayStandings : tab === 'yesterday' ? yday : monthTop;
  const reportsLoading = tab === 'today' ? false : tab === 'yesterday' ? !ydayLoaded : !monthLoaded;
  const ownRank = findOwnRank(todayStandings, profile.uid);

  // Movement vs yesterday — only computable where we have real data: the
  // اليوم tab, cross-referenced against yesterday's own top-N report. Rows
  // absent from yesterday's report get no delta (they may be new, or just
  // outside that top-N — the backend doesn't retain full historical ranks).
  const yesterdayRankOf = new Map<string, number>();
  yday.forEach((e, i) => { if (e.uid) yesterdayRankOf.set(e.uid, i + 1); });
  function movementFor(entry: LeaderboardEntry, todayRank: number): number | null {
    if (tab !== 'today' || !entry.uid) return null;
    const yRank = yesterdayRankOf.get(entry.uid);
    if (yRank == null) return null;
    return yRank - todayRank; // positive ⇒ moved up
  }

  // Podium only makes sense with a full top-3 — with 1-2 entries (e.g. a
  // quiet يوم/أمس), splitting into a 3-slot podium + "everyone from rank 4"
  // list dropped every real entry: podium.length === 3 was never true, and
  // listData.slice(3) is empty whenever there are fewer than 3 total rows.
  const podium = listData.length >= 3 ? listData.slice(0, 3) : [];
  const rest = listData.length >= 3 ? listData.slice(3) : listData;

  function renderRow({ item, index }: { item: LeaderboardEntry; index: number }) {
    const rank = index + podium.length + 1; // podium (if any) covers 1..podium.length
    const isMe = item.uid === profile.uid;
    const flag = flagEmoji(item.country);
    const delta = movementFor(item, rank);
    return (
      <View style={[s.row, isMe && { backgroundColor: colors.goldPale }]}>
        <Text style={[s.rank, { color: colors.inkSoft }]}>{arNum(rank)}</Text>
        {flag ? <Text style={s.rowFlag}>{flag}</Text> : <View style={s.rowFlagPlaceholder} />}
        <Text style={[s.rowName, { color: colors.ink }, isMe && { fontFamily: 'PlexArabic-Bold', color: colors.goldDeep }]} numberOfLines={1}>{item.name ?? 'زائر(ة)'}</Text>
        {delta != null && delta !== 0 && (
          <Text style={[s.delta, delta > 0 ? { color: colors.correct } : { color: colors.wrong }]}>
            {delta > 0 ? `▲${arNum(delta)}` : `▼${arNum(Math.abs(delta))}`}
          </Text>
        )}
        <Text style={[s.rowScore, { color: colors.ink }, isMe && { color: colors.goldDeep }]}>{arNum(item.score)}</Text>
      </View>
    );
  }

  // Compact neighbor row for the "your rank today" card — same shape as
  // renderRow but takes an explicit rank number (not a list index).
  function renderNeighborRow(item: RankedEntry, isMe: boolean) {
    const flag = flagEmoji(item.country);
    return (
      <View key={`${item.rank}-${item.uid ?? item.name}`} style={[s.row, isMe && { backgroundColor: colors.goldPale }]}>
        <Text style={[s.rank, { color: colors.inkSoft }]}>{item.rank <= 3 ? MEDAL[item.rank - 1] : arNum(item.rank)}</Text>
        {flag ? <Text style={s.rowFlag}>{flag}</Text> : <View style={s.rowFlagPlaceholder} />}
        <Text style={[s.rowName, { color: colors.ink }, isMe && { fontFamily: 'PlexArabic-Bold', color: colors.goldDeep }]} numberOfLines={1}>{item.name ?? 'زائر(ة)'}</Text>
        <Text style={[s.rowScore, { color: colors.ink }, isMe && { color: colors.goldDeep }]}>{arNum(item.score)}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.paper }]} edges={['bottom']}>
      <ScrollView style={s.scrollView} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Compact daily challenge strip */}
        {status === 'available' && (
          dailyDone ? (
            <View style={[s.dailyStrip, { backgroundColor: colors.correctPale, borderWidth: 1.5, borderColor: colors.correct }]}>
              <Ionicons name="checkmark-circle" size={18} color={colors.correct} />
              <Text style={[s.dailyStripTxt, { color: colors.correct }]}>أكملت اختبار اليوم ✓</Text>
            </View>
          ) : (
            <PressScale style={[s.dailyStrip, { backgroundColor: colors.card }]} onPress={startDaily}>
              <Ionicons name="star" size={18} color={colors.gold} />
              <Text style={[s.dailyStripTxt, { color: colors.ink }]}>اختبار اليوم جاهز</Text>
              <View style={[s.dailyStripBtn, { backgroundColor: colors.navy }]}>
                <Text style={s.dailyStripBtnTxt}>ابدأ</Text>
              </View>
            </PressScale>
          )
        )}
        {status === 'loading' && (
          <View style={[s.dailyStrip, { backgroundColor: colors.card }]}>
            <ActivityIndicator size="small" color={colors.ink} />
            <Text style={[s.dailyStripTxt, { color: colors.ink }]}>جارٍ التحقق...</Text>
          </View>
        )}
        {status === 'error' && (
          <PressScale style={[s.dailyStrip, { backgroundColor: colors.wrongPale }]} onPress={checkDaily}>
            <Ionicons name="refresh" size={16} color={colors.wrong} />
            <Text style={[s.dailyStripTxt, { color: colors.wrong }]}>تعذر الاتصال — إعادة المحاولة</Text>
          </PressScale>
        )}

        {/* Your rank today — live, and shown even far outside the top 10 (the
            regular tabs below only ever carry a top-10 slice). Hidden until the
            user has a submission in today's live standings. */}
        {ownRank && (
          <View style={[s.card, { backgroundColor: colors.card }]}>
            <Text style={[s.cardTitle, { color: colors.ink, borderColor: colors.line }]}>ترتيبك اليوم: #{arNum(ownRank.rank)}</Text>
            {ownRank.above.map((e) => renderNeighborRow(e, false))}
            {renderNeighborRow(ownRank.entry, true)}
            {ownRank.below.map((e) => renderNeighborRow(e, false))}
          </View>
        )}

        {/* Inner tab bar */}
        <View style={[s.tabBar, { backgroundColor: colors.goldPale }]}>
          {([['today', 'اليوم'], ['yesterday', 'أمس'], ['month', 'الشهر']] as [Tab, string][]).map(([key, label]) => (
            <PressScale
              key={key}
              style={[s.tabBtn, tab === key && { backgroundColor: colors.navy }]}
              onPress={() => setTab(key)}
            >
              <Text style={[s.tabBtnTxt, { color: colors.ink }, tab === key && { color: '#fff' }]}>{label}</Text>
            </PressScale>
          ))}
        </View>

        <View style={[s.card, { backgroundColor: colors.card }]}>
          <Text style={[s.cardTitle, { color: colors.ink, borderColor: colors.line }]}>
            {tab === 'today' ? 'المتصدّرون اليوم' : tab === 'yesterday' ? 'أفضل نتائج الأمس' : 'أفضل نتائج هذا الشهر'}
          </Text>
          {reportsLoading ? (
            <ActivityIndicator color={colors.ink} style={{ marginVertical: 16 }} />
          ) : listData.length === 0 ? (
            <View style={s.emptyWrap}>
              <Ionicons name="trophy-outline" size={30} color={colors.inkSoft} />
              <Text style={[s.emptyTitle, { color: colors.ink }]}>كن أول المتصدرين {tab === 'month' ? 'هذا الشهر' : 'اليوم'}</Text>
              <PressScale style={[s.emptyBtn, { backgroundColor: colors.gold }]} onPress={() => router.push({ pathname: '/(app)/quiz', params: { chooser: '1', nonce: String(Date.now()) } })}>
                <Text style={[s.emptyBtnTxt, { color: colors.navy }]}>ابدأ اختباراً</Text>
              </PressScale>
            </View>
          ) : (
            <>
              {/* Top-3 podium — above the list */}
              {podium.length === 3 && (
                <View style={s.podium}>
                  {[1, 0, 2].map((i) => {
                    const e = podium[i];
                    const heights = [84, 64, 52]; // first, second, third
                    return (
                      <View key={i} style={s.podCol}>
                        <InitialAvatar name={e.name ?? '؟'} size={i === 0 ? 52 : 44} tint={PODIUM_TINTS[i]} colors={colors} />
                        <Text style={[s.podName, { color: colors.ink }]} numberOfLines={1}>{e.name ?? 'زائر(ة)'}</Text>
                        <Text style={[s.podScore, { color: colors.goldDeep }]}>{arNum(e.score)}</Text>
                        <View style={[s.podBase, { height: heights[i], backgroundColor: PODIUM_TINTS[i] }]}>
                          <Text style={s.podBaseTxt}>{MEDAL[i]}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
              <FlatList
                data={rest}
                keyExtractor={(_, i) => String(i)}
                renderItem={renderRow}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={[s.sep, { backgroundColor: colors.line }]} />}
              />
            </>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  // flex:1 bounds the scroller to the viewport so the list scrolls when it
  // overflows (e.g. all 10 rows on a short phone); paddingBottom clears the tab bar.
  scrollView: { flex: 1 },
  scroll: { padding: 16, gap: 12, paddingBottom: 32 },

  dailyStrip: {
    borderRadius: radii.md,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    boxShadow: '0px 0px 4px rgba(0,0,0,0.06)',
    elevation: 2,
  },
  dailyStripTxt: { flex: 1, fontSize: 14, fontFamily: 'PlexArabic-SemiBold', textAlign: 'right' },
  dailyStripBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: radii.sm },
  dailyStripBtnTxt: { color: '#fff', fontFamily: 'PlexArabic-Bold', fontSize: 13 },

  tabBar: { flexDirection: 'row-reverse', borderRadius: radii.md, padding: 3, gap: 3 },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: radii.sm, alignItems: 'center' },
  tabBtnTxt: { fontSize: 13, fontFamily: 'PlexArabic-SemiBold' },

  card: {
    borderRadius: radii.md,
    overflow: 'hidden',
    boxShadow: '0px 0px 4px rgba(0,0,0,0.06)',
    elevation: 2,
  },
  cardTitle: {
    fontSize: 13,
    fontFamily: 'PlexArabic-Bold',
    textAlign: 'right',
    padding: 14,
    borderBottomWidth: 1,
  },
  emptyWrap: { alignItems: 'center', gap: 10, padding: 28 },
  emptyTitle: { fontSize: 14, fontFamily: 'PlexArabic-SemiBold', textAlign: 'center' },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: radii.pill, marginTop: 4 },
  emptyBtnTxt: { fontSize: 13, fontFamily: 'PlexArabic-Bold' },

  // Podium
  podium: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 10, paddingTop: 18, paddingHorizontal: 12 },
  podCol: { alignItems: 'center', width: 84 },
  podName: { fontSize: 12, fontFamily: 'PlexArabic-SemiBold', marginTop: 4, maxWidth: 80 },
  podScore: { fontSize: 12, fontFamily: 'PlexArabic-Bold', marginBottom: 6 },
  podBase: { width: 72, borderTopLeftRadius: radii.sm, borderTopRightRadius: radii.sm, alignItems: 'center', paddingTop: 4 },
  podBaseTxt: { fontSize: 16 },

  initAvatar: { alignItems: 'center', justifyContent: 'center' },
  initAvatarTxt: { fontFamily: 'PlexArabic-Bold' },

  center: { padding: 24, alignItems: 'center' },
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  rank: { width: 26, fontSize: 13, fontFamily: 'PlexArabic-SemiBold', textAlign: 'center' },
  rowFlag: { fontSize: 18, width: 28, textAlign: 'center' },
  rowFlagPlaceholder: { width: 28 },
  rowName: { flex: 1, fontSize: 14, textAlign: 'right' },
  delta: { fontSize: 11, fontFamily: 'PlexArabic-Bold' },
  rowScore: { fontSize: 15, fontFamily: 'PlexArabic-Bold', minWidth: 42, textAlign: 'left' },
  sep: { height: 1, marginHorizontal: 14 },
});
