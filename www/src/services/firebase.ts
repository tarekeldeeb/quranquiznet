// Firebase integration — mirrors www/profile/firebasecontrol.js and _model_/services.js (FB factory)
// Uses Firebase JS SDK v10 modular API — works on iOS, Android, and web.

import { Platform } from 'react-native';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth, initializeAuth, onAuthStateChanged, signInAnonymously,
  signInWithPopup, linkWithPopup, signInWithCredential, linkWithCredential,
  GoogleAuthProvider, FacebookAuthProvider, AuthProvider, AuthCredential, OAuthCredential,
  signOut as fbSignOut, User, Auth,
} from 'firebase/auth';
// getReactNativePersistence is only exported from Firebase's React Native build;
// the app's tsconfig resolves the web/node types, so the type isn't visible here.
// It's present at runtime on native via Metro's "react-native" entry point.
// @ts-expect-error — RN-only export, absent from the resolved web types
import { getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase, ref, set, push, get as dbGet, Database } from 'firebase/database';
import type { SocialKind } from './nativeOAuth';

// Config comes from EXPO_PUBLIC_* env vars (see .env / .env.example), so the
// values are not hard-coded in source. Note: EXPO_PUBLIC_* vars are still
// inlined into the client bundle — the Firebase web apiKey is a public project
// identifier, not a secret; protect data via Firebase Security Rules / App Check.
const FIREBASE_CONFIG = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};
// ─────────────────────────────────────────────────────────────────────────────

let app: FirebaseApp;
let auth: Auth;
let db: Database;

export function getFirebaseApp(): FirebaseApp {
  if (!getApps().length) {
    app = initializeApp(FIREBASE_CONFIG);
  } else {
    app = getApp();
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    if (Platform.OS === 'web') {
      auth = getAuth(getFirebaseApp());
    } else {
      // Native: wire Auth to AsyncStorage so the session survives app restarts.
      // initializeAuth throws "auth/already-initialized" if called twice (e.g. on
      // Fast Refresh) — fall back to getAuth to recover the existing instance.
      try {
        auth = initializeAuth(getFirebaseApp(), {
          persistence: getReactNativePersistence(AsyncStorage),
        });
      } catch {
        auth = getAuth(getFirebaseApp());
      }
    }
  }
  return auth;
}

export function getFirebaseDb(): Database {
  if (!db) db = getDatabase(getFirebaseApp());
  return db;
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

export async function signInAnon(): Promise<User | null> {
  try {
    const result = await signInAnonymously(getFirebaseAuth());
    return result.user;
  } catch (e) {
    console.error('signInAnon error:', e);
    return null;
  }
}

// Popup outcomes that mean "the user backed out" — not real failures, so we
// stay silent (return null without surfacing an error to the caller's UI).
const BENIGN_POPUP_CODES = new Set([
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/user-cancelled',
]);

function googleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  // Always show the Google account chooser instead of silently reusing the one
  // already signed in to the browser.
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

function credentialFromError(provider: AuthProvider, err: unknown): OAuthCredential | null {
  if (provider instanceof GoogleAuthProvider) return GoogleAuthProvider.credentialFromError(err as never);
  if (provider instanceof FacebookAuthProvider) return FacebookAuthProvider.credentialFromError(err as never);
  return null;
}

/** The "other" social provider — used to resolve same-email account collisions.
 *  This app only has Google + Facebook, so if a sign-in collides on email the
 *  existing account must be the other provider. */
function otherProvider(provider: AuthProvider): AuthProvider {
  return provider instanceof FacebookAuthProvider ? googleProvider() : new FacebookAuthProvider();
}

/**
 * Resolve `auth/account-exists-with-different-credential`: the user tried one
 * provider but their email is already registered with the other. Sign them into
 * the existing provider, then link the credential they just tried so either one
 * works next time. Returns the signed-in user (or null if they dismiss the popup).
 */
async function linkExistingAccount(auth: Auth, provider: AuthProvider, error: unknown): Promise<User | null> {
  const pendingCred = credentialFromError(provider, error);
  if (!pendingCred) throw error;
  const result = await signInWithPopup(auth, otherProvider(provider));
  // Best-effort link; if it fails (e.g. already linked) the user is still signed in.
  await linkWithCredential(result.user, pendingCred).catch((e) => console.warn('link pending credential failed:', e));
  return result.user;
}

/**
 * Sign in (or, for a guest, upgrade) with a social provider.
 *
 * - Anonymous guest: link the provider so local progress is preserved; if that
 *   social account already exists, sign straight into it.
 * - Same email registered with the other provider
 *   (`auth/account-exists-with-different-credential`): sign into the existing
 *   provider and link the new credential.
 *
 * Throws on real errors so the caller can show a message; returns null only when
 * the user dismisses a popup.
 */
async function socialSignIn(provider: AuthProvider, kind: SocialKind): Promise<User | null> {
  // Native (iOS/Android) can't use Firebase's popup flow — it throws
  // `auth/operation-not-supported-in-this-environment`. Run the OAuth flow in the
  // system browser instead and sign in / link with the resulting credential.
  if (Platform.OS !== 'web') return nativeSocialSignIn(kind);

  const auth = getFirebaseAuth();
  const current = auth.currentUser;
  try {
    if (current?.isAnonymous) {
      try {
        const linked = await linkWithPopup(current, provider);
        return linked.user;
      } catch (e: unknown) {
        const code = (e as { code?: string }).code;
        // The social account is already registered — sign into it directly.
        if (code === 'auth/credential-already-in-use') {
          const cred = credentialFromError(provider, e);
          if (cred) {
            const result = await signInWithCredential(auth, cred);
            return result.user;
          }
        }
        throw e;
      }
    }
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code === 'auth/account-exists-with-different-credential') {
      try {
        return await linkExistingAccount(auth, provider, e);
      } catch (e2: unknown) {
        if (BENIGN_POPUP_CODES.has((e2 as { code?: string }).code ?? '')) return null;
        console.error('socialSignIn link error:', e2);
        throw e2;
      }
    }
    if (BENIGN_POPUP_CODES.has(code ?? '')) return null;
    console.error('socialSignIn error:', e);
    throw e;
  }
}

