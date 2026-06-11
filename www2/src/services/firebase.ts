// Firebase integration — mirrors www/profile/firebasecontrol.js and _model_/services.js (FB factory)
// Uses Firebase JS SDK v10 modular API — works on iOS, Android, and web.

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, signInAnonymously,
  signInWithPopup, GoogleAuthProvider, FacebookAuthProvider,
  signOut as fbSignOut, User, Auth,
} from 'firebase/auth';
import { getDatabase, ref, onValue, set, push, get as dbGet, Database } from 'firebase/database';

// ─── Replace these values with your Firebase project config ───────────────────
// Copy from: Firebase Console → Project Settings → Your apps → Web app → Config
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCGxNSZizDrqsm58SIi1mmBAe4tWfvCmJk",
  authDomain: "quranquiznet-3a54c.firebaseapp.com",
  databaseURL: "https://quranquiznet-3a54c.firebaseio.com",
  projectId: "quranquiznet-3a54c",
  storageBucket: "quranquiznet-3a54c.firebasestorage.app",
  messagingSenderId: "635224907527",
  appId: "1:635224907527:web:bb6cd3e8d858130d3a6fa2",
  measurementId: "G-Y9MJ3PD6KV"
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
  } catch {
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
