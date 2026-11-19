/* The review of 2026.11.19-4: a workshop short of an input says what it really makes, the old-ground bonus says where
   it comes from, and the update line on the title never reads "Checking..". */
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { produce, output } from '../src/core/economy.js';
import { explainMade, explainOutput } from '../src/core/explain.js';
import { mulShown } from '../src/ui/explain.js';
import { OLD_LABEL } from '../src/core/defense.js';

test('a workshop short of its input shows what it really makes, and the breakdown says why', () => {
  const g = newGame('rv194', 'gulch'), t = g.town;
  t.buildings.saw = 2; t.buildings.camp = 0; t.goods.timber = 0;
  for (let i = 0; i < 40; i++) produce(t, .25); // no timber at all: it makes nothing
  const ex = explainMade(t, 'saw'), full = explainOutput(t, 'saw').value;
  assert.ok(ex.lacking && ex.short === 'timber');
  assert.ok(ex.value < full * .05, 'made ' + ex.value + ' of ' + full);
  assert.equal(ex.rows.at(-1).label, 'Not enough timber');
  // timber for half its use: it settles near half
  const half = output(t, 'saw') * 2 * .5;
  for (let i = 0; i < 200; i++) { t.goods.timber = half * .25; produce(t, .25); }
  const ex2 = explainMade(t, 'saw');
  assert.ok(Math.abs(ex2.value - full / 2) < full * .05, 'about half: ' + ex2.value);
  assert.ok(mulShown(ex2).every((v, i) => (ex2.rows[i].base !== undefined ? v === null : v > 0)));
  // with plenty it reads its full output, with no extra row
  for (let i = 0; i < 200; i++) { t.goods.timber = 1000; produce(t, .25); }
  const ex3 = explainMade(t, 'saw');
  assert.ok(!ex3.lacking); assert.equal(ex3.value, full);
});

test('the old-ground bonus on the tower card says where it comes from', () => {
  assert.match(OLD_LABEL, /beat your best wave/); // the explainer's words (review of 2026.11.19-8)
});

test('the update line has no doubled or clipped dots', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../src/ui/update.js', import.meta.url), 'utf8');
  assert.ok(!/Checking\.\.\./.test(src));
});
