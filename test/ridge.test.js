// Iron Ridge (M3): founding it from Copper Gulch, its chain and towers, the armored train, routes that ship bricks and
// tools from the Gulch, and Pine Hollow, the second outpost that opens with it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, loadGame } from '../src/core/setup.js';
import { encode, decode } from '../src/core/save.js';
import { build, output, demand, KEEP_SECONDS } from '../src/core/economy.js';
import { buildTower, upgradeTower, towerCost, towerIn, planWave, bossWave, waitsAway } from '../src/core/defense.js';
import { nextTowns, canFound, foundTown } from '../src/core/empire.js';
import { isOutpost } from '../src/core/outpost.js';
import { tabs } from '../src/core/reveal.js';
import { TOWNS } from '../src/data/towns/index.js';

const run = (g, seconds) => { for (let i = 0; i < seconds * 4; i++) g.step(.25); };
/* A Gulch that has reached `wave` and holds `coins`. */
function gulch(seed, wave = 20, coins = 2e5) {
  const g = newGame(seed, 'gulch'), t = g.town;
  t.bestWave = wave; t.coins = coins;
  return g;
}

test('Iron Ridge shows as a locked town at Gulch wave 15 and can be founded at wave 20 with 15K coins', () => {
  const f = TOWNS.ridge.found;
  assert.deepEqual([f.from, f.wave, f.coins], ['gulch', 20, 15000]);
  let g = gulch('r1', 14);
  assert.deepEqual(nextTowns(g), []);
  assert.equal(tabs(g, g.town).chip, false);
  g = gulch('r1', 15, 1000);
  assert.deepEqual(nextTowns(g).map(n => [n.id, n.ready]), [['ridge', false]]);
  assert.equal(tabs(g, g.town).chip, true, 'the town buttons come out to show it');
  assert.equal(canFound(g, 'ridge'), false);
  g = gulch('r1', 20, 14999);
  assert.equal(canFound(g, 'ridge'), false, 'short of the coins');
  g.town.coins = 15000;
  assert.equal(canFound(g, 'ridge'), true);
});

test('founding Iron Ridge pays from the Gulch and opens the Ridge and Pine Hollow, once', () => {
  const g = gulch('r2'), seen = [];
  g.bus.on('town:found', e => seen.push(e));
  const r = foundTown(g, 'ridge');
  assert.ok(r);
  assert.equal(g.towns.gulch.coins, 2e5 - 15000 + g.defs.ridge.start.coins + g.defs.pinehollow.start.coins, 'paid from the purse; the new towns bring their start coins');
  assert.equal(g.towns.ridge.coins, g.towns.gulch.coins, 'one purse');
  assert.deepEqual(Object.keys(g.towns).sort(), ['gulch', 'pinehollow', 'ridge']);
  assert.equal(g.active, 'gulch', 'founding does not move the player; the screen takes them there');
  assert.ok(isOutpost(g.towns.pinehollow));
  assert.deepEqual(seen.map(e => [e.town, e.from, e.coins]), [['ridge', 'gulch', 15000]]);
  assert.equal(foundTown(g, 'ridge'), null);
  assert.deepEqual(nextTowns(g), []);
});

test('the Ridge chain: the Quarry at the start, then iron, coal, pig iron and steel', () => {
  const g = gulch('r3'); foundTown(g, 'ridge'); g.go('ridge');
  const t = g.towns.ridge;
  assert.equal(t.level('rquarry'), 1);
  t.coins = 1e6; t.sell = { stone: false, iron: false, coal: false, pigiron: false, steel: false };
  for (let i = 0; i < 6; i++) build(g, t, 'rquarry');
  for (let i = 0; i < 5; i++) assert.ok(build(g, t, 'ironmine'));
  for (let i = 0; i < 3; i++) assert.ok(build(g, t, 'colliery'));
  assert.ok(build(g, t, 'furnace'));
  for (let i = 0; i < 4; i++) build(g, t, 'furnace');
  assert.ok(build(g, t, 'steelmill'));
  run(g, 60);
  for (const good of ['stone', 'iron', 'coal', 'pigiron', 'steel']) assert.ok((t.made[good] || 0) > 1, good + ' is made');
  assert.ok(output(t, 'furnace') > 0);
});

test('Ridge towers are paid with Ridge goods, the Mortar with pig iron, and the boss is the armored train', () => {
  const g = gulch('r4'); foundTown(g, 'ridge'); g.go('ridge');
  const t = g.towns.ridge;
  assert.deepEqual(towerCost(t, 'crossbow').goods, { stone: 8 });
  assert.deepEqual(towerCost(t, 'cannon').goods, { iron: 6 });
  assert.ok('pigiron' in towerCost(t, 'mortar').goods);
  for (const k of ['crossbow', 'cannon', 'frost', 'still', 'mortar']) assert.ok(towerIn(t, k), k + ' can be built');
  t.coins = 1000; t.goods.stone = 20;
  assert.ok(buildTower(g, t, 0, 'crossbow'));
  assert.ok(bossWave(t, 10));
  assert.equal(planWave(t, 10, 'mixed').at(-1), 'train');
  assert.notEqual(planWave(t, 9, 'mixed').at(-1), 'train');
});

