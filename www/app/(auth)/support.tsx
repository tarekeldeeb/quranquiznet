import { useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../src/theme/tokens';
import { useDirection, rowDir, alignDir, mirror } from '../../src/theme/direction';

const SUPPORT_EMAIL = 'tarekeldeeb@gmail.com';

export default function SupportScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { isRTL } = useDirection();

  const sections = useMemo(
    () => [
      {
        key: 'technical',
        title: t('support.sections.technical.title'),
        body: t('support.sections.technical.body'),
      },
      {
        key: 'sync',
        title: t('support.sections.sync.title'),
        body: t('support.sections.sync.body'),
      },
      {
        key: 'deletion',
        title: t('support.sections.deletion.title'),
        body: t('support.sections.deletion.body'),
      },
    ],
    [t]
  );

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.paper }]} edges={['top', 'bottom']}>
      {/* Header — matches privacy.tsx's fixed navy panel, correct in both modes */}
      <View style={[s.header, { backgroundColor: colors.navy, flexDirection: rowDir(isRTL) }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name={mirror(isRTL, 'chevron-back', 'chevron-forward')} size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('support.title')}</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {sections.map((sec) => (
          <View key={sec.key} style={[s.card, { backgroundColor: colors.card }]}>
            <Text style={[s.cardTitle, { color: colors.ink, textAlign: alignDir(isRTL) }]}>{sec.title}</Text>
            <Text style={[s.cardBody, { color: colors.ink, textAlign: alignDir(isRTL) }]}>{sec.body}</Text>
          </View>
        ))}

        <TouchableOpacity
          style={[s.emailCard, { backgroundColor: colors.gold, flexDirection: rowDir(isRTL) }]}
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

  emailCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    padding: 16,
    marginTop: 4,
  },
  emailText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
