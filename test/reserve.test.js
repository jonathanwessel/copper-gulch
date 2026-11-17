// The tower reserve: auto-sell never sells the goods the towers need next (every tower's next upgrade, the path
// choice at level 4, the cheapest tower that could be built on a free pad or pit), each good has a "Keep for towers"
// switch that is on by default, and the tower card can say what a buy is short of and how long it will take.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, loadGame } from '../src/core/setup.js';
import { buildTower, upgradeTower, towerCost, towerReserve, setReserve, shortfall, canPay, pitSpots } from '../src/core/defense.js';
import { output, demand, KEEP_SECONDS } from '../src/core/economy.js';
import { migrate, SAVE_VERSION } from '../src/core/save.js';
import { TOWERS, PATH_LEVEL } from '../src/data/towers.js';

const run = (g, sec) => { for (let i = 0; i < sec * 4; i++) g.step(.25); };
/* A town with a working chain, waves held, and lots of coins (goods come only from its own buildings). */
function town(seed) {
  const g = newGame(seed), t = g.town;
  t.coins = 1e9; t.buildings = { camp: 30, mine: 20, pit: 20, saw: 12, smelter: 12, kiln: 12 };
  Object.assign(t.waves, { phase: 'break', timer: 1e9, hold: true });
  return { g, t };
}
const sum = cs => { const o = {}; for (const c of cs) for (const [k, n] of Object.entries(c.goods)) o[k] = (o[k] || 0) + n; return o; };

test('a new town keeps the timber for its first Crossbow from the start', () => {
  const g = newGame('r1'), t = g.town;
  assert.equal(towerReserve(t).timber, TOWERS.crossbow.goods.gulch.timber);
  assert.equal(t.keep.timber, TOWERS.crossbow.goods.gulch.timber);
});

test('the reserve adds up every tower\'s next upgrade and the cheapest new tower for each good', () => {
  const { g, t } = town('r2'); t.goods = { timber: 1e6, copper: 1e6, bricks: 1e6 };
  buildTower(g, t, 0, 'crossbow'); buildTower(g, t, 1, 'crossbow'); upgradeTower(g, t, 1); buildTower(g, t, 2, 'cannon');
  const want = sum([towerCost(t, 'crossbow', 1), towerCost(t, 'crossbow', 2), towerCost(t, 'cannon', 1), towerCost(t, 'crossbow', 0), towerCost(t, 'cannon', 0), towerCost(t, 'frost', 0), towerCost(t, 'still', 0)]);
  // the cheapest tower that uses bricks is the Frost Lens, the cheapest that uses copper the Cannon
  want.copper -= towerCost(t, 'frost', 0).goods.copper; want.bricks -= towerCost(t, 'still', 0).goods.bricks;
  assert.deepEqual(towerReserve(t), want);
});

test('the path choice at level 4 is kept, and a free mortar pit keeps a Mortar once it is open', () => {
  const { g, t } = town('r3'); t.goods = { timber: 1e6, copper: 1e6, bricks: 1e6 };
  buildTower(g, t, 0, 'crossbow'); for (let L = 1; L < PATH_LEVEL - 1; L++) upgradeTower(g, t, 0);
  assert.equal(t.towers[0].level, PATH_LEVEL - 1);
  const before = towerReserve(t).timber;
  assert.equal(before, towerCost(t, 'crossbow', PATH_LEVEL - 1).goods.timber + towerCost(t, 'crossbow', 0).goods.timber);
  const b0 = towerReserve(t).bricks;
  t.flags['open:mortar'] = true;
  assert.equal(towerReserve(t).bricks, b0 + TOWERS.mortar.goods.gulch.bricks);
  for (const p of pitSpots(t)) buildTower(g, t, p, 'mortar'); // every pit full: only the Mortars' upgrades are kept
  assert.equal(towerReserve(t).bricks, b0 + pitSpots(t).length * towerCost(t, 'mortar', 1).goods.bricks);
});

