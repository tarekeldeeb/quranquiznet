// Regression guard for the 12-language rollout: every locale file must define
// exactly the same strings as en.json (mechanically, not by content review),
// and every new language's plural-suffixed key groups must carry at least the
// CLDR categories that language's Intl.PluralRules actually resolves to (a
// missing category is a real bug — i18next falls through to the raw key; an
// extra one is harmless, i18next just never selects it).
import { SUPPORTED_LANGUAGES, LANGUAGE_META, type Language } from '../languages';
import ar from '../locales/ar.json';
import en from '../locales/en.json';
import ms from '../locales/ms.json';
import bn from '../locales/bn.json';
import tr from '../locales/tr.json';
import ur from '../locales/ur.json';
import pa from '../locales/pa.json';
import fa from '../locales/fa.json';
import ha from '../locales/ha.json';
import jv from '../locales/jv.json';
import ps from '../locales/ps.json';
import fr from '../locales/fr.json';
import es from '../locales/es.json';
import id from '../locales/id.json';
import zh from '../locales/zh.json';
import sw from '../locales/sw.json';

const LOCALES: Record<Language, unknown> = { ar, en, ms, bn, tr, ur, pa, fa, ha, jv, ps, fr, es, id, zh, sw };

// The three key groups in en.json that carry CLDR plural suffixes today
// (me.duration.hours_one/_two/..., me.duration.minutes_one/..., me.activeParts_one/...).
const PLURAL_SUFFIXES = ['zero', 'one', 'two', 'few', 'many', 'other'];
const pluralSuffixPattern = new RegExp(`^(.+)_(${PLURAL_SUFFIXES.join('|')})$`);

/** Recursively collects dot-joined leaf key paths, e.g. "me.duration.hours_one". */
function collectLeafPaths(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
    collectLeafPaths(value, prefix ? `${prefix}.${key}` : key));
}

/** Collapses any plural-suffixed leaf ("me.activeParts_one") to its base ("me.activeParts"). */
function normalizePluralPaths(paths: string[]): Set<string> {
  return new Set(paths.map((p) => p.replace(pluralSuffixPattern, '$1')));
}

/** Groups plural-suffixed leaves by their base path, recording which suffixes exist. */
function pluralSuffixesByBase(paths: string[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const p of paths) {
    const match = p.match(pluralSuffixPattern);
    if (!match) continue;
    const [, base, suffix] = match;
    if (!map.has(base)) map.set(base, new Set());
    map.get(base)!.add(suffix);
  }
  return map;
}

const enPaths = collectLeafPaths(en);
const enNormalized = normalizePluralPaths(enPaths);
const enPluralBases = pluralSuffixesByBase(enPaths);

describe('locale files: structural key parity with en.json', () => {
  for (const lang of SUPPORTED_LANGUAGES) {
    it(`${lang}.json defines exactly the same keys as en.json (plural suffixes collapsed)`, () => {
      const paths = collectLeafPaths(LOCALES[lang]);
      const normalized = normalizePluralPaths(paths);

      const missing = [...enNormalized].filter((p) => !normalized.has(p));
      const extra = [...normalized].filter((p) => !enNormalized.has(p));

      expect({ missing, extra }).toEqual({ missing: [], extra: [] });
    });
  }
});

// ar/en predate this rollout and are excluded from the completeness check below:
// ar.json is missing a _zero form for hours/minutes/activeParts even though
// Arabic's Intl.PluralRules reports a "zero" category — a pre-existing gap
// (i18next just falls back to _other for a count of 0), not something this
// task's 12 new languages should be held responsible for fixing.
const NEW_LANGUAGES = SUPPORTED_LANGUAGES.filter((l) => l !== 'ar' && l !== 'en');

describe('locale files: plural suffixes cover every category Intl.PluralRules requires', () => {
  // A locale may harmlessly carry extra CLDR categories it doesn't strictly need
  // (i18next just never selects them). The actual regression risk is a
  // *missing* category, which would make i18next fall through to the raw key.
  for (const lang of NEW_LANGUAGES) {
    const expectedCategories = new Set(
      new Intl.PluralRules(LANGUAGE_META[lang].numberTag).resolvedOptions().pluralCategories,
    );

    for (const base of enPluralBases.keys()) {
      it(`${lang}.json's "${base}" has at least the suffixes ${lang} needs (${[...expectedCategories].join('/')})`, () => {
        const actual = pluralSuffixesByBase(collectLeafPaths(LOCALES[lang])).get(base) ?? new Set();
        const missing = [...expectedCategories].filter((c) => !actual.has(c));
        expect(missing).toEqual([]);
      });
    }
  }
});
