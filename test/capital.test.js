// The Capital (M4): founding it from Iron Ridge, its federal contracts and Influence, the save, and the map.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, loadGame } from '../src/core/setup.js';
import { encode, decode, migrate, SAVE_VERSION } from '../src/core/save.js';
import { KEEP_SECONDS, demand } from '../src/core/economy.js';
import { foundTown } from '../src/core/empire.js';
import { capitalOf, capitalOpen, capitalNext, canFoundCapital, foundCapital, takeContract, dropContract, contractGoods, spareRate, spareNow, claim, nice } from '../src/core/capital.js';
import { mapSites, lockedRules, mapCalls } from '../src/core/map.js';
import { incomeLabel } from '../src/core/explain.js';
import { CAPITAL_DEF } from '../src/data/capital.js';
import { GOODS } from '../src/data/goods.js';

const F = CAPITAL_DEF.found, C = CAPITAL_DEF.contracts;
const run = (g, seconds) => { for (let i = 0; i < seconds * 4; i++) g.step(.25); };
/* A game with the Gulch and Iron Ridge open, both with working chains, and the Ridge at `wave`. */
function empire(seed = 'cap', wave = F.wave, coins = F.coins) {
  const g = newGame(seed, 'gulch'), gu = g.town;
  gu.bestWave = 20; gu.coins = 1e9;
  foundTown(g, 'ridge');
  const r = g.towns.ridge;
  Object.assign(gu.buildings, { camp: 12, mine: 12, pit: 12, saw: 10, smelter: 10, kiln: 8, toolsmith: 4 });
  Object.assign(r.buildings, { rquarry: 12, ironmine: 12, colliery: 12, furnace: 10, steelmill: 8, rolling: 4, boilershop: 3 });
  for (const t of [gu, r, g.towns.pinehollow]) if (t.waves) t.waves.hold = true; // no raiders in these tests
  r.bestWave = wave; gu.coins = coins;
  run(g, 30); // the chains fill their buffers
  gu.coins = coins;
  return g;
}

test('the Capital comes into sight at the Ridge wave it names and is built with coins from the purse', () => {
  const g = empire('c1', F.shows - 1);
  assert.equal(capitalNext(g), null, 'not in sight yet');
  assert.equal(canFoundCapital(g), false);
  g.towns.ridge.bestWave = F.shows;
  assert.deepEqual([capitalNext(g).waveOk, capitalNext(g).ready], [false, false]);
  g.towns.ridge.bestWave = F.wave; g.town.coins = F.coins - 1;
  assert.equal(canFoundCapital(g), false, 'one coin short');
  assert.equal(mapCalls(g), false);
  g.town.coins = F.coins + 500;
  assert.equal(canFoundCapital(g), true);
  assert.equal(mapCalls(g), true, 'Map gets a dot');
  assert.equal(lockedRules(g, 'capital').ready, true);
  const seen = []; g.bus.on('capital:found', e => seen.push(e));
  assert.equal(foundCapital(g), true);
  assert.equal(Math.round(g.town.coins), 500, 'the purse paid');
  assert.equal(capitalOpen(g), true);
  assert.equal(foundCapital(g), false, 'only once');
  assert.equal(seen.length, 1);
  assert.equal(mapSites(g)[0].open, true, 'the map shows it built');
  assert.equal(capitalOf(g).offers.length, C.board, 'the board fills');
  assert.equal(mapCalls(g), true, 'no contract running yet: Map keeps its dot');
});

test('contracts ask for made goods a town has to spare, a few minutes of it, and pay coins and Influence', () => {
  const g = empire('c2'); foundCapital(g);
  const c = capitalOf(g), goods = new Set();
  for (const o of c.offers) {
    const d = GOODS[o.good], t = g.towns[o.town];
    assert.ok(d.tier >= 1, o.good + ' is a made good, never raw');
    assert.equal(d.town, o.town, 'asked from the town that makes it');
    assert.ok(!goods.has(o.good), 'no good twice on the board'); goods.add(o.good);
    const rate = spareRate(g, t, o.good);
    assert.ok(rate > 0, o.good + ' is spare');
    assert.ok(o.minutes >= C.minutes[0] && o.minutes <= C.minutes[1]);
    assert.ok(o.need >= C.least[d.tier] && (o.need === C.least[d.tier] || Math.abs(o.need - rate * 60 * o.minutes) / (rate * 60 * o.minutes) < .06), 'about that many minutes of spare goods');
    assert.equal(o.coins, Math.round(o.need * d.price * C.pay));
    assert.equal(o.influence, Math.max(1, Math.round(C.influence[d.tier] * o.minutes / C.per)));
  }
  assert.deepEqual([nice(3456), nice(87), nice(12.3), nice(0)], [3500, 87, 12, 0]);
});

