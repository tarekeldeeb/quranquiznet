// Compact circular progress indicator, shared by the Home stat tiles and the
// post-session summary sheet. The conic-gradient arc is web-only (RN-web
// supports backgroundImage; native silently ignores it) — the percentage text
// itself, which is what actually communicates the number, renders correctly
// on every platform either way.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  pct: number;
  color: string;
  trackColor?: string;
  innerColor?: string;
  size?: number;
  label?: string;   // overrides the default "N%" text
}

export default function Ring({ pct, color, trackColor = '#e8edf2', innerColor = '#fff', size = 76, label }: Props) {
  const clamped = Math.max(0, Math.min(100, pct));
  const innerSize = size * 0.76;
  return (
    <View style={[s.outer, { width: size, height: size }]}>
      <View
        style={[
          s.track,
          {
            width: size, height: size, borderRadius: size / 2,
            backgroundImage: `conic-gradient(${color} ${clamped * 3.6}deg, ${trackColor} 0deg)`,
          } as object,
        ]}
      />
      <View style={[s.inner, { width: innerSize, height: innerSize, borderRadius: innerSize / 2, backgroundColor: innerColor }]}>
        <Text style={[s.txt, { color, fontSize: size * 0.21 }]}>{label ?? `${Math.round(clamped)}%`}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  outer: { alignItems: 'center', justifyContent: 'center' },
  track: { position: 'absolute' },
  inner: { alignItems: 'center', justifyContent: 'center' },
  txt: { fontFamily: 'PlexArabic-Bold' },
});
