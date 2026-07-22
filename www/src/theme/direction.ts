import { useProfileStore } from '../stores/profileStore';

export const isRTLLang = (lang: 'ar' | 'en'): boolean => lang === 'ar';
export const rowDir = (isRTL: boolean): 'row-reverse' | 'row' => (isRTL ? 'row-reverse' : 'row');
export const alignDir = (isRTL: boolean): 'right' | 'left' => (isRTL ? 'right' : 'left');
export const writingDir = (isRTL: boolean): 'rtl' | 'ltr' => (isRTL ? 'rtl' : 'ltr');

export function mirror<T>(isRTL: boolean, ltrValue: T, rtlValue: T): T {
  return isRTL ? rtlValue : ltrValue;
}

export function useDirection() {
  const language = useProfileStore((s) => s.language);
  return { language, isRTL: isRTLLang(language) };
}
