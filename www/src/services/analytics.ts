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
