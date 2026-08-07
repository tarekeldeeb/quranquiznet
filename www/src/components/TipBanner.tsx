// Feature-discovery toast on the `me` screen — see models/tips.ts and
// profileStore's rollForTip()/dismissTip()/pendingTipKey for the daily-roll,
// sequencing, and dismissal logic. Slides in from the top of the screen and
// locks its close button behind a short Ring countdown, so dismissing takes
// at least a glance rather than a reflex tap. Renders directly off
// pendingTipKey (not a one-shot local effect) so it's also driveable from a
// JS console — see the __DEV__ store exposure in profileStore.ts.
import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useProfileStore } from '../stores/profileStore';
import { useTheme, radii } from '../theme/tokens';
import { useDirection, rowDir, alignDir } from '../theme/direction';
import Ring from './Ring';

const LOCK_MS = 5000;
const TICK_MS = 100;
const OFFSCREEN_Y = -140;

export function TipBanner(): React.ReactElement | null {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { isRTL } = useDirection();
  const profile = useProfileStore();
  const [msLeft, setMsLeft] = useState(LOCK_MS);
  const translateY = useSharedValue(OFFSCREEN_Y);

  useEffect(() => {
    if (!profile.loaded) return;
    profile.rollForTip();
    // Only ever roll once, right after the profile finishes loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.loaded]);

  useEffect(() => {
    translateY.value = withTiming(profile.pendingTipKey ? 0 : OFFSCREEN_Y, { duration: 300 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.pendingTipKey]);

  useEffect(() => {
    if (!profile.pendingTipKey) return;
    setMsLeft(LOCK_MS);
    const id = setInterval(() => setMsLeft((m) => Math.max(0, m - TICK_MS)), TICK_MS);
    return () => clearInterval(id);
  }, [profile.pendingTipKey]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!profile.pendingTipKey) return null;

  const locked = msLeft > 0;

  return (
    <Animated.View style={[s.overlay, animStyle]} pointerEvents="box-none">
      <View
        style={[
          s.wrap,
          { backgroundColor: colors.goldPale, borderColor: colors.gold, flexDirection: rowDir(isRTL) },
        ]}
      >
        <Ionicons name="bulb" size={32} color={colors.goldDeep} />
        <Text style={[s.text, { color: colors.ink, textAlign: alignDir(isRTL) }]}>
          {t(profile.pendingTipKey)}
        </Text>
        <TouchableOpacity
          onPress={() => profile.dismissTip()}
          disabled={locked}
          hitSlop={6}
          accessibilityLabel={t('tips.dismiss')}
        >
          <Ring pct={(msLeft / LOCK_MS) * 100} color={colors.gold} trackColor={colors.goldPale} innerColor="transparent" size={30}>
            <Ionicons name="close" size={16} color={colors.inkSoft} style={{ opacity: locked ? 0.35 : 1 }} />
          </Ring>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  wrap: {
    width: '100%',
    maxWidth: 512,
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    boxShadow: '0px 4px 12px rgba(13,45,78,0.18)',
  },
  text: { flex: 1, fontSize: 13, lineHeight: 18 },
});
