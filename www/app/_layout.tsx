import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import {
  I18nManager, ActivityIndicator, View, Text, TextInput, Image, Platform, StyleSheet,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { initDb } from '../src/db/initDb';
import { getFirebaseApp } from '../src/services/firebase';
import { configureNotifications } from '../src/services/notifications';
import { useProfileStore } from '../src/stores/profileStore';
import { Analytics } from '../src/components/Analytics';
import { ConsentBanner } from '../src/components/ConsentBanner';

const appIcon = require('../assets/images/app-icon.png');

// Force RTL layout for Arabic
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

// Apply Amiri as the app-wide default font (web only — the Amiri woff2 face is
// loaded via expo-font for web; native keeps the system Arabic font, as before).
// We prepend it to each element's own style so RNW's built-in "System" default is
// overridden, while any explicit fontFamily (e.g. the Quran face,
// AmiriQuranColored) still wins because it comes after ours in the merged array.
if (Platform.OS === 'web') {
  const DEFAULT_FONT = { fontFamily: 'Amiri-Regular' };
  const patchDefaultFont = (Comp: { render?: (props: any, ref: any) => unknown; __amiriPatched?: boolean }) => {
    if (typeof Comp.render !== 'function' || Comp.__amiriPatched) return;
    const origRender = Comp.render;
    Comp.render = (props: any, ref: any) =>
      origRender({ ...props, style: [DEFAULT_FONT, props.style] }, ref);
    Comp.__amiriPatched = true;
  };
  patchDefaultFont(Text as unknown as { render?: (props: any, ref: any) => unknown });
  patchDefaultFont(TextInput as unknown as { render?: (props: any, ref: any) => unknown });
}

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
  background-color: #c8d0da;
  background-image:
    url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20241.42%20241.42%22%3E%3Cg%20fill%3D%22none%22%20stroke%3D%22%23a9b4c0%22%20stroke-opacity%3D%220.5%22%20stroke-width%3D%221.6%22%3E%3Cpolygon%20points%3D%22241.42%2C170.71%20170.71%2C241.42%2070.71%2C241.42%200.0%2C170.71%20-0.0%2C70.71%2070.71%2C-0.0%20170.71%2C0.0%20241.42%2C70.71%22%2F%3E%3Cpolygon%20points%3D%22241.42%2C170.71%20170.71%2C170.71%20170.71%2C241.42%20120.71%2C191.42%2070.71%2C241.42%2070.71%2C170.71%200.0%2C170.71%2050.0%2C120.71%20-0.0%2C70.71%2070.71%2C70.71%2070.71%2C-0.0%20120.71%2C50.0%20170.71%2C0.0%20170.71%2C70.71%20241.42%2C70.71%20191.42%2C120.71%22%2F%3E%3Cpolygon%20points%3D%22-50.0%2C-50.0%2050.0%2C-50.0%2050.0%2C50.0%20-50.0%2C50.0%22%2F%3E%3Cpolygon%20points%3D%22191.42%2C-50.0%20291.42%2C-50.0%20291.42%2C50.0%20191.42%2C50.0%22%2F%3E%3Cpolygon%20points%3D%22-50.0%2C191.42%2050.0%2C191.42%2050.0%2C291.42%20-50.0%2C291.42%22%2F%3E%3Cpolygon%20points%3D%22191.42%2C191.42%20291.42%2C191.42%20291.42%2C291.42%20191.42%2C291.42%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E"),
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
  outer: { flex: 1, alignItems: 'center', backgroundColor: '#c8d0da' },
  inner: {
    flex: 1,
    width: '100%',
    // 480 (max card width) + 16px breathing room on each side.
    maxWidth: 512,
    backgroundColor: '#edf1f5',
    boxShadow: '0px 0px 24px rgba(0,0,0,0.18)',
  },
});

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [dbProgress, setDbProgress] = useState(0);
  const loadProfile = useProfileStore((s) => s.load);

  const [fontsLoaded] = useFonts({
    'AmiriQuranColored': require('../assets/fonts/AmiriQuranColored.woff2'),
    'Amiri-Regular': require('../assets/fonts/Amiri-Regular.woff2'),
  });

  useEffect(() => {
    (async () => {
      await loadProfile();
      await initDb((pct) => setDbProgress(pct));
      setDbReady(true);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!dbReady || !fontsLoaded) {
    return (
      <SafeAreaProvider>
        <WebFrame>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0d2d4e', gap: 20 }}>
            <Image source={appIcon} style={{ width: 96, height: 96, borderRadius: 20 }} />
            <ActivityIndicator size="large" color="#f39c12" />
            {dbProgress > 0 && dbProgress < 1 && (
              <Text style={{ color: '#9bbdd4', fontSize: 13 }}>
                تحميل البيانات {Math.round(dbProgress * 100)}٪
              </Text>
            )}
          </View>
        </WebFrame>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Analytics />
      <WebFrame>
        <Stack screenOptions={{ headerShown: false }} />
      </WebFrame>
      <ConsentBanner />
    </SafeAreaProvider>
  );
}
