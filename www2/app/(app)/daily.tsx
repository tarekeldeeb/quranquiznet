import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getDailyHead, getYesterdayReport, getAllTopReport, type DailyHead,
} from '../../src/services/firebase';
import { useProfileStore } from '../../src/stores/profileStore';
import * as QS from '../../src/services/questionnaireService';

type Status = 'loading' | 'available' | 'empty' | 'error';

interface ReportEntry { name: string; score: number; uid?: string }

export default function DailyScreen() {
  const router = useRouter();
  const profile = useProfileStore();

  const [status, setStatus] = useState<Status>('loading');
  const [head, setHead] = useState<DailyHead | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [yday, setYday] = useState<ReportEntry[]>([]);
  const [allTop, setAllTop] = useState<ReportEntry[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  const checkDaily = useCallback(async () => {
    setStatus('loading');
    setErrorMsg('');
    try {
      const h = await getDailyHead();
      if (h && h.daily_random != null) {
        setHead(h);
        setStatus('available');
        loadReports();
      } else {
        setStatus('empty');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMsg(msg);
      setStatus('error');
      console.error('getDailyHead error:', e);
    }
  }, []);

  async function loadReports() {
    setReportsLoading(true);
    try {
      const [y, a] = await Promise.all([getYesterdayReport(), getAllTopReport()]);
      setYday((y as ReportEntry[]).slice(0, 5));
      setAllTop((a as ReportEntry[]).slice(0, 5));
    } catch (e) {
      console.error('loadReports error:', e);
    } finally {
      setReportsLoading(false);
    }
  }

  useEffect(() => { checkDaily(); }, [checkDaily]);

  function startDaily() {
    if (!head) return;
    Alert.alert(
      'اختبار اليوم',
      'الاختبار يتكون من 10 أسئلة في نطاق حفظك وعليك الإجابة بشكل صحيح وسريع',
      [
        { text: 'لا', style: 'cancel' },
        {
          text: 'ابدأ',
          onPress: () => {
            const weights = profile.getDailyQuizStudyPartsWeights();
            QS.initDailyQuiz(head.daily_random, profile.parts, weights);
            router.push({ pathname: '/(app)/quiz', params: { dailyMode: '1' } });
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>

        {/* Status card */}
        <View style={s.card}>
          {status === 'loading' && (
            <View style={s.center}>
              <ActivityIndicator size="large" color="#1a5276" />
              <Text style={s.statusTxt}>جارٍ التحقق من اختبار اليوم...</Text>
            </View>
          )}

          {status === 'available' && (
            <View style={s.center}>
              <Ionicons name="star" size={48} color="#f39c12" />
              <Text style={s.readyTitle}>اختبار اليوم جاهز!</Text>
              <Text style={s.readyBody}>
                أجب على 10 أسئلة بشكل صحيح وسريع لتحصل على أعلى نقاط
              </Text>
              <TouchableOpacity style={s.startBtn} onPress={startDaily}>
                <Ionicons name="play" size={20} color="#fff" />
                <Text style={s.startBtnTxt}> ابدأ الاختبار</Text>
              </TouchableOpacity>
            </View>
          )}

          {status === 'empty' && (
            <View style={s.center}>
              <Ionicons name="time-outline" size={48} color="#bdc3c7" />
              <Text style={s.statusTxt}>لا يوجد اختبار اليوم حتى الآن</Text>
              <Text style={s.subTxt}>يتم تجديد الاختبار كل 24 ساعة</Text>
              <TouchableOpacity style={s.retryBtn} onPress={checkDaily}>
                <Text style={s.retryTxt}>إعادة التحقق</Text>
              </TouchableOpacity>
            </View>
          )}

          {status === 'error' && (
            <View style={s.center}>
              <Ionicons name="cloud-offline-outline" size={48} color="#c0392b" />
              <Text style={s.errorTitle}>تعذّر الاتصال بالخادم</Text>
              {!!errorMsg && <Text style={s.errorMsg}>{errorMsg}</Text>}
              <TouchableOpacity style={s.retryBtn} onPress={checkDaily}>
                <Ionicons name="refresh" size={16} color="#1a5276" />
                <Text style={s.retryTxt}> إعادة المحاولة</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Yesterday's top 5 */}
        {yday.length > 0 && (
          <View style={s.card}>
            <Text style={s.sectionTitle}>أفضل 5 بالأمس</Text>
            {reportsLoading
              ? <ActivityIndicator color="#1a5276" />
              : yday.map((r, i) => (
                <View key={i} style={s.row}>
                  <Text style={s.rank}>#{i + 1}</Text>
                  <Text style={s.rowName}>{r.name ?? 'مجهول'}</Text>
                  <Text style={s.rowScore}>{r.score}</Text>
                </View>
              ))}
          </View>
        )}

        {/* All-time top 10 */}
        {allTop.length > 0 && (
          <View style={s.card}>
            <Text style={s.sectionTitle}>أعلى النتائج</Text>
            {reportsLoading
              ? <ActivityIndicator color="#1a5276" />
              : allTop.map((r, i) => (
                <View key={i} style={s.row}>
                  <Text style={s.rank}>#{i + 1}</Text>
                  <Text style={s.rowName}>{r.name ?? 'مجهول'}</Text>
                  <Text style={s.rowScore}>{r.score}</Text>
                </View>
              ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  scroll: { padding: 16, gap: 16 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  center: { alignItems: 'center', gap: 12, paddingVertical: 8 },
  readyTitle: { fontSize: 20, fontWeight: '700', color: '#1a5276', textAlign: 'center' },
  readyBody: { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 22 },
  statusTxt: { fontSize: 16, color: '#555', textAlign: 'center', marginTop: 8 },
  subTxt: { fontSize: 13, color: '#aaa', textAlign: 'center' },
  errorTitle: { fontSize: 16, fontWeight: '700', color: '#c0392b', textAlign: 'center' },
  errorMsg: { fontSize: 12, color: '#e74c3c', textAlign: 'center', fontFamily: 'monospace' },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a5276',
    paddingHorizontal: 28, paddingVertical: 14, borderRadius: 10, marginTop: 8,
  },
  startBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#1a5276',
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 4,
  },
  retryTxt: { color: '#1a5276', fontWeight: '600' },
  sectionTitle: {
    fontSize: 14, fontWeight: '700', color: '#1a5276', textAlign: 'right',
    marginBottom: 8, borderBottomWidth: 1, borderColor: '#eee', paddingBottom: 6,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderColor: '#f5f5f5' },
  rank: { width: 28, fontSize: 12, color: '#888' },
  rowName: { flex: 1, fontSize: 14, color: '#333', textAlign: 'right' },
  rowScore: { fontSize: 15, fontWeight: '700', color: '#1a5276', marginLeft: 8 },
});
