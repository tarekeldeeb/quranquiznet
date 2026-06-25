// Google Analytics 4 (gtag.js) helpers.
//
// gtag.js itself is loaded once in the web <head> (see app/+html.tsx) with
// automatic page_view disabled (`send_page_view: false`), because Expo Router is
// a single-page app: the browser only loads once, so we must send a page_view
// ourselves on every client-side route change (see src/components/Analytics.tsx).
//
// All functions are safe no-ops on native (no gtag there) and before the
// gtag.js script has loaded.
import { Platform } from 'react-native';

// Keep this in sync with the literal hard-coded in app/+html.tsx.
export const GA_MEASUREMENT_ID = 'G-KBJMQL8WT5';

type GtagFn = (...args: unknown[]) => void;

function getGtag(): GtagFn | undefined {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
  return (window as unknown as { gtag?: GtagFn }).gtag;
}

/** Send a manual page_view for the current route. */
export function trackPageView(path: string, title?: string): void {
  const gtag = getGtag();
  if (!gtag) return;
  gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: title ?? document.title,
  });
}

/** Send a custom GA4 event. */
export function trackEvent(name: string, params?: Record<string, unknown>): void {
  const gtag = getGtag();
  if (!gtag) return;
  gtag('event', name, params);
}

// ── Consent (GDPR) ──────────────────────────────────────────────────────────
// We use Google Consent Mode v2. gtag.js is initialized with consent defaulted
// to DENIED (see app/+html.tsx), so until the user accepts, GA only sends
// cookieless pings (no analytics cookies / identifiers). The user's choice is
// remembered in localStorage so the banner shows only once.
const CONSENT_KEY = 'qqn_analytics_consent';

export type ConsentChoice = 'granted' | 'denied';

/** The user's previously stored consent choice, or null if not yet asked. */
export function getStoredConsent(): ConsentChoice | null {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return null;
  const v = localStorage.getItem(CONSENT_KEY);
  return v === 'granted' || v === 'denied' ? v : null;
}

/**
 * Persist and apply the analytics consent choice. We only ever toggle
 * `analytics_storage` — this app runs no ads, so ad_* consent stays denied.
 */
export function setAnalyticsConsent(choice: ConsentChoice): void {
  if (Platform.OS !== 'web') return;
  try {
    localStorage.setItem(CONSENT_KEY, choice);
  } catch {
    // localStorage can throw in private mode / when storage is full — ignore.
  }
  const gtag = getGtag();
  if (!gtag) return;
  gtag('consent', 'update', { analytics_storage: choice });
}
