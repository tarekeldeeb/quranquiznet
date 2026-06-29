// Firebase integration — mirrors www/profile/firebasecontrol.js and _model_/services.js (FB factory)
// Uses Firebase JS SDK v10 modular API — works on iOS, Android, and web.

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, signInAnonymously,
  signInWithPopup, linkWithPopup, signInWithCredential,
  GoogleAuthProvider, FacebookAuthProvider, AuthProvider, OAuthCredential,
  signOut as fbSignOut, User, Auth,
} from 'firebase/auth';
import { getDatabase, ref, set, push, get as dbGet, Database } from 'firebase/database';

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
  if (!auth) auth = getAuth(getFirebaseApp());
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

/**
 * Sign in (or, for a guest, upgrade) with a social provider.
 *
 * If the current user is anonymous we link the provider so the guest's local
 * progress is preserved. If that social account already exists we fall back to
 * signing straight into it. Throws on real errors so the caller can show a
 * message; returns null only when the user dismisses the popup.
 */
async function socialSignIn(provider: AuthProvider): Promise<User | null> {
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
    if (BENIGN_POPUP_CODES.has((e as { code?: string }).code ?? '')) return null;
    console.error('socialSignIn error:', e);
    throw e;
  }
}

export function signInGoogle(): Promise<User | null> {
  return socialSignIn(googleProvider());
}

export function signInFacebook(): Promise<User | null> {
  return socialSignIn(new FacebookAuthProvider());
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
