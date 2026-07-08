// Answer-feedback haptics — a light tactile "tick" on a correct answer, a
// distinct warning buzz on an incorrect one. Native only (iOS/Android);
// expo-haptics is a no-op that resolves to nothing useful on web, so every
// export here feature-detects the platform and no-ops there instead of
// calling into a module with nothing to vibrate.

import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

export function hapticCorrect(): void {
  if (!isNative) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { /* non-critical */ });
}

export function hapticIncorrect(): void {
  if (!isNative) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => { /* non-critical */ });
}
