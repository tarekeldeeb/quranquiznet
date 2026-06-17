import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getDailyHead, type DailyHead } from '../../src/services/firebase';
import { useProfileStore } from '../../src/stores/profileStore';
import * as QS from '../../src/services/questionnaireService';

export default function HomeScreen() {
  const router = useRouter();
  const profile = useProfileStore();
  const [dailyHead, setDailyHead] = useState<DailyHead | null | 'loading'>('loading');

  useEffect(() => {
    getDailyHead()
      .then((h) => setDailyHead(h ?? null))
      .catch(() => setDailyHead(null));
  }, []);

  function startDaily() {
    if (!dailyHead || dailyHead === 'loading') return;
    const weights = profile.getDailyQuizStudyPartsWeights();
    QS.initDailyQuiz(dailyHead.daily_random, profile.parts, weights);
    router.push({ pathname: '/(app)/quiz', params: { dailyMode: '1' } });
  }

  const firstName = profile.social.displayName?.split(' ')[0] ?? '';
  const greeting = firstName ? `مرحباً ${firstName}` : 'مرحباً';

  // Trend: compare current score with yesterday's record
  const score = profile.getScore();
  const yesterday = profile.scores.length >= 2
    ? profile.scores[profile.scores.length - 2]?.score ?? 0
    : 0;
  const trend = score - yesterday;

  const today = new Date().toISOString().split('T')[0];
  const dailyCompleted = dailyHead !== 'loading'
    && dailyHead != null
    && profile.lastDailyCompletedDate === today;

  const weakSura = profile.getTopBadParts()[0];
  const weakPartIndex = weakSura !== '-'
    ? profile.parts.findIndex((p) => p.name === weakSura)
    : -1;
  const weakPart = weakPartIndex >= 0 ? profile.parts[weakPartIndex] : null;

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header row */}
        <View style={s.headerRow}>
          {profile.streak > 0 && (
            <View style={s.streakBadge}>
              <Text style={s.streakTxt}>🔥 {profile.streak} أيام</Text>
            </View>
          )}
          <Text style={s.greeting}>{greeting}</Text>
        </View>

        {/* Daily challenge card */}
        {dailyHead === 'loading' ? (
          <View style={s.dailyCardLoading}>
            <ActivityIndicator color="#fff" size="large" />
          </View>
        ) : dailyCompleted ? (
          <View style={s.dailyCardDone}>
            <Text style={s.dailyIcon}>✅</Text>
            <Text style={s.dailyTitleDark}>أحسنت! أكملت اختبار اليوم</Text>
            <Text style={s.dailyBodyDark}>عد غداً للاختبار الجديد</Text>
          </View>
        ) : dailyHead ? (
          <View style={s.dailyCardAvailable}>
            <Text style={s.dailyIcon}>⭐</Text>
            <Text style={s.dailyTitle}>اختبار اليوم جاهز!</Text>
            <Text style={s.dailyBody}>10 أسئلة × صحة وسرعة</Text>
            <TouchableOpacity style={s.dailyBtn} onPress={startDaily}>
              <Text style={s.dailyBtnTxt}>ابدأ اختبار اليوم</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.dailyCardUnavailable}>
            <Text style={s.dailyUnavailIcon}>⏰</Text>
            <Text style={s.dailyUnavailTxt}>لا يوجد اختبار اليوم حتى الآن</Text>
            <Text style={s.dailyUnavailSub}>يتم تجديد الاختبار كل 24 ساعة</Text>
          </View>
        )}

        {/* Score + study tiles */}
        <View style={s.tilesRow}>
          <View style={s.tile}>
            <Text style={s.tileLabel}>نقاطك</Text>
            <Text style={s.tileValue}>{score.toLocaleString()}</Text>
            {trend !== 0 && (
              <Text style={[s.tileTrend, trend > 0 ? s.trendUp : s.trendDown]}>
                {trend > 0 ? '▲' : '▼'} {Math.abs(trend).toLocaleString()}
              </Text>
            )}
          </View>
          <View style={s.tile}>
            <Text style={s.tileLabel}>كم الحفظ</Text>
            <Text style={s.tileValue}>{profile.getPercentTotalStudy()}</Text>
            <Text style={s.tileSub}>من القرآن</Text>
          </View>
        </View>

        {/* Weak sura alert */}
        {weakPart && (
          <TouchableOpacity
            style={s.alertCard}
            onPress={() => router.push({ pathname: '/(app)/quiz', params: { customPart: String(weakPartIndex), nonce: String(Date.now()) } })}
            activeOpacity={0.8}
          >
            <View style={s.alertAccent} />
            <View style={s.alertBody}>
              <Text style={s.alertTitle}>⚠️ تحتاج مراجعة: {weakSura}</Text>
              <Text style={s.alertSub}>اضغط لبدء تدريب مخصص</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Quick play */}
        <TouchableOpacity style={s.quickBtn} onPress={() => router.push('/(app)/quiz')}>
          <Text style={s.quickBtnTxt}>ابدأ اختباراً الآن</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#edf1f5' },
  scroll: { padding: 16, gap: 14 },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  greeting: { fontSize: 20, fontWeight: '700', color: '#0d2d4e', textAlign: 'right' },
  streakBadge: {
    backgroundColor: '#fff3cd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f39c12',
  },
  streakTxt: { fontSize: 13, fontWeight: '700', color: '#b7770d' },

  dailyCardAvailable: {
    backgroundColor: '#0d2d4e',
    borderRadius: 16,
    padding: 22,
    alignItems: 'center',
    gap: 8,
    boxShadow: '0px 0px 8px rgba(0,0,0,0.15)',
    elevation: 4,
  },
  dailyCardLoading: {
    backgroundColor: '#0d2d4e',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
  },
  dailyCardUnavailable: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 22,
    alignItems: 'center',
    gap: 6,
    boxShadow: '0px 0px 4px rgba(0,0,0,0.06)',
    elevation: 2,
  },
  dailyCardDone: {
    backgroundColor: '#eafaf1',
    borderRadius: 16,
    padding: 22,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#27ae60',
    boxShadow: '0px 0px 4px rgba(0,0,0,0.06)',
    elevation: 2,
  },
  dailyIcon: { fontSize: 40 },
  dailyTitle: { fontSize: 20, fontWeight: '700', color: '#fff', textAlign: 'center' },
  dailyTitleDark: { fontSize: 18, fontWeight: '700', color: '#1e8449', textAlign: 'center' },
  dailyBody: { fontSize: 14, color: '#9bbdd4', textAlign: 'center' },
  dailyBodyDark: { fontSize: 13, color: '#7dcea0', textAlign: 'center' },
  dailyBtn: {
    backgroundColor: '#f39c12',
    paddingHorizontal: 32,
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 6,
  },
  dailyBtnTxt: { fontSize: 16, fontWeight: '700', color: '#0d2d4e' },
  dailyUnavailIcon: { fontSize: 36 },
  dailyUnavailTxt: { fontSize: 15, color: '#666', textAlign: 'center', fontWeight: '600' },
  dailyUnavailSub: { fontSize: 12, color: '#aaa', textAlign: 'center' },

  tilesRow: { flexDirection: 'row-reverse', gap: 12 },
  tile: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    boxShadow: '0px 0px 4px rgba(0,0,0,0.06)',
    elevation: 2,
    gap: 4,
  },
  tileLabel: { fontSize: 12, color: '#888', fontWeight: '600' },
  tileValue: { fontSize: 24, fontWeight: '700', color: '#0d2d4e' },
  tileSub: { fontSize: 11, color: '#aaa' },
  tileTrend: { fontSize: 12, fontWeight: '700' },
  trendUp: { color: '#27ae60' },
  trendDown: { color: '#e74c3c' },

  alertCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    flexDirection: 'row-reverse',
    overflow: 'hidden',
    boxShadow: '0px 0px 4px rgba(0,0,0,0.06)',
    elevation: 2,
  },
  alertAccent: { width: 4, backgroundColor: '#f39c12' },
  alertBody: { flex: 1, padding: 14, gap: 4, alignItems: 'flex-end' },
  alertTitle: { fontSize: 14, fontWeight: '700', color: '#b7770d', textAlign: 'right' },
  alertSub: { fontSize: 12, color: '#888', textAlign: 'right' },

  quickBtn: {
    backgroundColor: '#0d2d4e',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    boxShadow: '0px 0px 4px rgba(0,0,0,0.1)',
    elevation: 3,
  },
  quickBtnTxt: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
