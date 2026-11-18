// Silver Falls (M5): the river lane and its boats, the ironclad steamer, the power grid, founding it with deeds from
// Iron Ridge, and Sandy Bend, the third outpost that opens with it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, loadGame } from '../src/core/setup.js';
import { encode, decode } from '../src/core/save.js';
import { build, output, gridOf, produce, demand } from '../src/core/economy.js';
import { buildTower, planWave, startWave, lanesOf, laneFor, waveRun, towerCost } from '../src/core/defense.js';
import { nextTowns, canFound, foundTown } from '../src/core/empire.js';
import { lockedRules } from '../src/core/map.js';
import { stripGoods, listedGoods } from '../src/core/reveal.js';
import { shortOf } from '../src/core/foremen.js';
import { STEP } from '../src/core/clock.js';
import { pointAt } from '../src/core/path.js';
import { TOWNS } from '../src/data/towns/index.js';
import { FOES } from '../src/data/foes.js';

const run = (g, seconds) => { for (let i = 0; i < seconds * 4; i++) g.step(STEP); };
/* A game with Iron Ridge at `wave`, `coins` in the purse and `deeds` held. */
function ridge(seed, wave = TOWNS.falls.found.wave, coins = 2e6, deeds = 5) {
  const g = newGame(seed, 'gulch');
  g.addTown('ridge');
  g.towns.ridge.bestWave = wave; g.town.coins = coins; g.shared.charter.deeds = deeds;
  return g;
}
/* A game in Silver Falls. */
function falls(seed) {
  const g = ridge(seed);
  foundTown(g, 'falls'); g.go('falls');
  return g;
}

test('Silver Falls needs Ridge wave 57, the coins and 5 deeds, and the map lists all three', () => {
  const f = TOWNS.falls.found;
  assert.deepEqual([f.from, f.wave, f.deeds], ['ridge', 57, 5]);
  assert.deepEqual(nextTowns(ridge('f1', 19)), [], 'out of sight before Ridge wave 20');
  assert.deepEqual(nextTowns(ridge('f1', 20, 0, 0)).map(n => [n.id, n.ready, n.deedsOk]), [['falls', false, false]]);
  assert.equal(canFound(ridge('f1', f.wave, 2e6, 4), 'falls'), false, 'one deed short');
  assert.equal(canFound(ridge('f1', f.wave, f.coins - 1, 5), 'falls'), false, 'short of coins');
  assert.equal(canFound(ridge('f1', f.wave - 1, 2e6, 5), 'falls'), false, 'one wave short');
  assert.equal(canFound(ridge('f1'), 'falls'), true);
  const lr = lockedRules(ridge('f1', f.wave, 2e6, 2), 'falls');
  assert.deepEqual(lr.rules.map(r => [r.kind, r.done]), [['wave', true], ['deeds', false], ['coins', true]]);
  assert.equal(lr.rules[1].have, 2);
});

test('founding Silver Falls pays from the purse, keeps the deeds and opens Sandy Bend', () => {
  const g = ridge('f2');
  const t = foundTown(g, 'falls');
  assert.ok(t && g.towns.falls && g.towns.sandybend);
  assert.equal(g.shared.charter.deeds, 5, 'deeds are kept, not spent');
  assert.equal(g.towns.falls.level('sandpit'), 1);
  assert.equal(foundTown(g, 'falls'), null, 'once');
});

test('the river: boats ride lane 1 and raiders the road, both end at the vault', () => {
  const g = falls('f3'), t = g.town, [road, river] = lanesOf(t);
  assert.ok(river, 'Silver Falls has a river lane');
  const end = l => l.points[l.points.length - 1];
  assert.deepEqual(end(road), end(river));
  assert.equal(laneFor(t, 'boat'), 1); assert.equal(laneFor(t, 'raider'), 0); assert.equal(laneFor(t, 'steamer'), 1);
  assert.equal(laneFor(g.towns.ridge, 'boat'), 0, 'no river, no river lane');
  const q = planWave(t, 4, 'mixed');
  assert.ok(q.filter(k => k === 'boat').length >= Math.floor(q.length / 3) - 1, 'every third raider comes by boat');
  assert.ok(!planWave(g.towns.ridge, 4, 'mixed').includes('boat'), 'other towns get no boats');
  startWave(g, t); run(g, 20);
  const boats = t.waves.foes.filter(f => f.kind === 'boat'), riders = t.waves.foes.filter(f => f.kind !== 'boat');
  assert.ok(boats.length && riders.length);
  assert.ok(boats.every(f => f.lane === 1) && riders.every(f => !f.lane));
});

