// Compact circular progress indicator, shared by the Home stat tiles and the
// post-session summary sheet. Drawn with react-native-svg (a stroked circle,
// not a filled conic-gradient) so it renders identically on web, iOS, and
// Android — a plain View + CSS conic-gradient used to draw this, but that's a
// react-native-web-only style and native silently drops it, leaving a blank
// ring on both native platforms.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

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
  const strokeWidth = size * 0.24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const innerSize = size - strokeWidth * 2;
  return (
    <View style={[s.outer, { width: size, height: size }]}>
      <Svg width={size} height={size} style={s.track}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="butt"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
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
