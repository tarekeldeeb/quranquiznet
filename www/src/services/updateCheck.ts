// Native "a newer version is out" nudge. Compares the running app's marketing
// version (Constants.expoConfig.version — reliable here since this app ships
// no expo-updates OTA channel, so the bundled config always matches the
// installed native build) against www/public/version.json, a static file
// served as-is by Firebase Hosting (see that file's own comment for why it's
// bumped manually, after each store listing actually goes live).
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { APP_STORE_URL, PLAY_STORE_URL } from '../models/storeLinks';

const VERSION_URL = 'https://quranquiz.net/version.json';
const FETCH_TIMEOUT_MS = 5000;
// Local-only (not synced via pushCurrentProfile) — a dismissal is tied to the
// native build installed on *this* device, not the account, so it shouldn't
// follow the user to a different device that may be on a different version.
const DISMISSED_KEY = 'qqn_dismissed_update_version';

interface LatestVersions {
  ios: string;
  android: string;
}

export async function fetchLatestVersions(): Promise<LatestVersions | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(VERSION_URL, { signal: controller.signal });
    if (!res.ok) return null;
    const json = await res.json();
    if (typeof json?.ios !== 'string' || typeof json?.android !== 'string') return null;
    return { ios: json.ios, android: json.android };
  } catch {
    return null; // offline, timeout, malformed JSON — never block the app over this
  } finally {
    clearTimeout(timer);
  }
}

// Numeric dot-segment compare ("2.10.0" > "2.9.0"), not a lexical one.
export function isNewerVersion(remote: string, local: string): boolean {
  const toParts = (v: string) => v.split('.').map((n) => parseInt(n, 10) || 0);
  const r = toParts(remote);
  const l = toParts(local);
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const rv = r[i] ?? 0;
    const lv = l[i] ?? 0;
    if (rv !== lv) return rv > lv;
  }
  return false;
}

export interface PendingUpdate {
  version: string;
  storeUrl: string;
}

// Dev-only override for previewing UpdateBanner on demand (e.g. on web, where
// the real check below is a no-op) without needing a real version.json bump
// — see the __DEV__ exposure at the bottom of this file. Module-level rather
// than component state since the console command has no component to call a
// setter on; the listener set is how every mounted useUpdateAvailable() finds
// out it changed. Mirrors profileStore's rollForTip(true)/pendingTipKey.
let devForcedUpdate: PendingUpdate | null = null;
const devForceListeners = new Set<() => void>();
const notifyDevForceListeners = () => devForceListeners.forEach((listen) => listen());

// Drives UpdateBanner. Web has no store to update from, so the real check is
// a no-op there (the dev override above still works on any platform).
export function useUpdateAvailable(): { update: PendingUpdate | null; dismiss: () => void } {
  const [update, setUpdate] = useState<PendingUpdate | null>(null);
  const [, forceRerender] = useState(0);

  useEffect(() => {
    const listen = () => forceRerender((n) => n + 1);
    devForceListeners.add(listen);
    return () => { devForceListeners.delete(listen); };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let cancelled = false;
    (async () => {
      const remote = await fetchLatestVersions();
      if (!remote || cancelled) return;
      const latest = Platform.OS === 'ios' ? remote.ios : remote.android;
      const current = Constants.expoConfig?.version ?? '0';
      if (!isNewerVersion(latest, current)) return;
      const dismissed = await AsyncStorage.getItem(DISMISSED_KEY);
      if (cancelled || dismissed === latest) return;
      setUpdate({ version: latest, storeUrl: Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL });
    })();
    return () => { cancelled = true; };
  }, []);

  const dismiss = () => {
    if (devForcedUpdate) {
      devForcedUpdate = null;
      notifyDevForceListeners();
      return;
    }
    if (update) AsyncStorage.setItem(DISMISSED_KEY, update.version);
    setUpdate(null);
  };

  return { update: devForcedUpdate ?? update, dismiss };
}

// Console-debuggable (Metro's web devtools console, or the Hermes/remote
// debugger on native) so UpdateBanner can be previewed without a real
// version.json bump or an outdated build — pass null to clear the override
// and fall back to the real check. e.g. from the browser console:
//   forceUpdateBanner()
//   forceUpdateBanner('9.9.9')
//   forceUpdateBanner(null)
// Exported directly (not just via globalThis) so it's callable from tests too.
export function forceUpdateBanner(version: string | null = '9.9.9'): void {
  devForcedUpdate = version === null ? null : { version, storeUrl: Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL };
  notifyDevForceListeners();
}

if (__DEV__) {
  (globalThis as unknown as { forceUpdateBanner: typeof forceUpdateBanner }).forceUpdateBanner = forceUpdateBanner;
}
