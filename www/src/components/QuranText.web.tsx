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

export default function QuranText({ sura, aya, words, style }: QuranTextProps) {
  return (
    <View style={[wrap, style as StyleProp<ViewStyle>]}>
      <QuranMadinaHtml
        key={`${sura}:${aya}:${words}`}
        sura={sura}
        aya={aya}
        words={words}
        headless
        font="Amiri Quran Colored"
        fontSize={24}
        style={{ background: 'transparent' }}
      />
    </View>
  );
}

const wrap: StyleProp<ViewStyle> = {
  alignItems: 'flex-end',   // RTL: text hugs the right edge
  width: '100%',
};
