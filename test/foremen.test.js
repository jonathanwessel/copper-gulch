// Foremen: hired for a building raised to level 10 by hand, they buy its next level whenever it costs half the coins
// on hand or less, never more, and stop while switched off. They keep working offline and survive a save.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, loadGame } from '../src/core/setup.js';
import { cost } from '../src/core/economy.js';
import { FOREMAN_LEVEL, HIRE, SHARE, PAYBACK, canHire, hireCost, hireForeman, setForeman, hasForeman, foremanOn, foremanWait, nextGain, wanted } from '../src/core/foremen.js';
import { marginal, saturation } from '../src/core/market.js';
import { encode, decode } from '../src/core/save.js';
import { foremenWork as foremenStep } from '../src/core/foremen.js';

/* A town with waves held, the camp at level `L`, and no sales (so the coins only change by spending). */
function town(L = FOREMAN_LEVEL, seed = 'f') {
  const g = newGame(seed, 'gulch'), t = g.town;
  Object.assign(t.waves, { hold: true, timer: 0 });
  t.buildings.camp = L; t.sell = { timber: false };
  return { g, t };
}

test('a foreman can be hired only once the building reaches level 10, for its price', () => {
  let { g, t } = town(FOREMAN_LEVEL - 1);
  t.coins = 1e9;
  assert.equal(canHire(t, 'camp'), false);
  assert.equal(hireForeman(g, t, 'camp'), false);
  ({ g, t } = town());
  const c = hireCost(t, 'camp'); assert.equal(c, HIRE * cost(t, 'camp'));
  t.coins = c - 1; assert.equal(hireForeman(g, t, 'camp'), false);
  t.coins = c; const ev = g.bus.record();
  assert.ok(hireForeman(g, t, 'camp'));
  assert.equal(t.coins, 0);
  assert.ok(hasForeman(t, 'camp') && foremanOn(t, 'camp') && !canHire(t, 'camp'));
  assert.ok(ev.some(([n, d]) => n === 'foreman:hire' && d.id === 'camp'));
});

test('a foreman buys a level when it costs half the coins or less, and never more', () => {
  const { g, t } = town(FOREMAN_LEVEL, 'f2');
  t.coins = 1e9; hireForeman(g, t, 'camp');
  const c = cost(t, 'camp');
  t.coins = c / SHARE - 1; g.step(.25);
  assert.equal(t.level('camp'), FOREMAN_LEVEL, 'too dear: it waits');
  t.coins = c / SHARE; g.step(.25);
  assert.equal(t.level('camp'), FOREMAN_LEVEL + 1);
  assert.ok(Math.abs(t.coins - (c / SHARE - c)) < 1e-6, 'it paid the price, and kept the other half');
  t.coins = 1e12; g.step(.25);
  assert.equal(t.level('camp'), FOREMAN_LEVEL + 2, 'one level a step');
});

test('switched off, a foreman buys nothing; switched on again, it goes back to work', () => {
  const { g, t } = town(FOREMAN_LEVEL, 'f3');
  t.coins = 1e9; hireForeman(g, t, 'camp'); setForeman(t, 'camp', false);
  const L = t.level('camp'); for (let i = 0; i < 20; i++) g.step(.25);
  assert.equal(t.level('camp'), L);
  assert.ok(hasForeman(t, 'camp') && !foremanOn(t, 'camp'));
  setForeman(t, 'camp', true); g.step(.25);
  assert.equal(t.level('camp'), L + 1);
});

test('only buildings with a foreman buy by themselves', () => {
  const { g, t } = town(FOREMAN_LEVEL, 'f4');
  t.buildings.mine = 3; t.coins = 1e9;
  for (let i = 0; i < 8; i++) g.step(.25);
  assert.equal(t.level('mine'), 3);
  assert.equal(t.level('camp'), FOREMAN_LEVEL);
});

test('foremen keep working while the game catches up time away, and survive a save', () => {
  const { g, t } = town(FOREMAN_LEVEL, 'f5');
  t.coins = 1e6; hireForeman(g, t, 'camp'); setForeman(t, 'camp', true);
  delete t.sell.timber; // sell timber so coins come in while away
  const L = t.level('camp');
  g.catchUp(1800);
  assert.ok(t.level('camp') > L);
  const b = loadGame(decode(encode(g, 0)).game).town;
  assert.deepEqual(b.foremen, { camp: true });
  setForeman(t, 'camp', false);
  assert.deepEqual(loadGame(decode(encode(g, 0)).game).town.foremen, { camp: false });
});

// A foreman waits on a level that would not pay (PLAN.md M4, Idle income grows): a flooded good nobody is short of, a
// level that takes over an hour to earn back, or its own building short of an input.
test('marginal: what one more unit a second sold adds, base x saturation squared', () => {
  const { g, t } = town(FOREMAN_LEVEL, 'w0');
  assert.ok(Math.abs(marginal(g, t, 'timber') - 1) < 1e-9, 'an empty market pays the base price');
  g.shared.market.rate.timber = 4; // the depth: the price is halved, one more unit adds a quarter
  assert.ok(Math.abs(saturation(g, 'timber') - .5) < 1e-9);
  assert.ok(Math.abs(marginal(g, t, 'timber') - .25) < 1e-9);
});

test('a foreman waits on a flooded good nobody is short of, and buys it again once a workshop runs short', () => {
  const { g, t } = town(40, 'w1');
  delete t.sell.timber; t.coins = 1e12; hireForeman(g, t, 'camp'); t.keep = {}; // the towers keep nothing back
  g.shared.market.rate.timber = 5000; // timber floods the market
  const w = foremanWait(g, t, 'camp');
  assert.deepEqual(w, { why: 'flooded', good: 'timber' });
  assert.ok(nextGain(g, t, 'camp') * PAYBACK < cost(t, 'camp'));
  const L = t.level('camp');
  t.goods = {}; g.shared.market.rate.timber = 5000; foremenStep(g, t);
  assert.equal(t.level('camp'), L, 'it waits');
  // the Sawmill runs short of timber: the camp's next level is wanted whatever timber sells for
  t.buildings.saw = 30; t.starved = { saw: true }; t.goods.timber = 0;
  assert.deepEqual(wanted(g, t, 'timber'), { town: t, id: 'saw' });
  assert.equal(foremanWait(g, t, 'camp'), null);
});

test('a foreman waits while its own building is short of an input, and on a level too slow to pay back', () => {
  const { g, t } = town(FOREMAN_LEVEL, 'w2');
  t.buildings.saw = 20; t.starved = { saw: true }; t.goods.timber = 0; t.coins = 1e12; t.keep = {};
  assert.deepEqual(foremanWait(g, t, 'saw'), { why: 'short', good: 'timber' });
  t.starved = {}; t.goods.timber = 1e6; t.buildings.saw = 120; // a level priced far past what it adds in an hour
  assert.ok(nextGain(g, t, 'saw') > 0);
  assert.deepEqual(foremanWait(g, t, 'saw'), { why: 'slow', good: 'planks' });
  t.buildings.saw = 5;
  assert.equal(foremanWait(g, t, 'saw'), null, 'a cheap level of a good that sells well is bought');
});

test('the tower reserve counts as being short: the towers keep more than the yard holds', () => {
  const { g, t } = town(40, 'w3');
  g.shared.market.rate.timber = 5000; t.goods.timber = 2; t.keep = { timber: 10 };
  assert.deepEqual(wanted(g, t, 'timber'), { town: t, id: 'towers' });
  assert.equal(foremanWait(g, t, 'camp'), null);
});
