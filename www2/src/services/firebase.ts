// Firebase integration — mirrors www/profile/firebasecontrol.js and _model_/services.js (FB factory)
// Uses Firebase JS SDK v10 modular API — works on iOS, Android, and web.

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, signInAnonymously,
  signInWithPopup, GoogleAuthProvider, FacebookAuthProvider,
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

export async function signInGoogle(): Promise<User | null> {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(getFirebaseAuth(), provider);
    return result.user;
  } catch (e) {
    console.error('signInGoogle error:', e);
    return null;
  }
}

export async function signInFacebook(): Promise<User | null> {
  try {
    const provider = new FacebookAuthProvider();
    const result = await signInWithPopup(getFirebaseAuth(), provider);
    return result.user;
  } catch (e: unknown) {
    const err = e as { code?: string; credential?: unknown };
    if (err.code === 'auth/account-exists-with-different-credential') {
      // Link: sign in with Google first, then link Facebook credential
      const gProvider = new GoogleAuthProvider();
      const gResult = await signInWithPopup(getFirebaseAuth(), gProvider);
      // Linking is handled separately in the auth flow
      return gResult.user;
    }
    console.error('signInFacebook error:', e);
    return null;
  }
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
