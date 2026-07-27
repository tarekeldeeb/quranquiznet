// Per-city "fun facts" for the PvP journey's CityCard (see
// src/components/CityCard.tsx) — the city's founding year plus its
// *country's* population and Muslim share (not city-level: city-proper
// religious-demographic figures are patchy/contested for several of these
// places, e.g. Jerusalem, so we report the much better-documented
// country-level numbers instead — see country id below). Numbers are
// best-available public estimates (national censuses / Pew / CIA World
// Factbook, 2023-ish) rounded for a casual game stat, not survey-grade
// figures. The matching monument photo (assets/images/cities/<id>.jpg) is
// keyed by the city id itself — see CityCard.tsx's CITY_IMAGES.

import i18n from '../i18n';

export type CountryId =
  | 'indonesia' | 'malaysia' | 'bangladesh' | 'india' | 'pakistan' | 'afghanistan'
  | 'uzbekistan' | 'iran' | 'iraq' | 'saudiArabia' | 'syria' | 'palestine' | 'turkey'
  | 'bosnia' | 'egypt' | 'libya' | 'tunisia' | 'algeria' | 'morocco';

export interface CityFacts {
  country: CountryId;
  population: number;     // approx country population
  muslimPercent: number;  // 0..100, approx share of `population`
  foundedYear: number;    // city's founding year; negative = BCE
}

export const CITY_FACTS: Record<string, CityFacts> = {
  jakarta:      { country: 'indonesia',   population: 275_000_000,   muslimPercent: 87, foundedYear: 1527 },
  kualaLumpur:  { country: 'malaysia',    population: 34_000_000,    muslimPercent: 64, foundedYear: 1857 },
  dhaka:        { country: 'bangladesh',  population: 173_000_000,   muslimPercent: 90, foundedYear: 1608 },
  delhi:        { country: 'india',       population: 1_430_000_000, muslimPercent: 14, foundedYear: 1639 },
  lahore:       { country: 'pakistan',    population: 240_000_000,   muslimPercent: 96, foundedYear: 1021 },
  kabul:        { country: 'afghanistan', population: 42_000_000,    muslimPercent: 99, foundedYear: -1500 },
  tashkent:     { country: 'uzbekistan',  population: 35_000_000,    muslimPercent: 96, foundedYear: -200 },
  tehran:       { country: 'iran',        population: 89_000_000,    muslimPercent: 99, foundedYear: 1796 },
  baghdad:      { country: 'iraq',        population: 44_000_000,    muslimPercent: 98, foundedYear: 762 },
  mecca:        { country: 'saudiArabia', population: 36_000_000,    muslimPercent: 93, foundedYear: -300 },
  medina:       { country: 'saudiArabia', population: 36_000_000,    muslimPercent: 93, foundedYear: 622 },
  damascus:     { country: 'syria',       population: 23_000_000,    muslimPercent: 87, foundedYear: -3000 },
  jerusalem:    { country: 'palestine',   population: 5_480_000,     muslimPercent: 99, foundedYear: -1800 },
  istanbul:     { country: 'turkey',      population: 85_000_000,    muslimPercent: 99, foundedYear: -660 },
  sarajevo:     { country: 'bosnia',      population: 3_300_000,     muslimPercent: 51, foundedYear: 1461 },
  cairo:        { country: 'egypt',       population: 105_000_000,   muslimPercent: 90, foundedYear: 969 },
  tripoli:      { country: 'libya',       population: 7_000_000,     muslimPercent: 97, foundedYear: -700 },
  tunis:        { country: 'tunisia',     population: 12_000_000,    muslimPercent: 99, foundedYear: 698 },
  algiers:      { country: 'algeria',     population: 45_000_000,    muslimPercent: 99, foundedYear: 944 },
  marrakech:    { country: 'morocco',     population: 37_000_000,    muslimPercent: 99, foundedYear: 1070 },
};

export function muslimPopulation(id: string): number {
  const f = CITY_FACTS[id];
  return Math.round((f.population * f.muslimPercent) / 100);
}

// Both helpers below go through i18n.t rather than plain template strings —
// city stats sit right next to every other on-screen number (points,
// streaks, ...), which all render in Arabic-Indic digits via the localeAware
// Formatter in i18n/index.ts. Building "300 BCE"/"1.2M" by hand here would
// silently ship Western digits and English words into the Arabic UI.
function localeTag(): string {
  return i18n.language === 'ar' ? 'ar-EG' : 'en-US';
}

export function formatFoundedYear(year: number): string {
  const value = Math.abs(year).toLocaleString(localeTag());
  return year < 0 ? i18n.t('pvpJourney.cityCard.bce', { value }) : value;
}

export function formatCount(n: number): string {
  const lng = localeTag();
  if (n >= 1_000_000) {
    const value = (n / 1_000_000).toLocaleString(lng, { maximumFractionDigits: 1 });
    return i18n.t('pvpJourney.cityCard.million', { value });
  }
  if (n >= 1_000) {
    const value = (n / 1_000).toLocaleString(lng, { maximumFractionDigits: 1 });
    return i18n.t('pvpJourney.cityCard.thousand', { value });
  }
  return n.toLocaleString(lng);
}

export function formatPercent(n: number): string {
  return `${n.toLocaleString(localeTag())}%`;
}