test('auto-sell never sells below the reserve, and then every next buy can be paid at once', () => {
  const { g, t } = town('r4'); t.goods = { timber: 500, copper: 100, bricks: 100 };
  for (let i = 0; i < 6; i++) buildTower(g, t, i, i % 2 ? 'cannon' : 'crossbow');
  for (let i = 0; i < 6; i++) upgradeTower(g, t, i);
  t.goods = {}; t.coins = 1e9;
  for (let k = 0; k < 120 * 4; k++) {
    g.step(.25);
    for (const [good, n] of Object.entries(t.keep)) if (k > 60 * 4 && t.made[good]) assert.ok((t.goods[good] || 0) + 1e-6 >= n, good + ' sold below its reserve');
  }
  for (const tw of t.towers) assert.ok(canPay(t, towerCost(t, tw.kind, tw.level)), tw.kind + ' upgrade');
  const all = sum(t.towers.map(tw => towerCost(t, tw.kind, tw.level)));
  assert.ok(Object.keys(all).length >= 2);
  for (const [good, n] of Object.entries(all)) assert.ok(t.goods[good] + 1e-6 >= n, 'all upgrades together: ' + good);
  assert.ok(t.lifetime > 0, 'the rest still sells');
});

test('no workshop starves because of the reserve', () => {
  const a = town('r5'), b = town('r5');
  for (const { g, t } of [a, b]) { t.goods = { timber: 500, copper: 100, bricks: 100 }; for (let i = 0; i < 8; i++) buildTower(g, t, i, 'crossbow'); }
  b.t.reserveOff = { timber: true };
  run(a.g, 120); run(b.g, 120);
  assert.deepEqual(a.t.starved, {});
  assert.deepEqual(a.t.made.planks.toFixed(3), b.t.made.planks.toFixed(3), 'the workshops make the same with or without it');
});

test('Keep for towers is on by default, and switching it off lets the good sell', () => {
  const { g, t } = town('r6');
  assert.ok(t.keep.timber > 0);
  setReserve(t, 'timber', false);
  assert.equal(t.keep.timber, undefined);
  run(g, 30);
  assert.ok(Math.abs((t.goods.timber || 0) - demand(t).timber * KEEP_SECONDS) < 1e-6, 'timber sells down to the workshops buffer');
  setReserve(t, 'timber', true);
  assert.ok(t.keep.timber > 0);
  const h = loadGame(JSON.parse(JSON.stringify(g.toJSON())));
  setReserve(t, 'timber', false);
  assert.deepEqual(loadGame(JSON.parse(JSON.stringify(g.toJSON()))).town.reserveOff, { timber: true }, 'the switch is saved');
  assert.deepEqual(h.town.reserveOff, {});
});

test('shortfall names the good, how much is there, the building that makes it and about how long', () => {
  const g = newGame('r7'), t = g.town;
  t.goods = { copper: 2 };
  const c = towerCost(t, 'cannon', 0);
  let s = shortfall(t, c);
  assert.equal(s.length, 1);
  assert.deepEqual([s[0].good, s[0].have, s[0].need, s[0].maker, s[0].seconds], ['copper', 2, c.goods.copper, 'smelter', null]);
  t.buildings.smelter = 2; t.buildings.mine = 10;
  s = shortfall(t, c);
  assert.ok(Math.abs(s[0].seconds - (c.goods.copper - 2) / output(t, 'smelter')) < 1e-9);
  t.goods.copper = 99; assert.deepEqual(shortfall(t, c), []);
});

test('save v4: an older save gets every Keep for towers switch on', () => {
  assert.ok(SAVE_VERSION >= 4);
  const s = migrate({ v: 3, at: 0, game: { towns: { gulch: { waves: { phase: 'break', foes: [], shells: [], fires: [] } } } } });
  assert.deepEqual([s.v, s.game.towns.gulch.reserveOff], [SAVE_VERSION, {}]);
});
