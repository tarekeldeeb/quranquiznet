// Custom root HTML for the static web export.
// Expo Router wraps every exported page with this component, so the PWA
// <head> tags and the service-worker registration land on every route.
import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

const swRegistration = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function (err) {
      console.error('SW registration failed:', err);
    });
  });
}
`;

// Google Analytics 4. Keep this ID in sync with GA_MEASUREMENT_ID in
// src/services/analytics.ts. Automatic page_view is disabled because this is an
// SPA — page_views are sent per route from src/components/Analytics.tsx.
const GA_MEASUREMENT_ID = 'G-KBJMQL8WT5';
const gaInit = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
// Consent Mode v2: default everything to denied until the user accepts (see
// src/components/ConsentBanner.tsx). GA sends only cookieless pings meanwhile.
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
  wait_for_update: 500
});
gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />

        {/* Favicons — ?v= forces Chrome to drop its aggressively cached old icon.
            Bump the version whenever the icon art changes. */}
        <link rel="icon" href="/favicon.ico?v=2" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png?v=2" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16.png?v=2" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png?v=2" />

        {/* PWA */}
        <link rel="manifest" href="/manifest.webmanifest?v=2" />
        <meta name="theme-color" content="#1a5276" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="اختبار القرآن" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png?v=2" />

        <ScrollViewStyleReset />

        {/* Google Analytics (gtag.js) */}
        <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} />
        <script dangerouslySetInnerHTML={{ __html: gaInit }} />

        {/* Register the service worker once the page has loaded. */}
        <script dangerouslySetInnerHTML={{ __html: swRegistration }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
