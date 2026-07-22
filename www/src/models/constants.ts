// All Quran structural constants — ported from www/_model_/utils.js

import i18n from '../i18n';

// Default display name for an anonymous/guest user who hasn't picked a
// nickname yet. Shared so every surface that shows/compares a guest's name
// (auth handler, me.tsx, the daily-quiz submission) agrees on the same string.
export const DEFAULT_GUEST_NAME = 'زائر(ة)';

// Total word count of q.json (its last _id) and the modQWords wrap boundary.
// An-Nas's final verse lives at _id 77879-77881 — see the data-driven read in
// db/idb.ts, which predates this constant being synced to the shipped DB.
export const QURAN_WORDS = 77881;
export const JUZ2_AVG_WORDS = QURAN_WORDS / 30;
export const ANSWER_LENGTH = 24;

// Daily quiz constants
export const DAILYQUIZ_PARTS_COUNT = 50;
export const DAILYQUIZ_QPERPART_COUNT = 10;
export const DAILYQUIZ_QPERPART_DIST = [0.4, 0.2, 0.83, 0.73, 0.44, 0.98, 0.522, 0.78, 0.33, 0.68];
export const DAILYQUIZ_CHECKEVERY = 20;
export const DAILYQUIZ_CHECKAFTER = 2;
export const DAILYQUIZ_MAXTIME = 10 * (12 + 9 * 5);
// Fast floor (≈1s/question) below which no further speed credit is given. Kept
// low so realistically-fast runs still get a non-zero, *differentiating* speed
// penalty instead of all saturating to 0 and tying at the top of the leaderboard.
export const DAILYQUIZ_MINTIME = 10 * 1;
export const SURAS_SPECIAL_ELIGIBILITY_THRESHOLD = 7;

// Word index where each sura ENDS (exclusive upper bound, 1-indexed) — i.e. the
// first word _id of the NEXT sura in q.json. Derived from the shipped q.json
// (Tanzil uthmani-min tokenization); regenerate if db_maker.py output changes.
// Stale values mis-attribute words near sura boundaries: wrong sura names on
// answer cards and the Madina renderer's sura title revealed mid-basmala.
export const SURA_IDX = [
  30, 6151, 9636, 13387, 16195, 19249, 22573, 23811, 26309, 28146,
  30067, 31848, 32706, 33540, 34199, 36047, 37607, 39190, 40155, 41494,
  42667, 43945, 44999, 46319, 47216, 48538, 49693, 51127, 52107, 52928,
  53478, 53854, 55145, 56032, 56811, 57540, 58405, 59142, 60318, 61541,
  62339, 63203, 64037, 64387, 64879, 65526, 66069, 66633, 66984, 67361,
  67725, 68041, 68405, 68751, 69106, 69489, 70067, 70543, 70992, 71344,
  71569, 71748, 71932, 72177, 72468, 72721, 73058, 73362, 73624, 73845,
  74075, 74364, 74567, 74826, 74994, 75241, 75426, 75603, 75786, 75923,
  76031, 76115, 76288, 76399, 76512, 76577, 76653, 76749, 76890, 76976,
  77034, 77109, 77153, 77184, 77222, 77298, 77332, 77430, 77470, 77514,
  77554, 77586, 77604, 77641, 77668, 77689, 77718, 77732, 77762, 77785,
  77812, 77831, 77858, 77882,
];

export const SURA_NAME = [
  'الفاتحة', 'البقرة', 'آل عمران', 'النساء', 'المائدة', 'الأنعام', 'الأعراف', 'الأنفال',
  'التوبة', 'يونس', 'هود', 'يوسف', 'الرعد', 'إبراهيم', 'الحجر', 'النحل', 'الإسراء',
  'الكهف', 'مريم', 'طه', 'الأنبياء', 'الحج', 'المؤمنون', 'النور', 'الفرقان', 'الشعراء',
  'النمل', 'القصص', 'العنكبوت', 'الروم', 'لقمان', 'السجدة', 'الأحزاب', 'سبأ', 'فاطر',
  'يس', 'الصافات', 'ص', 'الزمر', 'غافر', 'فصلت', 'الشورى', 'الزخرف', 'الدخان',
  'الجاثية', 'الأحقاف', 'محمد', 'الفتح', 'الحجرات', 'ق', 'الذاريات', 'الطور', 'النجم',
  'القمر', 'الرحمن', 'الواقعة', 'الحديد', 'المجادلة', 'الحشر', 'الممتحنة', 'الصف',
  'الجمعة', 'المنافقون', 'التغابن', 'الطلاق', 'التحريم', 'الملك', 'القلم', 'الحاقة',
  'المعارج', 'نوح', 'الجن', 'المزمل', 'المدثر', 'القيامة', 'الإنسان', 'المرسلات',
  'النبأ', 'النازعات', 'عبس', 'التكوير', 'الانفطار', 'المطففين', 'الانشقاق', 'البروج',
  'الطارق', 'الأعلى', 'الغاشية', 'الفجر', 'البلد', 'الشمس', 'الليل', 'الضحى', 'الشرح',
  'التين', 'العلق', 'القدر', 'البينة', 'الزلزلة', 'العاديات', 'القارعة', 'التكاثر',
  'العصر', 'الهمزة', 'الفيل', 'قريش', 'الماعون', 'الكوثر', 'الكافرون', 'النصر',
  'المسد', 'الإخلاص', 'الفلق', 'الناس',
];