test('a contract taken: its town sends the goods before the market, the Sell switch does not stop it, and it pays when full', () => {
  const g = empire('c3'); foundCapital(g);
  const c = capitalOf(g), o = c.offers[0], t = g.towns[o.town];
  t.sell[o.good] = false; // held back from the market: the Capital still gets it
  const done = []; g.bus.on('contract:done', e => done.push(e));
  assert.equal(takeContract(g, o.id), true);
  assert.equal(c.active.id, o.id);
  assert.equal(mapCalls(g), false, 'a contract is running: no dot');
  assert.equal(c.offers.length, C.board, 'the board fills again');
  const life = t.lifetime, inf = c.influence;
  let s = 0;
  while (c.active && s++ < 4 * 60 * 30) {
    g.step(.25);
    if (c.active) assert.ok((t.goods[o.good] || 0) + 1e-6 >= Math.min(t.goods[o.good] || 0, (demand(t)[o.good] || 0) * KEEP_SECONDS), 'the workshops keep their buffer');
  }
  assert.equal(c.active, null, 'filled within 30 minutes');
  assert.equal(done.length, 1);
  assert.equal(c.filled, 1);
  assert.equal(c.influence - inf, o.influence);
  assert.ok(t.lifetime - life >= o.coins, 'its coins are the town\'s own earnings');
  assert.ok(t.tally.contract >= o.coins);
  assert.equal(incomeLabel('contract'), 'Contracts for the Capital');
  assert.ok(s / 4 / 60 < o.minutes * 2.5, 'it took about as long as it said (' + (s / 240).toFixed(1) + ' min for ' + o.minutes + ')');
});

test('the tower reserve is kept, and a good with nothing to spare is never asked for', () => {
  const g = empire('c4'); foundCapital(g);
  const c = capitalOf(g), o = c.offers[0], t = g.towns[o.town];
  takeContract(g, o.id);
  // what it can send is its stock above the workshops' buffer and the tower reserve (the defense sets town.keep each step)
  t.goods[o.good] = 500; t.keep = { [o.good]: 120 };
  assert.ok(Math.abs(spareNow(t, o.good) - (500 - 120 - (demand(t)[o.good] || 0) * KEEP_SECONDS)) < 1e-6);
  t.keep = { [o.good]: 1e9 };
  assert.equal(spareNow(t, o.good), 0, 'nothing below the reserve');
  claim(g, t);
  assert.equal(t.goods[o.good], 500, 'so nothing is sent');
  // starve a good: its workshops use all of it
  const g2 = empire('c5');
  g2.towns.ridge.buildings.steelmill = 0; g2.towns.ridge.buildings.furnace = 1; g2.towns.ridge.buildings.rolling = 0; g2.towns.ridge.buildings.boilershop = 0;
  g2.towns.ridge.buildings.steelmill = 30; // uses far more pig iron than one Blast Furnace makes
  foundCapital(g2);
  assert.ok(!contractGoods(g2).some(x => x.good === 'pigiron'), 'no pig iron to spare');
  assert.ok(!capitalOf(g2).offers.some(x => x.good === 'pigiron'));
});

test('taking another offer drops the one running, and Drop clears it', () => {
  const g = empire('c6'); foundCapital(g);
  const c = capitalOf(g), [a, b] = c.offers;
  takeContract(g, a.id); run(g, 10);
  assert.ok(c.active.got > 0);
  assert.equal(takeContract(g, b.id), true);
  assert.equal(c.active.id, b.id);
  assert.ok(!c.offers.some(x => x.id === a.id), 'the dropped one is gone');
  assert.equal(c.active.got, 0);
  assert.equal(dropContract(g), true);
  assert.equal(c.active, null);
  assert.equal(dropContract(g), false);
  assert.equal(takeContract(g, 9999), false, 'no such offer');
});

test('the Capital is kept in the save, and the same game draws the same contracts', () => {
  const g = empire('c7'); foundCapital(g);
  const c = capitalOf(g);
  takeContract(g, c.offers[1].id); run(g, 5);
  const back = loadGame(decode(encode(g, 1)).game), c2 = capitalOf(back);
  assert.equal(c2.open, true);
  assert.deepEqual(c2.active, c.active);
  assert.deepEqual(c2.offers, c.offers);
  assert.deepEqual(c2.rng, c.rng);
  // both draw the same next offer
  dropContract(g); dropContract(back);
  takeContract(g, c.offers[0].id); takeContract(back, c2.offers[0].id);
  assert.deepEqual(c2.offers.map(o => [o.good, o.need]), c.offers.map(o => [o.good, o.need]));
});

test('an old save (v13) gets a Capital not built yet', () => {
  const g = newGame('c8'), data = JSON.parse(encode(g, 5));
  delete data.game.shared.capital; data.v = 13;
  const m = migrate(data);
  assert.equal(m.v, SAVE_VERSION);
  assert.equal(m.game.shared.capital.open, false);
  const back = loadGame(m.game);
  assert.equal(capitalOpen(back), false);
  assert.ok(Array.isArray(capitalOf(back).rng), 'its random stream is filled in on load');
  run(back, 2); // the Capital's tick runs on an old save
});
