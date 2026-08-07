// Persistent top strip nudging the user to update from the store — distinct
// from TipBanner (an ephemeral, self-dismissing feature-discovery toast): an
// available update is longer-lived and lower-urgency, so it docks in normal
// layout flow instead of floating over content. me.tsx skips the day's tip
// roll while this is showing so the two banners never stack. See
// services/updateCheck.ts for the version-compare + dismissal logic.
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/tokens';
import { useDirection, rowDir, alignDir } from '../theme/direction';
import type { PendingUpdate } from '../services/updateCheck';

export function UpdateBanner(
  { update, onDismiss }: { update: PendingUpdate | null; onDismiss: () => void },
): React.ReactElement | null {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { isRTL } = useDirection();

  if (!update) return null;

  return (
    <View style={[s.wrap, { backgroundColor: colors.goldPale, borderColor: colors.gold, flexDirection: rowDir(isRTL) }]}>
      <Ionicons name="arrow-up-circle" size={22} color={colors.goldDeep} />
      <Text style={[s.text, { color: colors.ink, textAlign: alignDir(isRTL) }]} numberOfLines={2}>
        {t('update.available', { version: update.version })}
      </Text>
      <TouchableOpacity onPress={() => Linking.openURL(update.storeUrl)} hitSlop={6}>
        <Text style={[s.action, { color: colors.goldDeep }]}>{t('update.updateNow')}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDismiss} hitSlop={6} accessibilityLabel={t('update.dismiss')}>
        <Ionicons name="close" size={18} color={colors.inkSoft} />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  text: { flex: 1, fontSize: 12, lineHeight: 16 },
  action: { fontSize: 13, fontWeight: '700' },
});
