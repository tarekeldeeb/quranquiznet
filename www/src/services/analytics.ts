// Firebase Analytics (GA4) helpers — native implementation (iOS/Android), via
// @react-native-firebase/analytics. The native Firebase app is auto-configured
// from GoogleService-Info.plist / google-services.json (see app.json's
// googleServicesFile fields + the "@react-native-firebase/app" plugin), so no
// manual initializeApp() call is needed here.
//
// Metro picks this file on iOS/Android; src/services/analytics.web.ts (gtag.js)
// is used on web — same split as src/db/idb.ts / idb.web.ts.
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAnalytics,
  logEvent,
  logScreenView,
  setAnalyticsCollectionEnabled,
  setConsent,
  setUserId as rnSetUserId,
  setUserProperties as rnSetUserProperties,
} from '@react-native-firebase/analytics';

const analytics = getAnalytics();

// Collection starts disabled until the user grants consent — mirrors gtag's
// default-DENIED Consent Mode on web (see analytics.web.ts / app/+html.tsx).
void setAnalyticsCollectionEnabled(analytics, false);

/** Send a manual screen_view for the current route. */
export function trackPageView(path: string, title?: string): void {
  void logScreenView(analytics, { screen_name: path, screen_class: title ?? path });
}

/** Send a custom GA4 event. */
export function trackEvent(name: string, params?: Record<string, unknown>): void {
  void logEvent(analytics, name, params);
}

/** Set the primary user ID for analytics. */
export function setUserId(id: string | null): void {
  void rnSetUserId(analytics, id);
}

/** Set custom user properties for segmentation. */
export function setUserProperties(properties: Record<string, string | null>): void {
  void rnSetUserProperties(analytics, properties);
}

/** Bucket streak values into standardized ranges (0, 1-6, 7-29, 30+). */
export function getStreakBucket(streak: number): string {
  if (streak <= 0) return '0';
  if (streak <= 6) return '1-6';
  if (streak <= 29) return '7-29';
  return '30+';
}

export interface UserAnalyticsProfile {
  uid?: string | null;
  level: number;
  language: string;
  isAnonymous?: boolean;
  social?: { isAnonymous?: boolean };
  streak: number;
}

/** Sync user ID and user properties based on profile state. */
export function syncUserAnalytics(profile: UserAnalyticsProfile): void {
  if (profile.uid) {
    setUserId(profile.uid);
  }
  const isAnon = profile.isAnonymous ?? profile.social?.isAnonymous ?? false;
  setUserProperties({
    user_level: String(profile.level),
    user_lang: profile.language,
    user_type: isAnon ? 'guest' : 'registered',
    user_streak_bucket: getStreakBucket(profile.streak),
  });
}

// ── Consent (GDPR) ──────────────────────────────────────────────────────────
// The user's choice is remembered in AsyncStorage so the banner shows only once,
// same key as the web implementation for continuity of intent (the two stores
// are independent per-platform, not actually shared).
const CONSENT_KEY = 'qqn_analytics_consent';

export type ConsentChoice = 'granted' | 'denied';

/** The user's previously stored consent choice, or null if not yet asked. */
export async function getStoredConsent(): Promise<ConsentChoice | null> {
  const v = await AsyncStorage.getItem(CONSENT_KEY);
  return v === 'granted' || v === 'denied' ? v : null;
}

/**
 * Persist and apply the analytics consent choice. We only ever toggle
 * `analytics_storage` — this app runs no ads, so ad_* consent stays denied.
 */
export async function setAnalyticsConsent(choice: ConsentChoice): Promise<void> {
  try {
    await AsyncStorage.setItem(CONSENT_KEY, choice);
  } catch {
    // AsyncStorage can throw when storage is full — ignore.
  }
  const granted = choice === 'granted';
  await setConsent(analytics, { analytics_storage: granted });
  await setAnalyticsCollectionEnabled(analytics, granted);
}
