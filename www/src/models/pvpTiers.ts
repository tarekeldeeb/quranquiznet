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

// Points required to advance one city *within* each tier (index-aligned with
// TIER_IDS) — a gentle ramp so Hafiz Gold cities are a bigger ask than Bronze ones.
const TIER_STEP_COST: Record<PvpTierId, number> = {
  bronze: 20,
  silver: 30,
  gold: 40,
  platinum: 55,
  hafizGold: 70,
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
  { id: 'jakarta', xFrac: 0.892, yFrac: 0.719 },
  { id: 'kualaLumpur', xFrac: 0.840, yFrac: 0.612 },
  { id: 'dhaka', xFrac: 0.768, yFrac: 0.327 },
  { id: 'delhi', xFrac: 0.715, yFrac: 0.200 },
  { id: 'lahore', xFrac: 0.720, yFrac: 0.235 },
  { id: 'kabul', xFrac: 0.700, yFrac: 0.184 },
  { id: 'tashkent', xFrac: 0.690, yFrac: 0.092 },
  { id: 'tehran', xFrac: 0.645, yFrac: 0.153 },
  { id: 'baghdad', xFrac: 0.592, yFrac: 0.201 },
  { id: 'mecca', xFrac: 0.598, yFrac: 0.393 },
  { id: 'medina', xFrac: 0.585, yFrac: 0.334 },
  { id: 'damascus', xFrac: 0.578, yFrac: 0.162 },
  { id: 'jerusalem', xFrac: 0.577, yFrac: 0.197 },
  { id: 'istanbul', xFrac: 0.598, yFrac: 0.071 },
  { id: 'sarajevo', xFrac: 0.565, yFrac: 0.08 },
  { id: 'cairo', xFrac: 0.573, yFrac: 0.231 },
  { id: 'tripoli', xFrac: 0.525, yFrac: 0.224 },
  { id: 'tunis', xFrac: 0.499, yFrac: 0.247 },
  { id: 'algiers', xFrac: 0.473, yFrac: 0.245 },
  { id: 'marrakech', xFrac: 0.435, yFrac: 0.224 },
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
