// Review of 2026.11.19-7: the Goods sheet's lines, research levels and the lost toast say what they mean.
import test from 'node:test';
import assert from 'node:assert/strict';
import { goodsLine, levelsDone } from '../src/ui/format.js';
import { lostToast } from '../src/ui/lost.js';

test('a good with every unit kept says there is none to sell, not "all kept" beside Sell On', () => {
  const t = goodsLine({ have: 19, kept: 19, selling: true, price: 2 });
  assert.equal(t, '19 in stock · 19 for towers · 0 spare');
  assert.doesNotMatch(t, /sells for/);
});

test('a good not for sale says so and what it would sell for', () => {
  const t = goodsLine({ have: 40, selling: false, price: .9 });
  assert.equal(t, '40 in stock');
  assert.doesNotMatch(t, /worth/);
  assert.equal(goodsLine({ have: 40, kept: 5, selling: true, price: 13 }), '40 in stock · 5 for towers · 35 spare');
  assert.equal(goodsLine({ have: 40, selling: true, price: 13, open: true }), '40 in stock'); // the open box says the price
});

test('research says how many levels are done', () => {
  assert.equal(levelsDone(0, 5), '0 of 5 done');
  assert.equal(levelsDone(2, 5), '2 of 5 done');
});

test('the lost toast is one step, and the map card says the rest', () => {
  const town = { def: { name: 'Copper Gulch', short: 'Copper Gulch' }, lost: { why: 'vault', back: 8 }, wave: 8 };
  assert.equal(lostToast(town), 'The vault in Copper Gulch fell. Tap Map to go there.');
  assert.equal(lostToast(town, false, null, true), 'The vault in Copper Gulch fell. Tap Copper Gulch to see it.');
});

test('goods shipped in for a built workshop stay on the strip at 0', async () => {
  const { stripGoods } = await import('../src/core/reveal.js');
  const { newGame } = await import('../src/core/setup.js');
  const g = newGame('strip197', 'ridge'), t = g.town;
  t.goods.bricks = 0;
  const before = stripGoods(t).includes('bricks');
  t.buildings.boilershop = 1;
  assert.ok(stripGoods(t).includes('bricks'), 'the Boiler Shop uses bricks, so they show at 0');
  assert.equal(before, false, 'not before the Boiler Shop stands (unless a tower needs them)');
});
