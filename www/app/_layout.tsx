import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import {
  I18nManager, ActivityIndicator, View, Text, TextInput, ImageBackground, Platform, StyleSheet,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { I18nextProvider } from 'react-i18next';
import i18n from '../src/i18n';
import { initDb } from '../src/db/initDb';
import { initMadinaAssets } from '../src/services/madinaAssets';
import { getFirebaseApp, flushPendingDailySubmit } from '../src/services/firebase';
import { configureNotifications } from '../src/services/notifications';
import { useProfileStore } from '../src/stores/profileStore';
import { Analytics } from '../src/components/Analytics';
import { ConsentBanner } from '../src/components/ConsentBanner';

const splashImage = require('../assets/images/splash.png');

// RTL is hand-built everywhere via `flexDirection: 'row-reverse'`/textAlign,
// same as on web (where RNW's I18nManager is a no-op, isRTL always false).
// Forcing native RTL here made Yoga auto-mirror those rows a second time —
// keep layout direction LTR so native matches web. (Needs one full native
// restart on a device that previously had RTL forced, not just Fast Refresh.)
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

// Apply the UI Arabic sans (Plex Arabic) as the app-wide default font, on every
// platform — replaces the old web-only Amiri patch, which meant native never
// saw a brand face at all (it silently fell back to the system font). Amiri is
// now reserved for the "ceremony" moments that ask for it explicitly (sura
// names, milestone toasts, daily-complete headlines) and UthmanTN stays
// exclusive to Quran text — both still win over this default because they're
// set explicitly and come after it in the merged style array.
// The patch itself only takes effect where the platform's Text/TextInput is a
// forwardRef component exposing `.render` (true for react-native-web); if a
// given native implementation doesn't expose it, this silently no-ops there
// and per-component explicit fontFamily props (unaffected by this patch)
// continue to work exactly as before.
const DEFAULT_FONT = { fontFamily: 'PlexArabic-Regular' };
const patchDefaultFont = (Comp: { render?: (props: any, ref: any) => unknown; __fontPatched?: boolean }) => {
  if (typeof Comp.render !== 'function' || Comp.__fontPatched) return;
  const origRender = Comp.render;
  Comp.render = (props: any, ref: any) =>
    origRender({ ...props, style: [DEFAULT_FONT, props.style] }, ref);
  Comp.__fontPatched = true;
};
patchDefaultFont(Text as unknown as { render?: (props: any, ref: any) => unknown });
patchDefaultFont(TextInput as unknown as { render?: (props: any, ref: any) => unknown });

// Initialize Firebase eagerly
getFirebaseApp();

// Wire the notification handler/channel eagerly (native only; no-op on web) so a
// notification tapped at cold start behaves correctly.
configureNotifications();

// Animated Islamic geometric backdrop shown in the web gutters around the
// phone column. Two seamlessly-tiling 8-point-star layers drift at different
// speeds (parallax) over a deep-navy gradient, with a slow amber "breath"
// glow behind the column. Pure CSS — no images, no JS animation loop.
const WEB_BG_CSS = `
#qqn-web-bg {
  position: relative;
  background-color: #ded5c2;
  background-image:
    url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20241.42%20241.42%22%3E%3Cg%20fill%3D%22none%22%20stroke%3D%22%23c3b590%22%20stroke-opacity%3D%220.5%22%20stroke-width%3D%221.6%22%3E%3Cpolygon%20points%3D%22241.42%2C170.71%20170.71%2C241.42%2070.71%2C241.42%200.0%2C170.71%20-0.0%2C70.71%2070.71%2C-0.0%20170.71%2C0.0%20241.42%2C70.71%22%2F%3E%3Cpolygon%20points%3D%22241.42%2C170.71%20170.71%2C170.71%20170.71%2C241.42%20120.71%2C191.42%2070.71%2C241.42%2070.71%2C170.71%200.0%2C170.71%2050.0%2C120.71%20-0.0%2C70.71%2070.71%2C70.71%2070.71%2C-0.0%20120.71%2C50.0%20170.71%2C0.0%20170.71%2C70.71%20241.42%2C70.71%20191.42%2C120.71%22%2F%3E%3Cpolygon%20points%3D%22-50.0%2C-50.0%2050.0%2C-50.0%2050.0%2C50.0%20-50.0%2C50.0%22%2F%3E%3Cpolygon%20points%3D%22191.42%2C-50.0%20291.42%2C-50.0%20291.42%2C50.0%20191.42%2C50.0%22%2F%3E%3Cpolygon%20points%3D%22-50.0%2C191.42%2050.0%2C191.42%2050.0%2C291.42%20-50.0%2C291.42%22%2F%3E%3Cpolygon%20points%3D%22191.42%2C191.42%20291.42%2C191.42%20291.42%2C291.42%20191.42%2C291.42%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E"),
    url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20241.42%20241.42%22%3E%3Cg%20fill%3D%22none%22%20stroke%3D%22%23ffffff%22%20stroke-opacity%3D%220.2%22%20stroke-width%3D%221.6%22%3E%3Cpolygon%20points%3D%22241.42%2C170.71%20170.71%2C241.42%2070.71%2C241.42%200.0%2C170.71%20-0.0%2C70.71%2070.71%2C-0.0%20170.71%2C0.0%20241.42%2C70.71%22%2F%3E%3Cpolygon%20points%3D%22241.42%2C170.71%20170.71%2C170.71%20170.71%2C241.42%20120.71%2C191.42%2070.71%2C241.42%2070.71%2C170.71%200.0%2C170.71%2050.0%2C120.71%20-0.0%2C70.71%2070.71%2C70.71%2070.71%2C-0.0%20120.71%2C50.0%20170.71%2C0.0%20170.71%2C70.71%20241.42%2C70.71%20191.42%2C120.71%22%2F%3E%3Cpolygon%20points%3D%22-50.0%2C-50.0%2050.0%2C-50.0%2050.0%2C50.0%20-50.0%2C50.0%22%2F%3E%3Cpolygon%20points%3D%22191.42%2C-50.0%20291.42%2C-50.0%20291.42%2C50.0%20191.42%2C50.0%22%2F%3E%3Cpolygon%20points%3D%22-50.0%2C191.42%2050.0%2C191.42%2050.0%2C291.42%20-50.0%2C291.42%22%2F%3E%3Cpolygon%20points%3D%22191.42%2C191.42%20291.42%2C191.42%20291.42%2C291.42%20191.42%2C291.42%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E");
  background-size: 240px 240px, 372px 372px;
  background-position: 0px 0px, 0px 0px;
  background-repeat: repeat, repeat;
  animation: qqnDrift 55s linear infinite;
}
#qqn-web-bg::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(60% 50% at 50% 34%, rgba(255,255,255,0.40), rgba(255,255,255,0) 72%);
  animation: qqnBreathe 9s ease-in-out infinite;
}
@keyframes qqnDrift {
  from { background-position: 0px 0px, 0px 0px; }
  to   { background-position: 240px -240px, -372px 372px; }
}
@keyframes qqnBreathe {
  0%, 100% { opacity: .35; transform: scale(1); }
  50%      { opacity: .8;  transform: scale(1.05); }
}
@media (prefers-reduced-motion: reduce) {
  #qqn-web-bg, #qqn-web-bg::before { animation: none; }
}
`;

function injectWebBg() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById('qqn-web-bg-style')) return;
  const el = document.createElement('style');
  el.id = 'qqn-web-bg-style';
  el.textContent = WEB_BG_CSS;
  document.head.appendChild(el);
}
injectWebBg();