// ─── Native (iOS/Android) credential-based sign-in ──────────────────────────────

/**
 * Sign in / link on native using a credential obtained from the system-browser
 * OAuth flow. Mirrors the web `socialSignIn` logic:
 *  - Anonymous guest → link to preserve progress; if the social account already
 *    exists, sign straight into it.
 *  - Same email registered with the other provider
 *    (`auth/account-exists-with-different-credential`) → run the other provider's
 *    flow, sign into it, then link this credential so either one works next time.
 *
 * Throws on real errors; returns null when the user dismisses the browser.
 */
async function nativeSocialSignIn(kind: SocialKind): Promise<User | null> {
  // Lazy require so the native-only OAuth code (and its expo-auth-session deps,
  // whose module side-effects run on load) is never executed on web. The `import
  // type` keeps this fully typed without a runtime ESM import.
  const oauth = require('./nativeOAuth') as typeof import('./nativeOAuth');
  const auth = getFirebaseAuth();
  const credential = await oauth.acquireCredential(kind);
  if (!credential) return null; // user dismissed the browser

  const current = auth.currentUser;
  if (current?.isAnonymous) {
    try {
      const linked = await linkWithCredential(current, credential);
      return linked.user;
    } catch (e: unknown) {
      // The social account already exists — sign into it directly.
      if ((e as { code?: string }).code === 'auth/credential-already-in-use') {
        const result = await signInWithCredential(auth, credential);
        return result.user;
      }
      throw e;
    }
  }

  try {
    const result = await signInWithCredential(auth, credential);
    return result.user;
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'auth/account-exists-with-different-credential') {
      return nativeLinkExistingAccount(auth, oauth, kind, credential);
    }
    throw e;
  }
}

/** Native counterpart of `linkExistingAccount`: the email already belongs to the
 *  other provider, so sign into that one and link the credential just attempted. */
async function nativeLinkExistingAccount(
  auth: Auth,
  oauth: typeof import('./nativeOAuth'),
  kind: SocialKind,
  pendingCred: AuthCredential,
): Promise<User | null> {
  const otherKind: SocialKind = kind === 'google' ? 'facebook' : 'google';
  const otherCred = await oauth.acquireCredential(otherKind);
  if (!otherCred) return null; // user dismissed the recovery browser
  const result = await signInWithCredential(auth, otherCred);
  // Best-effort link; the user is signed in regardless.
  await linkWithCredential(result.user, pendingCred).catch((e) => console.warn('native link pending credential failed:', e));
  return result.user;
}

export function signInGoogle(): Promise<User | null> {
  return socialSignIn(googleProvider(), 'google');
}

export function signInFacebook(): Promise<User | null> {
  return socialSignIn(new FacebookAuthProvider(), 'facebook');
}

export async function signOut(): Promise<void> {
  await fbSignOut(getFirebaseAuth());
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(getFirebaseAuth(), callback);
}

// ─── Profile sync ─────────────────────────────────────────────────────────────

export async function fetchRemoteProfile(uid: string): Promise<unknown | null> {
  try {
    const dbRef = ref(getFirebaseDb(), `/users/${uid}`);
    const snap = await dbGet(dbRef);
    return snap.val();
  } catch {
    return null;
  }
}

export async function pushProfile(uid: string, profile: unknown): Promise<void> {
  try {
    await set(ref(getFirebaseDb(), `/users/${uid}`), profile);
  } catch (e) {
    console.error('pushProfile error:', e);
  }
}

// ─── Daily quiz ───────────────────────────────────────────────────────────────

export interface DailyHead {
  daily_random: number;
  start_time: number;
  submit_to_ref: string;
  yesterday: string;
}

export async function getDailyHead(): Promise<DailyHead | null> {
  try {
    const snap = await dbGet(ref(getFirebaseDb(), '/daily/head'));
    return snap.val() as DailyHead | null;
  } catch (e) {
    console.error('getDailyHead error:', e);
    return null;
  }
}

export async function submitDailyResult(score: {
  score: number;
  name: string;
  country?: string;
  city?: string;
  uid: string;
}): Promise<void> {
  try {
    const head = await getDailyHead();
    if (!head) return;
    await push(ref(getFirebaseDb(), `/daily/${head.submit_to_ref}`), score);
  } catch (e) {
    console.error('submitDailyResult error:', e);
  }
}

export async function getYesterdayReport(): Promise<unknown[]> {
  try {
    const head = await getDailyHead();
    const path = head?.yesterday ?? '/daily/reports/yday';
    const snap = await dbGet(ref(getFirebaseDb(), path.startsWith('/') ? path : `/daily/${path}`));
    return (snap.val() as unknown[]) ?? [];
  } catch {
    return [];
  }
}

export async function getAllTopReport(): Promise<unknown[]> {
  try {
    const snap = await dbGet(ref(getFirebaseDb(), '/daily/reports/all'));
    return (snap.val() as unknown[]) ?? [];
  } catch {
    return [];
  }
}

export async function reportQuestion(card: unknown): Promise<void> {
  try {
    await push(ref(getFirebaseDb(), '/reports/'), { q: card });
  } catch (e) {
    console.error('reportQuestion error:', e);
  }
}
