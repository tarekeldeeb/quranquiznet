import { useEffect, useState } from 'react';
import {
  View, Text, Image, StyleSheet, ScrollView,
  Alert, ActivityIndicator, Modal, Platform, Share, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  signInGoogle, signInFacebook, signInApple, getDailyHead, getTodayStandings, type DailyHead,
} from '../../src/services/firebase';
import { useProfileStore } from '../../src/stores/profileStore';
import * as QS from '../../src/services/questionnaireService';
import { DEFAULT_GUEST_NAME } from '../../src/models/constants';
import { Avatar } from '../../src/components/Avatar';
import { scheduleDailyReminder } from '../../src/services/notifications';
import { describeLiveRank } from '../../src/models/dailyRank';
import { getRankInfo, getRankLadder } from '../../src/models/rank';
import { useTheme, arNum, radii } from '../../src/theme/tokens';
import PressScale from '../../src/components/PressScale';
import Ring from '../../src/components/Ring';

const DAILY_PERIOD_MS = 24 * 60 * 60 * 1000;
// Matches notifications.ts's STREAK_REMINDER_HOUR — "tonight" starts at the
// same evening hour the streak-loss reminder itself fires.
const EVENING_HOUR = 19;

const APP_ICON = require('../../assets/images/app-icon.png');

/** Small brand mark for the header's right slot — icon + app name, sitting
 * beside the personalized greeting (headerTitle, centered) rather than
 * replacing it the way the tab navigator's default HeaderLogo does on
 * screens with no situational title. A thin gold ring gives it a seal-like
 * finish instead of a plain square icon. */
function HeaderBrand() {
  return (
    <View style={hb.wrap}>
      <Image source={APP_ICON} style={hb.icon} />
      <Text style={hb.name}>اختبار القرآن</Text>
    </View>
  );
}

const hb = StyleSheet.create({
  wrap: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6 },
  icon: { width: 24, height: 24, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(217,173,85,0.6)' },
  name: { color: '#fff', fontSize: 12, fontFamily: 'PlexArabic-Bold' },
});

/** Cross-platform alert (RN Alert is a no-op on react-native-web). */
function notify(title: string, msg: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(`${title}\n\n${msg}`);
    return;
  }
  Alert.alert(title, msg);
}

/** Arabic plural for a count + singular/dual/plural noun forms. */
function arPlural(n: number, one: string, two: string, few: string, many: string): string {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return `${n} ${few}`;
  return `${n} ${many}`;
}

/** Format a remaining duration (ms) as e.g. "5 ساعات و23 دقيقة". */
function formatRemaining(ms: number): string {
  if (ms <= 0) return 'متاح الآن';
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const hPart = h > 0 ? arPlural(h, 'ساعة', 'ساعتان', 'ساعات', 'ساعة') : '';
  const mPart = m > 0 ? arPlural(m, 'دقيقة', 'دقيقتان', 'دقائق', 'دقيقة') : '';
  if (hPart && mPart) return `${hPart} و${mPart}`;
  return hPart || mPart || 'أقل من دقيقة';
}

/** Compact score-over-time sparkline tile (one bar per recorded day). */
function ProgressChart({ scores, colors }: { scores: { date: number; score: number }[]; colors: ReturnType<typeof useTheme>['colors'] }) {
  const MAX_BARS = 40;
  const data = scores.slice(-MAX_BARS);
  const H = 46;
  const MIN_BAR = 3;
  const enough = data.length >= 2;

  let bars: React.ReactNode = null;
  if (enough) {
    const vals = data.map((d) => d.score);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min;
    bars = data.map((d, i) => {
      const norm = range > 0 ? (d.score - min) / range : 0.5;
      const h = MIN_BAR + norm * (H - MIN_BAR);
      const isLast = i === data.length - 1;
      return <View key={i} style={[s.sparkBar, { height: h, backgroundColor: isLast ? colors.gold : colors.line }]} />;
    });
  }

  return (
    <View style={[s.bentoHalf, s.statTile, { backgroundColor: colors.card }]}>
      {/* RTL: newest (اليوم) on the left */}
      <View style={[s.sparkRow, { height: H }]}>
        {enough ? bars : <Text style={[s.sparkEmpty, { color: colors.line }]}>—</Text>}
      </View>
      <Text style={[s.statLabel, { color: colors.ink }]}>تقدّمك</Text>
      <Text style={[s.statSub, { color: colors.inkSoft }]}>{enough ? `${arNum(data.length)} يوم` : 'ابدأ اللعب'}</Text>
    </View>
  );
}

/** Streak sheet — tapping the flame opens a place, not just a sticker: a week
 * calendar (days with a recorded score, as a play-day proxy), the best streak,
 * and an "at risk tonight" nudge once the evening reminder hour has passed. */