// On web, constrain the app to a phone-like column centered on the page.
// Mobile renders children untouched.
function WebFrame({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View nativeID="qqn-web-bg" style={webStyles.outer}>
      <View style={webStyles.inner}>{children}</View>
    </View>
  );
}

const webStyles = StyleSheet.create({
  // Fallback color; the animated pattern is layered on via #qqn-web-bg CSS.
  outer: { flex: 1, alignItems: 'center', backgroundColor: '#ded5c2' },
  inner: {
    flex: 1,
    width: '100%',
    // 480 (max card width) + 16px breathing room on each side.
    maxWidth: 512,
    backgroundColor: '#faf6ec',
    boxShadow: '0px 0px 24px rgba(0,0,0,0.18)',
  },
});

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [dbProgress, setDbProgress] = useState(0);
  // Native only — extracts the bundled quran-madina-html assets QuranText.native.tsx's
  // WebView needs (see src/services/madinaAssets.ts); a no-op resolved promise on web.
  const [madinaReady, setMadinaReady] = useState(Platform.OS === 'web');
  const loadProfile = useProfileStore((s) => s.load);
  const language = useProfileStore((s) => s.language);

  const [fontsLoaded] = useFonts({
    // UI face — buttons, tabs, labels, body text; legible at 11-13px where
    // Amiri (a book face) isn't. The app-wide default (see the Text/TextInput
    // patch above).
    'PlexArabic-Regular':  require('../assets/fonts/PlexArabic-Regular.woff2'),
    'PlexArabic-SemiBold': require('../assets/fonts/PlexArabic-SemiBold.woff2'),
    'PlexArabic-Bold':     require('../assets/fonts/PlexArabic-Bold.woff2'),
    // Ceremony face — reserved for sura names, milestone toasts, and other
    // moments that deserve a bookish voice. Used sparingly, by design.
    'Amiri-Regular': require('../assets/fonts/Amiri-Regular.woff2'),
    // Same "Uthman" font quran-madina-html uses for its question rendering
    // (UthmanTN_v2-0.woff2, pulled from the quran-madina-html package's own
    // assets) — the app-wide Quran-text face, for both plain-text fallbacks
    // and the answer options, so everything visually matches.
    'UthmanTN': require('../assets/fonts/UthmanTN_v2-0.woff2'),
  });

  useEffect(() => {
    (async () => {
      await loadProfile();
      // Best-effort retry of a daily-quiz submission that didn't confirm last
      // time (see endDailyQuiz in quiz.tsx) — fire-and-forget, must not block
      // startup on network.
      flushPendingDailySubmit().catch(() => {});
      // initDb and initMadinaAssets are independent (different storage, no
      // shared state), so run them together instead of stacking their latency.
      await Promise.all([
        initDb((pct) => setDbProgress(pct)),
        initMadinaAssets().then(() => setMadinaReady(true)),
      ]);
      setDbReady(true);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!dbReady || !madinaReady || !fontsLoaded) {
    return (
      <SafeAreaProvider>
        <WebFrame>
          <ImageBackground
            source={splashImage}
            resizeMode="cover"
            style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0d2d4e', gap: 20 }}
          >
            <ActivityIndicator size="large" color="#c8973a" />
            {dbProgress > 0 && dbProgress < 1 && (
              <Text style={{ color: '#0d2d4e', fontSize: 13 }}>
                تحميل البيانات {Math.round(dbProgress * 100)}٪
              </Text>
            )}
          </ImageBackground>
        </WebFrame>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Analytics />
      <WebFrame>
        <I18nextProvider i18n={i18n}>
          <Stack key={language} screenOptions={{ headerShown: false }} />
        </I18nextProvider>
      </WebFrame>
      <ConsentBanner />
    </SafeAreaProvider>
  );
}
