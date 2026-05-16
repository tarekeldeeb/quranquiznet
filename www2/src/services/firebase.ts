import Constants from 'expo-constants';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, User, Auth } from 'firebase/auth';
import { getDatabase, ref, set, get, Database } from 'firebase/database';

const extra = (Constants.expoConfig as any)?.extra || {};
const firebaseConfig = {
  apiKey: extra.FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '',
  authDomain: extra.FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || '',
  projectId: extra.FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || '',
  storageBucket: extra.FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: extra.FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || '',
  appId: extra.FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || '',
};

function isFirebaseConfigValid(config: Record<string, string>) {
  return Object.values(config).every(v => typeof v === 'string' && v.length > 0);
}

const firebaseApp: FirebaseApp | null = isFirebaseConfigValid(firebaseConfig)
  ? initializeApp(firebaseConfig)
  : null;

export const auth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null;
let db: Database | null = null;
if (firebaseApp) {
  try {
    db = getDatabase(firebaseApp);
  } catch (e) {
    db = null;
  }
}

export const isFirebaseConfigured = isFirebaseConfigValid(firebaseConfig);

export async function signInAnon() {
  if (!auth) throw new Error('Firebase auth not initialized');
  return signInAnonymously(auth);
}

export function onAuthChange(cb: (user: User | null) => void) {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, cb);
}

export async function writeProfile(uid: string, profile: any) {
  if (!db) throw new Error('Realtime DB not initialized');
  const r = ref(db, `profiles/${uid}`);
  await set(r, profile);
}

export async function readProfile(uid: string) {
  if (!db) throw new Error('Realtime DB not initialized');
  const r = ref(db, `profiles/${uid}`);
  const snap = await get(r);
  return snap.exists() ? snap.val() : null;
}

export default { auth, isFirebaseConfigured, signInAnon, onAuthChange, writeProfile, readProfile };
