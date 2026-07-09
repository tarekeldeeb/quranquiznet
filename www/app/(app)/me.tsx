import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Switch, Alert, ActivityIndicator, Modal, FlatList, Animated, Platform, Share, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  signInGoogle, signInFacebook, signOut, getDailyHead, getComparisonReport, type DailyHead,
} from '../../src/services/firebase';
import { useProfileStore, CORRECT_RATIO_RANGE } from '../../src/stores/profileStore';
import * as QS from '../../src/services/questionnaireService';
import { DEFAULT_GUEST_NAME } from '../../src/models/constants';
import Constants from 'expo-constants';
import { Avatar } from '../../src/components/Avatar';
import { scheduleDailyReminder } from '../../src/services/notifications';
import { describeRankGap } from '../../src/models/dailyRank';

const APP_ICON = require('../../assets/images/app-icon.png');
// Pulled from app.json (expo.version) at build/runtime — single source of truth.
const APP_VERSION = Constants.expoConfig?.version ?? '';

type BulkAction = 'all' | 'good' | 'weak';

const NAVY = '#0d2d4e';
const AMBER = '#f39c12';

const DOT_COLOR: Record<number, string> = {
  [CORRECT_RATIO_RANGE.HIGH]:  '#27ae60',
  [CORRECT_RATIO_RANGE.MID]:   AMBER,
  [CORRECT_RATIO_RANGE.LOW]:   '#e74c3c',
  [CORRECT_RATIO_RANGE.EMPTY]: '#bdc3c7',
};

const DAILY_PERIOD_MS = 24 * 60 * 60 * 1000;

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

/** Short, soft bell chime on web (no native dependency). No-op elsewhere. */
function playBell() {
  if (Platform.OS !== 'web') return;
  try {
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const Ctx = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.36);
    o.onended = () => ctx.close();
  } catch { /* audio is non-critical */ }
}

/** Active-parts counter that tweens up/down, with a bell that rings on increase. */
function ActiveCountBadge({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const prevRef = useRef(value);
  const rafRef = useRef<number | null>(null);
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const from = fromRef.current;
    const to = value;

    if (from !== to) {
      const duration = 450;
      const start = Date.now();
      const tick = () => {
        const t = Math.min(1, (Date.now() - start) / duration);
        const eased = 1 - (1 - t) ** 3; // easeOutCubic
        setDisplay(Math.round(from + (to - from) * eased));
        if (t < 1) rafRef.current = requestAnimationFrame(tick);
        else { fromRef.current = to; rafRef.current = null; }
      };
      rafRef.current = requestAnimationFrame(tick);
    }

    if (to > prevRef.current) {
      shake.setValue(0);
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 80, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 80, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0.5, duration: 70, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 70, useNativeDriver: true }),
      ]).start();
      playBell();
    }
    prevRef.current = to;

    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, shake]);

  const rotate = shake.interpolate({ inputRange: [-1, 1], outputRange: ['-22deg', '22deg'] });

  return (
    <View style={s.countBadge}>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Ionicons name="notifications" size={15} color="#b7770d" />
      </Animated.View>
      <Text style={s.countNum}>{display}</Text>
    </View>
  );
}

/** Compact score-over-time sparkline tile (one bar per recorded day). */
function ProgressChart({ scores }: { scores: { date: number; score: number }[] }) {
  const data = scores; // full history
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
      return <View key={i} style={[s.sparkBar, { height: h }, isLast && s.barLast]} />;
    });
  }

  return (
    <View style={[s.bentoHalf, s.statTile]}>
      {/* RTL: newest (اليوم) on the left */}
      <View style={[s.sparkRow, { height: H }]}>
        {enough ? bars : <Text style={s.sparkEmpty}>—</Text>}
      </View>
      <Text style={s.statLabel}>تقدّمك</Text>
      <Text style={s.statSub}>{enough ? `${data.length} يوم` : 'ابدأ اللعب'}</Text>
    </View>
  );
}

