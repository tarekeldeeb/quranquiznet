// Cumulative monthly leaderboard aggregation. Pure functions (no admin SDK)
// so the daily cron's merge logic is unit-testable with `npm test`.

/**
 * Merge one day's raw submissions into the per-uid cumulative month totals.
 *
 * Submissions are push()-keyed, so nothing server-side stops a client from
 * submitting twice in a day — dedupe to one score per uid (best wins) before
 * adding, or duplicates would inflate the running total.
 *
 * @param {Object|null} totals  current map: uid -> {uid, name, score, days, country?}
 * @param {Array} daySubmissions  one day's entries: {uid, name, score, country?}
 * @returns {Object} new totals map (input is not mutated)
 */
function mergeDayIntoMonthTotals(totals, daySubmissions) {
  const bestOfDay = new Map();
  for (const sub of daySubmissions || []) {
    if (!sub || typeof sub.uid !== 'string' || !sub.uid) continue;
    if (typeof sub.score !== 'number' || !isFinite(sub.score)) continue;
    const prev = bestOfDay.get(sub.uid);
    if (!prev || sub.score > prev.score) bestOfDay.set(sub.uid, sub);
  }

  const next = Object.assign({}, totals);
  for (const [uid, sub] of bestOfDay) {
    const cur = next[uid];
    // Scores can be fractional (speed bonus) — round the running sum to 2
    // decimals so float noise never accumulates into the displayed total.
    const entry = {
      uid: uid,
      name: sub.name || (cur && cur.name) || '',
      score: Math.round(((cur ? cur.score : 0) + sub.score) * 100) / 100,
      days: (cur ? cur.days : 0) + 1,
    };
    const country = sub.country || (cur && cur.country);
    if (country) entry.country = country;
    next[uid] = entry;
  }
  return next;
}

/**
 * Best-first top-N slice of the totals map, in the legacy array shape old
 * clients read from daily/reports/month.
 */
function topOfMonth(totals, n) {
  return Object.values(totals || {})
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, n);
}

module.exports = { mergeDayIntoMonthTotals, topOfMonth };
