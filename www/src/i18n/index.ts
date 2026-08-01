import i18next, { type FormatterModule } from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import { LANGUAGE_META, resolveDeviceLanguage, type Language } from './languages';
import ar from './locales/ar.json';
import en from './locales/en.json';
import ms from './locales/ms.json';
import bn from './locales/bn.json';
import tr from './locales/tr.json';
import ur from './locales/ur.json';
import pa from './locales/pa.json';
import fa from './locales/fa.json';
import ha from './locales/ha.json';
import jv from './locales/jv.json';
import ps from './locales/ps.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import id from './locales/id.json';

const deviceLang = Localization.getLocales()[0]?.languageCode;
const initialLng: Language = resolveDeviceLanguage(deviceLang);

// A plural key's {{count}} must stay a raw number for Intl.PluralRules
// category selection (not a pre-formatted string like localeNum() produces),
// so it needs locale-aware digit formatting applied on the way out instead.
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
      ? value.toLocaleString(LANGUAGE_META[lng as Language]?.numberTag ?? 'en-US')
      : String(value)),
};

i18next.use(localeAwareFormatter).use(initReactI18next).init({
  resources: {
    ar: { translation: ar },
    en: { translation: en },
    ms: { translation: ms },
    bn: { translation: bn },
    tr: { translation: tr },
    ur: { translation: ur },
    pa: { translation: pa },
    fa: { translation: fa },
    ha: { translation: ha },
    jv: { translation: jv },
    ps: { translation: ps },
    fr: { translation: fr },
    es: { translation: es },
    id: { translation: id },
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

export function changeLanguage(lang: Language) {
  return i18next.changeLanguage(lang);
}

export default i18next;