function StreakSheet({
  visible, onClose, colors, streak, bestStreak, scores, playedToday,
}: {
  visible: boolean; onClose: () => void; colors: ReturnType<typeof useTheme>['colors'];
  streak: number; bestStreak: number; scores: { date: number; score: number }[]; playedToday: boolean;
}) {
  const DOW = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().split('T')[0];
    const played = scores.some((sc) => new Date(sc.date).toISOString().split('T')[0] === key);
    return { label: DOW[d.getDay()], played, isToday: i === 6 };
  });
  const atRisk = !playedToday && new Date().getHours() >= EVENING_HOUR && streak > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.sheetBg}>
        <View style={[s.sheet, { backgroundColor: colors.card }]}>
          <View style={s.sheetHeader}>
            <PressScale onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.inkSoft} />
            </PressScale>
            <Text style={[s.sheetTitle, { color: colors.ink }]}>سلسلتك</Text>
            <View style={{ width: 22 }} />
          </View>

          <View style={s.streakHero}>
            <Ionicons name="flame" size={36} color={colors.gold} />
            <Text style={[s.streakBig, { color: colors.ink }]}>{arNum(streak)}</Text>
            <Text style={[s.streakUnit, { color: colors.inkSoft }]}>يوماً متتالياً</Text>
          </View>

          <View style={s.weekRow}>
            {days.map((d, i) => (
              <View key={i} style={s.weekCell}>
                <View style={[
                  s.weekDot,
                  { backgroundColor: d.played ? colors.gold : colors.goldPale },
                  d.isToday && { borderWidth: 2, borderColor: colors.ink },
                ]}
                >
                  {d.played && <Ionicons name="checkmark" size={14} color={colors.navy} />}
                </View>
                <Text style={[s.weekLabel, { color: colors.inkSoft }]}>{d.label}</Text>
              </View>
            ))}
          </View>

          <View style={[s.streakStatRow, { borderColor: colors.line }]}>
            <Ionicons name="trophy-outline" size={16} color={colors.goldDeep} />
            <Text style={[s.streakStatTxt, { color: colors.ink }]}>أفضل سلسلة: {arNum(bestStreak)} يوماً</Text>
          </View>

          {atRisk && (
            <View style={[s.riskBanner, { backgroundColor: colors.wrongPale }]}>
              <Ionicons name="warning-outline" size={16} color={colors.wrong} />
              <Text style={[s.riskTxt, { color: colors.wrong }]}>سلسلتك في خطر الليلة — العب اختباراً قبل منتصف الليل!</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// A distinct badge per rank — a growing sense of accomplishment on the way
// up, not four identical dots with different labels.
const RANK_ICONS: React.ComponentProps<typeof Ionicons>['name'][] = ['leaf-outline', 'flame', 'book', 'trophy'];

/** Rank ladder sheet — tapping the rank progress bar opens the whole path
 * instead of leaving "متقن" a mystery: every rank, the points needed to
 * reach it, and a badge for reached / current / locked. */
function RankSheet({
  visible, onClose, colors, score,
}: {
  visible: boolean; onClose: () => void; colors: ReturnType<typeof useTheme>['colors']; score: number;
}) {
  const ladder = getRankLadder(score);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.sheetBg}>
        <View style={[s.sheet, { backgroundColor: colors.card }]}>
          <View style={s.sheetHeader}>
            <PressScale onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.inkSoft} />
            </PressScale>
            <Text style={[s.sheetTitle, { color: colors.ink }]}>درجات الحفظ</Text>
            <View style={{ width: 22 }} />
          </View>

          <View style={s.rankList}>
            {ladder.map((r, i) => (
              <View
                key={r.title}
                style={[s.rankLadderRow, { borderColor: colors.line }, r.current && { backgroundColor: colors.goldPale }]}
              >
                <View style={[
                  s.rankBadge,
                  { backgroundColor: r.reached ? colors.gold : colors.goldPale },
                  r.current && { borderWidth: 2, borderColor: colors.goldDeep },
                ]}
                >
                  <Ionicons name={RANK_ICONS[i]} size={19} color={r.reached ? colors.navy : colors.inkSoft} />
                </View>
                <View style={s.rankLadderInfo}>
                  <Text style={[s.rankLadderTitle, { color: colors.ink }]}>{r.title}</Text>
                  <Text style={[s.rankLadderSub, { color: colors.inkSoft }]}>
                    {i === 0 ? 'من البداية' : `من ${arNum(r.threshold)} نقطة`}
                  </Text>
                </View>
                {r.current ? (
                  <View style={[s.rankNowBadge, { backgroundColor: colors.gold }]}>
                    <Text style={[s.rankNowTxt, { color: colors.navy }]}>مستواك الآن</Text>
                  </View>
                ) : r.reached ? (
                  <Ionicons name="checkmark-circle" size={20} color={colors.correct} />
                ) : (
                  <Ionicons name="lock-closed-outline" size={16} color={colors.inkSoft} />
                )}
              </View>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function MeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const profile = useProfileStore();
  const social = profile.social;

  const [dailyHead, setDailyHead] = useState<DailyHead | null | 'loading'>('loading');
  const [now, setNow] = useState(() => Date.now());
  const [avatarError, setAvatarError] = useState(false);
  // Post-win engagement: rank-comparison line for the "already done today" card.
  const [dailyRankLine, setDailyRankLine] = useState<string | null>(null);
  const [nicknameModalOpen, setNicknameModalOpen] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [streakSheetOpen, setStreakSheetOpen] = useState(false);
  const [rankSheetOpen, setRankSheetOpen] = useState(false);

  useEffect(() => {
    getDailyHead()
      .then((h) => setDailyHead(h ?? null))
      .catch(() => setDailyHead(null));
  }, []);

  // Tick once a minute so the "next quiz" countdown stays current.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Once today's daily is done, arm a local notification for the moment the next
  // one rotates in (no-op without permission/native). Keyed off Date.now() at
  // effect-run-time rather than the ticking `now` state, so it schedules once
  // instead of on every minute tick.
  useEffect(() => {
    if (dailyHead === 'loading' || !dailyHead) return;
    if (profile.lastDailyCompletedDate !== new Date().toISOString().split('T')[0]) return;
    const nowMs = Date.now();
    const nextAt = dailyHead.start_time
      + (Math.floor((nowMs - dailyHead.start_time) / DAILY_PERIOD_MS) + 1) * DAILY_PERIOD_MS;
    scheduleDailyReminder(nextAt);
  }, [dailyHead, profile.lastDailyCompletedDate]);

  // Once today's daily quiz is done, fetch a live rank-comparison line against
  // today's actual participants — the same cohort the league screen's اليوم tab
  // shows, so the two never disagree (best-effort; hidden if unavailable).
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    if (profile.lastDailyCompletedDate !== today || !profile.lastDailyScore) {
      setDailyRankLine(null);
      return;
    }
    let cancelled = false;
    getTodayStandings()
      .then((entries) => { if (!cancelled) setDailyRankLine(describeLiveRank(entries, profile.uid)); })
      .catch(() => { if (!cancelled) setDailyRankLine(null); });
    return () => { cancelled = true; };
  }, [profile.lastDailyCompletedDate, profile.lastDailyScore, profile.uid]);

  // Prompt a guest once to pick a nickname instead of the generic "زائر(ة)" on
  // the leaderboard — auto-shown the first time they land here still on the
  // default name. Always reachable afterward via the manual edit button.
  useEffect(() => {
    if (!social.isAnonymous || social.displayName !== DEFAULT_GUEST_NAME) return;
    let cancelled = false;
    AsyncStorage.getItem('guest_nickname_prompted').then((v) => {
      if (cancelled || v) return;
      setNicknameInput('');
      setNicknameModalOpen(true);
      AsyncStorage.setItem('guest_nickname_prompted', '1');
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [social.isAnonymous, social.displayName]);

  // Reclaim the header: greeting + a gear icon into settings, replacing the
  // repeated app-name nameplate.
  const firstName = social.displayName?.split(' ')[0] ?? '';
  const greeting = firstName ? `مرحباً ${firstName}` : 'مرحباً';
  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => <Text style={{ color: '#fff', fontSize: 16, fontFamily: 'PlexArabic-Bold' }}>{greeting}</Text>,
      // RTL: brand mark at the right (reading-start), greeting centered, and
      // the gear — a secondary, trailing action — at the left, matching the
      // app's row-reverse convention (primary content right, controls left).
      headerRight: () => <HeaderBrand />,
      headerLeft: () => (
        <PressScale onPress={() => router.push('/(app)/settings')} hitSlop={8} style={{ paddingHorizontal: 10, paddingVertical: 6 }}>
          <Ionicons name="settings-outline" size={24} color={colors.navySoft} />
        </PressScale>
      ),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [greeting]);

  async function saveNickname() {
    const trimmed = nicknameInput.trim().slice(0, 20);
    if (trimmed) {
      await profile.setSocial({ ...social, displayName: trimmed });
    }
    setNicknameModalOpen(false);
  }

  function openNicknameEditor() {
    setNicknameInput(social.displayName && social.displayName !== DEFAULT_GUEST_NAME ? social.displayName : '');
    setNicknameModalOpen(true);
  }

  function launchDaily(head: DailyHead) {
    const weights = profile.getDailyQuizStudyPartsWeights();
    QS.initDailyQuiz(head.daily_random, profile.parts, weights);
    router.push({ pathname: '/(app)/quiz', params: { dailyMode: '1' } });
  }

  function startDaily() {
    if (!dailyHead || dailyHead === 'loading') return;
    launchDaily(dailyHead);
  }

  async function shareScore() {
    // A submission still pending confirmation hasn't updated lastDailyScore
    // yet (see endDailyQuiz in quiz.tsx) — fall back to the pending payload's
    // score so a share right after finishing shows today's actual result.
    const today = new Date().toISOString().split('T')[0];
    const score = profile.lastDailyCompletedDate === today
      ? profile.lastDailyScore
      : profile.pendingDailySubmit?.score ?? profile.lastDailyScore;
    try {
      await Share.share({
        message: `حصلت على ${score} نقطة في اختبار اليوم على شبكة اختبار القرآن! جرّب حظك:\nhttps://quranquiz.net`,
        url: 'https://quranquiz.net',
      });
    } catch { /* ignore */ }
  }

  async function upgradeGuest(provider: 'google' | 'facebook' | 'apple') {
    try {
      if (provider === 'google') await signInGoogle();
      else if (provider === 'facebook') await signInFacebook();
      else await signInApple();
    } catch {
      notify('خطأ', 'تعذر تسجيل الدخول. حاول مرة أخرى.');
    }
  }

  // ── Derived values ──
  const score = profile.getScore();
  const yesterday = profile.scores.length >= 2
    ? profile.scores[profile.scores.length - 2]?.score ?? 0
    : 0;
  const trend = score - yesterday;
  const rank = getRankInfo(score);

  const today = new Date().toISOString().split('T')[0];
  // Treat an unconfirmed submission from today the same as completed — the
  // quiz was in fact taken, it just hasn't been retried/confirmed yet (see
  // endDailyQuiz in quiz.tsx), so don't offer to start it again.
  const dailyCompleted = dailyHead !== 'loading'
    && dailyHead != null
    && (profile.lastDailyCompletedDate === today || profile.pendingDailySubmit?.date === today);
  const playedToday = profile.lastPlayDate === today;

  // The daily quiz rotates every 24h from start_time. Roll forward to the next
  // 24h boundary so the countdown is always a concrete, positive wait — even if
  // the cached head is already more than a day old.
  const nextDailyMs = dailyHead !== 'loading' && dailyHead != null
    ? dailyHead.start_time
      + (Math.floor((now - dailyHead.start_time) / DAILY_PERIOD_MS) + 1) * DAILY_PERIOD_MS
      - now
    : 0;

  const weakSura = profile.getTopBadParts()[0];
  const weakPartIndex = weakSura && weakSura !== '-'
    ? profile.parts.findIndex((p) => p.name === weakSura)
    : -1;

  const studyPct = parseFloat(profile.getPercentTotalStudy()) || 0;
  const ratioPct = parseFloat(profile.getPercentTotalRatio()) || 0;
  const activeParts = profile.parts.filter((p) => p.checked).length;
  const pvpTotal = profile.pvp.wins + profile.pvp.losses + profile.pvp.draws;

  const avatarUri = social.photoURL && !avatarError ? social.photoURL : undefined;

  // "Ways to play" — quick play + PvP as a 2-up row, with the weak-sura nudge
  // folded in as a third option, instead of three competing full-width blocks.
  const waysToPlay = (
    <View style={s.waysWrap}>
      <View style={s.waysRow}>
        <PressScale
          style={[s.wayTile, { backgroundColor: colors.navy }]}
          onPress={() => router.push({ pathname: '/(app)/quiz', params: { chooser: '1', nonce: String(Date.now()) } })}
        >
          <Ionicons name="play" size={22} color="#fff" />
          <Text style={s.wayTileTxt}>ابدأ اختباراً</Text>
        </PressScale>
        <PressScale
          style={[s.wayTile, { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.gold }]}
          onPress={() => router.push('/(app)/pvp')}
        >
          <Ionicons name="flash" size={22} color={colors.goldDeep} />
          <Text style={[s.wayTileTxt, { color: colors.goldDeep }]}>منافسة مباشرة</Text>
          {pvpTotal > 0 && (
            <View style={[s.wayBadge, { backgroundColor: colors.goldPale }]}>
              <Text style={[s.wayBadgeTxt, { color: colors.goldDeep }]}>{arNum(profile.pvp.wins)} فوز</Text>
            </View>
          )}
        </PressScale>
      </View>
      {weakPartIndex >= 0 && (
        <PressScale
          style={[s.wayNudge, { backgroundColor: colors.goldPale }]}
          onPress={() => router.push({ pathname: '/(app)/quiz', params: { customPart: String(weakPartIndex), nonce: String(Date.now()) } })}
        >
          <Ionicons name="chevron-back" size={16} color={colors.goldDeep} />
          <Text style={[s.wayNudgeTxt, { color: colors.goldDeep }]}>راجع أضعف سورة: {weakSura}</Text>
          <Ionicons name="warning" size={15} color={colors.goldDeep} />
        </PressScale>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.paper }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Identity strip: avatar + points + streak (greeting lives in the header) ── */}
        <View style={s.topStrip}>
          <Avatar
            uri={avatarUri}
            fallback={require('../../assets/images/app-icon.png')}
            style={[s.topAvatar, { borderColor: colors.goldPale, backgroundColor: colors.paper }]}
            onError={() => setAvatarError(true)}
          />
          <View style={s.topInfo}>
            {social.isAnonymous ? (
              <PressScale style={s.topSubRow} onPress={openNicknameEditor} hitSlop={6}>
                <Ionicons name="pencil" size={11} color={colors.inkSoft} />
                <Text style={[s.topSub, { color: colors.inkSoft }]} numberOfLines={1}>{social.displayName || DEFAULT_GUEST_NAME}</Text>
              </PressScale>
            ) : (
              <Text style={[s.topSub, { color: colors.inkSoft }]} numberOfLines={1}>{social.email ?? social.displayName ?? ''}</Text>
            )}
            <Text style={s.topPoints} numberOfLines={1}>
              {trend !== 0 && (
                <Text style={trend > 0 ? { color: colors.correct } : { color: colors.wrong }}>{trend > 0 ? '▲' : '▼'} </Text>
              )}
              <Text style={[s.topPointsVal, { color: colors.ink }]}>{arNum(score)}</Text>
              <Text style={[s.topPointsLabel, { color: colors.inkSoft }]}> نقطة</Text>
            </Text>
          </View>
          <PressScale
            style={[s.streakBadge, { backgroundColor: colors.goldPale, borderColor: colors.gold, opacity: profile.streak > 0 ? 1 : 0.5 }]}
            onPress={() => setStreakSheetOpen(true)}
          >
            <Ionicons name="flame" size={16} color={colors.goldDeep} />
            <Text style={[s.streakTxt, { color: colors.goldDeep }]}>{arNum(profile.streak)}</Text>
          </PressScale>
        </View>

        {/* ── Give the score a destination: badge + rank title + progress to
            next rank — tap opens the full ladder (all ranks + how to reach
            each one). Same badge icon set as the ladder sheet, so the current
            rank reads as one continuous idea between the two. ── */}
        <PressScale style={[s.bentoFull, s.rankCard, { backgroundColor: colors.card }]} onPress={() => setRankSheetOpen(true)}>
          <View style={s.rankHeaderRow}>
            <View style={[s.rankBadgeSmall, { backgroundColor: colors.gold }]}>
              <Ionicons name={RANK_ICONS[rank.index]} size={18} color={colors.navy} />
            </View>
            <View style={s.rankColumn}>
              <View style={s.rankRow}>
                <View style={s.rankTitleRow}>
                  <Text style={[s.rankTitle, { color: colors.ink }]}>{rank.title}</Text>
                  <Ionicons name="chevron-back" size={14} color={colors.inkSoft} />
                </View>
                {rank.nextTitle && (
                  <Text style={[s.rankNext, { color: colors.inkSoft }]}>
                    {arNum(rank.remaining)} نقطة إلى «{rank.nextTitle}» ✦
                  </Text>
                )}
              </View>
              <View style={[s.rankTrack, { backgroundColor: colors.goldPale }]}>
                <View style={[s.rankFill, { width: `${rank.progress * 100}%`, backgroundColor: colors.gold }]} />
              </View>
            </View>
          </View>
        </PressScale>

        {/* ── One hero at a time: the daily card until completed ── */}
        {dailyHead === 'loading' ? (
          <View style={[s.bentoFull, s.dailyHeroDark, { backgroundColor: colors.navy }]}>
            <ActivityIndicator color="#fff" size="large" />
          </View>
        ) : dailyCompleted ? (
          <View style={[s.bentoFull, s.dailyStripDone, { backgroundColor: colors.correctPale, borderColor: colors.correct }]}>
            <Ionicons name="checkmark-circle" size={20} color={colors.correct} />
            <View style={s.dailyStripText}>
              <Text style={[s.dailyStripTitle, { color: colors.correct }]}>أكملت اختبار اليوم — الاختبار الجديد بعد {formatRemaining(nextDailyMs)}</Text>
              {dailyRankLine && <Text style={[s.rankLine, { color: colors.goldDeep }]}>{dailyRankLine}</Text>}
            </View>
            <PressScale onPress={shareScore} hitSlop={6}>
              <Ionicons name="share-social-outline" size={18} color={colors.correct} />
            </PressScale>
          </View>
        ) : dailyHead ? (
          <View style={[s.bentoFull, s.dailyHeroDark, { backgroundColor: colors.navy }]}>
            <View style={s.dailyHeroRow}>
              <Ionicons name="star" size={34} color={colors.gold} />
              <View style={s.dailyHeroText}>
                <Text style={s.dailyTitle}>اختبار اليوم جاهز!</Text>
                <Text style={[s.dailyBody, { color: colors.navySoft }]}>١٠ أسئلة × صحة وسرعة</Text>
              </View>
            </View>
            <PressScale style={[s.dailyBtn, { backgroundColor: colors.gold, shadowColor: colors.goldDeep }]} onPress={startDaily}>
              <Text style={[s.dailyBtnTxt, { color: colors.navy }]}>ابدأ اختبار اليوم</Text>
            </PressScale>
          </View>
        ) : (
          <View style={[s.bentoFull, s.dailyHeroUnavail, { backgroundColor: colors.card }]}>
            <Ionicons name="time-outline" size={30} color={colors.inkSoft} />
            <View style={s.dailyHeroText}>
              <Text style={[s.dailyUnavailTxt, { color: colors.ink }]}>لا يوجد اختبار اليوم حتى الآن</Text>
              <Text style={[s.dailyUnavailSub, { color: colors.inkSoft }]}>يتجدد الاختبار كل 24 ساعة</Text>
            </View>
          </View>
        )}

        {/* ── Ways to play — promoted once the daily is done, present either way ── */}
        {waysToPlay}

        {/* ── BENTO: 2× progress ring tiles + sparkline ── */}
        <View style={s.bentoRow}>
          <View style={[s.bentoHalf, s.statTile, { backgroundColor: colors.card }]}>
            <Ring pct={studyPct} color={colors.gold} trackColor={colors.goldPale} innerColor={colors.card} />
            <Text style={[s.statLabel, { color: colors.ink }]}>كم الحفظ</Text>
            <Text style={[s.statSub, { color: colors.inkSoft }]}>من القرآن</Text>
          </View>
          <View style={[s.bentoHalf, s.statTile, { backgroundColor: colors.card }]}>
            <Ring pct={ratioPct} color={colors.correct} trackColor={colors.correctPale} innerColor={colors.card} />
            <Text style={[s.statLabel, { color: colors.ink }]}>صحة الحفظ</Text>
            <Text style={[s.statSub, { color: colors.inkSoft }]}>دقة الإجابات</Text>
          </View>
          <ProgressChart scores={profile.scores} colors={colors} />
        </View>

        {/* ── The progression map — replaces the parts-editor summary card ── */}
        <PressScale style={[s.bentoFull, s.mapCard, { backgroundColor: colors.navy }]} onPress={() => router.push('/(app)/map')}>
          <Ionicons name="chevron-back" size={18} color={colors.navySoft} />
          <View style={s.mapBody}>
            <Text style={s.mapTitle}>خريطة الحفظ</Text>
            <Text style={[s.mapSub, { color: colors.navySoft }]}>
              {arPlural(activeParts, 'سورة مُفعّلة', 'سورتان مُفعّلتان', 'سور مُفعّلة', 'سورة مُفعّلة')} — اضغط لعرض التفاصيل
            </Text>
          </View>
          <Ionicons name="map-outline" size={26} color={colors.gold} />
        </PressScale>

        {/* ── Sign-in nag — demoted to a one-line banner, modern brand colors ── */}
        {social.isAnonymous && (
          <View style={[s.anonBanner, { backgroundColor: colors.card, borderColor: colors.line }]}>
            <Text style={[s.anonTxt, { color: colors.inkSoft }]} numberOfLines={1}>سجّل دخولك لحفظ تقدمك</Text>
            <View style={s.anonBtns}>
              {/* Apple requires its own native button component (not a custom
                  one) to start the auth flow — App Store guideline 4.8. iOS
                  only: no Android/web equivalent. */}
              {Platform.OS === 'ios' && (
                <AppleAuthentication.AppleAuthenticationButton
                  testID="apple-upgrade-button"
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={15}
                  style={s.appleIconBtn}
                  onPress={() => upgradeGuest('apple')}
                />
              )}
              <PressScale
                style={[s.iconBtn, { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line }]}
                onPress={() => upgradeGuest('google')}
                accessibilityRole="button"
                accessibilityLabel="المتابعة بحساب جوجل"
              >
                <Ionicons name="logo-google" size={16} color="#4285F4" />
              </PressScale>
              <PressScale
                style={[s.iconBtn, { backgroundColor: '#1877F2' }]}
                onPress={() => upgradeGuest('facebook')}
                accessibilityRole="button"
                accessibilityLabel="المتابعة بحساب فيسبوك"
              >
                <Ionicons name="logo-facebook" size={16} color="#fff" />
              </PressScale>
            </View>
          </View>
        )}

      </ScrollView>

      <StreakSheet
        visible={streakSheetOpen}
        onClose={() => setStreakSheetOpen(false)}
        colors={colors}
        streak={profile.streak}
        bestStreak={profile.bestStreak}
        scores={profile.scores}
        playedToday={playedToday}
      />

      <RankSheet
        visible={rankSheetOpen}
        onClose={() => setRankSheetOpen(false)}
        colors={colors}
        score={score}
      />

      {/* Guest nickname picker — auto-shown once for a fresh guest, always
          reachable afterward via the ✎ next to the identity subtitle. */}
      <Modal
        visible={nicknameModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setNicknameModalOpen(false)}
      >
        <View style={s.nickOverlay}>
          <View style={[s.nickBox, { backgroundColor: colors.card }]}>
            <Text style={[s.nickTitle, { color: colors.ink }]}>اختر اسماً يظهر على لوحة الصدارة</Text>
            <TextInput
              style={[s.nickInput, { borderColor: colors.line, color: colors.ink }]}
              value={nicknameInput}
              onChangeText={setNicknameInput}
              placeholder={DEFAULT_GUEST_NAME}
              placeholderTextColor={colors.inkSoft}
              maxLength={20}
              textAlign="right"
              autoFocus
            />
            <View style={s.nickRow}>
              <PressScale style={[s.nickSkip, { backgroundColor: colors.goldPale }]} onPress={() => setNicknameModalOpen(false)}>
                <Text style={[s.nickSkipTxt, { color: colors.inkSoft }]}>لاحقاً</Text>
              </PressScale>
              <PressScale style={[s.nickSave, { backgroundColor: colors.navy }]} onPress={saveNickname}>
                <Text style={s.nickSaveTxt}>حفظ</Text>
              </PressScale>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const CARD_SHADOW = {
  boxShadow: '0px 2px 8px rgba(13,45,78,0.08)',
  elevation: 2,
} as const;

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 14, gap: 12, paddingBottom: 36 },

  // Top strip
  topStrip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 2,
    paddingTop: 2,
  },
  topAvatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 2 },
  topInfo: { flex: 1, alignItems: 'flex-end' },
  topSub: { fontSize: 12, textAlign: 'right' },
  topSubRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  topPoints: { fontSize: 15, textAlign: 'right', marginTop: 2 },
  topPointsVal: { fontFamily: 'PlexArabic-Bold' },
  topPointsLabel: { fontSize: 12 },
  streakBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  streakTxt: { fontSize: 14, fontFamily: 'PlexArabic-Bold' },

  // Bento primitives
  bentoFull: { borderRadius: radii.lg, ...CARD_SHADOW },
  bentoRow: { flexDirection: 'row-reverse', gap: 12 },
  bentoHalf: { flex: 1, borderRadius: radii.lg, ...CARD_SHADOW },

  // Rank card
  rankCard: { padding: 14 },
  rankHeaderRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10 },
  rankBadgeSmall: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  rankColumn: { flex: 1, gap: 8 },
  rankRow: { flexDirection: 'row-reverse', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  rankTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  rankTitle: { fontSize: 16, fontFamily: 'PlexArabic-Bold' },
  rankNext: { fontSize: 12, flexShrink: 1, textAlign: 'left' },
  // RTL: the fill grows from the right edge (app convention).
  rankTrack: { height: 6, borderRadius: 3, overflow: 'hidden', position: 'relative' },
  rankFill: { position: 'absolute', top: 0, bottom: 0, right: 0, borderRadius: 3 },

  // Rank ladder sheet
  rankList: { gap: 8, marginTop: 12 },
  rankLadderRow: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 12,
    padding: 10, borderRadius: radii.md, borderWidth: 1,
  },
  rankBadge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rankLadderInfo: { flex: 1, alignItems: 'flex-end' },
  rankLadderTitle: { fontSize: 15, fontFamily: 'PlexArabic-Bold', textAlign: 'right' },
  rankLadderSub: { fontSize: 12, textAlign: 'right', marginTop: 1 },
  rankNowBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.pill },
  rankNowTxt: { fontSize: 11, fontFamily: 'PlexArabic-Bold' },

  // Daily hero
  dailyHeroDark: { padding: 20, gap: 14 },
  dailyHeroRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 14 },
  dailyHeroText: { flex: 1, alignItems: 'flex-end' },
  dailyTitle: { fontSize: 20, fontFamily: 'PlexArabic-Bold', color: '#fff', textAlign: 'right' },
  dailyBody: { fontSize: 13, textAlign: 'right', marginTop: 2 },
  dailyBtn: {
    paddingVertical: 14,
    borderRadius: radii.md,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  dailyBtnTxt: { fontSize: 16, fontFamily: 'PlexArabic-Bold' },
  dailyStripDone: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 10, padding: 14, borderWidth: 1.5,
  },
  dailyStripText: { flex: 1, alignItems: 'flex-end' },
  dailyStripTitle: { fontSize: 13, fontFamily: 'PlexArabic-SemiBold', textAlign: 'right' },
  rankLine: { fontSize: 11, fontFamily: 'PlexArabic-SemiBold', textAlign: 'right', marginTop: 2 },
  dailyHeroUnavail: { padding: 18, flexDirection: 'row-reverse', alignItems: 'center', gap: 14 },
  dailyUnavailTxt: { fontSize: 14, textAlign: 'right', fontFamily: 'PlexArabic-SemiBold' },
  dailyUnavailSub: { fontSize: 12, textAlign: 'right', marginTop: 2 },

  // Ways to play
  waysWrap: { gap: 8 },
  waysRow: { flexDirection: 'row-reverse', gap: 10 },
  wayTile: {
    flex: 1,
    borderRadius: radii.lg,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 6,
    ...CARD_SHADOW,
  },
  wayTileTxt: { fontSize: 14, fontFamily: 'PlexArabic-Bold', color: '#fff' },
  wayBadge: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radii.pill },
  wayBadgeTxt: { fontSize: 10, fontFamily: 'PlexArabic-Bold' },
  wayNudge: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 6, padding: 10, borderRadius: radii.md,
  },
  wayNudgeTxt: { flex: 1, fontSize: 12, fontFamily: 'PlexArabic-SemiBold', textAlign: 'right' },

  // Stat ring tiles
  statTile: { padding: 14, alignItems: 'center', justifyContent: 'center', gap: 6 },
  statLabel: { fontSize: 13, fontFamily: 'PlexArabic-Bold' },
  statSub: { fontSize: 11 },
  sparkRow: { width: '100%', flexDirection: 'row-reverse', alignItems: 'flex-end', justifyContent: 'center', gap: 1.5 },
  sparkBar: { flex: 1, maxWidth: 9, minWidth: 2, borderRadius: 2 },
  sparkEmpty: { fontSize: 18, fontFamily: 'PlexArabic-Bold' },

  // Map card
  mapCard: { flexDirection: 'row-reverse', alignItems: 'center', padding: 16, gap: 10 },
  mapBody: { flex: 1, alignItems: 'flex-end' },
  mapTitle: { fontSize: 15, fontFamily: 'Amiri-Regular', fontWeight: '700', color: '#fff', textAlign: 'right' },
  mapSub: { fontSize: 11, textAlign: 'right', marginTop: 2 },

  // Sign-in nag — a compact one-liner
  anonBanner: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: radii.md, borderWidth: 1, gap: 8,
  },
  anonTxt: { fontSize: 12, flex: 1, textAlign: 'right' },
  anonBtns: { flexDirection: 'row-reverse', gap: 6 },
  iconBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  appleIconBtn: { width: 130, height: 30 },

  // Bottom sheets (streak, rank ladder) — Modal renders outside the web
  // column wrapper (see WebFrame in app/_layout.tsx), so the sheet itself
  // needs the same width cap or it stretches full-browser-width on desktop.
  sheetBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radii.lg + 4, borderTopRightRadius: radii.lg + 4,
    padding: 20, paddingBottom: 32,
    width: '100%', maxWidth: 512, alignSelf: 'center',
  },
  sheetHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 16, fontFamily: 'PlexArabic-Bold' },
  streakHero: { alignItems: 'center', gap: 4, paddingVertical: 16 },
  streakBig: { fontSize: 40, fontFamily: 'PlexArabic-Bold' },
  streakUnit: { fontSize: 13 },
  weekRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 16 },
  weekCell: { alignItems: 'center', gap: 4 },
  weekDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  weekLabel: { fontSize: 10 },
  streakStatRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingTop: 14, borderTopWidth: 1 },
  streakStatTxt: { fontSize: 13, fontFamily: 'PlexArabic-SemiBold' },
  riskBanner: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, padding: 12, borderRadius: radii.md, marginTop: 14 },
  riskTxt: { flex: 1, fontSize: 12, fontFamily: 'PlexArabic-SemiBold', textAlign: 'right' },

  // Guest nickname modal
  nickOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  nickBox: { borderRadius: radii.lg, padding: 20, width: '100%', maxWidth: 400, gap: 14 },
  nickTitle: { fontSize: 15, fontFamily: 'PlexArabic-Bold', textAlign: 'right' },
  nickInput: {
    borderWidth: 1, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15,
  },
  nickRow: { flexDirection: 'row-reverse', gap: 10 },
  nickSkip: { flex: 1, paddingVertical: 12, borderRadius: radii.md, alignItems: 'center' },
  nickSkipTxt: { fontSize: 14, fontFamily: 'PlexArabic-SemiBold' },
  nickSave: { flex: 1, paddingVertical: 12, borderRadius: radii.md, alignItems: 'center' },
  nickSaveTxt: { fontSize: 14, fontFamily: 'PlexArabic-SemiBold', color: '#fff' },
});
