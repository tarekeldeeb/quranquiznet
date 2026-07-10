// Extracts the bundled quran-madina-html assets (assets/quran-madina.zip — see
// scripts/sync-madina-assets.mjs, which zips the very same tree
// public/quran-madina/ ships to the web build) into local storage once per
// pinned "quran-madina-html" version, so QuranText.native.tsx's WebView can
// load the library's JS/CSS/DB/font from local disk with the exact dist/ +
// assets/ layout it expects. No-op on web — QuranText.web.tsx fetches straight
// from public/quran-madina/ instead.
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { unzipSync, strFromU8 } from 'fflate';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../../package.json') as { dependencies: Record<string, string> };

const BASE_DIR = `${FileSystem.documentDirectory}quran-madina/`;
const VERSION_FILE = `${BASE_DIR}VERSION`;
// Same string scripts/sync-madina-assets.mjs writes as the zip's own VERSION
// entry — reading it from package.json here too means there is nothing to
// keep in sync by hand; re-running `npm run sync:madina` after a version bump
// is enough to invalidate any previously-extracted copy on next app launch.
const EXPECTED_VERSION = pkg.dependencies['quran-madina-html'];

// Only the font is real binary; the JS/CSS/JSON/SVG entries are all UTF-8 text.
const BINARY_ENTRY = /\.woff2?$/;

function base64FromBytes(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += chars[b0 >> 2];
    out += chars[((b0 & 0x3) << 4) | (b1 === undefined ? 0 : b1 >> 4)];
    out += b1 === undefined ? '=' : chars[((b1 & 0xf) << 2) | (b2 === undefined ? 0 : b2 >> 6)];
    out += b2 === undefined ? '=' : chars[b2 & 0x3f];
  }
  return out;
}

async function alreadyExtracted(): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(VERSION_FILE);
  if (!info.exists) return false;
  const onDisk = await FileSystem.readAsStringAsync(VERSION_FILE);
  return onDisk === EXPECTED_VERSION;
}

// Downloads + unzips once, writing every entry under BASE_DIR. Throws if the
// download was corrupt or incomplete — detected by checking the zip's own
// embedded VERSION entry (see scripts/sync-madina-assets.mjs) matches what we
// expect, rather than trusting entry count/size, since either could shrink
// for a legitimate reason on a future version bump. Observed once during
// development (a stale/partial response landed only the 24px anchor DB,
// silently breaking font-size interpolation) with an unclear root cause —
// this makes that failure mode loud and retryable instead of quietly leaving
// a half-extracted copy that then passes the VERSION_FILE check forever.
async function downloadAndUnzip(): Promise<Record<string, Uint8Array>> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const zipAsset = Asset.fromModule(require('../../assets/quran-madina.zip'));
  await zipAsset.downloadAsync();
  const res = await fetch(zipAsset.localUri ?? zipAsset.uri);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const files = unzipSync(bytes);
  const zipVersion = files.VERSION ? strFromU8(files.VERSION) : null;
  if (zipVersion !== EXPECTED_VERSION) {
    throw new Error(
      `quran-madina.zip content mismatch: expected VERSION "${EXPECTED_VERSION}", got "${zipVersion}" (${Object.keys(files).length} entries)`,
    );
  }
  return files;
}

async function writeAll(files: Record<string, Uint8Array>): Promise<void> {
  for (const [relPath, contents] of Object.entries(files)) {
    if (relPath === 'VERSION') continue; // written last, once everything else lands
    const dest = BASE_DIR + relPath;
    await FileSystem.makeDirectoryAsync(dest.slice(0, dest.lastIndexOf('/')), { intermediates: true });
    if (BINARY_ENTRY.test(relPath)) {
      await FileSystem.writeAsStringAsync(dest, base64FromBytes(contents), { encoding: 'base64' });
    } else {
      await FileSystem.writeAsStringAsync(dest, strFromU8(contents));
    }
  }
  // Marks extraction complete — written last so a crash/kill mid-extraction
  // is retried (not mistaken for a valid, up-to-date copy) on next launch.
  await FileSystem.writeAsStringAsync(VERSION_FILE, EXPECTED_VERSION);
}

async function extract(): Promise<void> {
  if (await alreadyExtracted()) return;
  try {
    const files = await downloadAndUnzip();
    await writeAll(files);
  } catch (err) {
    // One retry — the one real failure seen here so far self-resolved on a
    // second attempt (see the comment on downloadAndUnzip). Rendering the
    // Quran text on native is an enhancement over the plain-text fallback,
    // not something app startup should ever hang on, so a second failure
    // is swallowed rather than rethrown — see initMadinaAssets.
    console.error('[madinaAssets] extraction failed, retrying once', err);
    const files = await downloadAndUnzip();
    await writeAll(files);
  }
}

let readyPromise: Promise<void> | null = null;

export function initMadinaAssets(): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  if (!readyPromise) {
    // Never reject: app/_layout.tsx gates its splash screen on this resolving,
    // so a persistent failure here must degrade to a missing/broken Quran
    // render for the session, not an app that's stuck on the splash forever.
    readyPromise = extract().catch((err) => {
      console.error('[madinaAssets] extraction failed after retry, continuing without it', err);
    });
  }
  return readyPromise;
}

// Safe to call once the initMadinaAssets() promise has resolved.
export function getMadinaBaseUri(): string {
  return BASE_DIR;
}
