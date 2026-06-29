// Regression tests for the three auth bugs fixed in firebase.ts:
//   #1 Google must show the account chooser (prompt: select_account).
//   #3 A signed-in guest upgrading via Google/Facebook must LINK (preserve
//      progress), fall back to sign-in if the account already exists, and
//      surface real errors instead of failing silently.
// (#2 — the logout navigation race — is covered in app/(app)/__tests__/me.test.tsx.)

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
  getApps: jest.fn(() => [{}]), // pretend an app already exists
  getApp: jest.fn(() => ({})),
}));

jest.mock('firebase/database', () => ({
  getDatabase: jest.fn(() => ({})),
  ref: jest.fn(),
  set: jest.fn(),
  push: jest.fn(),
  get: jest.fn(),
}));

jest.mock('firebase/auth', () => {
  const authState = { currentUser: null as null | { uid: string; isAnonymous: boolean } };
  class GoogleAuthProvider {
    customParameters: Record<string, string> = {};
    setCustomParameters(p: Record<string, string>) { this.customParameters = p; return this; }
    static credentialFromError = jest.fn();
  }
  class FacebookAuthProvider {
    static credentialFromError = jest.fn();
  }
  return {
    __authState: authState,
    getAuth: jest.fn(() => authState),
    onAuthStateChanged: jest.fn(),
    signInAnonymously: jest.fn(),
    signInWithPopup: jest.fn(),
    linkWithPopup: jest.fn(),
    signInWithCredential: jest.fn(),
    GoogleAuthProvider,
    FacebookAuthProvider,
    signOut: jest.fn(),
  };
});

import * as fbAuth from 'firebase/auth';
import { signInGoogle, signInFacebook } from '../firebase';

// Typed handles to the mocks.
const m = fbAuth as unknown as {
  __authState: { currentUser: null | { uid: string; isAnonymous: boolean } };
  getAuth: jest.Mock;
  signInWithPopup: jest.Mock;
  linkWithPopup: jest.Mock;
  signInWithCredential: jest.Mock;
  GoogleAuthProvider: { credentialFromError: jest.Mock };
  FacebookAuthProvider: { credentialFromError: jest.Mock };
};

beforeEach(() => {
  m.__authState.currentUser = null;
  m.signInWithPopup.mockReset();
  m.linkWithPopup.mockReset();
  m.signInWithCredential.mockReset();
  m.GoogleAuthProvider.credentialFromError.mockReset();
  m.FacebookAuthProvider.credentialFromError.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  (console.error as jest.Mock).mockRestore?.();
});

describe('signInGoogle — bug #1: account chooser', () => {
  it('always requests the Google account chooser via prompt: select_account', async () => {
    m.signInWithPopup.mockResolvedValue({ user: { uid: 'g1' } });
    await signInGoogle();
    expect(m.signInWithPopup).toHaveBeenCalledTimes(1);
    const provider = m.signInWithPopup.mock.calls[0][1];
    expect(provider.customParameters).toEqual({ prompt: 'select_account' });
  });
});

describe('social sign-in — bug #3: guest upgrade', () => {
  it('links the provider (not a fresh sign-in) when the user is an anonymous guest', async () => {
    m.__authState.currentUser = { uid: 'anon', isAnonymous: true };
    m.linkWithPopup.mockResolvedValue({ user: { uid: 'anon', isAnonymous: false } });

    const user = await signInGoogle();

    expect(m.linkWithPopup).toHaveBeenCalledWith(m.__authState.currentUser, expect.anything());
    expect(m.signInWithPopup).not.toHaveBeenCalled(); // progress preserved, no replacement
    expect(user).toEqual({ uid: 'anon', isAnonymous: false });
  });

  it('falls back to signInWithCredential when the social account already exists', async () => {
    m.__authState.currentUser = { uid: 'anon', isAnonymous: true };
    m.linkWithPopup.mockRejectedValue({ code: 'auth/credential-already-in-use' });
    m.GoogleAuthProvider.credentialFromError.mockReturnValue({ providerId: 'google.com' });
    m.signInWithCredential.mockResolvedValue({ user: { uid: 'existing-google' } });

    const user = await signInGoogle();

    expect(m.signInWithCredential).toHaveBeenCalledTimes(1);
    expect(user).toEqual({ uid: 'existing-google' });
  });

  it('uses signInWithPopup (not link) when no one is signed in', async () => {
    m.__authState.currentUser = null;
    m.signInWithPopup.mockResolvedValue({ user: { uid: 'g1' } });

    await signInGoogle();

    expect(m.signInWithPopup).toHaveBeenCalledTimes(1);
    expect(m.linkWithPopup).not.toHaveBeenCalled();
  });
});

describe('social sign-in — bug #3: errors are no longer swallowed', () => {
  it('throws on a real popup error so the caller can show a message', async () => {
    m.signInWithPopup.mockRejectedValue({ code: 'auth/network-request-failed' });
    await expect(signInGoogle()).rejects.toBeTruthy();
  });

  it('stays silent (returns null) when the user dismisses the popup', async () => {
    m.signInWithPopup.mockRejectedValue({ code: 'auth/popup-closed-by-user' });
    await expect(signInGoogle()).resolves.toBeNull();
  });

  it('Facebook follows the same guest-link upgrade path', async () => {
    m.__authState.currentUser = { uid: 'anon', isAnonymous: true };
    m.linkWithPopup.mockResolvedValue({ user: { uid: 'anon', isAnonymous: false } });
    await signInFacebook();
    expect(m.linkWithPopup).toHaveBeenCalled();
  });
});
