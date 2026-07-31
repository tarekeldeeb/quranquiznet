// Bumps expo.version (semver) plus each platform's build counter —
// expo.ios.buildNumber and expo.android.versionCode — in app.json, and
// mirrors the semver into package.json's "version" field.
//
// iOS buildNumber and Android versionCode are bumped by 1 independently on
// every release regardless of which semver component changes: they're
// separate per-store submission counters (already diverged, e.g. 9 vs 15
// from past releases), not tied to the marketing version.
//
// Called by scripts/release.sh; also usable standalone:
//   node scripts/bump-version.mjs major|minor|patch
//   node scripts/bump-version.mjs version X.Y.Z
//
// Prints KEY=VALUE lines on stdout (meant to be `eval`'d by the caller) and
// a human-readable summary on stderr.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const appJsonPath = join(root, 'app.json');
const pkgJsonPath = join(root, 'package.json');

function fail(msg) {
  console.error(`bump-version: ${msg}`);
  process.exit(1);
}

const mode = process.argv[2];
const explicitVersion = process.argv[3];

if (!['major', 'minor', 'patch', 'version'].includes(mode)) {
  fail(`unknown mode "${mode ?? ''}" — expected one of: major, minor, patch, version X.Y.Z`);
}
if (mode === 'version' && !explicitVersion) {
  fail('mode "version" requires an explicit X.Y.Z argument');
}

const appJson = JSON.parse(readFileSync(appJsonPath, 'utf8'));
const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));

const currentVersion = appJson.expo.version;
const versionMatch = /^(\d+)\.(\d+)\.(\d+)$/.exec(currentVersion);
if (!versionMatch) fail(`app.json expo.version "${currentVersion}" is not a plain X.Y.Z semver`);
const major = Number(versionMatch[1]);
const minor = Number(versionMatch[2]);
const patch = Number(versionMatch[3]);

let newVersion;
if (mode === 'version') {
  if (!/^\d+\.\d+\.\d+$/.test(explicitVersion)) fail(`"${explicitVersion}" is not a plain X.Y.Z semver`);
  newVersion = explicitVersion;
} else if (mode === 'major') {
  newVersion = `${major + 1}.0.0`;
} else if (mode === 'minor') {
  newVersion = `${major}.${minor + 1}.0`;
} else {
  newVersion = `${major}.${minor}.${patch + 1}`;
}

const currentIosBuild = Number(appJson.expo.ios.buildNumber);
if (!Number.isFinite(currentIosBuild)) fail(`app.json expo.ios.buildNumber "${appJson.expo.ios.buildNumber}" is not numeric`);
const newIosBuild = currentIosBuild + 1;

const currentAndroidVersionCode = appJson.expo.android.versionCode;
if (!Number.isInteger(currentAndroidVersionCode)) fail('app.json expo.android.versionCode is not an integer');
const newAndroidVersionCode = currentAndroidVersionCode + 1;

appJson.expo.version = newVersion;
appJson.expo.ios.buildNumber = String(newIosBuild);
appJson.expo.android.versionCode = newAndroidVersionCode;
pkgJson.version = newVersion;

writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');
writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n');

console.error(
  `Bumped ${currentVersion} -> ${newVersion} ` +
    `(iOS buildNumber ${currentIosBuild} -> ${newIosBuild}, ` +
    `Android versionCode ${currentAndroidVersionCode} -> ${newAndroidVersionCode})`
);
console.log(`RELEASE_VERSION=${newVersion}`);
console.log(`RELEASE_IOS_BUILD=${newIosBuild}`);
console.log(`RELEASE_ANDROID_VERSION_CODE=${newAndroidVersionCode}`);
