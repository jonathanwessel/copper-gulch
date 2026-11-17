// What the play screen shows (PLAN.md M2, box 1): side buttons that appear when they become useful, and the dots
// that say something there wants the player.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { tabs, dots, look, lookGoods, lookPerks, listedGoods } from '../src/core/reveal.js';
import { build } from '../src/core/economy.js';
import { winOutpost } from '../src/core/outpost.js';
import { startResearch, itemsOf } from '../src/core/research.js';
import { DEEDS } from '../src/data/perks.js';

const run = (g, seconds) => { for (let i = 0; i < seconds * 4; i++) g.step(.25); };

test('a new game shows Pause, Hold waves and Menu, and nothing else yet', () => {
  const g = newGame('r1'), t = tabs(g, g.town);
  assert.deepEqual([t.pause, t.hold, t.menu], [true, true, true]);
  assert.deepEqual([t.goods, t.research, t.perks, t.chip], [false, false, false, false]);
});

test('Goods comes out with a second good, then stays out in every town once its card was seen', () => {
  const g = newGame('r2'), dc = g.town;
  assert.equal(listedGoods(dc).length, 1);
  dc.buildings.dmine = 1;
  assert.equal(tabs(g, dc).goods, true);
  // a fresh Gulch makes one good, but a player who met Goods in Dry Creek keeps the button
  winOutpost(g, dc); g.go('gulch');
  assert.equal(tabs(g, g.town).goods, false);
  g.shared.seen = { ...(g.shared.seen || {}), goods: true };
  assert.equal(tabs(g, g.town).goods, true);
});

test('the Goods dot shows for a good new to the list and goes once the list is opened', () => {
  const g = newGame('r3'), dc = g.town;
  dc.buildings.dmine = 1;
  assert.equal(dots(g, dc).goods, true);
  lookGoods(dc);
  assert.equal(dots(g, dc).goods, false);
});

test('Research comes out when research opens, with a dot while nothing runs and an item can be paid', () => {
  const g = newGame('r4', 'gulch'), t = g.town;
  assert.equal(tabs(g, t).research, false);
  t.flags['open:research'] = true;
  assert.equal(tabs(g, t).research, true);
  t.coins = 0;
  assert.equal(dots(g, t).research, false, 'no dot when nothing can be paid');
  t.coins = 1e6;
  assert.equal(dots(g, t).research, true);
  assert.ok(startResearch(g, t, itemsOf(t)[0]));
  assert.equal(dots(g, t).research, false, 'no dot while an item runs');
});

test('Perks comes out at the first charter offer, with a dot until the sheet is opened, and again for a new deed', () => {
  const g = newGame('r5', 'gulch'), t = g.town;
  assert.equal(tabs(g, t).perks, false);
  t.bestWave = DEEDS.wave;
  run(g, 1);
  assert.equal(tabs(g, t).perks, true);
  assert.equal(dots(g, t).perks, true);
  lookPerks(t);
  assert.equal(dots(g, t).perks, false);
  t.bestWave = DEEDS.wave + DEEDS.waveStep;
  assert.equal(dots(g, t).perks, true, 'a second deed earned');
});

test('Perks never shows in an outpost', () => {
  const g = newGame('r6');
  g.shared.charter.offered = true;
  assert.equal(tabs(g, g.town).perks, false);
});

test('a town button gets a dot when that town was raided while you were away, and loses it on a visit', () => {
  const g = newGame('r7'), dc = g.town;
  winOutpost(g, dc); g.go('gulch'); look(g.town);
  assert.equal(tabs(g, g.town).chip, true);
  assert.deepEqual(dots(g, g.town).towns, {});
  look(dc);
  dc.breaches = (dc.breaches || 0) + 1;
  assert.deepEqual(dots(g, g.town).towns, { drycreek: true });
  g.go('drycreek'); look(dc);
  g.go('gulch');
  assert.deepEqual(dots(g, g.town).towns, {});
});

test('the Goods card waits for the Goods button, and the Red dots card shows once a dot does', async () => {
  const { EXPLAINERS } = await import('../src/data/explainers.js');
  const { helper } = await import('../src/ui/coach.js');
  const E = id => EXPLAINERS.find(e => e.id === id);
  const g = newGame('r8'), dc = g.town;
  assert.equal(E('goods').when(helper(dc, g)), false);
  assert.equal(E('dots').when(helper(dc, g)), false);
  dc.buildings.dmine = 1;
  assert.equal(E('goods').when(helper(dc, g)), true);
  assert.equal(E('dots').when(helper(dc, g)), true);
  assert.ok(EXPLAINERS.indexOf(E('goods')) < EXPLAINERS.indexOf(E('dots')), 'the Goods card comes first');
});

test('the goods strip shows what the town makes, holds, and needs for its towers, from the very start', async () => {
  const { stripGoods, tabs } = await import('../src/core/reveal.js');
  const { newGame } = await import('../src/core/setup.js');
  const dc = newGame('strip1');
  assert.deepEqual(stripGoods(dc.town), ['stone'], 'Dry Creek: the stone its Crossbow costs, even before any is cut');
  assert.equal(tabs(dc, dc.town).strip, true);
  dc.town.buildings.dmine = 1;
  assert.deepEqual(stripGoods(dc.town), ['ore', 'stone'], 'in the order of the goods list');
  const g = newGame('strip2', 'gulch');
  assert.ok(['timber', 'ore', 'clay', 'planks'].every(x => stripGoods(g.town).includes(x)), 'every good an open tower kind costs');
  assert.ok(!stripGoods(g.town).includes('bricks'), 'not the Mortar\'s bricks before it opens');
  g.town.goods.bricks = 5;
  assert.ok(stripGoods(g.town).includes('bricks'), 'but bricks once there are some');
});
