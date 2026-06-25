import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getDailyHead, getYesterdayReport, getAllTopReport, type DailyHead,
} from '../../src/services/firebase';
import { useProfileStore } from '../../src/stores/profileStore';
import * as QS from '../../src/services/questionnaireService';

type Tab = 'yesterday' | 'all';
type Status = 'loading' | 'available' | 'empty' | 'error';

interface ReportEntry { name: string; score: number; uid?: string; country?: string }

const MEDAL = ['🥇', '🥈', '🥉'];

function flagEmoji(code?: string): string {
  if (!code || code.length < 2) return '';
  const pts = [...code.toUpperCase().slice(0, 2)].map((c) => 0x1F1E6 - 65 + c.charCodeAt(0));
  return String.fromCodePoint(...pts);
}

export default function LeagueScreen() {
  const router = useRouter();
  const profile = useProfileStore();

  const [tab, setTab] = useState<Tab>('yesterday');
  const [status, setStatus] = useState<Status>('loading');
  const [head, setHead] = useState<DailyHead | null>(null);
  const [yday, setYday] = useState<ReportEntry[]>([]);
  const [allTop, setAllTop] = useState<ReportEntry[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const dailyDone = profile.lastDailyCompletedDate === today;

  const checkDaily = useCallback(async () => {
    setStatus('loading');
    try {
      const h = await getDailyHead();
      if (h && h.daily_random != null) {
        setHead(h);
        setStatus('available');
        loadReports();
      } else {
        setStatus('empty');
      }
    } catch {
      setStatus('error');
    }
  }, []);

  async function loadReports() {
    setReportsLoading(true);
    try {
      const [y, a] = await Promise.all([getYesterdayReport(), getAllTopReport()]);
      setYday((y as ReportEntry[]).slice(0, 10));
      setAllTop((a as ReportEntry[]).slice(0, 10));
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

  const listData = tab === 'yesterday' ? yday : allTop;

  function renderRow({ item, index }: { item: ReportEntry; index: number }) {
    const isMe = item.uid === profile.uid;
    const flag = flagEmoji(item.country);
    return (
      <View style={[s.row, isMe && s.rowMe]}>
        {/* RTL: medal (right) → flag → name (flex) → score (left) */}
        <Text style={s.medal}>{index < 3 ? MEDAL[index] : `${index + 1}`}</Text>
        {flag ? <Text style={s.rowFlag}>{flag}</Text> : <View style={s.rowFlagPlaceholder} />}
        <Text style={[s.rowName, isMe && s.rowNameMe]} numberOfLines={1}>{item.name ?? 'مجهول'}</Text>
        <Text style={[s.rowScore, isMe && s.rowScoreMe]}>{item.score}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Compact daily challenge strip */}
        {status === 'available' && (
          dailyDone ? (
            <View style={[s.dailyStrip, s.dailyStripDone]}>
              <Ionicons name="checkmark-circle" size={18} color="#27ae60" />
              <Text style={[s.dailyStripTxt, { color: '#1e8449' }]}>أكملت اختبار اليوم ✓</Text>
            </View>
          ) : (
            <TouchableOpacity style={s.dailyStrip} onPress={startDaily} activeOpacity={0.85}>
              <Ionicons name="star" size={18} color="#f39c12" />
              <Text style={s.dailyStripTxt}>اختبار اليوم جاهز</Text>
              <View style={s.dailyStripBtn}>
                <Text style={s.dailyStripBtnTxt}>ابدأ</Text>
              </View>
            </TouchableOpacity>
          )
        )}
        {status === 'loading' && (
          <View style={s.dailyStrip}>
            <ActivityIndicator size="small" color="#0d2d4e" />
            <Text style={s.dailyStripTxt}>جارٍ التحقق...</Text>
          </View>
        )}
        {status === 'error' && (
          <TouchableOpacity style={[s.dailyStrip, s.dailyStripError]} onPress={checkDaily}>
            <Ionicons name="refresh" size={16} color="#c0392b" />
            <Text style={[s.dailyStripTxt, { color: '#c0392b' }]}>تعذر الاتصال — إعادة المحاولة</Text>
          </TouchableOpacity>
        )}

        {/* Inner tab bar */}
        <View style={s.tabBar}>
          {([['yesterday', 'أمس'], ['all', 'الكل']] as [Tab, string][]).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[s.tabBtn, tab === key && s.tabBtnActive]}
              onPress={() => setTab(key)}
            >
              <Text style={[s.tabBtnTxt, tab === key && s.tabBtnTxtActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {(tab === 'yesterday' || tab === 'all') && (
          <View style={s.card}>
            <Text style={s.cardTitle}>
              {tab === 'yesterday' ? 'أفضل نتائج الأمس' : 'أعلى النتائج على الإطلاق'}
            </Text>
            {reportsLoading ? (
              <ActivityIndicator color="#0d2d4e" style={{ marginVertical: 16 }} />
            ) : listData.length === 0 ? (
              <Text style={[s.emptyTxt, { padding: 16 }]}>لا توجد نتائج بعد</Text>
            ) : (
              <FlatList
                data={listData}
                keyExtractor={(_, i) => String(i)}
                renderItem={renderRow}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={s.sep} />}
              />
            )}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#edf1f5' },
  scroll: { padding: 16, gap: 12 },

  dailyStrip: {
    backgroundColor: '#fff',
    borderRadius: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    boxShadow: '0px 0px 4px rgba(0,0,0,0.06)',
    elevation: 2,
  },
  dailyStripError: { borderWidth: 1, borderColor: '#f5b7b1' },
  dailyStripDone: { borderWidth: 1.5, borderColor: '#27ae60', backgroundColor: '#eafaf1' },
  dailyStripTxt: { flex: 1, fontSize: 14, fontWeight: '600', color: '#0d2d4e', textAlign: 'right' },
  dailyStripBtn: {
    backgroundColor: '#0d2d4e',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
  },
  dailyStripBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },

  tabBar: {
    flexDirection: 'row-reverse',
    backgroundColor: '#dce8f2',
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: '#0d2d4e' },
  tabBtnTxt: { fontSize: 13, fontWeight: '600', color: '#666' },
  tabBtnTxtActive: { color: '#fff' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0px 0px 4px rgba(0,0,0,0.06)',
    elevation: 2,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0d2d4e',
    textAlign: 'right',
    padding: 14,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
  },
  center: { padding: 24, alignItems: 'center' },
  emptyTxt: { fontSize: 14, color: '#888', textAlign: 'center' },
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  rowMe: { backgroundColor: '#d8e8f2' },
  medal: { width: 30, fontSize: 15, textAlign: 'center' },
  rowFlag: { fontSize: 18, width: 28, textAlign: 'center' },
  rowFlagPlaceholder: { width: 28 },
  rowName: { flex: 1, fontSize: 14, color: '#333', textAlign: 'right' },
  rowNameMe: { fontWeight: '700', color: '#0d2d4e' },
  rowScore: { fontSize: 15, fontWeight: '700', color: '#0d2d4e', minWidth: 42, textAlign: 'left' },
  rowScoreMe: { color: '#f39c12' },
  sep: { height: 1, backgroundColor: '#f5f5f5', marginHorizontal: 14 },
});
