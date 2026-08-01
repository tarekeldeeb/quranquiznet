// Single source of truth for supported UI languages — direction, native labels,
// and number-formatting locale tags. Every other module (i18n init, profileStore,
// direction helpers, tokens, LanguagePicker) reads off this file instead of
// hardcoding its own 'ar' | 'en'-shaped union, so RTL/LTR and locale-tag logic
// can't drift out of sync between files.

export const SUPPORTED_LANGUAGES = [
  'ar', 'en', 'ms', 'bn', 'tr', 'ur', 'pa', 'fa', 'ha', 'jv', 'ps', 'fr', 'es', 'id', 'zh', 'sw',
] as const;

export type Language = typeof SUPPORTED_LANGUAGES[number];

interface LanguageMeta {
  /** Label in the language's own script, for the language picker. */
  nativeLabel: string;
  isRTL: boolean;
  /** BCP-47 tag passed to Number.prototype.toLocaleString for native digit formatting. */
  numberTag: string;
}

export const LANGUAGE_META: Record<Language, LanguageMeta> = {
  ar: { nativeLabel: 'العربية',        isRTL: true,  numberTag: 'ar-EG' },
  en: { nativeLabel: 'English',        isRTL: false, numberTag: 'en-US' },
  ms: { nativeLabel: 'Bahasa Melayu',  isRTL: false, numberTag: 'ms-MY' },
  bn: { nativeLabel: 'বাংলা',          isRTL: false, numberTag: 'bn-BD' },
  tr: { nativeLabel: 'Türkçe',         isRTL: false, numberTag: 'tr-TR' },
  // Shahmukhi (Perso-Arabic script) Punjabi — RTL, shares the Urdu/Farsi/Pashto
  // glyph range, per explicit product decision (2026-07-31).
  ur: { nativeLabel: 'اردو',           isRTL: true,  numberTag: 'ur-PK' },
  pa: { nativeLabel: 'پنجابی',         isRTL: true,  numberTag: 'pa-PK' },
  fa: { nativeLabel: 'فارسی',          isRTL: true,  numberTag: 'fa-IR' },
  ha: { nativeLabel: 'Hausa',          isRTL: false, numberTag: 'ha-NG' },
  jv: { nativeLabel: 'Basa Jawa',      isRTL: false, numberTag: 'jv-ID' },
  ps: { nativeLabel: 'پښتو',           isRTL: true,  numberTag: 'ps-AF' },
  fr: { nativeLabel: 'Français',       isRTL: false, numberTag: 'fr-FR' },
  es: { nativeLabel: 'Español',        isRTL: false, numberTag: 'es-ES' },
  id: { nativeLabel: 'Bahasa Indonesia', isRTL: false, numberTag: 'id-ID' },
  // Simplified Chinese — mainland China (incl. the Hui Muslim community),
  // Singapore, Malaysia. Needs a dedicated CJK font (see NotoSansSC in
  // app/_layout.tsx); PlexArabic has zero CJK glyph coverage.
  zh: { nativeLabel: '简体中文',         isRTL: false, numberTag: 'zh-CN' },
  sw: { nativeLabel: 'Kiswahili',       isRTL: false, numberTag: 'sw-TZ' },
};

export function isSupportedLanguage(x: string): x is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(x);
}

/** Matches a device locale's language code against the supported set, falling back to English. */
export function resolveDeviceLanguage(deviceCode: string | undefined | null): Language {
  if (deviceCode && isSupportedLanguage(deviceCode)) return deviceCode;
  return 'en';
}
