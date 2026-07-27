// The PvP journey map — a Jakarta→Marrakech route of 20 cities (see
// src/models/pvpTiers.ts) rendered over the real world map at
// assets/images/green-map.png. Deliberately not scaled to fit: the map is
// rendered at full viewport height (which overflows its width, since the
// image is much wider than the card — a natural "zoomed in" look with no
// separate zoom constant to tune) and the whole layer pans horizontally as
// pvp.points grows — starting zoomed on the east (Jakarta) side, sliding
// left to the west (Marrakech) side as the journey completes. The avatar
// still springs city-to-city within that panning layer, same "node-to-node"
// approach as before (see pvpTiers.ts's CityDef comment) — no path-tracing.
import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Avatar } from './Avatar';
import {
  CITIES, JOURNEY_MAP_IMAGE_ASPECT, JOURNEY_VIEWPORT_ASPECT, PVP_TIER_COLOR, cityName, type PvpCity,
} from '../models/pvpTiers';
import type { ThemeColors } from '../theme/tokens';

const APP_ICON = require('../../assets/images/app-icon.png');
const GREEN_MAP = require('../../assets/images/green-map.png');

// How much wider the map layer is than the viewport — derived from the
// image's own aspect ratio vs. the card's, so the layer's rendered box is
// exactly the image's native proportions (no stretch/squash) and the
// "zoom" is whatever that mismatch naturally gives.
const ZOOM = JOURNEY_MAP_IMAGE_ASPECT / JOURNEY_VIEWPORT_ASPECT;

const PAN_MIN = -(ZOOM - 1) * 100; // fully east (Jakarta side)
const PAN_MAX = 0;                 // fully west (Marrakech side)

/** Map-layer `left` (% of viewport) that centers `city` in the frame,
 *  clamped to the map's actual pannable range. Centering rather than a
 *  flat progress→edge interpolation matters because the westmost/eastmost
 *  cities aren't at the image's own edges (there's more map beyond them,
 *  e.g. the Americas past Marrakech) — a naive edge-to-edge pan left
 *  Marrakech clipped at the frame's corner instead of nicely in view. */
function panLeftPercentForCity(city: PvpCity): number {
  const centered = -(city.xFrac * ZOOM - 0.5) * 100;
  return Math.max(PAN_MIN, Math.min(PAN_MAX, centered));
}

function pct(v: number): `${number}%` {
  return `${v}%`;
}

interface Props {
  currentIndex: number;   // CITIES[currentIndex] — the reached city
  avatarUri?: string;
  colors: Pick<ThemeColors, 'card' | 'line' | 'ink' | 'inkSoft' | 'paper' | 'gold'>;
}

export default function JourneyMap({ currentIndex, avatarUri, colors }: Props) {
  const current = CITIES[currentIndex] ?? CITIES[0];

  const pan = useSharedValue(panLeftPercentForCity(current));
  const avatarX = useSharedValue(current.xFrac * 100);
  const avatarY = useSharedValue(current.yFrac * 100);
  const prevIndexRef = useRef(currentIndex);

  useEffect(() => {
    if (prevIndexRef.current === currentIndex) return;
    prevIndexRef.current = currentIndex;
    const springCfg = { damping: 16, stiffness: 70 };
    pan.value = withSpring(panLeftPercentForCity(current), springCfg);
    avatarX.value = withSpring(current.xFrac * 100, springCfg);
    avatarY.value = withSpring(current.yFrac * 100, springCfg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  const mapLayerStyle = useAnimatedStyle(() => ({ left: pct(pan.value) }));
  const avatarStyle = useAnimatedStyle(() => ({ left: pct(avatarX.value), top: pct(avatarY.value) }));

  return (
    <View style={[s.wrap, { aspectRatio: JOURNEY_VIEWPORT_ASPECT, backgroundColor: colors.paper, borderColor: colors.line }]}>
      <Animated.View style={[s.mapLayer, { width: pct(ZOOM * 100) }, mapLayerStyle]}>
        <Image source={GREEN_MAP} style={s.mapImage} resizeMode="stretch" />

        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
          <Polyline
            points={CITIES.map((c) => `${c.xFrac * 100},${c.yFrac * 100}`).join(' ')}
            fill="none"
            stroke={colors.gold}
            strokeWidth={0.3}
            strokeDasharray="0.3,0.9"
            strokeLinecap="round"
            opacity={0.75}
            vectorEffect="non-scaling-stroke"
          />
        </Svg>

        {CITIES.map((c) => {
          const reached = c.index <= currentIndex;
          return (
            <View
              key={c.id}
              style={[
                s.cityDot,
                {
                  left: pct(c.xFrac * 100),
                  top: pct(c.yFrac * 100),
                  backgroundColor: reached ? PVP_TIER_COLOR[c.tier] : colors.card,
                  borderColor: c.index === currentIndex ? colors.gold : colors.line,
                  borderWidth: c.index === currentIndex ? 2.5 : 1.5,
                  opacity: reached ? 1 : 0.6,
                },
                c.index === currentIndex && s.cityDotCurrent,
              ]}
            />
          );
        })}

        <Animated.View style={[s.avatarMarker, avatarStyle]} pointerEvents="none">
          <View style={[s.avatarGlow, { borderColor: colors.gold, backgroundColor: colors.card }]}>
            <Avatar uri={avatarUri} fallback={APP_ICON} style={s.avatarImg} />
          </View>
          <Text style={[s.avatarLabel, { color: colors.ink, backgroundColor: colors.card, borderColor: colors.line }]} numberOfLines={1}>
            {cityName(current.id)}
          </Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { width: '100%', borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  mapLayer: { position: 'absolute', top: 0, bottom: 0 },
  mapImage: { width: '100%', height: '100%' },
  cityDot: {
    position: 'absolute', width: 9, height: 9, borderRadius: 4.5,
    marginLeft: -4.5, marginTop: -4.5,
  },
  cityDotCurrent: { width: 13, height: 13, borderRadius: 6.5, marginLeft: -6.5, marginTop: -6.5 },
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
