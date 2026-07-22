import { useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../src/theme/tokens';
import { useDirection, rowDir, alignDir, mirror } from '../../src/theme/direction';

export default function PrivacyScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { isRTL } = useDirection();

  const sections = useMemo(
    () => [
      {
        key: 'intro',
        title: t('privacy.sections.intro.title'),
        body: t('privacy.sections.intro.body'),
      },
      {
        key: 'dataCollected',
        title: t('privacy.sections.dataCollected.title'),
        body: t('privacy.sections.dataCollected.body'),
      },
      {
        key: 'useOfData',
        title: t('privacy.sections.useOfData.title'),
        body: t('privacy.sections.useOfData.body'),
      },
      {
        key: 'cookiesAnalytics',
        title: t('privacy.sections.cookiesAnalytics.title'),
        body: t('privacy.sections.cookiesAnalytics.body'),
      },
      {
        key: 'storageSecurity',
        title: t('privacy.sections.storageSecurity.title'),
        body: t('privacy.sections.storageSecurity.body'),
      },
      {
        key: 'accountDeletion',
        title: t('privacy.sections.accountDeletion.title'),
        body: t('privacy.sections.accountDeletion.body'),
      },
      {
        key: 'termsOfUse',
        title: t('privacy.sections.termsOfUse.title'),
        body: t('privacy.sections.termsOfUse.body'),
      },
      {
        key: 'contact',
        title: t('privacy.sections.contact.title'),
        body: t('privacy.sections.contact.body'),
      },
    ],
    [t]
  );

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.paper }]} edges={['top', 'bottom']}>
      {/* Header — a fixed navy panel like the auth/onboarding heroes, correct in both modes */}
      <View style={[s.header, { backgroundColor: colors.navy, flexDirection: rowDir(isRTL) }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name={mirror(isRTL, 'chevron-back', 'chevron-forward')} size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('privacy.title')}</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {sections.map((sec) => (
          <View key={sec.key} style={[s.card, { backgroundColor: colors.card }]}>
            <Text style={[s.cardTitle, { color: colors.ink, textAlign: alignDir(isRTL) }]}>{sec.title}</Text>
            <Text style={[s.cardBody, { color: colors.ink, textAlign: alignDir(isRTL) }]}>{sec.body}</Text>
          </View>
        ))}
        <Text style={[s.updated, { color: colors.inkSoft }]}>{t('privacy.updated')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
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
  cardTitle: { fontSize: 15, fontWeight: '800' },
  cardBody: { fontSize: 14, lineHeight: 24 },
  updated: { fontSize: 12, textAlign: 'center', marginTop: 4 },
});
