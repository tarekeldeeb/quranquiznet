// PvP tier ladder — a one-way "journey" across 20 cities (Jakarta → Marrakech),
// grouped into 5 named tiers of 4 cities each. Mirrors the shape of
// src/models/rank.ts (score → title → ladder), but keyed on profile.pvp.points
// instead of lifetime score, and additionally exposes per-city map placement.
//
// One-way by design: profile.pvp.points only ever grows (see addPvpResult in
// profileStore.ts) — a loss/draw never moves the avatar backward. Later cities
// cost a bit more than earlier ones so the journey feels earned, not just a
// flat counter with a coat of paint.
import i18n from '../i18n';

export type PvpTierId = 'bronze' | 'silver' | 'gold' | 'platinum' | 'hafizGold';

export const CITIES_PER_TIER = 4;
export const TIER_IDS: PvpTierId[] = ['bronze', 'silver', 'gold', 'platinum', 'hafizGold'];

// Single source of truth for tier color — used by JourneyMap's city dots and
// by the PvP progress bar on me.tsx, so the bar's fill always matches the
// tier the player is actually in instead of a flat shared gold.
export const PVP_TIER_COLOR: Record<PvpTierId, string> = {
  bronze: '#B08D57',
  silver: '#9AA5B1',
  gold: '#D4AF37',
  platinum: '#8FD3D9',
  hafizGold: '#2E9E6D',
};

// Points required to advance one city *within* each tier (index-aligned with
// TIER_IDS) — a gentle ramp so Hafiz Gold cities are a bigger ask than Bronze ones.
// 3x'd from the original 20/30/40/55/70 (2026-07-27): at those costs the whole
// 840-point journey was clearable in ~42 wins (a single session, maxed streak),
// which felt too easy for a 20-city journey. Total is now 2520.
const TIER_STEP_COST: Record<PvpTierId, number> = {
  bronze: 60,
  silver: 90,
  gold: 120,
  platinum: 165,
  hafizGold: 210,
};

export function pvpTierTitle(tier: PvpTierId): string {
  return i18n.t(`pvp.tier.${tier}`);
}

interface CityDef {
  id: string;
  // Position as a fraction (0..1) of assets/images/green-map.png — the real,
  // bordered world map JourneyMap.tsx renders zoomed-in and pans across,
  // not an abstract projection. Estimated by eye against that image (it
  // conveniently already shades this exact Jakarta→Marrakech corridor in a
  // darker green), not computed from real lon/lat — good enough for a
  // panning background, not survey-accurate. Nudge these if the map image
  // ever changes.
  xFrac: number;
  yFrac: number;
}

// East (Indonesia) → west (Morocco), through South/Central Asia, the Middle
// East, the Balkans ("east Europe"), and North Africa — the zigzag (e.g.
// Baghdad → Mecca dips south before Damascus goes back north) mirrors real
// geography. Easy to edit — this is content, not architecture.
const CITY_DEFS: CityDef[] = [
  { id: 'jakarta', xFrac: 0.807, yFrac: 0.805 },
  { id: 'kualaLumpur', xFrac: 0.792, yFrac: 0.637 },
  { id: 'dhaka', xFrac: 0.748, yFrac: 0.357 },
  { id: 'delhi', xFrac: 0.701, yFrac: 0.232 },
  { id: 'lahore', xFrac: 0.690, yFrac: 0.163 },
  { id: 'kabul', xFrac: 0.675, yFrac: 0.158 },
  { id: 'tashkent', xFrac: 0.678, yFrac: 0.088 },
  { id: 'tehran', xFrac: 0.622, yFrac: 0.162 },
  { id: 'baghdad', xFrac: 0.592, yFrac: 0.201 },
  { id: 'mecca', xFrac: 0.598, yFrac: 0.393 },
  { id: 'medina', xFrac: 0.585, yFrac: 0.334 },
  { id: 'damascus', xFrac: 0.574, yFrac: 0.174 },
  { id: 'jerusalem', xFrac: 0.567, yFrac: 0.224 },
  { id: 'istanbul', xFrac: 0.546, yFrac: 0.077 },
  { id: 'sarajevo', xFrac: 0.521, yFrac: 0.031 },
  { id: 'cairo', xFrac: 0.553, yFrac: 0.259 },
  { id: 'tripoli', xFrac: 0.505, yFrac: 0.212 },
  { id: 'tunis', xFrac: 0.490, yFrac: 0.146 },
  { id: 'algiers', xFrac: 0.467, yFrac: 0.150 },
  { id: 'marrakech', xFrac: 0.430, yFrac: 0.225 },
];

