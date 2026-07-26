import {
  CITIES, CITIES_PER_TIER, TIER_IDS, PVP_TOTAL_JOURNEY_POINTS,
  pointsForWin, getPvpTierInfo, getCityLadder,
} from '../pvpTiers';

describe('CITIES', () => {
  it('has 20 sequentially-indexed cities', () => {
    expect(CITIES).toHaveLength(20);
    CITIES.forEach((c, i) => expect(c.index).toBe(i));
  });

  it('groups cities into 5 tiers of 4, in TIER_IDS order', () => {
    expect(TIER_IDS).toHaveLength(5);
    CITIES.forEach((c, i) => {
      expect(c.tier).toBe(TIER_IDS[Math.floor(i / CITIES_PER_TIER)]);
    });
  });

  it('has a zero threshold at the start and strictly increasing thresholds after', () => {
    expect(CITIES[0].threshold).toBe(0);
    for (let i = 1; i < CITIES.length; i++) {
      expect(CITIES[i].threshold).toBeGreaterThan(CITIES[i - 1].threshold);
    }
    expect(PVP_TOTAL_JOURNEY_POINTS).toBe(CITIES[CITIES.length - 1].threshold);
  });
});

describe('pointsForWin', () => {
  it('is the base amount for a first win off a loss', () => {
    expect(pointsForWin(1)).toBe(10);
  });

  it('adds a streak bonus for consecutive wins', () => {
    expect(pointsForWin(2)).toBe(12);
    expect(pointsForWin(3)).toBe(14);
  });

  it('caps the streak bonus instead of growing unbounded', () => {
    expect(pointsForWin(6)).toBe(20);
    expect(pointsForWin(20)).toBe(20);
  });
});

describe('getPvpTierInfo', () => {
  it('starts at the first city with zero progress', () => {
    const info = getPvpTierInfo(0);
    expect(info.city.id).toBe('jakarta');
    expect(info.progress).toBe(0);
    expect(info.journeyComplete).toBe(false);
  });

  it('reports the exact midpoint of a leg as ~0.5 progress', () => {
    const start = CITIES[0].threshold;
    const end = CITIES[1].threshold;
    const info = getPvpTierInfo(Math.round((start + end) / 2));
    expect(info.city.index).toBe(0);
    expect(info.nextCity?.index).toBe(1);
    expect(info.progress).toBeCloseTo(0.5, 1);
  });

  it('is complete once the final city is reached, with no further points needed', () => {
    const info = getPvpTierInfo(PVP_TOTAL_JOURNEY_POINTS);
    expect(info.city.id).toBe('marrakech');
    expect(info.journeyComplete).toBe(true);
    expect(info.nextCity).toBeNull();
    expect(info.pointsToNextCity).toBe(0);
  });

  it('never regresses below zero for pointsToNextCity even mid-journey', () => {
    const info = getPvpTierInfo(CITIES[5].threshold);
    expect(info.pointsToNextCity).toBeGreaterThanOrEqual(0);
  });
});

describe('getCityLadder', () => {
  it('marks exactly one city as current, and every city up to it as reached', () => {
    const points = CITIES[7].threshold;
    const ladder = getCityLadder(points);
    expect(ladder.filter((e) => e.current)).toHaveLength(1);
    expect(ladder.find((e) => e.current)?.city.index).toBe(7);
    ladder.forEach((e) => {
      expect(e.reached).toBe(e.city.index <= 7);
    });
  });
});
