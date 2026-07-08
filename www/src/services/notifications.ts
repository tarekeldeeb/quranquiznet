// Local notifications — retention triggers for the streak + daily quiz.
//
// Native only (iOS/Android). Web push needs backend infra this repo doesn't have
// (a service worker + VAPID keys + a push server), so every function here is a
// graceful no-op on web. See the branch commit message for that documented cut.
//
// Two reminders, each scheduled under a stable identifier so re-scheduling simply
// replaces the previous one:
//   • qqn-streak — evening nudge the day AFTER the user last played, so an active
//     streak that is a few hours from expiring gets a "don't lose your streak" ping.
//   • qqn-daily  — fires when the next daily quiz rotates in and is ready to play.

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const STREAK_ID = 'qqn-streak';
const DAILY_ID = 'qqn-daily';

// Hour of day (local) for the streak reminder.
const STREAK_REMINDER_HOUR = 19;

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

let configured = false;

/** Wire the foreground handler + Android channel. Safe to call more than once. */
export function configureNotifications(): void {
  if (!isNative || configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      // Newer expo-notifications also expects banner/list flags; harmless extras.
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  // Android 8+ requires an explicit channel for notifications to appear.
  Notifications.setNotificationChannelAsync('default', {
    name: 'التذكيرات',
    importance: Notifications.AndroidImportance.DEFAULT,
  }).catch(() => { /* channel setup is best-effort */ });
}

/** True if we already hold notification permission (never prompts). */
export async function hasPermission(): Promise<boolean> {
  if (!isNative) return false;
  try {
    const { granted } = await Notifications.getPermissionsAsync();
    return granted;
  } catch {
    return false;
  }
}

/**
 * Ask for notification permission — call this at an engaged moment (after
 * onboarding, or the first completed quiz), never on a cold first launch.
 * Returns whether permission is granted. No-op (false) on web.
 */
export async function requestPermission(): Promise<boolean> {
  if (!isNative) return false;
  configureNotifications();
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}

function scheduleAt(identifier: string, when: Date, title: string, body: string): Promise<unknown> {
  // The DATE trigger fires once at an absolute time.
  const trigger: Notifications.DateTriggerInput = {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date: when,
  };
  return Notifications.scheduleNotificationAsync({
    identifier,
    content: { title, body },
    trigger,
  });
}

/**
 * Schedule an evening reminder for tomorrow so an active streak that would expire
 * (no play that day) gets a nudge while there's still time. Called each time the
 * user plays: re-scheduling replaces the prior one, always pushing it a day out.
 * A streak of 0 clears any pending reminder instead.
 */
export async function scheduleStreakReminder(streak: number): Promise<void> {
  if (!isNative) return;
  configureNotifications();
  if (!(await hasPermission())) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(STREAK_ID).catch(() => {});
    if (streak <= 0) return;
    const when = new Date();
    when.setDate(when.getDate() + 1);
    when.setHours(STREAK_REMINDER_HOUR, 0, 0, 0);
    await scheduleAt(
      STREAK_ID,
      when,
      '🔥 لا تفقد سلسلتك',
      `سلسلتك ${streak} يوم! العب اختباراً اليوم للحفاظ عليها.`,
    );
  } catch { /* scheduling is non-critical */ }
}

/**
 * Notify the user when the next daily quiz becomes available. `atMs` is the epoch
 * time the next quiz rotates in; a past/invalid time just clears the reminder.
 */
export async function scheduleDailyReminder(atMs: number): Promise<void> {
  if (!isNative) return;
  configureNotifications();
  if (!(await hasPermission())) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(DAILY_ID).catch(() => {});
    if (!isFinite(atMs) || atMs <= Date.now()) return;
    await scheduleAt(
      DAILY_ID,
      new Date(atMs),
      '⭐ اختبار اليوم جاهز',
      'اختبار جديد في نطاق حفظك بانتظارك. جرّب حظك الآن!',
    );
  } catch { /* scheduling is non-critical */ }
}
