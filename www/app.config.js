// Dynamic Expo config.
//
// Google native sign-in needs three OAuth client IDs. Rather than maintaining
// them as separate env vars, we read them straight from the standard Firebase
// config files dropped into the project root:
//   - GoogleService-Info.plist  → iOS client ID
//   - google-services.json      → Android + Web client IDs
// The values are injected into `expo.extra.googleAuth`, which the app reads at
// runtime via expo-constants (see src/services/nativeOAuth.ts). An
// EXPO_PUBLIC_GOOGLE_*_CLIENT_ID env var, if set, overrides the file value.
//
// We also register the iOS OAuth redirect scheme (the *reversed* iOS client ID)
// in CFBundleURLTypes so the browser flow can return to the app.
//
// Expo passes the normalized app.json in as `config`, so everything there is
// preserved; we only augment iOS URL schemes and `extra`.

const fs = require('fs');
const path = require('path');

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

/** `1234-abc.apps.googleusercontent.com` → `com.googleusercontent.apps.1234-abc` */
function reverseGoogleClientId(clientId) {
  return clientId.replace(/(.*)\.apps\.googleusercontent\.com$/, 'com.googleusercontent.apps.$1');
}

/** iOS client ID: env override, else the CLIENT_ID key in GoogleService-Info.plist. */
function googleIosClientId() {
  if (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID) return process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const plist = readFileSafe(path.join(__dirname, 'GoogleService-Info.plist'));
  // Match <key>CLIENT_ID</key> exactly (not <key>ANDROID_CLIENT_ID</key>).
  const m = plist && plist.match(/<key>CLIENT_ID<\/key>\s*<string>([^<]+)<\/string>/);
  return m ? m[1] : undefined;
}

/** Android (client_type 1) + Web (client_type 3) client IDs from google-services.json. */
function googleClientIdsFromJson() {
  const raw = readFileSafe(path.join(__dirname, 'google-services.json'));
  let json = null;
  try { json = raw ? JSON.parse(raw) : null; } catch { json = null; }
  const clients = (json && json.client && json.client[0] && json.client[0].oauth_client) || [];
  let android;
  let web;
  for (const c of clients) {
    if (c.client_type === 1 && !android) android = c.client_id; // Android (package + SHA-1)
    if (c.client_type === 3 && !web) web = c.client_id;         // Web (server)
  }
  return { android, web };
}

module.exports = ({ config }) => {
  const iosClientId = googleIosClientId();
  const fromJson = googleClientIdsFromJson();
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || fromJson.android;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || fromJson.web;
  // Facebook native login redirects to fb<APP_ID>://authorize (the only custom
  // scheme Facebook accepts), so that scheme must be registered on both platforms.
  const facebookAppId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
  const facebookScheme = facebookAppId ? `fb${facebookAppId}` : null;
  // Reversed-client-id redirect schemes for the Google native OAuth flow (see
  // src/services/nativeOAuth.ts). iOS goes into CFBundleURLTypes; Android needs an
  // intent filter so the browser redirect returns to the app.
  const googleIosScheme = iosClientId ? [reverseGoogleClientId(iosClientId)] : [];
  const googleAndroidScheme = androidClientId ? reverseGoogleClientId(androidClientId) : null;

  return {
    ...config,
    ios: {
      ...config.ios,
      infoPlist: {
        ...(config.ios && config.ios.infoPlist),
        CFBundleURLTypes: [
          {
            // App's own schemes, the Facebook redirect scheme, and the Google
            // iOS reversed-client-id scheme.
            CFBundleURLSchemes: [
              'quranquiz',
              'net.quranquiz.app',
              ...(facebookScheme ? [facebookScheme] : []),
              ...googleIosScheme,
            ],
          },
        ],
      },
    },
    android: {
      ...config.android,
      intentFilters: [
        ...((config.android && config.android.intentFilters) || []),
        // Google Android OAuth redirect (reversed client id). Only added once the
        // Android client id is available (google-services.json has a client_type 1).
        ...(googleAndroidScheme
          ? [{
              action: 'VIEW',
              category: ['DEFAULT', 'BROWSABLE'],
              data: [{ scheme: googleAndroidScheme }],
            }]
          : []),
        // Facebook OAuth redirect (fb<APP_ID>://authorize).
        ...(facebookScheme
          ? [{
              action: 'VIEW',
              category: ['DEFAULT', 'BROWSABLE'],
              data: [{ scheme: facebookScheme }],
            }]
          : []),
      ],
    },
    extra: {
      ...(config.extra || {}),
      googleAuth: {
        iosClientId: iosClientId || null,
        androidClientId: androidClientId || null,
        webClientId: webClientId || null,
      },
    },
  };
};
