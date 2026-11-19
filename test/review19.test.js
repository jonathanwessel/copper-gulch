// M5, words and numbers from the reviews of 2026.11.18-17 and 2026.11.19-1: prices read rounded and never "0 coins",
// a price breakdown never reads "× 0", the Income total is written like the top bar, a goal that sends the player to
// another town is marked so a boss fight can keep it off the strip, and the back card names the button as it reads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { explainPrice } from '../src/core/explain.js';
import { mulShown, mulText, unitText, explainBox } from '../src/ui/explain.js';
import { fmtPrice, sellsFor, fmtLive, ALMOST } from '../src/ui/format.js';
import { GOALS } from '../src/data/goals.js';
import { EXPLAINERS } from '../src/data/explainers.js';
import { sendsAway } from '../src/core/goals.js';
import { PATHS } from '../src/data/towers.js';

test('prices read rounded: one decimal under 10 coins, under 0.1 coin near 0, never 0 coins for a good that sells', () => {
  assert.equal(fmtPrice(.93), '0.9 coins');
  assert.equal(fmtPrice(1.02), '1 coin');
  assert.equal(fmtPrice(4.56), '4.6 coins');
  assert.equal(fmtPrice(36.4), '36 coins');
  assert.equal(fmtPrice(.004), ALMOST);
  assert.equal(sellsFor(.004), 'sells for under 0.1 coin each');
  assert.equal(sellsFor(1.5), 'sells for 1.5 coins each');
  assert.equal(unitText('coins', .93), '0.9 coins');
});

test('a flooded good reads "× under 0.01", and a price breakdown multiplies as written to its total', () => {
  assert.equal(mulText(.003), '× under 0.01');
  const g = newGame('rv19', 'gulch'), t = g.town;
  for (const s of [1, .8, .62, .31, .12, .05, .004]) {
    const ex = { unit: 'coins', value: 1.5 * s, rows: [{ label: 'Base price', base: 1.5 }, { label: 'Sold a lot lately', mul: s }] };
    const vals = mulShown(ex), shown = 1.5 * vals[1];
    const want = ex.value < 10 ? Math.round(ex.value * 10) / 10 : ex.value;
    assert.equal(Math.round(shown * 10) / 10, want, 'saturation ' + s);
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
  assert.equal(e.say({ back: 'drycreek' }), 'Tap ◂ Dry Creek next to Map to go back to the town you played last.');
  assert.equal(e.say({ back: null }), null);
  assert.match(PATHS.mortar.a.about, /slower/);
  assert.match(PATHS.cannon.a.about, /slower/);
});
