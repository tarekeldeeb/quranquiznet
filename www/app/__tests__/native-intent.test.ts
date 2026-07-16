// Regression test for the native OAuth redirect landing on Expo Router's
// "Unmatched Route" 404 screen mid sign-in (see app/+native-intent.tsx).
import { redirectSystemPath, isOAuthCallback } from '../+native-intent';

describe('isOAuthCallback', () => {
  it('matches the Facebook redirect (fb<APP_ID>://authorize)', () => {
    expect(isOAuthCallback('fb2174811292744823://authorize?access_token=abc#_=_')).toBe(true);
  });

  it('matches the Google redirect (<package>:/oauthredirect)', () => {
    expect(isOAuthCallback('net.quranquiz:/oauthredirect?code=abc')).toBe(true);
  });

  it('matches a bare path with no scheme', () => {
    expect(isOAuthCallback('authorize?access_token=abc')).toBe(true);
    expect(isOAuthCallback('oauthredirect?code=abc')).toBe(true);
  });

  it('does not match normal in-app routes', () => {
    expect(isOAuthCallback('quranquiz:///(app)/me')).toBe(false);
    expect(isOAuthCallback('quranquiz:///')).toBe(false);
    expect(isOAuthCallback('/(app)/me')).toBe(false);
  });

  it('does not match unrelated paths that merely contain the token elsewhere', () => {
    expect(isOAuthCallback('quranquiz:///league/authorize-something')).toBe(false);
  });
});

describe('redirectSystemPath', () => {
  it('vetoes navigation (returns undefined) for OAuth callback URLs', () => {
    expect(redirectSystemPath({ path: 'fb2174811292744823://authorize?access_token=abc', initial: false })).toBeUndefined();
    expect(redirectSystemPath({ path: 'net.quranquiz:/oauthredirect?code=abc', initial: true })).toBeUndefined();
  });

  it('passes normal routes through unchanged', () => {
    expect(redirectSystemPath({ path: 'quranquiz:///(app)/me', initial: false })).toBe('quranquiz:///(app)/me');
  });
});
