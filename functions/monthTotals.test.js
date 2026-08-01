// Run with `npm test` (node --test — no test framework dependency).
const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeDayIntoMonthTotals, topOfMonth } = require('./monthTotals.js');

test('starts totals from an empty/null map', () => {
  const totals = mergeDayIntoMonthTotals(null, [
    { uid: 'a', name: 'Ali', score: 10, country: 'EG' },
  ]);
  assert.deepEqual(totals, {
    a: { uid: 'a', name: 'Ali', score: 10, days: 1, country: 'EG' },
  });
});

test('accumulates score and days across days', () => {
  let totals = mergeDayIntoMonthTotals(null, [{ uid: 'a', name: 'Ali', score: 10 }]);
  totals = mergeDayIntoMonthTotals(totals, [{ uid: 'a', name: 'Ali', score: 7.5 }]);
  totals = mergeDayIntoMonthTotals(totals, [{ uid: 'a', name: 'Ali', score: 2 }]);
  assert.equal(totals.a.score, 19.5);
  assert.equal(totals.a.days, 3);
});

test('dedupes within a day: best score counts once', () => {
  const totals = mergeDayIntoMonthTotals(null, [
    { uid: 'a', name: 'Ali', score: 4 },
    { uid: 'a', name: 'Ali', score: 9 },
    { uid: 'a', name: 'Ali', score: 6 },
  ]);
  assert.equal(totals.a.score, 9);
  assert.equal(totals.a.days, 1);
});

test('skips malformed entries (missing uid or non-numeric score)', () => {
  const totals = mergeDayIntoMonthTotals(null, [
    { name: 'NoUid', score: 5 },
    { uid: 'b', name: 'BadScore', score: 'high' },
    { uid: 'c', name: 'NaN', score: NaN },
    null,
    { uid: 'd', name: 'Ok', score: 3 },
  ]);
  assert.deepEqual(Object.keys(totals), ['d']);
});

test('keeps the latest name and backfills country both ways', () => {
  let totals = mergeDayIntoMonthTotals(null, [{ uid: 'a', name: 'Old', score: 1, country: 'EG' }]);
  // Renamed, no country today: name updates, stored country survives.
  totals = mergeDayIntoMonthTotals(totals, [{ uid: 'a', name: 'New', score: 1 }]);
  assert.equal(totals.a.name, 'New');
  assert.equal(totals.a.country, 'EG');
  // Country appearing later fills a total that had none.
  let t2 = mergeDayIntoMonthTotals(null, [{ uid: 'b', name: 'B', score: 1 }]);
  t2 = mergeDayIntoMonthTotals(t2, [{ uid: 'b', name: 'B', score: 1, country: 'MA' }]);
  assert.equal(t2.b.country, 'MA');
});

test('rounds running float sums to 2 decimals', () => {
  let totals = null;
  for (let i = 0; i < 10; i++) {
    totals = mergeDayIntoMonthTotals(totals, [{ uid: 'a', name: 'A', score: 0.1 }]);
  }
  assert.equal(totals.a.score, 1);
});

test('does not mutate the input totals map', () => {
  const before = { a: { uid: 'a', name: 'A', score: 5, days: 1 } };
  const frozen = JSON.parse(JSON.stringify(before));
  mergeDayIntoMonthTotals(before, [{ uid: 'a', name: 'A', score: 5 }]);
  assert.deepEqual(before, frozen);
});

test('topOfMonth sorts best-first and slices to n', () => {
  const totals = {
    a: { uid: 'a', name: 'A', score: 5, days: 2 },
    b: { uid: 'b', name: 'B', score: 12, days: 4 },
    c: { uid: 'c', name: 'C', score: 8, days: 1 },
  };
  const top2 = topOfMonth(totals, 2);
  assert.deepEqual(top2.map((e) => e.uid), ['b', 'c']);
});

test('topOfMonth tolerates an empty map', () => {
  assert.deepEqual(topOfMonth(null, 10), []);
  assert.deepEqual(topOfMonth({}, 10), []);
});
