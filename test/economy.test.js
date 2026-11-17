// The Gulch chain and the market: chain values, balance, production, costs, saturation and its recovery.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GOODS } from '../src/data/goods.js';
import { BUILDINGS } from '../src/data/buildings.js';
import { TOWNS } from '../src/data/towns/index.js';
import { newGame, loadGame } from '../src/core/setup.js';
import { build, cost, output, produce, unlocked, missing, demand, explainOutput } from '../src/core/economy.js';
import { price, sell, quote, saturation, TAU } from '../src/core/market.js';

const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e * Math.max(1, Math.abs(b));

test('chain: each made good is worth 1.3 to 1.6 times its inputs at base price', () => {
  for (const [id, b] of Object.entries(BUILDINGS)) {
    const ins = Object.entries(b.inputs);
    if (!ins.length) continue;
    const v = ins.reduce((s, [g, n]) => s + GOODS[g].price * n, 0), r = GOODS[b.makes].price / v;
    assert.ok(r >= 1.3 && r <= 1.6, `${id}: ${r.toFixed(2)}`);
  }
});

test('chain: at equal levels every supplier keeps up with each of its consumers', () => {
  const maker = Object.fromEntries(Object.entries(BUILDINGS).map(([id, b]) => [b.makes, id]));
  for (const [id, b] of Object.entries(BUILDINGS)) for (const [g, n] of Object.entries(b.inputs)) {
    assert.ok(BUILDINGS[maker[g]].rate + 1e-9 >= b.rate * n, `${maker[g]} feeds ${id}`);
  }
});

test('chain: every good has exactly one maker, and every building and good belongs to a known town', () => {
  const makers = {};
  for (const b of Object.values(BUILDINGS)) makers[b.makes] = (makers[b.makes] || 0) + 1;
  for (const g of Object.keys(GOODS)) assert.equal(makers[g], 1, g);
  for (const t of Object.values(TOWNS)) {
    for (const id of t.buildings) assert.equal(BUILDINGS[id].town, t.id);
    for (const g of t.goods) assert.equal(GOODS[g].town, t.id);
    assert.ok(t.goods.includes(t.top));
  }
});

test('a new game starts in the Gulch with a Lumber Camp and a few coins', () => {
  const g = newGame('t');
  assert.equal(g.active, 'gulch');
  assert.equal(g.town.level('camp'), 1);
  assert.equal(g.town.coins, TOWNS.gulch.start.coins);
});

test('the camp makes timber, which sells, and coins come in', () => {
  const g = newGame('t');
  for (let i = 0; i < 40; i++) g.step(.25); // 10 s
  assert.ok(g.town.made.timber > 9.9 && g.town.made.timber < 10.1);
  const kept = g.town.keep.timber; // timber held back for the first crossbow
  assert.ok(kept > 0 && Math.abs(g.town.goods.timber - kept) < 1e-6, 'keeps ' + kept);
  assert.ok(g.town.lifetime > 1, String(g.town.lifetime));
  assert.ok(g.town.flags.firstSale);
});

test('buildings cost more each level, need their prerequisites, and output grows with level and milestones', () => {
  const g = newGame('t'), t = g.town;
  t.coins = 1e9;
  const c1 = cost(t, 'camp'); assert.ok(build(g, t, 'camp')); assert.ok(cost(t, 'camp') > c1);
  assert.equal(unlocked(t, 'saw'), false); assert.deepEqual(missing(t, 'saw'), [{ id: 'camp', level: 5 }]);
  assert.equal(build(g, t, 'saw'), false);
  while (t.level('camp') < 9) build(g, t, 'camp');
  const at9 = output(t, 'camp'); build(g, t, 'camp');
  assert.ok(near(output(t, 'camp'), at9 / 9 * 10 * 2), 'level 10 doubles');
  assert.ok(build(g, t, 'saw'));
  const parts = explainOutput(t, 'camp');
  assert.ok(near(parts.reduce((p, x) => p * x.factor, 1), output(t, 'camp')));
  t.coins = 0; assert.equal(build(g, t, 'camp'), false);
});

