import test from 'node:test';
import assert from 'node:assert/strict';
import { wetBulb, estimateWbgt, riskLevel, floorPlan, isAtLeastAsStrict, isMiddayBreak } from '../src/heat.js';

test('Stull wet-bulb matches the published reference value', () => {
  // Stull (2011): 20 °C at 50% RH gives a wet-bulb of about 13.7 °C.
  assert.ok(Math.abs(wetBulb(20, 50) - 13.7) < 0.1);
});

test('sun raises WBGT and shade lowers it', () => {
  const base = { tempC: 38, rh: 40, solarWm2: 900, windMs: 2 };
  assert.ok(estimateWbgt(base) > estimateWbgt({ ...base, inShade: true }));
});

test('heavier work reaches a higher risk level at the same WBGT', () => {
  assert.equal(riskLevel(29, 'heavy'), 2);
  assert.equal(riskLevel(29, 'moderate'), 1);
  assert.equal(riskLevel(29, 'light'), 1);
  assert.equal(riskLevel(20, 'heavy'), 0);
  assert.equal(riskLevel(40, 'light'), 4);
});

test('plan strictness check', () => {
  assert.ok(isAtLeastAsStrict(floorPlan(2), 2));
  assert.ok(isAtLeastAsStrict(floorPlan(3), 2));
  assert.ok(!isAtLeastAsStrict(floorPlan(1), 2));
  assert.ok(!isAtLeastAsStrict({ ...floorPlan(2), rest: 5 }, 2));
  assert.ok(isAtLeastAsStrict({ ...floorPlan(2), water: 10 }, 2));
});

test('UAE midday break window (Dubai time, 15 Jun – 15 Sep, 12:30–15:00)', () => {
  assert.equal(isMiddayBreak(new Date('2026-07-01T09:00:00Z')), true); // 13:00 Dubai
  assert.equal(isMiddayBreak(new Date('2026-07-01T08:29:00Z')), false); // 12:29
  assert.equal(isMiddayBreak(new Date('2026-07-01T11:00:00Z')), false); // 15:00
  assert.equal(isMiddayBreak(new Date('2026-06-14T09:00:00Z')), false);
  assert.equal(isMiddayBreak(new Date('2026-09-15T09:00:00Z')), true);
  assert.equal(isMiddayBreak(new Date('2026-10-10T09:00:00Z')), false);
});
