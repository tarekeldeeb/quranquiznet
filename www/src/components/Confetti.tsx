// One orchestrated celebration for the session summary sheet (accuracy ≥80%)
// — the only confetti moment in the app, by design (see the motion-budget
// note in quiz.tsx). Plain Views + Reanimated, no image/particle assets.
import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay } from 'react-native-reanimated';

const { width: SW } = Dimensions.get('window');
const STAGE_W = Math.min(SW, 480);
const COLORS = ['#c8973a', '#2f7d5d', '#0d2d4e', '#b3473d', '#8a6410'];
const COUNT = 18;

function Piece({ index, active }: { index: number; active: boolean }) {
  const progress = useSharedValue(0);
  const left = (index / COUNT) * STAGE_W + (index % 2 === 0 ? -6 : 6);
  const color = COLORS[index % COLORS.length];
  const delay = (index % 6) * 60;
  const rotateStart = (index * 47) % 360;

  useEffect(() => {
    if (active) {
      progress.value = 0;
      progress.value = withDelay(delay, withTiming(1, { duration: 1400 + (index % 5) * 120 }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const style = useAnimatedStyle(() => ({
    opacity: active ? 1 - progress.value * 0.9 : 0,
    transform: [
      { translateY: progress.value * 240 },
      { translateX: Math.sin(progress.value * Math.PI * 2 + index) * 14 },
      { rotate: `${rotateStart + progress.value * 240}deg` },
    ],
  }));

  return <Animated.View pointerEvents="none" style={[s.piece, { left, backgroundColor: color }, style]} />;
}

export default function Confetti({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <View style={s.wrap} pointerEvents="none">
      {Array.from({ length: COUNT }, (_, i) => <Piece key={i} index={i} active={active} />)}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  piece: { position: 'absolute', top: -10, width: 8, height: 14, borderRadius: 2 },
});
