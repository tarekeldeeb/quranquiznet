// Native Google/Facebook sign-in (src/services/nativeOAuth.ts) redirects the system
// browser to `fb<APP_ID>://authorize` or `<package>:/oauthredirect` to hand control
// back to the app. expo-auth-session's own listener resolves the pending credential
// from that same deep link, but Expo Router's linking layer independently treats
// every incoming URL as a navigation target — with no route registered for those
// paths, it fell through to the default "Unmatched Route" screen mid-login, even
// though sign-in had already succeeded in the background.
//
// `redirectSystemPath` is Expo Router's hook for intercepting a raw incoming URL
// before it's matched to a route: returning a falsy value vetoes the navigation
// entirely, so the user never leaves the screen they were already on.
const OAUTH_CALLBACK_PATHS = ['authorize', 'oauthredirect'];

function isOAuthCallback(path: string): boolean {
  const afterScheme = path.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/*/, '');
  return OAUTH_CALLBACK_PATHS.some((p) => afterScheme.startsWith(p));
}

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string | undefined {
  return isOAuthCallback(path) ? undefined : path;
}

// Exported for testing (see app/__tests__/native-intent.test.ts) — not part of the
// NativeIntent contract itself.
export { isOAuthCallback };
