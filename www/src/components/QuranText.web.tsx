// Web renderer using the official React wrapper around <quran-madina-html>.
// The wrapper injects the library <script> at runtime and, left to its
// defaults, loads its CSS/DB from unpkg (unversioned "latest" — see the
// src/cdn override below for why we don't use that). Font + size are loader
// config honored on the first mounted instance.
//
// The underlying custom element reads its attributes on creation, so we key the
// element on its selection to force a remount when `words` changes (the question
// grows each round). The DB is fetched once and cached, so remounts are cheap.
import React from 'react';
import { View, StyleProp, ViewStyle, Dimensions } from 'react-native';
import QuranMadinaHtml from '@tarekeldeeb/quran-madina-react';
import type { QuranTextProps } from './QuranText';
import { madinaFontSizeForWidth } from '../models/madinaWidth';
import { useTheme } from '../theme/tokens';

// Self-hosted (same-origin) copy of the library instead of the wrapper's
// unpkg default, so the quiz works fully offline after the first load (the
// service worker cache-firsts same-origin static assets, but never touches
// cross-origin unpkg requests) and so an upstream publish can't silently
// change rendering underneath us. Assets are synced from the pinned
// "quran-madina-html" version via `npm run sync:madina` — see
// scripts/sync-madina-assets.mjs.
const MADINA_BASE = '/quran-madina/';
const MADINA_SRC = `${MADINA_BASE}dist/quran-madina-html.min.js`;

// The wrapper's loader config (including fontSize) is only honored on the
// first <QuranMadinaHtml> mounted per page session — see the "Global config
// caveat" in @tarekeldeeb/quran-madina-react's README — so this can't be a
// per-render/per-question value on web the way it is on native (a fresh
// WebView document per question there). Computed once instead, the same way
// QuizCard.tsx computes its own CARD_W once from Dimensions at module load.
// Mirrors CARD_W's own math (window width, capped at 480, minus the 32px
// outer margin) minus the more conservative of the two paddings the front
// (questionBox, 12px) and back (answerContent, 14px) faces wrap this in.
const { width: SW } = Dimensions.get('window');
const CARD_W = Math.min(SW - 32, 480);
const MADINA_FONT_SIZE = madinaFontSizeForWidth(CARD_W - 14 * 2);

// The custom element re-validates its {sura, aya} / {page} attributes on every
// individual attribute write, so during the remount below there's a brief,
// harmless window where React has set some but not all of them yet — the
// library logs this exact message every time, even though the next attribute
// write (a tick later) completes the render correctly. Filter just this one
// known-benign string; everything else still reaches the console untouched.
const QMH_BAD_ARGS_MSG = 'quran-madina-html> Bad arguments: Not rendering!';
type PatchedConsole = Console & { __qmhFiltered?: boolean };
const patchedConsole = console as PatchedConsole;
if (!patchedConsole.__qmhFiltered) {
  const origError = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes(QMH_BAD_ARGS_MSG)) return;
    origError(...args);
  };
  patchedConsole.__qmhFiltered = true;
}

// The library wires a raw mouseover/mouseout pair on its word-group elements
// that sets element.style.backgroundColor = "lightgrey" directly (hardcoded
// in the minified bundle — not a CSS rule, not a themeable prop, the only
// place in the whole library that sets an inline background-color; mouseout
// resets it to "transparent", also inline). Word text separately inherits
// its color from us via currentColor, which is correctly theme-aware — so in
// dark mode that left our light (dark-mode) text sitting on a literal
// "lightgrey" box: light-on-light, reported as "the hover highlight is too
// shiny, losing all text contrast."
//
// An inline style only loses to a stylesheet rule that's !important, so this
// needs a real injected rule — but [style*="background-color"] (an earlier,
// broken version of this fix) matched BOTH states, since "background-color"
// appears in the attribute text of the resting `background-color:transparent`
// just as much as the hover `background-color:lightgrey` — forcing every
// word permanently to var(--qmh-background), which turned out to resolve to
// the library's own #F5F5DC default rather than our override, painting every
// line pale yellow at all times (reported: "now it's horrible"). Matching
// the literal "lightgrey" substring instead only ever catches the actual
// hover moment, and resolving to plain transparent — not the custom
// property — means this doesn't depend on custom-property inheritance
// working in a way that couldn't be verified without live browser testing.
const QMH_HOVER_FIX_CSS = `
quran-madina-html [style*="lightgrey"] {
  background-color: transparent !important;
}
`;
function injectHoverFix() {
  if (typeof document === 'undefined' || document.getElementById('qmh-hover-fix')) return;
  const el = document.createElement('style');
  el.id = 'qmh-hover-fix';
  el.textContent = QMH_HOVER_FIX_CSS;
  document.head.appendChild(el);
}
injectHoverFix();

export default function QuranText({ sura, aya, words, hideTitle, style }: QuranTextProps) {
  const { colors } = useTheme();
  return (
    <View style={[wrap, style as StyleProp<ViewStyle>]}>
      <QuranMadinaHtml
        key={`${sura}:${aya}:${words}:${hideTitle}`}
        sura={sura}
        aya={aya}
        words={words}
        headless
        quotes="no"
        inline="no"
        src={MADINA_SRC}
        cdn={MADINA_BASE}
        // Suppresses the crossed-into sura's name while the excerpt hasn't reached any of
        // that sura's real (post-basmala) words yet — see QuizCard's reachesNewSuraContent,
        // which decides hideTitle per excerpt so the label only appears once it's earned.
        notitle={hideTitle}
        font="Hafs"
        fontSize={MADINA_FONT_SIZE}
        // The element's own background is a 10%-strength color-mix wash of
        // --qmh-background (a fixed light cream, #F5F5DC by default,
        // unrelated to our theme) over transparent. Word text separately
        // inherits its color from the wrapping element via currentColor (see
        // caller's `color: colors.ink`), which DOES flip with theme — so in
        // dark mode that left light text sitting on this library's own
        // still-light wash: light-on-light, the reported contrast loss.
        // Overriding the custom property to our own paper tone makes the
        // wash blend into the surrounding card instead of fighting it.
        style={{ background: 'transparent', '--qmh-background': colors.paper } as React.CSSProperties}
      />
    </View>
  );
}

const wrap: StyleProp<ViewStyle> = {
  // Cross-axis alignment on a column flex container follows inline
  // direction, and the page is RTL, so flex-start (not flex-end) is what
  // hugs the right edge here.
  alignItems: 'flex-start',
  width: '100%',
};
