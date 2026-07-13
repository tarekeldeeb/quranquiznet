import { useEffect } from 'react';
import {
  View, Text, StyleSheet, Image, Alert, ScrollView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { signInAnon, signInGoogle, signInFacebook, onAuthChange } from '../../src/services/firebase';
import { useTheme, arNum, radii } from '../../src/theme/tokens';
import PressScale from '../../src/components/PressScale';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const FEATURES: { icon: IconName; title: string; body: string; tint: string }[] = [
  { icon: 'flame', title: 'تحدٍّ يومي', body: 'اختبار جديد كل يوم وحافظ على سلسلة أيامك', tint: '#c8973a' },
  { icon: 'git-compare', title: 'أسئلة المتشابهات', body: 'اختبر تمييزك بين الآيات المتشابهة', tint: '#2980b9' },
  { icon: 'trophy', title: 'البطولة', body: 'نافس القرّاء على لوحة الصدارة', tint: '#c0a02c' },
  { icon: 'cloud-done', title: 'مزامنة سحابية', body: 'احفظ تقدمك وزامنه بين كل أجهزتك', tint: '#2f7d5d' },
];

const STATS = [
  { value: arNum(114), label: 'سورة' },
  { value: arNum(77878), label: 'كلمة' },
  { value: '∞', label: 'أسئلة' },
];

function notify(title: string, msg: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(`${title}\n\n${msg}`);
    return;
  }
  Alert.alert(title, msg);
}

