// Fires a GA4 page_view on every client-side route change so single-page
// navigation is tracked (gtag.js auto page_view is disabled — see
// src/services/analytics.ts). Renders nothing; no-op on native.
import { useEffect } from 'react';
import { usePathname, useGlobalSearchParams } from 'expo-router';
import { trackPageView } from '../services/analytics';

export function Analytics(): null {
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  // Serialize params so a query-only change (e.g. /quiz?dailyMode=1) re-fires.
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    trackPageView(pathname + search);
  }, [pathname, paramsKey]);

  return null;
}
