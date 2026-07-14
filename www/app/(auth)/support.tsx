import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/tokens';

const SUPPORT_EMAIL = 'tarekeldeeb@gmail.com';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: 'الدعم الفني',
    body: 'هل واجهت مشكلة في التطبيق، أو لديك اقتراح لتحسينه؟ يسعدنا مساعدتك. راسلنا عبر البريد الإلكتروني أدناه وسنرد عليك في أقرب وقت ممكن.',
  },
  {
    title: 'مشاكل تسجيل الدخول أو المزامنة',
    body: 'إن واجهت مشكلة في تسجيل الدخول عبر جوجل أو فيسبوك، أو لاحظت أن تقدّمك لم يُزامَن بين أجهزتك، تواصل معنا مع ذكر نوع جهازك ونظام التشغيل لمساعدتك بشكل أسرع.',
  },
  {
    title: 'حذف الحساب أو البيانات',
    body: 'لطلب حذف حسابك وبياناتك المخزَّنة على خوادمنا نهائياً، راسلنا على البريد الإلكتروني أدناه وسنُتم الطلب خلال أيام قليلة.',
  },
];

export default function SupportScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.paper }]} edges={['top', 'bottom']}>
      {/* Header — matches privacy.tsx's fixed navy panel, correct in both modes */}
      <View style={[s.header, { backgroundColor: colors.navy }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-forward" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>الدعم والمساعدة</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {SECTIONS.map((sec) => (
          <View key={sec.title} style={[s.card, { backgroundColor: colors.card }]}>
            <Text style={[s.cardTitle, { color: colors.ink }]}>{sec.title}</Text>
            <Text style={[s.cardBody, { color: colors.ink }]}>{sec.body}</Text>
          </View>
        ))}

        <TouchableOpacity
          style={[s.emailCard, { backgroundColor: colors.gold }]}
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
        >
          <Ionicons name="mail-outline" size={20} color="#fff" />
          <Text style={s.emailText}>{SUPPORT_EMAIL}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  backBtn: { width: 32, alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },

  scroll: { padding: 16, gap: 12, paddingBottom: 32 },
  card: {
    borderRadius: 14,
    padding: 16,
    gap: 6,
    boxShadow: '0px 2px 8px rgba(13,45,78,0.06)',
    elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', textAlign: 'right' },
  cardBody: { fontSize: 14, textAlign: 'right', lineHeight: 24 },

  emailCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    padding: 16,
    marginTop: 4,
  },
  emailText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