/* A Gulch making bricks and tools, and a Ridge with a Boiler Shop and a Locomotive Works that need them. */
function linked(seed) {
  const g = gulch(seed); foundTown(g, 'ridge');
  const G = g.towns.gulch, r = g.towns.ridge;
  Object.assign(G.buildings, { camp: 30, mine: 20, pit: 20, saw: 15, smelter: 15, kiln: 15, toolsmith: 10 });
  Object.assign(r.buildings, { boilershop: 5, loco: 3 });
  r.coins = 1e6; r.goods.steel = 1e4; r.goods.rails = 1e4; r.sell = { steel: false, rails: false };
  g.go('ridge');
  return { g, G, r };
}

test('routes: the Gulch ships bricks and tools to the Ridge, up to its workshops\' buffer, and no coins change hands', () => {
  const { g, G, r } = linked('r5'), seen = [];
  g.bus.on('route:open', e => seen.push(e.good));
  run(g, 60);
  assert.ok(r.shipped.bricks > 5, 'bricks came in');
  assert.ok(r.shipped.tools > 1, 'tools came in');
  assert.deepEqual(seen.sort(), ['bricks', 'tools'], 'each route opens once');
  assert.ok(G.sent.bricks > 5 && Math.abs(G.sent.bricks - r.shipped.bricks) < 1e-6, 'the Gulch counts what it sent');
  assert.ok(!Object.keys(G.tally).some(k => k.startsWith('ship:')), 'shipping earns no coins');
  const want = demand(r);
  assert.ok((r.goods.bricks || 0) <= want.bricks * KEEP_SECONDS + 1e-6, 'never more than the buffer');
  assert.ok(r.made.boilers > 0, 'the Boiler Shop ran on shipped bricks');
});

test('routes: the Ridge never sells shipped goods, needs no coins for them, and the Gulch\'s Sell switch does not stop it', () => {
  const { g, G, r } = linked('r6');
  G.sell.bricks = false; G.sell.tools = false;
  run(g, 20);
  assert.ok(r.shipped.bricks > 0, 'Sell Off in the Gulch only stops market sales');
  assert.equal(g.shared.market.sold.bricks || 0, 0, 'the Ridge sells none of its bricks');
  const { g: g2, r: r2 } = linked('r7');
  r2.coins = 0;
  run(g2, 20);
  assert.ok(r2.shipped.bricks > 0, 'an empty purse still gets loads');
});

test('routes: the Gulch keeps its own workshops\' buffer before it ships', () => {
  const { g, G, r } = linked('r8');
  G.buildings.toolsmith = 1; G.buildings.wagonworks = 20; G.goods.tools = 0; // the Wagon Works wants more tools than the Toolsmith makes
  run(g, 20);
  assert.equal(r.shipped.tools || 0, 0);
  assert.ok(r.shipped.bricks > 0);
});

test('Pine Hollow: the Crossbow and Cannon paid with timber, the bandit wagon at waves 10 and 15, won at 15', () => {
  const g = gulch('r9'); foundTown(g, 'ridge'); g.go('pinehollow');
  const t = g.towns.pinehollow;
  assert.equal(t.level('logcamp'), 1);
  assert.ok(towerIn(t, 'crossbow') && towerIn(t, 'cannon') && !towerIn(t, 'frost'));
  assert.deepEqual(Object.keys(towerCost(t, 'cannon').goods), ['timber']);
  assert.deepEqual([5, 10, 15, 20].map(w => bossWave(t, w)), [false, true, true, false]);
  assert.equal(planWave(t, 15, 'mixed').at(-1), 'bandits');
  t.bestWave = 15; g.step(.25);
  assert.ok(t.won);
  assert.equal(bossWave(t, 15), false, 'a won outpost never brings its boss again');
});

test('Pine Hollow waits while away until it is won, then keeps its raids', () => {
  const g = gulch('r10'); foundTown(g, 'ridge'); g.go('ridge');
  const t = g.towns.pinehollow, timer = t.waves.timer;
  assert.ok(waitsAway(g, t));
  run(g, 60);
  assert.equal(t.waves.timer, timer, 'its first wave waits for the player');
  t.won = true;
  assert.equal(waitsAway(g, t), false);
});

test('an outpost out of play feeds every town\'s workshops, the town in play first', () => {
  const g = gulch('r11'); foundTown(g, 'ridge');
  const G = g.towns.gulch, p = g.towns.pinehollow;
  G.buildings = { kiln: 10 }; G.goods = {}; // a Kiln short of clay and timber
  p.buildings = { logcamp: 20, claybank: 20 }; p.won = true;
  g.go('ridge');
  run(g, 20);
  assert.ok((G.drawn.clay || 0) > 1 && (G.drawn.timber || 0) > 1, 'the Gulch drew clay and timber while the Ridge was in play');
  assert.ok(G.made.bricks > 0);
});

test('a game with Iron Ridge saves and loads', () => {
  const { g } = linked('r12');
  run(g, 10);
  const back = loadGame(decode(encode(g, 1)).game);
  assert.deepEqual(Object.keys(back.towns).sort(), ['gulch', 'pinehollow', 'ridge']);
  assert.equal(back.active, 'ridge');
  assert.ok(back.towns.ridge.shipped.bricks > 0);
  assert.equal(back.towns.ridge.def.boss, 'train');
});
