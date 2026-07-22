import i18next, { type FormatterModule } from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import en from './locales/en.json';
import ar from './locales/ar.json';

const deviceLang = Localization.getLocales()[0]?.languageCode;
const initialLng: 'ar' | 'en' = deviceLang?.startsWith('ar') ? 'ar' : 'en';

// A plural key's {{count}} must stay a raw number for Intl.PluralRules
// category selection (not a pre-formatted string like localeNum() produces),
// so it needs Arabic-Indic digit formatting applied on the way out instead.
// i18next's own built-in Formatter short-circuits to the raw value whenever no
// explicit `{{value, someFormat}}` name is given (see node_modules/i18next's
// Formatter.format: `if (!format) return value`), so passing a plain
// interpolation.format function doesn't work — it gets overwritten by the
// built-in Formatter service during init anyway. Replacing the whole
// formatter module via `.use()` is the one hook that actually runs for every
// interpolation when combined with `alwaysFormat: true` below. Verified
// end-to-end (plural-category selection + digit formatting + string
// interpolation untouched) before relying on this.
const localeAwareFormatter: FormatterModule = {
  type: 'formatter',
  init: () => {},
  add: () => {},
  addCached: () => {},
  format: (value: unknown, _format, lng) =>
    (typeof value === 'number'
      ? value.toLocaleString(lng === 'ar' ? 'ar-EG' : 'en-US')
      : String(value)),
};

i18next.use(localeAwareFormatter).use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: initialLng,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
    // Without this, format() only runs for placeholders using explicit
    // format syntax ({{value, someFormat}}) — it needs to run for every
    // {{count}} etc. so numbers always get locale-aware digits.
    alwaysFormat: true,
  },
});

export function changeLanguage(lang: 'ar' | 'en') {
  return i18next.changeLanguage(lang);
}

export default i18next;
