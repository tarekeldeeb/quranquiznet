// Fires a GA4 page_view/screen_view on every client-side route change so
// single-page navigation is tracked on web (gtag.js auto page_view is
// disabled) and screen navigation is tracked on native (Firebase Analytics
// has no automatic screen tracking for Expo Router). See
// src/services/analytics.ts / analytics.web.ts. Renders nothing.
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { usePathname, useGlobalSearchParams } from 'expo-router';
import { trackPageView } from '../services/analytics';

export function Analytics(): null {
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  // Serialize params so a query-only change (e.g. /quiz?dailyMode=1) re-fires.
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    // window.location only exists on web — on native `window` is defined but
    // `window.location` is undefined, so guard on the platform.
    const search = Platform.OS === 'web' ? window.location.search : '';
    trackPageView(pathname + search);
  }, [pathname, paramsKey]);

  return null;
}
