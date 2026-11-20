// M5, words and numbers from the reviews of 2026.11.18-17 and 2026.11.19-1: prices read rounded and never "0 coins",
// a price breakdown never reads "× 0", the Income total is written like the top bar, a goal that sends the player to
// another town is marked so a boss fight can keep it off the strip, and the back card names the button as it reads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { explainPrice } from '../src/core/explain.js';
import { mulShown, mulText, unitText, explainBox } from '../src/ui/explain.js';
import { fmtPrice, sellsFor, fmtLive, ALMOST, priceNum } from '../src/ui/format.js';
import { GOALS } from '../src/data/goals.js';
import { EXPLAINERS } from '../src/data/explainers.js';
import { sendsAway } from '../src/core/goals.js';
import { PATHS } from '../src/data/towers.js';

test('prices read rounded: one decimal under 10 coins, one digit that is not 0 under 0.1, never 0 coins for a good that sells', () => {
  assert.equal(fmtPrice(.93), '0.9 coins');
  assert.equal(fmtPrice(1.02), '1 coin');
  assert.equal(fmtPrice(4.56), '4.6 coins');
  assert.equal(fmtPrice(36.4), '36 coins');
  assert.equal(fmtPrice(.004), ALMOST);
  assert.equal(fmtPrice(.012), '0.01 coins');
  assert.equal(fmtPrice(.0623), '0.06 coins');
  assert.equal(sellsFor(.004), 'sells for under 1 coin each');
  assert.equal(sellsFor(1.5), 'sells for 2 coins each'); // whole coins from 1 up (review of 2026.11.20-6)
  assert.equal(unitText('coins', .93), '0.9 coins');
});

test('a flooded good reads "× 0.003", and a price breakdown multiplies as written to its total', () => {
  assert.equal(mulText(.003), '× 0.003');
  assert.equal(mulText(.0004), '× 0.0004');
  const g = newGame('rv19', 'gulch'), t = g.town;
  for (const base of [1.5, 4, 12]) for (const s of [.8, .62, .31, .12, .05, .02, .004, .0013, .0007]) {
    const ex = { unit: 'coins', value: base * s, rows: [{ label: 'Base price', base }, { label: 'Sold a lot lately', mul: s }] };
    const vals = mulShown(ex);
    assert.notEqual(vals[1], 0, 'saturation ' + s);
    if (ex.value >= .0095) assert.equal(priceNum(base * vals[1]), priceNum(ex.value), base + ' × ' + s);
  }
  assert.ok(explainPrice(g, t, 'timber').value > 0);
});

test('the Income sheet writes a rate the way the top bar does', () => {
  for (const v of [5.36, 5.39, 36.7, 999.96, 1234]) assert.equal(unitText('rate', v), fmtLive(v) + '/s');
});

test('every goal that sends the player to another town is marked, so a boss fight here keeps it off the strip', () => {
  for (const g of GOALS) {
    const away = /^(Go to|Tap Map)/.test(g.text);
    assert.equal(sendsAway(g), away, g.id + ': ' + g.text);
  }
  assert.equal(sendsAway(null), false);
});

test('the back card names the button as it reads, and both strong paths say what they cost', () => {
  const e = EXPLAINERS.find(x => x.id === 'back');
  assert.equal(e.say({ back: 'drycreek' }), 'Tap ◂ Dry Creek to switch to Dry Creek Outpost.');
  assert.equal(e.say({ back: null }), null);
  assert.match(PATHS.mortar.a.about, /slower/);
  assert.match(PATHS.cannon.a.about, /slower/);
});
