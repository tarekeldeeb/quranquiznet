// Cookie/analytics consent banner (GDPR). Shown once until the user chooses,
// on every platform; the choice is stored and re-applied on return visits.
// See src/services/analytics.ts / analytics.web.ts for the consent mechanics.
import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useDirection, alignDir } from '../theme/direction';
import { getStoredConsent, setAnalyticsConsent, type ConsentChoice } from '../services/analytics';

export function ConsentBanner(): React.ReactElement | null {
  const [visible, setVisible] = useState(false);
  const router = useRouter();
  const { t } = useTranslation();
  const { isRTL } = useDirection();

  useEffect(() => {
    (async () => {
      const stored = await getStoredConsent();
      if (stored) {
        void setAnalyticsConsent(stored); // re-apply the returning user's choice
      } else {
        setVisible(true);
      }
    })();
  }, []);

  if (!visible) return null;

  const choose = (c: ConsentChoice) => {
    void setAnalyticsConsent(c);
    setVisible(false);
  };

  return (
    <View style={s.wrap} pointerEvents="box-none">
      <View style={s.banner}>
        <Text style={[s.text, { textAlign: alignDir(isRTL) }]}>
          {t('common.consentBanner.text')}{' '}
          <Text style={s.link} onPress={() => router.push('/privacy')}>
            {t('common.consentBanner.privacyPolicy')}
          </Text>
        </Text>
        <View style={[s.row, { justifyContent: isRTL ? 'flex-end' : 'flex-start' }]}>
          <TouchableOpacity style={[s.btn, s.decline]} onPress={() => choose('denied')}>
            <Text style={s.declineTxt}>{t('common.consentBanner.decline')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, s.accept]} onPress={() => choose('granted')}>
            <Text style={s.acceptTxt}>{t('common.consentBanner.accept')}</Text>
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
  text: { color: '#dbe6f0', fontSize: 13, lineHeight: 20, marginBottom: 12 },
  link: { color: '#c8973a', textDecorationLine: 'underline' },
  row: { flexDirection: 'row', gap: 10 },
  btn: { paddingVertical: 9, paddingHorizontal: 22, borderRadius: 8 },
  decline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#5a7491' },
  declineTxt: { color: '#aebfd0', fontWeight: '600' },
  accept: { backgroundColor: '#c8973a' },
  acceptTxt: { color: '#0d2d4e', fontWeight: '700' },
});