// English transliterations, sourced from quran.com's `name_simple` field
// (api.quran.com/api/v4/chapters?language=en) — same order/index as SURA_NAME.
export const SURA_NAME_EN = [
  'Al-Fatihah', 'Al-Baqarah', 'Ali \'Imran', 'An-Nisa', 'Al-Ma\'idah', 'Al-An\'am',
  'Al-A\'raf', 'Al-Anfal', 'At-Tawbah', 'Yunus', 'Hud', 'Yusuf', 'Ar-Ra\'d', 'Ibrahim',
  'Al-Hijr', 'An-Nahl', 'Al-Isra', 'Al-Kahf', 'Maryam', 'Taha', 'Al-Anbya', 'Al-Hajj',
  'Al-Mu\'minun', 'An-Nur', 'Al-Furqan', 'Ash-Shu\'ara', 'An-Naml', 'Al-Qasas',
  'Al-\'Ankabut', 'Ar-Rum', 'Luqman', 'As-Sajdah', 'Al-Ahzab', 'Saba', 'Fatir', 'Ya-Sin',
  'As-Saffat', 'Sad', 'Az-Zumar', 'Ghafir', 'Fussilat', 'Ash-Shuraa', 'Az-Zukhruf',
  'Ad-Dukhan', 'Al-Jathiyah', 'Al-Ahqaf', 'Muhammad', 'Al-Fath', 'Al-Hujurat', 'Qaf',
  'Adh-Dhariyat', 'At-Tur', 'An-Najm', 'Al-Qamar', 'Ar-Rahman', 'Al-Waqi\'ah',
  'Al-Hadid', 'Al-Mujadila', 'Al-Hashr', 'Al-Mumtahanah', 'As-Saf', 'Al-Jumu\'ah',
  'Al-Munafiqun', 'At-Taghabun', 'At-Talaq', 'At-Tahrim', 'Al-Mulk', 'Al-Qalam',
  'Al-Haqqah', 'Al-Ma\'arij', 'Nuh', 'Al-Jinn', 'Al-Muzzammil', 'Al-Muddaththir',
  'Al-Qiyamah', 'Al-Insan', 'Al-Mursalat', 'An-Naba', 'An-Nazi\'at', '\'Abasa',
  'At-Takwir', 'Al-Infitar', 'Al-Mutaffifin', 'Al-Inshiqaq', 'Al-Buruj', 'At-Tariq',
  'Al-A\'la', 'Al-Ghashiyah', 'Al-Fajr', 'Al-Balad', 'Ash-Shams', 'Al-Layl', 'Ad-Duhaa',
  'Ash-Sharh', 'At-Tin', 'Al-\'Alaq', 'Al-Qadr', 'Al-Bayyinah', 'Az-Zalzalah',
  'Al-\'Adiyat', 'Al-Qari\'ah', 'At-Takathur', 'Al-\'Asr', 'Al-Humazah', 'Al-Fil',
  'Quraysh', 'Al-Ma\'un', 'Al-Kawthar', 'Al-Kafirun', 'An-Nasr', 'Al-Masad',
  'Al-Ikhlas', 'Al-Falaq', 'An-Nas',
];

export const SURA_AYAS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110,
  98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88,
  75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24,
  13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42,
  29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3,
  9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];

export const SURA_MAKKI = [
  1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1,
  1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 0, 1,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1,
];

// pageSuraStart[sura_idx] => 0-based page index where that sura starts
const PAGE_SURA_START = [
  1, 2, 50, 77, 106, 128, 151, 177, 187, 208, 221, 235, 249, 255, 262, 267, 282, 293,
  305, 312, 322, 332, 342, 350, 359, 367, 377, 385, 396, 404, 411, 415, 418, 428, 434,
  440, 446, 453, 458, 467, 477, 483, 489, 496, 499, 502, 507, 511, 515, 518, 520, 523,
  526, 528, 531, 534, 537, 542, 545, 549, 551, 553, 554, 556, 558, 560, 562, 564, 566,
  568, 570, 572, 574, 575, 577, 578, 580, 582, 583, 585, 586, 587, 587, 589, 590, 591,
  591, 592, 593, 594, 595, 595, 596, 596, 597, 597, 598, 598, 599, 599, 600, 600, 601,
  601, 601, 602, 602, 602, 603, 603, 603, 604, 604, 604,
];