test('workshops use their inputs and go short when a supplier lags', () => {
  const g = newGame('t'), t = g.town;
  t.buildings = { camp: 1, saw: 2 }; t.goods = {};
  produce(t, 1);
  assert.ok(t.starved.saw);
  assert.ok(near(t.goods.planks, .5), 'one timber a second makes half a plank');
  assert.ok(near(t.goods.timber || 0, 0));
  t.buildings = { camp: 2, saw: 2 }; t.goods = { timber: 50 };
  produce(t, 1); assert.ok(!t.starved.saw);
  assert.ok(near(demand(t).timber, 2));
});

test('the town keeps its workshops inputs and sells the rest', () => {
  const g = newGame('t'), t = g.town;
  t.buildings = { camp: 4, saw: 1 }; t.goods = {};
  for (let i = 0; i < 400; i++) g.step(.25);
  const want = 10 + t.keep.timber; // 10 s of the sawmill's timber, plus what the next tower needs
  assert.ok(Math.abs(t.goods.timber - want) < 1, 'keeps ' + want + ', has ' + t.goods.timber);
  assert.ok((t.goods.planks || 0) < 1e-6, 'planks sell');
});

test('market: flooding one good drops its price and it recovers with time', () => {
  const g = newGame('m'), t = g.town, p0 = price(g, t, 'timber');
  t.goods.timber = 1000; sell(g, t, 'timber', 1000);
  const p1 = price(g, t, 'timber');
  assert.ok(p1 < p0 * .2, `${p0} -> ${p1}`);
  t.buildings = {}; // stop the camp so only recovery moves the price
  for (let i = 0; i < TAU * 4 * 4; i++) g.step(.25);
  assert.ok(price(g, t, 'timber') > p0 * .9, String(price(g, t, 'timber')));
});

test('market: one big sale pays the same as many small ones', () => {
  const a = newGame('m'), b = newGame('m');
  a.town.goods.planks = 100; b.town.goods.planks = 100;
  const big = sell(a, a.town, 'planks', 100);
  let small = 0; for (let i = 0; i < 100; i++) small += sell(b, b.town, 'planks', 1);
  assert.ok(near(big, small, 1e-9), `${big} vs ${small}`);
});

test('market: a spread of goods pays more than the same value of one good', () => {
  const a = newGame('m'), b = newGame('m');
  const one = quote(a, a.town, 'timber', 120);
  const spread = quote(b, b.town, 'timber', 40) + quote(b, b.town, 'clay', 40) + quote(b, b.town, 'ore', 40 / 1.5);
  assert.ok(spread > one * 1.1, `${spread} vs ${one}`);
});

test('market: selling s units a second settles at rate s whatever the step size', () => {
  for (const dt of [.25, 5, 60]) {
    const g = newGame('r'), t = g.town, m = g.shared.market;
    for (let s = 0; s < 1200; s += dt) { m.rate.copper = (m.rate.copper || 0) * Math.exp(-dt / TAU); t.goods.copper = 2 * dt; sell(g, t, 'copper', 2 * dt, dt); }
    assert.ok(Math.abs(m.rate.copper - 2) < .05, dt + ': ' + m.rate.copper);
  }
  assert.equal(saturation(newGame('x'), 'copper'), 1);
});

test('economy runs the same after a save and load, and offline catch-up earns', () => {
  const g = newGame('s'); g.town.coins = 5000;
  for (let i = 0; i < 5; i++) build(g, g.town, 'camp');
  build(g, g.town, 'mine'); build(g, g.town, 'saw');
  for (let i = 0; i < 200; i++) g.step(.25);
  const h = loadGame(JSON.parse(JSON.stringify(g.toJSON())));
  for (let i = 0; i < 200; i++) { g.step(.25); h.step(.25); }
  assert.deepEqual(h.toJSON(), g.toJSON());
  const before = g.town.lifetime, r = g.catchUp(3600);
  assert.ok(r.earned.gulch > 0 && near(g.town.lifetime - before, r.earned.gulch));
});
