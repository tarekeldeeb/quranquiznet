import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import en from './locales/en.json';
import ar from './locales/ar.json';

const deviceLang = Localization.getLocales()[0]?.languageCode;
const initialLng: 'ar' | 'en' = deviceLang?.startsWith('ar') ? 'ar' : 'en';

i18next.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: initialLng,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export function changeLanguage(lang: 'ar' | 'en') {
  return i18next.changeLanguage(lang);
}

export default i18next;