// pageAyaStart[page_idx] => aya number that starts on that page (within its sura)
const PAGE_AYA_START = [
  1, 1, 6, 17, 25, 30, 38, 49, 58, 62, 70, 77, 84, 89, 94, 102, 106, 113, 120, 127,
  135, 142, 146, 154, 164, 170, 177, 182, 187, 191, 197, 203, 211, 216, 220, 225, 231,
  234, 238, 246, 249, 253, 257, 260, 265, 270, 275, 282, 283, 1, 10, 16, 23, 30, 38, 46,
  53, 62, 71, 78, 84, 92, 101, 109, 116, 122, 133, 141, 149, 154, 158, 166, 174, 181,
  187, 195, 1, 7, 12, 15, 20, 24, 27, 34, 38, 45, 52, 60, 66, 75, 80, 87, 92, 95, 102,
  106, 114, 122, 128, 135, 141, 148, 155, 163, 171, 176, 3, 6, 10, 14, 18, 24, 31, 37,
  42, 46, 51, 58, 65, 71, 77, 83, 90, 96, 104, 109, 114, 1, 9, 19, 28, 36, 45, 53, 60,
  69, 74, 82, 91, 95, 102, 111, 119, 125, 132, 138, 143, 147, 152, 158, 1, 12, 23, 31,
  38, 44, 52, 58, 68, 74, 82, 88, 96, 105, 121, 131, 138, 144, 150, 156, 160, 164, 171,
  179, 188, 196, 1, 11, 25, 36, 45, 58, 73, 82, 91, 102, 1, 6, 16, 24, 31, 39, 47, 56,
  65, 73, 1, 18, 28, 43, 60, 75, 90, 105, 1, 11, 21, 28, 32, 37, 44, 54, 59, 62, 3, 12,
  21, 33, 44, 56, 68, 1, 20, 40, 61, 84, 112, 137, 160, 184, 207, 1, 14, 23, 36, 45, 56,
  64, 77, 89, 6, 14, 22, 29, 36, 44, 51, 60, 71, 78, 85, 7, 15, 24, 31, 39, 46, 53, 64,
  6, 16, 25, 33, 42, 51, 1, 12, 20, 29, 1, 12, 21, 1, 7, 16, 23, 31, 36, 44, 51, 55,
  63, 1, 8, 15, 23, 32, 40, 49, 4, 12, 19, 31, 39, 45, 13, 28, 41, 55, 71, 1, 25, 52,
  77, 103, 127, 154, 1, 17, 27, 43, 62, 84, 6, 11, 22, 32, 41, 48, 57, 68, 75, 8, 17,
  26, 34, 41, 50, 59, 67, 78, 1, 12, 21, 30, 39, 47, 1, 11, 16, 23, 32, 45, 52, 11, 23,
  34, 48, 61, 74, 1, 19, 40, 1, 14, 23, 33, 6, 15, 21, 29, 1, 12, 20, 30, 1, 10, 16, 24,
  29, 5, 12, 1, 16, 36, 7, 31, 52, 15, 32, 1, 27, 45, 7, 28, 50, 17, 41, 68, 17, 51, 77,
  4, 12, 19, 25, 1, 7, 12, 22, 4, 10, 17, 1, 6, 12, 6, 1, 9, 5, 1, 10, 1, 6, 1, 8, 1,
  13, 27, 16, 43, 9, 35, 11, 40, 11, 1, 14, 1, 20, 18, 48, 20, 6, 26, 20, 1, 31, 16, 1,
  1, 1, 7, 35, 1, 1, 16, 1, 24, 1, 15, 1, 1, 8, 10, 1, 1, 1, 1,
];

export const LAST5_JUZ_NAME = ['الأحقاف', 'الذاريات', 'قد سمع', 'تبارك', 'عم'];
// English names for the same 5 traditional juz titles (Juz 26-30). The first
// two are shared with sura names (Al-Ahqaf, Adh-Dhariyat); the last three are
// juz-only traditional titles, not sura names.
export const LAST5_JUZ_NAME_EN = ['Al-Ahqaf', 'Adh-Dhariyat', 'Qad Sami\'a', 'Tabaraka', '\'Amma'];
// Exclusive upper bounds like SURA_IDX, so the final entry is SURA_IDX[113]
// (one past the last word) — QURAN_WORDS here would drop the last word.
export const LAST5_JUZ_IDX = [
  SURA_IDX[44], SURA_IDX[49], SURA_IDX[56], SURA_IDX[65], SURA_IDX[76], SURA_IDX[113],
];

