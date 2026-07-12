import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/tokens';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: 'مقدمة',
    body: 'نهتم في «شبكة اختبار القرآن» بخصوصيتك. توضّح هذه الصفحة البيانات التي نجمعها وكيفية استخدامها وحمايتها عند استعمالك للتطبيق.',
  },
  {
    title: 'البيانات التي نجمعها',
    body: 'عند تسجيل الدخول عبر جوجل أو فيسبوك نحفظ اسمك وصورتك وبريدك الإلكتروني لإنشاء ملفك الشخصي. كما نحفظ تقدّمك في الحفظ ونتائج الاختبارات وإعداداتك. يمكنك أيضاً استخدام التطبيق كزائر دون تسجيل دخول.',
  },
  {
    title: 'كيف نستخدم بياناتك',
    body: 'نستخدم بياناتك لحفظ تقدّمك ومزامنته بين أجهزتك، ولعرض ترتيبك في البطولة والاختبار اليومي، ولتحسين تجربتك داخل التطبيق. لا نبيع بياناتك ولا نعرض إعلانات.',
  },
  {
    title: 'ملفات تعريف الارتباط والتحليلات',
    body: 'نستخدم خدمة Google Analytics لفهم كيفية استخدام التطبيق (مثل الصفحات التي تُزار وعدد الاختبارات) بهدف تحسين التجربة، وذلك عبر ملفات تعريف الارتباط (cookies). لا نفعّل هذا التتبّع إلا بعد موافقتك، ويمكنك رفضه من شريط الموافقة دون أن يؤثر ذلك على استخدامك للتطبيق. نستخدم هذه البيانات للتحليل فقط ولا نستعملها للإعلانات.',
  },
  {
    title: 'التخزين والأمان',
    body: 'تُخزَّن بياناتك على خوادم Firebase التابعة لجوجل بحماية مناسبة. تبقى بياناتك المحلية على جهازك، وتُمسح عند تسجيل الخروج.',
  },
  {
    title: 'حذف الحساب',
    body: 'يمكنك تسجيل الخروج في أي وقت لمسح بياناتك المحلية. لطلب حذف بياناتك من الخادم نهائياً، يُرجى التواصل معنا.',
  },
  {
    title: 'شروط الاستخدام',
    body: 'التطبيق مخصّص لمساعدتك على مراجعة حفظك للقرآن الكريم. تُقدَّم الخدمة كما هي دون ضمانات، ونحرص على دقة المحتوى القرآني المستند إلى مصدر تنزيل (tanzil.net).',
  },
  {
    title: 'التواصل',
    body: 'لأي استفسار حول الخصوصية أو الشروط، يمكنك مراسلتنا عبر البريد الإلكتروني الخاص بالتطبيق.',
  },
];

export default function PrivacyScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.paper }]} edges={['top', 'bottom']}>
      {/* Header — a fixed navy panel like the auth/onboarding heroes, correct in both modes */}
      <View style={[s.header, { backgroundColor: colors.navy }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-forward" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>الشروط وسياسة الخصوصية</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {SECTIONS.map((sec) => (
          <View key={sec.title} style={[s.card, { backgroundColor: colors.card }]}>
            <Text style={[s.cardTitle, { color: colors.ink }]}>{sec.title}</Text>
            <Text style={[s.cardBody, { color: colors.ink }]}>{sec.body}</Text>
          </View>
        ))}
        <Text style={[s.updated, { color: colors.inkSoft }]}>آخر تحديث: يونيو 2026</Text>
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
  updated: { fontSize: 12, textAlign: 'center', marginTop: 4 },
});
