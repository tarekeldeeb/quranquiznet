// The app's signature motif: the eight-point khatam star (two overlapping
// squares, one rotated 45°) — already tiled in the web background gutter,
// promoted here to the achievement/mastery language instead of borrowed
// western game bling (medals, gems, etc). Built from plain Views (no SVG
// dependency) so it renders identically on web, iOS, and Android.
import React from 'react';
import { View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MasteryTier } from '../models/milestones';
import { ThemeColors } from '../theme/tokens';

interface Props {
  tier: MasteryTier;
  size?: number;
  colors: Pick<ThemeColors, 'gold' | 'goldDeep' | 'wrong' | 'line' | 'card'>;
}

export default function KhatamStar({ tier, size = 40, colors }: Props) {
  const sq = size * 0.56;
  const base: ViewStyle = {
    position: 'absolute',
    width: sq,
    height: sq,
    top: (size - sq) / 2,
    left: (size - sq) / 2,
  };
  const wrap: ViewStyle = { width: size, height: size, alignItems: 'center', justifyContent: 'center' };

  if (tier === 'HIGH') {
    // متقن — filled gold star with a check mark: high accuracy, done.
    return (
      <View style={wrap}>
        <View style={[base, { backgroundColor: colors.gold }]} />
        <View style={[base, { backgroundColor: colors.gold, transform: [{ rotate: '45deg' }] }]} />
        <View
          style={{
            position: 'absolute', width: size * 0.42, height: size * 0.42, borderRadius: size * 0.21,
            backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="checkmark" size={size * 0.28} color={colors.goldDeep} />
        </View>
      </View>
    );
  }
  if (tier === 'MID') {
    // جيد — outline gold star with a filled center dot: on the way.
    return (
      <View style={wrap}>
        <View style={[base, { borderWidth: 2.5, borderColor: colors.gold }]} />
        <View style={[base, { borderWidth: 2.5, borderColor: colors.gold, transform: [{ rotate: '45deg' }] }]} />
        <View style={{ position: 'absolute', width: size * 0.22, height: size * 0.22, borderRadius: size * 0.11, backgroundColor: colors.gold }} />
      </View>
    );
  }
  if (tier === 'LOW') {
    // يحتاج مراجعة — outline in the "wrong" color: needs review, priority.
    return (
      <View style={[wrap, { opacity: 0.82 }]}>
        <View style={[base, { borderWidth: 2.5, borderColor: colors.wrong }]} />
        <View style={[base, { borderWidth: 2.5, borderColor: colors.wrong, transform: [{ rotate: '45deg' }] }]} />
      </View>
    );
  }
  // EMPTY — لم يُختبر — dashed outline: start here.
  return (
    <View style={wrap}>
      <View style={[base, { borderWidth: 2, borderColor: colors.line, borderStyle: 'dashed' }]} />
      <View style={[base, { borderWidth: 2, borderColor: colors.line, borderStyle: 'dashed', transform: [{ rotate: '45deg' }] }]} />
    </View>
  );
}

export const TIER_LABEL: Record<MasteryTier, string> = {
  HIGH: 'متقن',
  MID: 'جيد',
  LOW: 'يحتاج مراجعة',
  EMPTY: 'لم يُختبر',
};
