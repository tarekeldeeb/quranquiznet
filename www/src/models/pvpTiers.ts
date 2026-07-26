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
  lon: number;
  lat: number;
}

// East (Indonesia) → west (Morocco), through South/Central Asia, the Middle
// East, the Balkans ("east Europe"), and North Africa — real-world
// coordinates, so the route naturally zigzags a little (e.g. Baghdad → Mecca
// dips south before Damascus goes back north) instead of being a straight
// line. Easy to edit — this is content, not architecture.
const CITY_DEFS: CityDef[] = [
  { id: 'jakarta', lon: 106.8, lat: -6.2 },
  { id: 'kualaLumpur', lon: 101.7, lat: 3.1 },
  { id: 'dhaka', lon: 90.4, lat: 23.8 },
  { id: 'delhi', lon: 77.2, lat: 28.6 },
  { id: 'lahore', lon: 74.3, lat: 31.5 },
  { id: 'kabul', lon: 69.2, lat: 34.5 },
  { id: 'tashkent', lon: 69.2, lat: 41.3 },
  { id: 'tehran', lon: 51.4, lat: 35.7 },
  { id: 'baghdad', lon: 44.4, lat: 33.3 },
  { id: 'mecca', lon: 39.8, lat: 21.4 },
  { id: 'medina', lon: 39.6, lat: 24.5 },
  { id: 'damascus', lon: 36.3, lat: 33.5 },
  { id: 'jerusalem', lon: 35.2, lat: 31.8 },
  { id: 'istanbul', lon: 28.9, lat: 41.0 },
  { id: 'sarajevo', lon: 18.4, lat: 43.9 },
  { id: 'cairo', lon: 31.2, lat: 30.0 },
  { id: 'tripoli', lon: 13.2, lat: 32.9 },
  { id: 'tunis', lon: 10.2, lat: 36.8 },
  { id: 'algiers', lon: 3.1, lat: 36.8 },
  { id: 'marrakech', lon: -8.0, lat: 31.6 },
];

// Projection bounds, baked from the dataset above (not recomputed at runtime,
// so map layout is deterministic even if a city is nudged later).
const LON_MIN = -8, LON_MAX = 106.8;
const LAT_MIN = -6.2, LAT_MAX = 43.9;
// padding keeps every city (and the avatar label rendered below it) clear of
// the map card's rounded, overflow:hidden edge — the extremes of the route
// (Jakarta east, Marrakech west) would otherwise sit close enough to the
// corner that the label gets clipped.
export const MAP_VIEWBOX = { width: 1000, height: 520, padding: 130 };

/** Equirectangular projection into MAP_VIEWBOX — north up, east right (standard
 *  map convention). Deliberately NOT mirrored for RTL: it's a real map, not UI
 *  chrome. As a bonus, Jakarta (east/start) landing on the right and Marrakech
 *  (west/finish) on the left reads naturally alongside Arabic's right-to-left flow. */
export function projectCity(lon: number, lat: number): { x: number; y: number } {
  const { width, height, padding } = MAP_VIEWBOX;
  const x = padding + ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * (width - 2 * padding);
  const y = padding + ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * (height - 2 * padding);
  return { x, y };
}

export interface PvpCity {
  index: number;       // 0..19, position along the route
  id: string;           // translation-key fragment, e.g. "jakarta"
  tier: PvpTierId;
  x: number;
  y: number;
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
    const { x, y } = projectCity(def.lon, def.lat);
    return { index, id: def.id, tier, x, y, threshold: cumulative };
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