export default function AuthScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    const unsub = onAuthChange((user) => {
      if (user) router.replace('/(app)/me');
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGoogle() {
    try {
      await signInGoogle();
    } catch {
      notify('خطأ', 'تعذر تسجيل الدخول بجوجل');
    }
  }

  async function handleFacebook() {
    try {
      await signInFacebook();
    } catch {
      notify('خطأ', 'تعذر تسجيل الدخول بفيسبوك');
    }
  }

  async function handleAnonymous() {
    await signInAnon();
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.navy }]} edges={['top', 'bottom']}>
      {/* Decorative background accents */}
      <View style={[s.blob, s.blobTop, { backgroundColor: colors.gold }]} />
      <View style={[s.blob, s.blobBottom, { backgroundColor: colors.navySoft }]} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Hero ── */}
        <View style={s.hero}>
          <View style={s.logoRing}>
            <Image source={require('../../assets/images/app-icon.png')} style={s.logo} resizeMode="contain" />
          </View>
          <Text style={s.title}>شبكة اختبار القرآن</Text>
          <Text style={[s.tagline, { color: colors.navySoft }]}>اختبر حفظك ونافس أهل القرآن</Text>
        </View>

        {/* ── Stats strip ── */}
        <View style={s.statsRow}>
          {STATS.map((st, i) => (
            <View key={st.label} style={s.statItem}>
              <Text style={[s.statValue, { color: colors.gold }]}>{st.value}</Text>
              <Text style={[s.statLabel, { color: colors.navySoft }]}>{st.label}</Text>
              {i < STATS.length - 1 && <View style={s.statDivider} />}
            </View>
          ))}
        </View>

        {/* ── Primary CTA: play now, no sign-in required ── */}
        <View style={[s.card, { backgroundColor: colors.card }]}>
          <PressScale style={[s.playBtn, { backgroundColor: colors.gold, shadowColor: colors.goldDeep }]} onPress={handleAnonymous}>
            <Ionicons name="play" size={22} color={colors.navy} />
            <Text style={[s.playBtnTxt, { color: colors.navy }]}>العب الآن</Text>
          </PressScale>
          <Text style={[s.playHint, { color: colors.inkSoft }]}>بلا تسجيل — أول سؤال خلال ثوانٍ</Text>

          <View style={s.dividerRow}>
            <View style={[s.dividerLine, { backgroundColor: colors.line }]} />
            <Text style={[s.dividerTxt, { color: colors.inkSoft }]}>أو سجّل دخولك لحفظ تقدمك</Text>
            <View style={[s.dividerLine, { backgroundColor: colors.line }]} />
          </View>

          <PressScale style={[s.socialBtn, { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line }]} onPress={handleGoogle}>
            <Ionicons name="logo-google" size={18} color="#4285F4" />
            <Text style={[s.socialBtnTxt, { color: colors.ink }]}>المتابعة بحساب جوجل</Text>
          </PressScale>

          <PressScale style={[s.socialBtn, { backgroundColor: '#1877F2' }]} onPress={handleFacebook}>
            <Ionicons name="logo-facebook" size={18} color="#fff" />
            <Text style={[s.socialBtnTxt, { color: '#fff' }]}>المتابعة بحساب فيسبوك</Text>
          </PressScale>
        </View>

        {/* ── Why join (2×2 grid) ── */}
        <View style={s.featuresGrid}>
          {FEATURES.map((f) => (
            <View key={f.title} style={s.featureTile}>
              <View style={[s.featureIcon, { backgroundColor: `${f.tint}26` }]}>
                <Ionicons name={f.icon} size={18} color={f.tint} />
              </View>
              <View style={s.featureText}>
                <Text style={s.featureTitle}>{f.title}</Text>
                <Text style={[s.featureBody, { color: colors.navySoft }]} numberOfLines={2}>{f.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={[s.footer, { color: 'rgba(255,255,255,0.45)' }]}>
          بالمتابعة فأنت توافق على{' '}
          <Text style={[s.footerLink, { color: colors.navySoft }]} onPress={() => router.push('/(auth)/privacy')}>
            الشروط وسياسة الخصوصية
          </Text>
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 18, gap: 12, alignItems: 'stretch' },

  // Decorative accents
  blob: { position: 'absolute', borderRadius: 999, opacity: 0.12, pointerEvents: 'none' },
  blobTop: { width: 280, height: 280, top: -120, right: -80 },
  blobBottom: { width: 240, height: 240, bottom: -100, left: -70 },

  // Hero
  hero: { alignItems: 'center', gap: 4, paddingBottom: 2 },
  logoRing: {
    width: 74, height: 74, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  logo: { width: 50, height: 50, borderRadius: 12 },
  title: { color: '#fff', fontSize: 21, fontFamily: 'PlexArabic-Bold', textAlign: 'center', marginTop: 4 },
  tagline: { fontSize: 13, textAlign: 'center' },

  // Stats
  statsRow: {
    flexDirection: 'row-reverse',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radii.lg,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontFamily: 'PlexArabic-Bold' },
  statLabel: { fontSize: 11 },
  statDivider: {
    position: 'absolute', left: 0, top: '15%', height: '70%',
    width: 1, backgroundColor: 'rgba(255,255,255,0.12)',
  },

  // Primary CTA card
  card: {
    borderRadius: radii.lg + 2, padding: 16, gap: 10,
    boxShadow: '0px 4px 16px rgba(0,0,0,0.25)', elevation: 5,
  },
  playBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: radii.md,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  playBtnTxt: { fontSize: 18, fontFamily: 'PlexArabic-Bold' },
  playHint: { fontSize: 11, textAlign: 'center' },
  dividerRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1 },
  dividerTxt: { fontSize: 11 },

  // Features (2×2 grid)
  featuresGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  featureTile: {
    width: '47%',
    flexGrow: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 9,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radii.lg,
    paddingVertical: 10,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  featureIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  featureText: { flex: 1, alignItems: 'flex-end' },
  featureTitle: { color: '#fff', fontSize: 13, fontFamily: 'PlexArabic-Bold', textAlign: 'right' },
  featureBody: { fontSize: 11, textAlign: 'right', marginTop: 1, lineHeight: 15 },

  socialBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
    borderRadius: radii.md,
  },
  socialBtnTxt: { fontSize: 14, fontFamily: 'PlexArabic-SemiBold' },

  footer: { fontSize: 11, textAlign: 'center', lineHeight: 16 },
  footerLink: { fontFamily: 'PlexArabic-SemiBold', textDecorationLine: 'underline' },
});
