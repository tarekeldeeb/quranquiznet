// Copies the quran-madina-html assets QuranText.web.tsx actually uses (font
// "Hafs" @ 24px — see that file) from node_modules into public/quran-madina/,
// so `expo export` ships them same-origin and the web build works fully
// offline (no runtime fetch to unpkg). Re-run after bumping the pinned
// "quran-madina-html" version in package.json, and add files here if
// QuranText.web.tsx ever renders a different font/size.
//
// Includes both the manifest.json + per-juz split (assets/db/Madina05-Hafs-24px/)
// the library prefers — lazy-loads only the juz a question touches — and the
// monolithic assets/db/Madina05-Hafs-24px.json it falls back to if the manifest
// is missing. Without the split dir, every question would 404 the manifest
// fetch before falling back to downloading the whole (~1.8MB) monolithic file.
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = join(root, 'node_modules', 'quran-madina-html');
const dest = join(root, 'public', 'quran-madina');

const FILES = [
  'dist/quran-madina-html.min.js',
  'dist/quran-madina-html.min.css',
  'assets/db/Madina05-Hafs-24px.json',
  'assets/fonts/Hafs.woff2',
  'assets/img/sura_border_sym4.svg',
  ...readdirSync(join(src, 'assets/db/Madina05-Hafs-24px')).map(
    (f) => `assets/db/Madina05-Hafs-24px/${f}`
  ),
];

for (const rel of FILES) {
  const from = join(src, rel);
  const to = join(dest, rel);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  console.log(`copied ${rel}`);
}
