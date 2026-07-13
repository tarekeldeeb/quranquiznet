// WCAG contrast-ratio guardrails for every text/icon-on-background pairing
// actually used in the app. This is the test that would have caught every
// low-contrast bug found by hand this session: navySoft text on a navy
// panel in light mode, colors.navy text left un-flipped on paper/card in
// dark mode, goldDeep/correct/wrong falling just under 4.5:1 against their
// own *Pale backgrounds, and fixed (non-themed) brand pairs like the Google
// sign-in button's text going pale-on-white in the wrong palette.
//
// A pair belongs here if it's a real usage found in the app, not a
// hypothetical combination — e.g. `navy` text is deliberately never paired
// with `goldPale` anywhere (it was, until the earlier contrast pass moved
// those call sites to goldDeep instead), so that combination is absent
// below on purpose, not by oversight.
import { getTheme, ThemeMode } from '../tokens';

const AA_NORMAL = 4.5; // WCAG 2.1 AA, text below ~18pt/24px (everything in this app)

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function srgbToLinear(c: number): number {
  const cs = c / 255;
  return cs <= 0.03928 ? cs / 12.92 : ((cs + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two opaque hex colors, in [1, 21]. */
function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Flattens a translucent color over an opaque one (standard alpha-over
 * compositing), returning the resulting opaque hex. */
function compositeOver(fgHex: string, alpha: number, bgHex: string): string {
  const fg = hexToRgb(fgHex);
  const bg = hexToRgb(bgHex);
  const mixed = fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)));
  return `#${mixed.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

describe('contrastRatio()', () => {
  it('is 21 for pure black on white and 1 for identical colors', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#334455', '#334455')).toBeCloseTo(1, 5);
  });
});

describe('theme token contrast (WCAG AA, 4.5:1)', () => {
  const modes: ThemeMode[] = ['light', 'dark'];

  // [foreground token, background token, why this pair exists]
  const pairs: [string, string, string][] = [
    ['ink', 'paper', 'body text on the screen background'],
    ['ink', 'card', 'body text on cards/sheets'],
    ['inkSoft', 'paper', 'secondary/muted text on the screen background'],
    ['inkSoft', 'card', 'secondary/muted text on cards'],
    ['inkSoft', 'goldPale', 'e.g. streak-sheet week labels on a gold-tinted chip'],
    ['ink', 'goldPale', 'e.g. rank-ladder row text when the row is highlighted gold'],
    ['navySoft', 'navy', 'muted text/icons on a fixed navy hero panel (auth, daily hero, map card) — navy never flips, so this pair must hold in both modes on its own'],
    ['navy', 'gold', 'navy text/icons on gold buttons (Play/Start, daily banner, combo badge)'],
    ['goldDeep', 'goldPale', 'badge/chip text (streak count, PvP wins, way-nudge) — the closest near-miss found this session (was 4.42:1 in light mode)'],
    ['correct', 'correctPale', 'quiz reveal "✓ الصحيحة" mark, correct-answer banners'],
    ['wrong', 'wrongPale', 'quiz reveal "اخترت ✗" mark, risk/disconnect banners'],
  ];

  for (const mode of modes) {
    const colors = getTheme(mode);
    describe(mode, () => {
      for (const [fg, bg, why] of pairs) {
        it(`${fg} on ${bg} (${why})`, () => {
          const ratio = contrastRatio(
            (colors as unknown as Record<string, string>)[fg],
            (colors as unknown as Record<string, string>)[bg],
          );
          expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
        });
      }
    });
  }
});

// Colors that are deliberately fixed (brand requirements, or a surface that
// never flips with theme) rather than sourced from the theme tokens — not
// covered by the token-pair tests above since they don't live in tokens.ts.
describe('fixed (non-themed) UI color pairs', () => {
  it('Google button: #3c4043 text on its always-white background', () => {
    // Reported bug: this was colors.ink, which resolves to a pale cream in
    // dark mode — nearly invisible against the button's brand-mandated
    // white surface (auth screen, app/(auth)/index.tsx).
    expect(contrastRatio('#3c4043', '#ffffff')).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('Facebook button: white text on the brand blue background', () => {
    // 4.23:1 — a genuine, if small, shortfall against strict WCAG AA
    // (4.5:1). Not a bug to silently fix by darkening Facebook's official
    // #1877F2 without being asked; this is the exact pairing Facebook's own
    // login-button spec uses. Documented here as a known, deliberate
    // exception with its measured floor, rather than a passing 4.5 assertion
    // that would be quietly wrong.
    expect(contrastRatio('#ffffff', '#1877F2')).toBeGreaterThanOrEqual(4.2);
  });

  it('white text/icons on the fixed navy header bar', () => {
    expect(contrastRatio('#ffffff', '#0d2d4e')).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});

// quran-madina-html (the third-party Quran-text renderer, src/components/
// QuranText.web.tsx) fires a raw mouseover that sets a hardcoded inline
// background-color on hover; our fix overrides it via an injected !important
// rule to a translucent light-grey wash instead of the library's opaque
// default, so it only ever partially tints whatever's underneath rather than
// replacing it outright. Word text separately inherits its color from us via
// currentColor (colors.ink), so the wash needs to hold up against ink on top
// of every real background it could land on, composited in both palettes —
// this caught the exact regression reported and fixed twice in one session
// (an opaque override resolving to the wrong color, then a too-strong wash).
describe('Quran-text hover wash (quran-madina-html override)', () => {
  const HOVER_WASH = { hex: '#d3d3d3', alpha: 0.3 }; // rgba(211,211,211,0.3), see QuranText.web.tsx

  for (const mode of (['light', 'dark'] as ThemeMode[])) {
    const colors = getTheme(mode);
    for (const bgToken of ['paper', 'card'] as const) {
      it(`${mode}: ink text over the wash on ${bgToken}`, () => {
        const composited = compositeOver(HOVER_WASH.hex, HOVER_WASH.alpha, colors[bgToken]);
        expect(contrastRatio(colors.ink, composited)).toBeGreaterThanOrEqual(AA_NORMAL);
      });
    }
  }
});
