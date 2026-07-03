// Native (iOS/Android) social sign-in via expo-auth-session.
//
// The Firebase JS SDK's popup helpers (signInWithPopup / linkWithPopup) only
// work on the web — on React Native they throw
// `auth/operation-not-supported-in-this-environment`. So on native we run the
// OAuth dance ourselves in the system browser via expo-auth-session, get back a
// provider token (Google id_token / Facebook access_token), and hand it to
// Firebase as a credential (signInWithCredential / linkWithCredential).
//
// This module is only imported on native (firebase.ts lazy-imports it behind a
// Platform check), so the web bundle never pulls in expo-auth-session.
//
// Client IDs come from EXPO_PUBLIC_* env vars (see .env.example). They are not
// secrets — they are public OAuth client identifiers — so inlining them into the
// bundle is fine.

import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  GoogleAuthProvider, FacebookAuthProvider, OAuthCredential,
} from 'firebase/auth';

// Required so the browser-based auth flow can dismiss its tab and return control
// to the app when the redirect fires. Safe to call at module load.
WebBrowser.maybeCompleteAuthSession();

const GOOGLE_DISCOVERY: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

const FACEBOOK_DISCOVERY: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://www.facebook.com/v19.0/dialog/oauth',
  tokenEndpoint: 'https://graph.facebook.com/v19.0/oauth/access_token',
};

type GoogleAuthExtra = {
  iosClientId?: string | null;
  androidClientId?: string | null;
  webClientId?: string | null;
};

/** Google client IDs injected by app.config.js from GoogleService-Info.plist /
 *  google-services.json (see expo.extra.googleAuth). */
function googleAuthConfig(): GoogleAuthExtra {
  return (Constants.expoConfig?.extra?.googleAuth ?? {}) as GoogleAuthExtra;
}

/** Pick the Google OAuth client ID for the running platform. Prefers the value
 *  from the Firebase config files; falls back to an EXPO_PUBLIC_* env override. */
function googleClientId(): string | undefined {
  const cfg = googleAuthConfig();
  return (Platform.select({
    ios: cfg.iosClientId || process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    android: cfg.androidClientId || process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    default: cfg.webClientId || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  }) as string | undefined) || undefined;
}

/**
 * The native Google flow redirects to the app's own package/bundle-id scheme
 * (e.g. `net.quranquiz.app:/oauthredirect`). Google binds the iOS/Android OAuth
 * client to that identifier, so it accepts this redirect and rejects any other
 * (including the reversed client-id scheme) with `invalid_request`. The scheme is
 * registered by default from the applicationId, so no extra config is needed.
 * Mirrors expo-auth-session's own Google provider.
 */
function googleRedirectUri(): string {
  const cfg = Constants.expoConfig;
  const appId =
    (Platform.OS === 'ios' ? cfg?.ios?.bundleIdentifier : cfg?.android?.package) ??
    'net.quranquiz.app';
  return AuthSession.makeRedirectUri({ native: `${appId}:/oauthredirect` });
}

/**
 * Run the Google OAuth flow in the system browser and return a Firebase
 * credential, or null if the user dismisses the browser. Throws if the client
 * ID is unconfigured or no token comes back.
 */
export async function acquireGoogleCredential(): Promise<OAuthCredential | null> {
  const clientId = googleClientId();
  if (!clientId) {
    throw new Error('Google sign-in is not configured: add GoogleService-Info.plist / google-services.json to the project root (or set EXPO_PUBLIC_GOOGLE_*_CLIENT_ID).');
  }
  const redirectUri = googleRedirectUri();
  // Google's native (iOS/Android) OAuth clients are *public* clients and only
  // support the authorization-code + PKCE flow — the implicit id_token flow is
  // rejected with invalid_request. So request a code, then exchange it (with the
  // PKCE verifier; no client secret) for tokens and hand the id_token to Firebase.
  const request = new AuthSession.AuthRequest({
    clientId,
    scopes: ['openid', 'profile', 'email'],
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
  });
  const result = await request.promptAsync(GOOGLE_DISCOVERY);
  if (result.type !== 'success') return null; // cancelled / dismissed
  const code = result.params.code;
  if (!code) throw new Error('Google sign-in returned no authorization code.');

  const tokens = await AuthSession.exchangeCodeAsync(
    {
      clientId,
      code,
      redirectUri,
      extraParams: { code_verifier: request.codeVerifier ?? '' },
    },
    GOOGLE_DISCOVERY,
  );
  const idToken = tokens.idToken;
  if (!idToken) throw new Error('Google sign-in returned no id_token.');
  return GoogleAuthProvider.credential(idToken);
}

/**
 * Run the Facebook OAuth flow in the system browser and return a Firebase
 * credential, or null if the user dismisses the browser.
 */
export async function acquireFacebookCredential(): Promise<OAuthCredential | null> {
  const appId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
  if (!appId) {
    throw new Error('Facebook sign-in is not configured: set EXPO_PUBLIC_FACEBOOK_APP_ID.');
  }
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'quranquiz', path: 'oauthredirect' });
  const request = new AuthSession.AuthRequest({
    clientId: appId,
    scopes: ['public_profile', 'email'],
    redirectUri,
    responseType: AuthSession.ResponseType.Token,
    extraParams: { display: 'popup' },
    usePKCE: false, // implicit (token) flow — PKCE params don't apply
  });
  const result = await request.promptAsync(FACEBOOK_DISCOVERY);
  if (result.type !== 'success') return null;
  const accessToken = result.params.access_token;
  if (!accessToken) throw new Error('Facebook sign-in returned no access_token.');
  return FacebookAuthProvider.credential(accessToken);
}

export type SocialKind = 'google' | 'facebook';

/** Acquire a credential for the given provider kind. */
export function acquireCredential(kind: SocialKind): Promise<OAuthCredential | null> {
  return kind === 'google' ? acquireGoogleCredential() : acquireFacebookCredential();
}
