// Cookie/analytics consent banner (GDPR). Web-only — renders nothing on native.
// Shown once until the user chooses; the choice is stored and re-applied on
// return visits. See src/services/analytics.ts for the consent mechanics.
import { useEffect, useState } from 'react';
import { Platform, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { getStoredConsent, setAnalyticsConsent, type ConsentChoice } from '../services/analytics';

export function ConsentBanner(): React.ReactElement | null {
  const [visible, setVisible] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const stored = getStoredConsent();
    if (stored) {
      setAnalyticsConsent(stored); // re-apply the returning user's choice
    } else {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const choose = (c: ConsentChoice) => {
    setAnalyticsConsent(c);
    setVisible(false);
  };

  return (
    <View style={s.wrap} pointerEvents="box-none">
      <View style={s.banner}>
        <Text style={s.text}>
          نستخدم ملفات تعريف الارتباط لتحليل استخدام التطبيق وتحسين تجربتك.{' '}
          <Text style={s.link} onPress={() => router.push('/privacy')}>
            سياسة الخصوصية
          </Text>
        </Text>
        <View style={s.row}>
          <TouchableOpacity style={[s.btn, s.decline]} onPress={() => choose('denied')}>
            <Text style={s.declineTxt}>رفض</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, s.accept]} onPress={() => choose('granted')}>
            <Text style={s.acceptTxt}>موافق</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', zIndex: 1000 },
  banner: {
    width: '100%',
    maxWidth: 512,
    backgroundColor: '#0d2d4e',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
    boxShadow: '0px -2px 16px rgba(0,0,0,0.25)',
  },
  text: { color: '#dbe6f0', fontSize: 13, lineHeight: 20, textAlign: 'right', marginBottom: 12 },
  link: { color: '#c8973a', textDecorationLine: 'underline' },
  row: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  btn: { paddingVertical: 9, paddingHorizontal: 22, borderRadius: 8 },
  decline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#5a7491' },
  declineTxt: { color: '#aebfd0', fontWeight: '600' },
  accept: { backgroundColor: '#c8973a' },
  acceptTxt: { color: '#0d2d4e', fontWeight: '700' },
});
