// Pre-flight guard for scripts/release.sh's iOS build: counts the account's
// live "Apple Distribution" certificates via the App Store Connect API and
// aborts (non-zero exit) if creating one more would hit Apple's limit.
//
// Why this exists: `xcodebuild archive -allowProvisioningUpdates` will
// silently mint a NEW local Distribution certificate whenever the local
// keychain doesn't already hold a matching one — which is normal (each
// machine gets its own), but if the account is already at Apple's cap,
// Xcode's automatic signing can instead prompt to *revoke* an existing
// certificate to make room. That's dangerous here because EAS Build holds
// its own server-side Distribution cert for remote signing (see the
// project-ios-eas-build-fixes / project-ios-local-xcode-build memory notes)
// — an unattended revoke could silently break EAS builds.
//
// Reads the same ASC API key already configured for `eas submit` in
// eas.json (submit.production.ios) rather than duplicating those values.
//
// Usage: node scripts/check-ios-distribution-certs.mjs [maxAllowed=3]
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const maxAllowed = Number(process.argv[2] ?? 3);

const easJson = JSON.parse(readFileSync(join(root, 'eas.json'), 'utf8'));
const iosSubmit = easJson?.submit?.production?.ios;
if (!iosSubmit?.ascApiKeyPath || !iosSubmit?.ascApiKeyId || !iosSubmit?.ascApiKeyIssuerId) {
  console.error('check-ios-distribution-certs: eas.json submit.production.ios is missing ascApiKeyPath/ascApiKeyId/ascApiKeyIssuerId');
  process.exit(1);
}
const { ascApiKeyPath, ascApiKeyId, ascApiKeyIssuerId } = iosSubmit;

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function buildJwt() {
  const privateKey = readFileSync(ascApiKeyPath, 'utf8');
  const header = { alg: 'ES256', kid: ascApiKeyId, typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: ascApiKeyIssuerId, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const sign = createSign('SHA256');
  sign.update(signingInput);
  sign.end();
  const derSig = sign.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });
  return `${signingInput}.${base64url(derSig)}`;
}

const jwt = buildJwt();
const res = await fetch(
  'https://api.appstoreconnect.apple.com/v1/certificates?filter[certificateType]=DISTRIBUTION,IOS_DISTRIBUTION&limit=50',
  { headers: { Authorization: `Bearer ${jwt}` } }
);
const body = await res.json();
if (!res.ok) {
  console.error('check-ios-distribution-certs: App Store Connect API error', res.status, JSON.stringify(body, null, 2));
  process.exit(1);
}

const certs = body.data ?? [];
console.error(`check-ios-distribution-certs: ${certs.length}/${maxAllowed} Apple Distribution certificates in use`);
for (const c of certs) {
  const a = c.attributes;
  console.error(`  - "${a.displayName}" serial=${a.serialNumber} expires=${a.expirationDate}`);
}

if (certs.length >= maxAllowed) {
  console.error(
    `check-ios-distribution-certs: at or over the configured limit (${maxAllowed}) — xcodebuild's ` +
      'automatic signing may need to revoke an existing certificate (possibly the one EAS Build ' +
      'relies on) to create a new one. Aborting; review certificates in App Store Connect first, ' +
      'or rerun with a higher limit if you\'ve confirmed that\'s safe.'
  );
  process.exit(1);
}