// assets/images/green-map.png's own pixel dimensions, and the journey card's
// (wider-than-the-viewport) aspect ratio — JourneyMap.tsx renders the image
// at full viewport height, so it naturally overflows horizontally by
// (imageAspect / viewportAspect)×, which is exactly the "zoomed in" look
// asked for, no separate zoom constant to tune.
export const JOURNEY_MAP_IMAGE_ASPECT = 2443 / 598;
export const JOURNEY_VIEWPORT_ASPECT = 1.9;

export interface PvpCity {
  index: number;       // 0..19, position along the route
  id: string;           // translation-key fragment, e.g. "jakarta"
  tier: PvpTierId;
  xFrac: number;
  yFrac: number;
  threshold: number;    // cumulative points required to have reached this city
}

function tierForIndex(index: number): PvpTierId {
  return TIER_IDS[Math.floor(index / CITIES_PER_TIER)];
}

export const CITIES: PvpCity[] = (() => {
  let cumulative = 0;
  return CITY_DEFS.map((def, index) => {
    const tier = tierForIndex(index);
    if (index > 0) cumulative += TIER_STEP_COST[tier];
    return { index, id: def.id, tier, xFrac: def.xFrac, yFrac: def.yFrac, threshold: cumulative };
  });
})();

export const PVP_TOTAL_JOURNEY_POINTS = CITIES[CITIES.length - 1].threshold;

export function cityName(id: string): string {
  return i18n.t(`pvpJourney.city.${id}`);
}

// ─── Points earned per win ──────────────────────────────────────────────────

export const PVP_POINTS_PER_WIN = 10;
const STREAK_BONUS_PER_STEP = 2;
const STREAK_BONUS_STEP_CAP = 5; // caps the bonus at +10 (5 steps × 2)

/** Points a win is worth, given the player's win streak *after* this win
 *  (i.e. 1 for a first win off a loss, 2 after two in a row, ...). */
export function pointsForWin(winStreakAfter: number): number {
  const bonusSteps = Math.min(Math.max(winStreakAfter - 1, 0), STREAK_BONUS_STEP_CAP);
  return PVP_POINTS_PER_WIN + bonusSteps * STREAK_BONUS_PER_STEP;
}

export const STREAK_FREEZE_EVERY_N_WINS = 5;

// ─── Lookups (mirrors rank.ts's getRankInfo / getRankLadder) ────────────────

export interface PvpTierInfo {
  city: PvpCity;
  tier: PvpTierId;
  tierTitle: string;
  cityName: string;
  nextCity: PvpCity | null;
  pointsToNextCity: number; // 0 once the journey is complete
  progress: number;         // 0..1 through the current city→next-city leg
  journeyComplete: boolean;
}

export function getPvpTierInfo(points: number): PvpTierInfo {
  let cityIndex = 0;
  for (let i = CITIES.length - 1; i >= 0; i--) {
    if (points >= CITIES[i].threshold) { cityIndex = i; break; }
  }
  const city = CITIES[cityIndex];
  const nextCity = cityIndex < CITIES.length - 1 ? CITIES[cityIndex + 1] : null;
  const legStart = city.threshold;
  const legEnd = nextCity ? nextCity.threshold : legStart;
  const progress = !nextCity ? 1 : Math.max(0, Math.min(1, (points - legStart) / (legEnd - legStart)));
  return {
    city,
    tier: city.tier,
    tierTitle: pvpTierTitle(city.tier),
    cityName: cityName(city.id),
    nextCity,
    pointsToNextCity: nextCity ? Math.max(0, nextCity.threshold - points) : 0,
    progress,
    journeyComplete: !nextCity,
  };
}

export interface PvpCityLadderEntry {
  city: PvpCity;
  cityName: string;
  tierTitle: string;
  reached: boolean;
  current: boolean;
}

export function getCityLadder(points: number): PvpCityLadderEntry[] {
  const { city: currentCity } = getPvpTierInfo(points);
  return CITIES.map((city) => ({
    city,
    cityName: cityName(city.id),
    tierTitle: pvpTierTitle(city.tier),
    reached: points >= city.threshold,
    current: city.index === currentCity.index,
  }));
}