test('a boat that reaches the vault hurts it, and towers by the water shoot boats', () => {
  const g = falls('f4'), t = g.town;
  t.waves.foes = [{ id: 99, kind: 'boat', lane: 1, hp: 1, max: 1, s: lanesOf(t)[1].length - .01, slow: 0, slowT: 0, frozenT: 0, poison: 0, poisonT: 0, brittle: 0 }];
  t.waves.phase = 'wave'; t.waves.queue = ['raider'];
  const hp = t.vault.hp;
  g.step(STEP);
  assert.equal(t.vault.hp, hp - FOES.boat.leak);
  // a crossbow beside the river (pad 0 sits between the Sand Pit and the water) kills a boat floating past it
  const g2 = falls('f5'), t2 = g2.town; t2.coins = 1e6; t2.goods.sand = 100;
  assert.ok(buildTower(g2, t2, 0, 'crossbow'));
  const river = lanesOf(t2)[1]; let s = 0;
  const pad = t2.def.board.spots[0];
  // find the stretch of river nearest the pad
  let best = Infinity;
  for (let x = 0; x < river.length; x += .05) { const [px, pz] = pointAt(river, x), d = Math.hypot(px - pad[0], pz - pad[1]); if (d < best) { best = d; s = x; } }
  assert.ok(best < 1.5, 'pad 0 is right by the river');
  t2.waves.foes = [{ id: 7, kind: 'boat', lane: 1, hp: 3, max: 3, s, slow: 0, slowT: 0, frozenT: 0, poison: 0, poisonT: 0, brittle: 0 }];
  t2.waves.phase = 'wave'; t2.waves.queue = ['raider']; t2.waves.timer = 99;
  const coins = t2.coins;
  for (let i = 0; i < 12; i++) g2.step(STEP);
  assert.equal(t2.waves.foes.filter(f => f.kind === 'boat').length, 0, 'the boat was sunk');
  assert.ok(t2.coins > coins, 'and paid its bounty');
});

test('the ironclad steamer is Silver Falls\' boss, on the river, and a gate like every boss', () => {
  const g = falls('f6'), t = g.town;
  const q = planWave(t, 10, 'mixed');
  assert.equal(q[q.length - 1], 'steamer');
  assert.ok(FOES.steamer.boss && FOES.steamer.water);
  // with no towers the steamer gets through: the wave is lost and the town drops back
  t.wave = 10; t.waves.timer = 0; t.vault.hp = t.vault.max = 1e6;
  run(g, 1); assert.equal(t.waves.phase, 'wave');
  run(g, 400);
  assert.ok(t.wave < 10, 'the steamer reached the vault, so wave 10 was lost');
});

test('the background battle plays the river the same as the battle on screen', () => {
  const g = falls('f7'), t = g.town; t.coins = 1e6; t.goods.sand = 500; t.goods.quartz = 500;
  for (const s of [0, 1, 2, 3]) buildTower(g, t, s, 'crossbow');
  t.wave = 4; startWave(g, t);
  const r = waveRun(t);
  assert.ok(r.ev.some(e => e[1] === 'k'), 'raiders and boats fell in the played-out copy');
});

test('the power grid: the Water Wheel feeds every workshop, and they all slow down alike when it falls short', () => {
  const g = falls('f8'), t = g.town;
  Object.assign(t.buildings, { sandpit: 10, waterwheel: 1, glassworks: 4 });
  t.goods.sand = 1e4;
  const grid = gridOf(t);
  assert.equal(grid.made, output(t, 'waterwheel'));
  assert.ok(Math.abs(grid.want - output(t, 'glassworks')) < 1e-9);
  assert.ok(grid.share < 1);
  const before = t.goods.glass || 0;
  produce(t, 1);
  assert.ok(Math.abs((t.goods.glass - before) - output(t, 'glassworks') * grid.share) < 1e-9, 'it runs at the grid\'s share');
  assert.ok(t.starved.glassworks, 'and shows as short');
  assert.equal(t.goods.power || 0, 0, 'power is never kept');
  assert.equal(shortOf(t, 'power'), 'glassworks');
  assert.ok(!('power' in demand(t)), 'power is not a good anyone holds back');
  t.buildings.waterwheel = 6;
  assert.equal(gridOf(t).share, 1);
  produce(t, 1); assert.ok(!t.starved.glassworks);
  assert.equal(shortOf(t, 'power'), null);
});

test('power never shows on the goods strip or the Goods list, and is never sold', () => {
  const g = falls('f9'), t = g.town;
  Object.assign(t.buildings, { waterwheel: 2 });
  run(g, 5);
  assert.ok(!stripGoods(t).includes('power'));
  assert.ok(!listedGoods(t).includes('power'));
  assert.ok(stripGoods(t).includes('sand'), 'sand pays for Crossbows here');
  assert.equal(t.goods.power || 0, 0);
});

test('Silver Falls towers pay with its own goods, and Sandy Bend plays like the other outposts', () => {
  const g = falls('f10'), t = g.town;
  assert.deepEqual(towerCost(t, 'crossbow').goods, { sand: 8 });
  assert.deepEqual(Object.keys(towerCost(t, 'mortar').goods).sort(), ['glass', 'quartz']);
  const sb = g.towns.sandybend;
  assert.equal(sb.def.kind, 'outpost');
  assert.deepEqual(towerCost(sb, 'crossbow').goods, { sand: 6 });
  assert.equal(planWave(sb, 10, 'mixed').pop(), 'bandits');
  assert.ok(!planWave(sb, 5, 'mixed').includes('boat'), 'Sandy Bend has no river');
});

test('a game with Silver Falls saves and loads', () => {
  const g = falls('f11'); run(g, 30);
  const back = loadGame(decode(encode(g, 1)).game);
  assert.ok(back.towns.falls && back.towns.sandybend);
  assert.equal(back.towns.falls.level('sandpit'), g.towns.falls.level('sandpit'));
});
