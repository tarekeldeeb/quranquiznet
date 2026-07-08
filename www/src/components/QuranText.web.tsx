// Web renderer using the official React wrapper around <quran-madina-html>.
// The wrapper injects the library <script> at runtime and loads its CSS/DB from
// unpkg by default (so it works on localhost without self-hosting). Font + size
// are loader config honored on the first mounted instance.
//
// The underlying custom element reads its attributes on creation, so we key the
// element on its selection to force a remount when `words` changes (the question
// grows each round). The DB is fetched once and cached, so remounts are cheap.
import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import QuranMadinaHtml from '@tarekeldeeb/quran-madina-react';
import type { QuranTextProps } from './QuranText';

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

export default function QuranText({ sura, aya, words, hideTitle, style }: QuranTextProps) {
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
        // Suppresses the crossed-into sura's name while the excerpt hasn't reached any of
        // that sura's real (post-basmala) words yet — see QuizCard's reachesNewSuraContent,
        // which decides hideTitle per excerpt so the label only appears once it's earned.
        notitle={hideTitle}
        font="Hafs"
        fontSize={24}
        style={{ background: 'transparent' }}
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