// Relative weight of each study part vs an average juz
export const PART_WEIGHT_100 = [
  1, 236, 134, 145, 108, 118, 128, 48, 96, 71, 74, 69, 33, 32, 25, 71, 60, 61, 37, 52,
  45, 49, 41, 51, 35, 51, 44, 55, 38, 32, 21, 14, 50, 34, 30, 28, 33, 28, 45, 47, 31,
  33, 32, 13, 19, 96, 104, 102, 104, 95,
];

// --- Helper functions (pure, no framework deps) ---

export function getSuraIdx(wordIdx: number): number {
  for (let i = 0; i < 113; i++) {
    if (wordIdx < SURA_IDX[i]) return i;
  }
  return 113;
}

export function modQWords(n: number): number {
  return n > QURAN_WORDS ? n - QURAN_WORDS : n;
}

export function getSuraTanzil(wordIdx: number): string {
  return SURA_MAKKI[getSuraIdx(wordIdx)] === 1 ? i18n.t('quizCard.meccan') : i18n.t('quizCard.medinan');
}

/** Sura name (bare, no "Surah"/"سورة" prefix) in the current app language. */
export function suraNameLocalized(suraIdx: number): string {
  return i18n.language === 'en' ? SURA_NAME_EN[suraIdx] : SURA_NAME[suraIdx];
}

const SURA_PREFIX = 'سورة ';
const JUZ_PREFIX = 'جزء ';

/**
 * Display-only translation for a study part's stored name (e.g. "سورة البقرة"
 * or "جزء عم"). The stored `part.name` itself must stay the raw Arabic string
 * unchanged — it's persisted and used for equality comparisons — so this is
 * applied only at render sites, never where `part.name` is compared.
 */
export function translatePartName(name: string): string {
  if (i18n.language !== 'en') return name;
  if (name.startsWith(SURA_PREFIX)) {
    const arName = name.slice(SURA_PREFIX.length);
    const idx = SURA_NAME.indexOf(arName);
    if (idx !== -1) return i18n.t('quizCard.answerOption.sura', { name: SURA_NAME_EN[idx] });
  } else if (name.startsWith(JUZ_PREFIX)) {
    const arName = name.slice(JUZ_PREFIX.length);
    const idx = LAST5_JUZ_NAME.indexOf(arName);
    if (idx !== -1) return i18n.t('common.juzPart', { name: LAST5_JUZ_NAME_EN[idx] });
  }
  return name;
}

export function formattedAyaMark(ayaNum: number): string {
  return ` ﴿${ayaNum}﴾`;
}

export function getPageFromSuraAyah(sura: number, aya: number): number {
  let start = PAGE_SURA_START[sura];
  if (start < 604) {
    while (
      PAGE_AYA_START[start] < PAGE_AYA_START[start + 1] &&
      aya >= PAGE_AYA_START[start + 1]
    ) {
      start++;
    }
  }
  return start + 1;
}

export function getPageURLFromPageNumber(page: number): string {
  const pad = String(page).padStart(3, '0');
  return `https://cdn.rawgit.com/tarekeldeeb/madina_images/w1024/w1024_page${pad}.png`;
}

export function getPageURLFromSuraAyah(sura: number, aya: number): string {
  return getPageURLFromPageNumber(getPageFromSuraAyah(sura, aya));
}

export function randperm(n: number): number[] {
  const o = Array.from({ length: n }, (_, i) => i);
  for (let i = o.length; i > 0; ) {
    const j = Math.floor(Math.random() * i);
    i--;
    [o[i], o[j]] = [o[j], o[i]];
  }
  return o;
}

export function shuffleByPerm<T>(arr: T[], perm: number[]): T[] {
  return perm.map((p) => arr[p]);
}

export function deepCopy<T>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}

export function countedScore(arr: number[]): number {
  if (!arr || arr.length <= 3) return 0;
  // Levels 1–3 plus the beginner slot (index 4, may be absent in old profiles).
  return arr[1] + arr[2] + arr[3] + (arr[4] ?? 0);
}

export function removeAyaNum(text: string): string {
  return text.replace(/﴿[0-9]+﴾/g, '۝');
}

/** 2-letter ISO country code → flag emoji, via regional indicator symbols. */
export function flagEmoji(code?: string): string {
  if (!code || code.length < 2) return '';
  const pts = [...code.toUpperCase().slice(0, 2)].map((c) => 0x1F1E6 - 65 + c.charCodeAt(0));
  return String.fromCodePoint(...pts);
}
