// Single source of truth for color, radius, shadow, and type-scale tokens —
// replaces the ~12 ad-hoc greys and two competing blues (#0d2d4e / #1a5276)
// that used to be re-declared per screen. Palette drawn from the muṣḥaf:
// gilded gold instead of 2013 Flat-UI orange, warm paper instead of blue-grey.
import { useProfileStore } from '../stores/profileStore';

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  navy: string;
  navyDeep: string;
  navySoft: string;
  gold: string;
  goldDeep: string;
  goldPale: string;
  paper: string;
  card: string;
  ink: string;
  inkSoft: string;
  line: string;
  correct: string;
  correctPale: string;
  wrong: string;
  wrongPale: string;
  shadow: string;
}

const LIGHT: ThemeColors = {
  navy: '#0d2d4e',
  navyDeep: '#081e35',
  // Almost every use of navySoft is muted text/icons sitting directly on a
  // colors.navy panel (auth hero, daily hero, map card, onboarding slides) —
  // and navy itself never flips (DARK doesn't override it), so navySoft can't
  // flip either or it goes near-invisible against navy in light mode. Uses
  // DARK's value in the DARK palette below too — deliberately the same
  // constant, not a themed pair.
  navySoft: '#8fb0cf',
  gold: '#c8973a',
  goldDeep: '#8a6410',
  goldPale: '#f3e8d2',
  paper: '#faf6ec',
  card: '#ffffff',
  ink: '#22303c',
  inkSoft: '#5c6b7a',
  line: '#e4dcc9',
  correct: '#2f7d5d',
  correctPale: '#e4f0ea',
  wrong: '#b3473d',
  wrongPale: '#f5e4e2',
  shadow: 'rgba(13,45,78,0.09)',
};

// A memorization app gets used after ʿIshāʾ and before Fajr — night mode is not
// optional. Warm ink on a deep-navy ground, gold brightened one step.
const DARK: ThemeColors = {
  ...LIGHT,
  gold: '#d9ad55',
  goldDeep: '#e3bd6f',
  goldPale: '#2c3f52',
  paper: '#0b1826',
  card: '#13273c',
  ink: '#e9e3d3',
  inkSoft: '#9aa9b8',
  line: '#23405c',
  correct: '#58a57f',
  correctPale: '#17342a',
  wrong: '#d2766c',
  wrongPale: '#3c2320',
  shadow: 'rgba(0,0,0,0.4)',
};

// Radii collapsed from {6,7,8,10,12,14,16,18,20,23,29,30} to four steps.
export const radii = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

// Type scale collapsed from eleven ad-hoc sizes to six.
export const type = { xs: 11, sm: 13, base: 15, lg: 17, xl: 22, xxl: 28 } as const;

export function getTheme(mode: ThemeMode): ThemeColors {
  return mode === 'dark' ? DARK : LIGHT;
}

/** Live theme + tokens, following the user's manual light/dark choice (a
 * device preference in profileStore, defaulting to dark — وضع الليل) rather
 * than the OS color scheme. See Settings for the toggle. */
export function useTheme() {
  const mode = useProfileStore((s) => s.themeMode);
  return { mode, colors: getTheme(mode), radii, type };
}

/**
 * Format a number using Eastern Arabic-Indic digits — the one numeral system
 * used everywhere in the app (scores, counts, leaderboards), replacing the mix
 * of Western digits (`.toLocaleString()`) and hand-typed Arabic-Indic strings.
 */
export function arNum(n: number): string {
  return n.toLocaleString('ar-EG');
}