/** Compact circular progress shown inside the stat tiles. */
function Ring({ pct, color }: { pct: number; color: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  // Lightweight conic-gradient ring (RN-web supports backgroundImage).
  return (
    <View style={s.ringOuter}>
      <View
        style={[
          s.ringTrack,
          { backgroundImage: `conic-gradient(${color} ${clamped * 3.6}deg, #e8edf2 0deg)` } as object,
        ]}
      />
      <View style={s.ringInner}>
        <Text style={[s.ringTxt, { color }]}>{Math.round(clamped)}%</Text>
      </View>
    </View>
  );
}

export default function MeScreen() {
  const router = useRouter();
  const profile = useProfileStore();
  const social = profile.social;

  const [dailyHead, setDailyHead] = useState<DailyHead | null | 'loading'>('loading');
  const [partsModalOpen, setPartsModalOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [avatarError, setAvatarError] = useState(false);
  // Post-win engagement: rank-comparison line for the "already done today" card.
  const [dailyRankLine, setDailyRankLine] = useState<string | null>(null);
  const [nicknameModalOpen, setNicknameModalOpen] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');

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

  // Once today's daily quiz is done, fetch a rank-comparison line against
  // yesterday's/all-time leaderboard (best-effort; hidden if unavailable).
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    if (profile.lastDailyCompletedDate !== today || !profile.lastDailyScore) {
      setDailyRankLine(null);
      return;
    }
    let cancelled = false;
    getComparisonReport()
      .then((entries) => { if (!cancelled) setDailyRankLine(describeRankGap(entries as never[], profile.lastDailyScore)); })
      .catch(() => { if (!cancelled) setDailyRankLine(null); });
    return () => { cancelled = true; };
  }, [profile.lastDailyCompletedDate, profile.lastDailyScore]);

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
    try {
      await Share.share({
        message: `حصلت على ${profile.lastDailyScore} نقطة في اختبار اليوم على شبكة اختبار القرآن! جرّب حظك:\nhttps://quranquiz.net`,
        url: 'https://quranquiz.net',
      });
    } catch { /* ignore */ }
  }

  function practiceWeakestSura() {
    const weak = profile.getWeakCheckedParts(1)[0];
    if (!weak) return;
    router.push({ pathname: '/(app)/quiz', params: { customPart: String(weak.index), nonce: String(Date.now()) } });
  }

  async function performSignOut() {
    // Wait for Firebase to clear the session BEFORE navigating. Otherwise the
    // (auth) screen's auth listener re-reads the still-signed-in user and bounces
    // straight back here, leaving the screen with no account actions.
    try {
      await signOut();
    } catch (e) {
      console.error(e);
    }
    await profile.delete().catch(console.error);
    router.replace('/(auth)');
  }

  function handleSignOut() {
    const msg = 'سيتم مسح بيانات التطبيق المحلية. هل تريد المتابعة؟';
    // RN Alert is a no-op on react-native-web, so use the browser confirm there.
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || window.confirm(`تسجيل الخروج\n\n${msg}`)) {
        performSignOut();
      }
      return;
    }
    Alert.alert('تسجيل الخروج', msg, [
      { text: 'لا', style: 'cancel' },
      { text: 'نعم', style: 'destructive', onPress: performSignOut },
    ]);
  }

  async function upgradeGuest(provider: 'google' | 'facebook') {
    try {
      await (provider === 'google' ? signInGoogle() : signInFacebook());
    } catch {
      notify('خطأ', 'تعذر تسجيل الدخول. حاول مرة أخرى.');
    }
  }

  function togglePart(index: number) {
    if (index === 0) return;
    const parts = [...profile.parts];
    parts[index] = { ...parts[index], checked: !parts[index].checked };
    useProfileStore.setState({ parts });
    profile.saveParts();
  }

  // Special questions are only available from level 2 upward.
  // Levels 0 and 1 force the toggle off.
  const SPECIAL_MIN_LEVEL = 2;

  function setLevel(value: number) {
    const patch: { level: number; specialEnabled?: boolean } = { level: value };
    if (value < SPECIAL_MIN_LEVEL) patch.specialEnabled = false;
    useProfileStore.setState(patch);
    profile.saveSettings();
  }

  function toggleSpecial(v: boolean) {
    if (profile.level < SPECIAL_MIN_LEVEL) return; // not editable below level 2
    useProfileStore.setState({ specialEnabled: v });
    profile.saveSettings();
  }

  const specialEditable = profile.level >= SPECIAL_MIN_LEVEL;

  function applyBulk(action: BulkAction) {
    const parts = profile.parts.map((p, i) => {
      if (i === 0) return p; // Al-Fatiha always stays checked
      const range = profile.getCorrectRatioRange(i);
      let checked: boolean;
      if (action === 'all') checked = true;
      else if (action === 'good') checked = range === CORRECT_RATIO_RANGE.HIGH;
      else checked = range !== CORRECT_RATIO_RANGE.HIGH;
      return { ...p, checked };
    });
    // Fallback: a good/weak filter can match no suras, leaving only Al-Fatiha.
    // Guarantee a usable quiz set by enabling Juz 'Amma (the last part).
    const hasSubstantive = parts.some((p, i) => i !== 0 && p.checked);
    if (!hasSubstantive && parts.length > 0) {
      const juzAmma = parts.length - 1;
      parts[juzAmma] = { ...parts[juzAmma], checked: true };
    }
    useProfileStore.setState({ parts });
    profile.saveParts();
  }

  // ── Derived values ──
  const firstName = social.displayName?.split(' ')[0] ?? '';
  const greeting = firstName ? `مرحباً ${firstName}` : 'مرحباً';

  const score = profile.getScore();
  const yesterday = profile.scores.length >= 2
    ? profile.scores[profile.scores.length - 2]?.score ?? 0
    : 0;
  const trend = score - yesterday;

  const today = new Date().toISOString().split('T')[0];
  const dailyCompleted = dailyHead !== 'loading'
    && dailyHead != null
    && profile.lastDailyCompletedDate === today;

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
  const weakPart = weakPartIndex >= 0 ? profile.parts[weakPartIndex] : null;

  const studyPct = parseFloat(profile.getPercentTotalStudy()) || 0;
  const ratioPct = parseFloat(profile.getPercentTotalRatio()) || 0;

  const activePartsList = profile.parts
    .map((part, index) => ({ part, index, range: profile.getCorrectRatioRange(index) }))
    .filter(({ part }) => part.checked);
  const activeParts = activePartsList.length;
  const PREVIEW_MAX = 10;
  const selectedPreview = activePartsList.slice(0, PREVIEW_MAX);
  const extraCount = activeParts - selectedPreview.length;

  const avatarUri = social.photoURL && !avatarError ? social.photoURL : undefined;

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Greeting + identity strip ── */}
        <View style={s.topStrip}>
          <Avatar
            uri={avatarUri}
            fallback={APP_ICON}
            style={s.topAvatar}
            onError={() => setAvatarError(true)}
          />
          <View style={s.topInfo}>
            <Text style={s.greeting}>{greeting}</Text>
            {social.isAnonymous ? (
              <TouchableOpacity style={s.topSubRow} onPress={openNicknameEditor} hitSlop={6}>
                <Ionicons name="pencil" size={11} color="#8a97a5" />
                <Text style={s.topSub} numberOfLines={1}>{social.displayName || DEFAULT_GUEST_NAME}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={s.topSub} numberOfLines={1}>{social.email ?? social.displayName ?? ''}</Text>
            )}
          </View>
          <View style={s.topRight}>
            {profile.streak > 0 && (
              <View style={s.streakBadge}>
                <Text style={s.streakTxt}>🔥 {profile.streak}</Text>
              </View>
            )}
            <Text style={s.topPoints} numberOfLines={1}>
              <Text style={s.topPointsLabel}>نقاطك: </Text>
              {trend !== 0 && (
                <Text style={trend > 0 ? s.trendUp : s.trendDown}>{trend > 0 ? '▲' : '▼'} </Text>
              )}
              <Text style={s.topPointsVal}>{score.toLocaleString()}</Text>
            </Text>
          </View>
        </View>

        {/* ── BENTO: hero daily card (full width) ── */}
        {dailyHead === 'loading' ? (
          <View style={[s.bentoFull, s.dailyHeroDark]}>
            <ActivityIndicator color="#fff" size="large" />
          </View>
        ) : dailyCompleted ? (
          <View style={[s.bentoFull, s.dailyHeroDoneCol]}>
            <View style={s.dailyHeroRow}>
              <Text style={s.dailyIcon}>✅</Text>
              <View style={s.dailyHeroText}>
                <Text style={s.dailyTitleDone}>أحسنت! أكملت اختبار اليوم</Text>
                <Text style={s.dailyBodyDone}>
                  الاختبار الجديد بعد {formatRemaining(nextDailyMs)}
                </Text>
              </View>
            </View>
            {dailyRankLine && <Text style={s.rankLine}>{dailyRankLine}</Text>}
            <View style={s.postWinRow}>
              <TouchableOpacity style={s.postWinBtn} onPress={shareScore}>
                <Ionicons name="share-social-outline" size={15} color="#1a5276" />
                <Text style={s.postWinBtnTxt}>شارك النتيجة</Text>
              </TouchableOpacity>
              {profile.getWeakCheckedParts(1).length > 0 && (
                <TouchableOpacity style={s.postWinBtn} onPress={practiceWeakestSura}>
                  <Ionicons name="book-outline" size={15} color="#1a5276" />
                  <Text style={s.postWinBtnTxt}>تدرّب على أضعف سورة</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : dailyHead ? (
          <View style={[s.bentoFull, s.dailyHeroDark]}>
            <View style={s.dailyHeroRow}>
              <Text style={s.dailyIcon}>⭐</Text>
              <View style={s.dailyHeroText}>
                <Text style={s.dailyTitle}>اختبار اليوم جاهز!</Text>
                <Text style={s.dailyBody}>10 أسئلة × صحة وسرعة</Text>
              </View>
            </View>
            <TouchableOpacity style={s.dailyBtn} onPress={startDaily} activeOpacity={0.85}>
              <Text style={s.dailyBtnTxt}>ابدأ اختبار اليوم</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[s.bentoFull, s.dailyHeroUnavail]}>
            <Text style={s.dailyIcon}>⏰</Text>
            <View style={s.dailyHeroText}>
              <Text style={s.dailyUnavailTxt}>لا يوجد اختبار اليوم حتى الآن</Text>
              <Text style={s.dailyUnavailSub}>يتجدد الاختبار كل 24 ساعة</Text>
            </View>
          </View>
        )}

        {/* ── BENTO: 2× progress ring tiles ── */}
        <View style={s.bentoRow}>
          <View style={[s.bentoHalf, s.statTile]}>
            <Ring pct={studyPct} color={NAVY} />
            <Text style={s.statLabel}>كم الحفظ</Text>
            <Text style={s.statSub}>من القرآن</Text>
          </View>
          <View style={[s.bentoHalf, s.statTile]}>
            <Ring pct={ratioPct} color="#27ae60" />
            <Text style={s.statLabel}>صحة الحفظ</Text>
            <Text style={s.statSub}>دقة الإجابات</Text>
          </View>
          <ProgressChart scores={profile.scores} />
        </View>

        {/* ── Weak sura alert (full width) ── */}
        {weakPart && (
          <TouchableOpacity
            style={[s.bentoFull, s.alertCard]}
            onPress={() => router.push({ pathname: '/(app)/quiz', params: { customPart: String(weakPartIndex), nonce: String(Date.now()) } })}
            activeOpacity={0.85}
          >
            <Ionicons name="chevron-back" size={18} color="#b7770d" />
            <View style={s.alertBody}>
              <Text style={s.alertTitle}>تحتاج مراجعة: {weakSura}</Text>
              <Text style={s.alertSub}>اضغط لبدء تدريب مخصص</Text>
            </View>
            <Text style={s.alertIcon}>⚠️</Text>
          </TouchableOpacity>
        )}

        {/* ── Quick play CTA ── */}
        <TouchableOpacity
          style={[s.bentoFull, s.quickBtn]}
          onPress={() => router.push({ pathname: '/(app)/quiz', params: { chooser: '1', nonce: String(Date.now()) } })}
          activeOpacity={0.85}
        >
          <Ionicons name="play" size={20} color="#fff" />
          <Text style={s.quickBtnTxt}>ابدأ اختباراً الآن</Text>
        </TouchableOpacity>

        {/* ── PvP: live 1v1 — real opponent first, falls back to the bot ── */}
        <TouchableOpacity
          style={[s.bentoFull, s.pvpCard]}
          onPress={() => router.push('/(app)/pvp')}
          activeOpacity={0.85}
        >
          <Ionicons name="chevron-back" size={18} color="#8a97a5" />
          <View style={s.pvpBody}>
            <Text style={s.pvpTitle}>منافسة مباشرة ⚔️</Text>
            <Text style={s.pvpSub}>١٠ أسئلة وجهاً لوجه ضد لاعب حقيقي أو الحافظ 🤖 — الأدق والأسرع يفوز</Text>
          </View>
          {(profile.pvp.wins + profile.pvp.losses + profile.pvp.draws) > 0 && (
            <View style={s.pvpRecordBadge}>
              <Text style={s.pvpRecordTxt}>🏆 {profile.pvp.wins}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ── Sign-in prompt for guests ── */}
        {social.isAnonymous && (
          <View style={[s.bentoFull, s.anonCard]}>
            <Text style={s.anonTxt}>سجّل دخولك لحفظ تقدمك ومزامنة بياناتك</Text>
            <View style={s.anonBtns}>
              <TouchableOpacity style={[s.socialBtn, s.btnGoogle]} onPress={() => upgradeGuest('google')}>
                <Text style={s.socialBtnTxt}>جوجل</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.socialBtn, s.btnFb]} onPress={() => upgradeGuest('facebook')}>
                <Text style={s.socialBtnTxt}>فيسبوك</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── BENTO: active parts (half) + settings (half) ── */}
        <View style={s.bentoRow}>
          {/* Active study parts — tap to edit in popup */}
          <TouchableOpacity
            style={[s.bentoHalf, s.halfCard]}
            activeOpacity={0.85}
            onPress={() => setPartsModalOpen(true)}
          >
            <View style={s.halfHeader}>
              <Ionicons name="create-outline" size={16} color="#8a97a5" />
              <Text style={s.halfTitle}>حفظي</Text>
            </View>
            <Text style={s.partsCount}>
              {arPlural(activeParts, 'سورة مُفعّلة', 'سورتان مُفعّلتان', 'سور مُفعّلة', 'سورة مُفعّلة')}
            </Text>
            <View style={s.chipWrap}>
              {selectedPreview.map(({ part, index, range }) => (
                <View key={index} style={s.chip}>
                  <View style={[s.chipDot, { backgroundColor: DOT_COLOR[range] }]} />
                  <Text style={s.chipTxt} numberOfLines={1}>{part.name}</Text>
                </View>
              ))}
              {extraCount > 0 && (
                <View style={[s.chip, s.chipMoreBox]}>
                  <Text style={s.chipMore}>+{extraCount}</Text>
                </View>
              )}
            </View>
            <Text style={s.halfHint}>اضغط للتعديل ✎</Text>
          </TouchableOpacity>

          {/* Settings — level + special, non-collapsible */}
          <View style={[s.bentoHalf, s.halfCard]}>
            <View style={s.halfHeader}>
              <Ionicons name="settings-outline" size={16} color="#8a97a5" />
              <Text style={s.halfTitle}>الإعدادات</Text>
            </View>
            <Text style={s.settingsField}>مستوى الاختبار</Text>
            {profile.levels.map((lvl) => (
              <TouchableOpacity
                key={lvl.value}
                style={[s.levelRowSm, lvl.disabled && s.levelDisabled]}
                onPress={() => !lvl.disabled && setLevel(lvl.value)}
                activeOpacity={lvl.disabled ? 1 : 0.7}
              >
                <View style={[s.radio, profile.level === lvl.value && s.radioSelected]}>
                  {profile.level === lvl.value && <View style={s.radioDot} />}
                </View>
                <Text style={[s.levelNameSm, lvl.disabled && s.disabledTxt]} numberOfLines={1}>
                  {lvl.text}
                </Text>
              </TouchableOpacity>
            ))}
            <View style={s.toggleRowSm}>
              <Switch
                value={specialEditable && profile.specialEnabled}
                onValueChange={toggleSpecial}
                disabled={!specialEditable}
                trackColor={{ false: '#ccc', true: NAVY }}
                thumbColor={specialEditable && profile.specialEnabled ? '#fff' : '#f4f3f4'}
                style={s.partSwitch}
              />
              <View style={s.toggleLabelCol}>
                <Text style={[s.toggleLabelSm, !specialEditable && s.disabledTxt]}>الأسئلة الخاصة</Text>
                {!specialEditable && (
                  <Text style={s.toggleHintSm}>من المستوى الثانوي فأعلى</Text>
                )}
              </View>
            </View>
            <Text style={s.version}>الإصدار {APP_VERSION}</Text>
          </View>
        </View>

        {/* ── Logout — very last ── */}
        {!social.isAnonymous && social.uid && (
          <TouchableOpacity style={s.signOutLink} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={16} color="#e74c3c" />
            <Text style={s.signOutTxt}>تسجيل الخروج</Text>
          </TouchableOpacity>
        )}

      </ScrollView>

      {/* ── Study-parts editor popup (list, not cards) ── */}
      <Modal
        visible={partsModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setPartsModalOpen(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setPartsModalOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color="#444" />
              </TouchableOpacity>
              <View style={s.modalHeaderRight}>
                <Text style={s.modalTitle}>اختر سور الحفظ</Text>
                <ActiveCountBadge value={activeParts} />
              </View>
            </View>

            <View style={s.filterRow}>
              {([['all', 'الكل'], ['good', 'الجيد'], ['weak', 'الضعيف']] as [BulkAction, string][]).map(([action, label]) => (
                <TouchableOpacity key={action} style={s.filterBtn} onPress={() => applyBulk(action)}>
                  <Text style={s.filterBtnTxt}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <FlatList
              data={profile.parts}
              keyExtractor={(_, i) => String(i)}
              ItemSeparatorComponent={() => <View style={s.sep} />}
              renderItem={({ item: part, index }) => {
                const range = profile.getCorrectRatioRange(index);
                const correct = part.numCorrect[1] + part.numCorrect[2] + part.numCorrect[3] + (part.numCorrect[4] ?? 0);
                const questions = part.numQuestions[1] + part.numQuestions[2] + part.numQuestions[3] + (part.numQuestions[4] ?? 0);
                return (
                  <View style={s.partRow}>
                    <View style={[s.rangeDot, { backgroundColor: DOT_COLOR[range] }]} />
                    <View style={s.partRowInfo}>
                      <View style={s.partNameRow}>
                        {range === CORRECT_RATIO_RANGE.HIGH && (
                          <View style={s.masteryBadge}>
                            <Text style={s.masteryBadgeTxt}>🏅 متمكن</Text>
                          </View>
                        )}
                        <Text style={s.partName} numberOfLines={1}>{part.name}</Text>
                      </View>
                      <Text style={s.partSub}>{correct} صحيحة من {questions}</Text>
                    </View>
                    <TouchableOpacity
                      style={s.practiceBtn}
                      onPress={() => {
                        setPartsModalOpen(false);
                        router.push({ pathname: '/(app)/quiz', params: { customPart: String(index), nonce: String(Date.now()) } });
                      }}
                    >
                      <Ionicons name="play" size={13} color={NAVY} />
                      <Text style={s.practiceTxt}>تدرّب</Text>
                    </TouchableOpacity>
                    <Switch
                      value={part.checked}
                      onValueChange={() => togglePart(index)}
                      disabled={index === 0}
                      trackColor={{ false: '#ccc', true: NAVY }}
                      thumbColor={part.checked ? '#fff' : '#f4f3f4'}
                    />
                  </View>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Guest nickname picker — auto-shown once for a fresh guest, always
          reachable afterward via the ✎ next to the identity subtitle. */}
      <Modal
        visible={nicknameModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setNicknameModalOpen(false)}
      >
        <View style={s.nickOverlay}>
          <View style={s.nickBox}>
            <Text style={s.nickTitle}>اختر اسماً يظهر على لوحة الصدارة</Text>
            <TextInput
              style={s.nickInput}
              value={nicknameInput}
              onChangeText={setNicknameInput}
              placeholder={DEFAULT_GUEST_NAME}
              placeholderTextColor="#aaa"
              maxLength={20}
              textAlign="right"
              autoFocus
            />
            <View style={s.nickRow}>
              <TouchableOpacity style={s.nickSkip} onPress={() => setNicknameModalOpen(false)}>
                <Text style={s.nickSkipTxt}>لاحقاً</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.nickSave} onPress={saveNickname}>
                <Text style={s.nickSaveTxt}>حفظ</Text>
              </TouchableOpacity>
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
  container: { flex: 1, backgroundColor: '#edf1f5' },
  scroll: { padding: 14, gap: 12, paddingBottom: 36 },

  // Top strip
  topStrip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 2,
    paddingTop: 2,
  },
  topAvatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: '#d6eaf8', backgroundColor: '#e8eef4' },
  topInfo: { flex: 1, alignItems: 'flex-end' },
  greeting: { fontSize: 19, fontWeight: '800', color: NAVY, textAlign: 'right' },
  topSub: { fontSize: 12, color: '#8a97a5', textAlign: 'right', marginTop: 1 },
  topSubRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, marginTop: 1 },
  topRight: { alignItems: 'flex-end', gap: 5 },
  topPoints: { fontSize: 13, textAlign: 'right' },
  topPointsLabel: { color: '#8a97a5', fontWeight: '700' },
  topPointsVal: { color: NAVY, fontWeight: '800' },
  streakBadge: {
    backgroundColor: '#fff3cd',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: AMBER,
  },
  streakTxt: { fontSize: 14, fontWeight: '800', color: '#b7770d' },

  // Bento primitives
  bentoFull: { borderRadius: 18, ...CARD_SHADOW },
  bentoRow: { flexDirection: 'row-reverse', gap: 12 },
  bentoHalf: { flex: 1, borderRadius: 18, ...CARD_SHADOW },

  // Daily hero
  dailyHeroDark: {
    backgroundColor: NAVY,
    padding: 20,
    gap: 14,
  },
  dailyHeroRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 14 },
  dailyHeroText: { flex: 1, alignItems: 'flex-end' },
  dailyHeroDoneCol: {
    backgroundColor: '#eafaf1',
    padding: 20,
    gap: 12,
    borderWidth: 1.5,
    borderColor: '#27ae60',
  },
  rankLine: { fontSize: 12, fontWeight: '700', color: '#b7770d', textAlign: 'right' },
  postWinRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  postWinBtn: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  postWinBtnTxt: { fontSize: 12, fontWeight: '700', color: '#1a5276', textAlign: 'center' },
  dailyHeroUnavail: {
    backgroundColor: '#fff',
    padding: 20,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 14,
  },
  dailyIcon: { fontSize: 40 },
  dailyTitle: { fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'right' },
  dailyBody: { fontSize: 13, color: '#9bbdd4', textAlign: 'right', marginTop: 2 },
  dailyTitleDone: { fontSize: 17, fontWeight: '800', color: '#1e8449', textAlign: 'right' },
  dailyBodyDone: { fontSize: 13, color: '#5ca87b', textAlign: 'right', marginTop: 2 },
  dailyUnavailTxt: { fontSize: 15, color: '#444', textAlign: 'right', fontWeight: '700' },
  dailyUnavailSub: { fontSize: 12, color: '#aaa', textAlign: 'right', marginTop: 2 },
  dailyBtn: {
    backgroundColor: AMBER,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  dailyBtnTxt: { fontSize: 16, fontWeight: '800', color: NAVY },

  // Score trend (used by points line beside name)
  trendUp: { color: '#27ae60' },
  trendDown: { color: '#e74c3c' },

  // Progress sparkline tile
  sparkRow: { width: '100%', flexDirection: 'row-reverse', alignItems: 'flex-end', justifyContent: 'center', gap: 1.5 },
  sparkBar: { flex: 1, maxWidth: 9, minWidth: 2, backgroundColor: '#cdddec', borderRadius: 2 },
  barLast: { backgroundColor: AMBER },
  sparkEmpty: { color: '#cbd3db', fontSize: 18, fontWeight: '800' },

  // Stat ring tiles
  statTile: { backgroundColor: '#fff', padding: 14, alignItems: 'center', justifyContent: 'center', gap: 6 },
  statLabel: { fontSize: 13, fontWeight: '800', color: NAVY },
  statSub: { fontSize: 11, color: '#9aa6b2' },
  ringOuter: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center' },
  ringTrack: { position: 'absolute', width: 76, height: 76, borderRadius: 38 },
  ringInner: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  ringTxt: { fontSize: 16, fontWeight: '800' },

  // Weak sura alert
  alertCard: {
    backgroundColor: '#fffaf0',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#f6e2bd',
  },
  alertBody: { flex: 1, alignItems: 'flex-end' },
  alertTitle: { fontSize: 14, fontWeight: '800', color: '#b7770d', textAlign: 'right' },
  alertSub: { fontSize: 12, color: '#a98c5a', textAlign: 'right', marginTop: 1 },
  alertIcon: { fontSize: 22 },

  // Quick play
  quickBtn: {
    backgroundColor: NAVY,
    paddingVertical: 16,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  quickBtnTxt: { color: '#fff', fontSize: 17, fontWeight: '800' },

  // PvP challenge card
  pvpCard: {
    backgroundColor: '#fff',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 16,
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#d6eaf8',
  },
  pvpBody: { flex: 1, alignItems: 'flex-end' },
  pvpTitle: { fontSize: 15, fontWeight: '800', color: NAVY, textAlign: 'right' },
  pvpSub: { fontSize: 12, color: '#8a97a5', textAlign: 'right', marginTop: 2 },
  pvpRecordBadge: {
    backgroundColor: '#fff7e6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  pvpRecordTxt: { fontSize: 13, fontWeight: '800', color: '#b7770d' },

  // Anon / sign out
  anonCard: { backgroundColor: '#fff', padding: 16, gap: 12 },
  anonTxt: { fontSize: 13, color: '#555', textAlign: 'right' },
  anonBtns: { flexDirection: 'row-reverse', gap: 8 },
  socialBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnGoogle: { backgroundColor: '#dd4b39' },
  btnFb: { backgroundColor: '#3b5998' },
  socialBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  signOutLink: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  signOutTxt: { color: '#e74c3c', fontSize: 13, fontWeight: '700' },

  // Study filters (shared by popup)
  filterRow: { flexDirection: 'row-reverse', padding: 12, gap: 8 },
  filterBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#edf1f5',
    borderWidth: 1,
    borderColor: '#d8e0ea',
  },
  filterBtnTxt: { fontSize: 13, fontWeight: '700', color: NAVY },

  // Half cards (active parts + settings)
  halfCard: { backgroundColor: '#fff', padding: 14, gap: 8 },
  halfHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  halfTitle: { fontSize: 14, fontWeight: '800', color: NAVY },

  // Active parts preview
  partsCount: { fontSize: 12, color: '#8a97a5', fontWeight: '700', textAlign: 'right' },
  chipWrap: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
    alignContent: 'flex-start',
  },
  chip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f4f7fa',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipTxt: { fontSize: 11, fontWeight: '700', color: '#33485e', maxWidth: 90 },
  chipMoreBox: { backgroundColor: '#e7edf3' },
  chipMore: { fontSize: 11, fontWeight: '800', color: NAVY },
  halfHint: { fontSize: 11, color: '#a7b3bf', textAlign: 'left', marginTop: 2 },

  // Settings (compact, half width)
  settingsField: { fontSize: 12, color: '#7a8794', fontWeight: '700', textAlign: 'right' },
  levelRowSm: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingVertical: 5 },
  levelNameSm: { flex: 1, fontSize: 13, fontWeight: '700', color: '#1a1a1a', textAlign: 'right' },
  toggleRowSm: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: '#f0f0f0',
  },
  toggleLabelCol: { flex: 1, alignItems: 'flex-end' },
  toggleLabelSm: { fontSize: 12, fontWeight: '700', color: '#1a1a1a', textAlign: 'right' },
  toggleHintSm: { fontSize: 10, color: '#a7b3bf', textAlign: 'right', marginTop: 1 },

  // Shared bits
  partSwitch: { transform: [{ scale: 0.85 }] },
  rangeDot: { width: 12, height: 12, borderRadius: 6 },
  partNameRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  partName: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', textAlign: 'right' },
  partSub: { fontSize: 11, color: '#8a97a5', textAlign: 'right', marginTop: 1 },
  // Mastery badge — shown next to a sura's name once its accuracy tier
  // reaches HIGH (see CORRECT_RATIO_RANGE.HIGH), the same milestone quiz.tsx
  // celebrates with a toast the first time it's crossed.
  masteryBadge: {
    backgroundColor: '#eafaf1',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#a8e6bf',
  },
  masteryBadgeTxt: { fontSize: 10, fontWeight: '800', color: '#1e8449' },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#bbb',
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: NAVY },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: NAVY },
  levelDisabled: { opacity: 0.5 },
  disabledTxt: { color: '#bbb' },
  version: { textAlign: 'center', color: '#bbb', fontSize: 11, paddingTop: 10 },

  // Parts popup (modal)
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', alignItems: 'center' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
    paddingBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  modalHeaderRight: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  modalTitle: { fontSize: 15, fontWeight: '800', color: NAVY, textAlign: 'right' },
  countBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#fff7e6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  countNum: { fontSize: 14, fontWeight: '800', color: '#b7770d', minWidth: 14, textAlign: 'center' },
  partRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    gap: 10,
  },
  partRowInfo: { flex: 1, alignItems: 'flex-end' },
  practiceBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#eef3f8',
  },
  practiceTxt: { fontSize: 12, fontWeight: '700', color: NAVY },
  sep: { height: 1, backgroundColor: '#f3f5f7', marginHorizontal: 16 },

  // Guest nickname modal
  nickOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  nickBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    gap: 14,
  },
  nickTitle: { fontSize: 15, fontWeight: '800', color: NAVY, textAlign: 'right' },
  nickInput: {
    borderWidth: 1,
    borderColor: '#d8e0ea',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1a1a1a',
  },
  nickRow: { flexDirection: 'row-reverse', gap: 10 },
  nickSkip: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#f0f0f0' },
  nickSkipTxt: { fontSize: 14, fontWeight: '700', color: '#666' },
  nickSave: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: NAVY },
  nickSaveTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
