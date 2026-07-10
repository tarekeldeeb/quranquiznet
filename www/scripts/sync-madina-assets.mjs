// Copies the quran-madina-html assets QuranText renderers actually use from
// node_modules into public/quran-madina/, so `expo export` ships them
// same-origin and the web build works fully offline (no runtime fetch to
// unpkg). Re-run after bumping the pinned "quran-madina-html" version in
// package.json, and add files here if the app ever renders a different
// font/size.
//
// Bundles TWO font sizes — 16px and 24px — for the "Hafs" font: the library
// (>= 0.10) linearly interpolates its layout between whichever two sizes it
// has DBs for, so shipping both lets src/models/madinaWidth.ts pick any font
// size in between to fit the actual card width (narrow phones need less than
// the old fixed 24px) instead of being locked to one size. See that file for
// the width math, which reads its anchor constants from these same two
// manifests.
//
// For each size, includes both the manifest.json + per-juz split
// (assets/db/Madina05-Hafs-<size>px/) the library prefers — lazy-loads only
// the juz a question touches — and the monolithic assets/db/Madina05-Hafs-<size>px.json
// it falls back to if the manifest is missing. Without the split dir, every
// question would 404 the manifest fetch before falling back to downloading
// the whole (~1.8MB) monolithic file.
//
// Also zips the same tree into assets/quran-madina.zip — the bundle
// src/services/madinaAssets.ts extracts on first run so QuranText.native.tsx's
// WebView can load it from local disk (same reasoning as the web copy: fully
// offline, no upstream-publish surprises).
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync, strToU8 } from 'fflate';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = join(root, 'node_modules', 'quran-madina-html');
const dest = join(root, 'public', 'quran-madina');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const FONT_SIZES = [16, 24];

const FILES = [
  'dist/quran-madina-html.min.js',
  'dist/quran-madina-html.min.css',
  'assets/fonts/Hafs.woff2',
  'assets/img/sura_border_sym4.svg',
  ...FONT_SIZES.flatMap((size) => [
    `assets/db/Madina05-Hafs-${size}px.json`,
    ...readdirSync(join(src, `assets/db/Madina05-Hafs-${size}px`)).map(
      (f) => `assets/db/Madina05-Hafs-${size}px/${f}`
    ),
  ]),
];

for (const rel of FILES) {
  const from = join(src, rel);
  const to = join(dest, rel);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  console.log(`copied ${rel}`);
}

// Zip the same tree that was just copied into public/quran-madina/ (walking it
// back, rather than FILES again, keeps the zip's contents provably identical
// to what the web build ships).
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const zipInput = {};
for (const abs of walk(dest)) {
  zipInput[relative(dest, abs).split('\\').join('/')] = readFileSync(abs);
}
// Cache-invalidation key for src/services/madinaAssets.ts — bump by re-running
// this script whenever the pinned "quran-madina-html" version changes.
zipInput['VERSION'] = strToU8(pkg.dependencies['quran-madina-html']);

const zipped = zipSync(zipInput, { level: 6 });
const zipPath = join(root, 'assets', 'quran-madina.zip');
writeFileSync(zipPath, zipped);
console.log(`wrote ${relative(root, zipPath)} (${(statSync(zipPath).size / 1024).toFixed(0)} KB, ${Object.keys(zipInput).length} entries)`);
