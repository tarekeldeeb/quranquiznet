import { useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image, Alert, ScrollView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { signInAnon, signInGoogle, signInFacebook, onAuthChange } from '../../src/services/firebase';

const NAVY = '#0d2d4e';
const AMBER = '#f39c12';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const FEATURES: { icon: IconName; title: string; body: string; tint: string }[] = [
  { icon: 'flame', title: 'تحدٍّ يومي', body: 'اختبار جديد كل يوم وحافظ على سلسلة أيامك', tint: '#e67e22' },
  { icon: 'git-compare', title: 'أسئلة المتشابهات', body: 'اختبر تمييزك بين الآيات المتشابهة', tint: '#2980b9' },
  { icon: 'trophy', title: 'البطولة', body: 'نافس القرّاء على لوحة الصدارة', tint: '#c0a02c' },
  { icon: 'cloud-done', title: 'مزامنة سحابية', body: 'احفظ تقدمك وزامنه بين كل أجهزتك', tint: '#27ae60' },
];

const STATS = [
  { value: '١١٤', label: 'سورة' },
  { value: '٧٧٬٨٧٨', label: 'كلمة' },
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
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      {/* Decorative background accents */}
      <View style={[s.blob, s.blobTop]} />
      <View style={[s.blob, s.blobBottom]} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Hero ── */}
        <View style={s.hero}>
          <View style={s.logoRing}>
            <Image source={require('../../assets/images/app-icon.png')} style={s.logo} resizeMode="contain" />
          </View>
          <Text style={s.title}>شبكة اختبار القرآن</Text>
          <Text style={s.tagline}>اختبر حفظك ونافس أهل القرآن</Text>
        </View>

        {/* ── Stats strip ── */}
        <View style={s.statsRow}>
          {STATS.map((st, i) => (
            <View key={st.label} style={s.statItem}>
              <Text style={s.statValue}>{st.value}</Text>
              <Text style={s.statLabel}>{st.label}</Text>
              {i < STATS.length - 1 && <View style={s.statDivider} />}
            </View>
          ))}
        </View>

        {/* ── Sign-in card ── */}
        <View style={s.card}>
          <Text style={s.cardHeader}>ابدأ الآن</Text>
          <Text style={s.cardBody}>سجّل دخولك لحفظ تقدمك والمزامنة بين أجهزتك.</Text>

          <TouchableOpacity style={[s.btn, s.btnGoogle]} onPress={handleGoogle} activeOpacity={0.85}>
            <Ionicons name="logo-google" size={20} color="#fff" />
            <Text style={s.btnText}>المتابعة بحساب جوجل</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[s.btn, s.btnFacebook]} onPress={handleFacebook} activeOpacity={0.85}>
            <Ionicons name="logo-facebook" size={20} color="#fff" />
            <Text style={s.btnText}>المتابعة بحساب فيسبوك</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.anonLink} onPress={handleAnonymous} activeOpacity={0.7}>
            <Ionicons name="person-outline" size={16} color="#7a8794" />
            <Text style={s.anonLinkTxt}>المتابعة كزائر</Text>
          </TouchableOpacity>
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
                <Text style={s.featureBody} numberOfLines={2}>{f.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={s.footer}>
          بالمتابعة فأنت توافق على{' '}
          <Text style={s.footerLink} onPress={() => router.push('/(auth)/privacy')}>
            الشروط وسياسة الخصوصية
          </Text>
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY },
  scroll: { padding: 18, gap: 12, alignItems: 'stretch' },

  // Decorative accents
  blob: { position: 'absolute', borderRadius: 999, opacity: 0.12, pointerEvents: 'none' },
  blobTop: { width: 280, height: 280, backgroundColor: AMBER, top: -120, right: -80 },
  blobBottom: { width: 240, height: 240, backgroundColor: '#3b9ad9', bottom: -100, left: -70 },

  // Hero
  hero: { alignItems: 'center', gap: 4, paddingBottom: 2 },
  logoRing: {
    width: 74, height: 74, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  logo: { width: 50, height: 50, borderRadius: 12 },
  title: { color: '#fff', fontSize: 21, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  tagline: { color: '#9bbdd4', fontSize: 13, textAlign: 'center' },

  // Stats
  statsRow: {
    flexDirection: 'row-reverse',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { color: AMBER, fontSize: 18, fontWeight: '800' },
  statLabel: { color: '#9bbdd4', fontSize: 11 },
  statDivider: {
    position: 'absolute', left: 0, top: '15%', height: '70%',
    width: 1, backgroundColor: 'rgba(255,255,255,0.12)',
  },

  // Features (2×2 grid)
  featuresGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  featureTile: {
    width: '47%',
    flexGrow: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 9,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  featureIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  featureText: { flex: 1, alignItems: 'flex-end' },
  featureTitle: { color: '#fff', fontSize: 13, fontWeight: '700', textAlign: 'right' },
  featureBody: { color: '#9bbdd4', fontSize: 11, textAlign: 'right', marginTop: 1, lineHeight: 15 },

  // Sign-in card
  card: {
    backgroundColor: '#fff', borderRadius: 18, padding: 16, gap: 9,
    boxShadow: '0px 4px 16px rgba(0,0,0,0.25)', elevation: 5,
  },
  cardHeader: { fontSize: 17, fontWeight: '800', textAlign: 'right', color: NAVY },
  cardBody: { fontSize: 13, color: '#555', textAlign: 'right', lineHeight: 20 },
  btn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnGoogle:   { backgroundColor: '#dd4b39' },
  btnFacebook: { backgroundColor: '#3b5998' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  anonLink: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  anonLinkTxt: { color: '#7a8794', fontSize: 13, fontWeight: '600' },

  footer: { color: 'rgba(255,255,255,0.45)', fontSize: 11, textAlign: 'center', lineHeight: 16 },
  footerLink: { color: '#9bbdd4', fontWeight: '700', textDecorationLine: 'underline' },
});
