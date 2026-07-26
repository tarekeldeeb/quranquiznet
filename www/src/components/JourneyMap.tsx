// The PvP journey map — a Jakarta→Marrakech route of 20 cities (see
// src/models/pvpTiers.ts) with the player's avatar hopping city-to-city as
// pvp.points grows. Deliberately the "node-to-node fallback" from the design
// discussion that produced this feature: the avatar springs directly between
// two cities' coordinates, no SVG path-tracing/getPointAtLength needed — the
// simplest option, and visually what Duolingo/Candy-Crush-style maps actually
// do. The background is a stylized route + soft landmass tint, not literal
// country borders — real coastline data is a lot of hand-drawn path points to
// maintain for a feature this is (a progress indicator, not an atlas).
import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle, Ellipse } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Avatar } from './Avatar';
import { CITIES, MAP_VIEWBOX, cityName, type PvpCity } from '../models/pvpTiers';
import type { ThemeColors } from '../theme/tokens';

const APP_ICON = require('../../assets/images/app-icon.png');

const TIER_DOT_COLOR: Record<PvpCity['tier'], string> = {
  bronze: '#B08D57',
  silver: '#9AA5B1',
  gold: '#D4AF37',
  platinum: '#8FD3D9',
  hafizGold: '#2E9E6D',
};

function pct(v: number, total: number): `${number}%` {
  return `${(v / total) * 100}%`;
}

interface Props {
  currentIndex: number;   // CITIES[currentIndex] — the reached city
  avatarUri?: string;
  colors: Pick<ThemeColors, 'card' | 'line' | 'ink' | 'inkSoft' | 'paper' | 'gold'>;
  onCityPress?: (city: PvpCity) => void;
}

export default function JourneyMap({ currentIndex, avatarUri, colors, onCityPress }: Props) {
  const { width, height } = MAP_VIEWBOX;
  const current = CITIES[currentIndex] ?? CITIES[0];

  const x = useSharedValue(current.x);
  const y = useSharedValue(current.y);
  const prevIndexRef = useRef(currentIndex);

  useEffect(() => {
    if (prevIndexRef.current === currentIndex) return;
    prevIndexRef.current = currentIndex;
    x.value = withSpring(current.x, { damping: 14, stiffness: 90 });
    y.value = withSpring(current.y, { damping: 14, stiffness: 90 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  const avatarStyle = useAnimatedStyle(() => ({
    left: pct(x.value, width),
    top: pct(y.value, height),
  }));

  return (
    <View style={[s.wrap, { aspectRatio: width / height, backgroundColor: colors.paper, borderColor: colors.line }]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
        {/* Soft tinted blobs suggesting landmass clusters, not real coastlines. */}
        <Ellipse cx={width * 0.16} cy={height * 0.62} rx={width * 0.16} ry={height * 0.28} fill={colors.line} opacity={0.25} />
        <Ellipse cx={width * 0.5} cy={height * 0.42} rx={width * 0.24} ry={height * 0.34} fill={colors.line} opacity={0.2} />
        <Ellipse cx={width * 0.84} cy={height * 0.55} rx={width * 0.15} ry={height * 0.32} fill={colors.line} opacity={0.25} />

        <Polyline
          points={CITIES.map((c) => `${c.x},${c.y}`).join(' ')}
          fill="none"
          stroke={colors.gold}
          strokeWidth={2}
          strokeDasharray="2,7"
          strokeLinecap="round"
          opacity={0.6}
        />

        {CITIES.map((c) => {
          const reached = c.index <= currentIndex;
          return (
            <Circle
              key={c.id}
              cx={c.x}
              cy={c.y}
              r={c.index === currentIndex ? 10 : 7}
              fill={reached ? TIER_DOT_COLOR[c.tier] : colors.card}
              stroke={c.index === currentIndex ? colors.gold : colors.line}
              strokeWidth={c.index === currentIndex ? 3 : 1.5}
              opacity={reached ? 1 : 0.55}
              onPress={onCityPress ? () => onCityPress(c) : undefined}
            />
          );
        })}
      </Svg>

      <Animated.View style={[s.avatarMarker, avatarStyle]} pointerEvents="none">
        <View style={[s.avatarGlow, { borderColor: colors.gold, backgroundColor: colors.card }]}>
          <Avatar uri={avatarUri} fallback={APP_ICON} style={s.avatarImg} />
        </View>
        <Text style={[s.avatarLabel, { color: colors.ink, backgroundColor: colors.card, borderColor: colors.line }]} numberOfLines={1}>
          {cityName(current.id)}
        </Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { width: '100%', borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  avatarMarker: {
    position: 'absolute', alignItems: 'center',
    transform: [{ translateX: -18 }, { translateY: -18 }],
  },
  avatarGlow: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImg: { width: 32, height: 32, borderRadius: 16 },
  avatarLabel: {
    marginTop: 4, fontSize: 10, fontWeight: '700',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1,
    overflow: 'hidden',
  },
});
