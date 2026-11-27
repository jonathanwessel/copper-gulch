// Thunder Mesa, part 1a (PLAN.md M6b): founding it from Silver Falls with the Rail Office's third upgrade, its chain of
// oil, bauxite and rubber up to airships on wire and dynamos from the Falls and steel from the Ridge, its road with the
// war wagon at wave 10 until the airship comes, and the goal strip up its chain.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, loadGame } from '../src/core/setup.js';
import { encode, decode } from '../src/core/save.js';
import { build, output } from '../src/core/economy.js';
import { planWave, lanesOf, buildTower } from '../src/core/defense.js';
import { nextTowns, canFound, foundTown } from '../src/core/empire.js';
import { lockedRules } from '../src/core/map.js';
import { goalNow, INST_WORDS } from '../src/core/goals.js';
import { STEP } from '../src/core/clock.js';
import { TOWNS, TOWN_ORDER } from '../src/data/towns/index.js';
import { BUILDINGS } from '../src/data/buildings.js';
import { GOODS } from '../src/data/goods.js';
import { TOWERS } from '../src/data/towers.js';
import { SITES } from '../src/data/empire.js';

const run = (g, seconds) => { for (let i = 0; i < seconds * 4; i++) g.step(STEP); };
const F = TOWNS.mesa.found;
/* A game with Silver Falls at `wave`, `coins` in the purse and `nodes` Rail Office upgrades bought. */
function falls(seed, { wave = F.wave, coins = F.coins * 1.1, nodes = 3, deeds = F.deeds || 0 } = {}) {
  const g = newGame(seed, 'gulch');
  g.addTown('ridge'); g.addTown('falls');
  g.towns.falls.bestWave = wave; g.town.coins = coins;
  g.shared.tree.founded.push('transport'); g.shared.tree.nodes.transport = nodes;
  g.shared.charter.deeds = deeds;
  return g;
}
function mesa(seed) { const g = falls(seed); foundTown(g, 'mesa'); g.go('mesa'); return g; }

test('Thunder Mesa needs a Falls wave, deeds, the coins and 3 Rail Office upgrades, and the map lists them all', () => {
  assert.deepEqual([F.from, F.nodes, F.deeds], ['falls', { transport: 3 }, 12]);
  assert.deepEqual(nextTowns(falls('m1', { wave: F.shows - 1 })), [], 'out of sight before the Falls reach it');
  assert.deepEqual(nextTowns(falls('m1', { wave: F.shows, nodes: 1 })).map(n => [n.id, n.ready, n.nodesOk]), [['mesa', false, false]]);
  assert.equal(canFound(falls('m1', { nodes: 2 }), 'mesa'), false, 'one upgrade short');
  assert.equal(canFound(falls('m1', { coins: F.coins - 1 }), 'mesa'), false, 'short of coins');
  assert.equal(canFound(falls('m1', { wave: F.wave - 1 }), 'mesa'), false, 'one wave short');
  if (F.deeds) assert.equal(canFound(falls('m1', { deeds: F.deeds - 1 }), 'mesa'), false, 'one deed short');
  assert.equal(canFound(falls('m1'), 'mesa'), true);
  const lr = lockedRules(falls('m1', { nodes: 1 }), 'mesa');
  assert.deepEqual(lr.rules.map(r => [r.kind, r.done]), [['wave', true], ['deeds', true], ['nodes', false], ['coins', true]]);
  assert.deepEqual([lr.rules[2].name, lr.rules[2].have, lr.rules[2].nodes], ['Rail Office', 1, 3]);
  assert.deepEqual([lr.rules[1].deeds, lr.rules[1].have], [F.deeds, F.deeds], 'the deeds the Falls charter brings');
});

test('founding Thunder Mesa pays from the purse and keeps the upgrades', () => {
  const g = falls('m2'), before = g.town.coins;
  assert.ok(foundTown(g, 'mesa'));
  assert.equal(g.shared.tree.nodes.transport, 3, 'upgrades are kept, not spent');
  // the price comes out of the one purse, and the new town puts its start coins in once
  assert.ok(Math.abs(before - g.towns.mesa.coins - F.coins + TOWNS.mesa.start.coins) < 1e-3, 'the price comes out of the one purse');
  assert.equal(g.towns.mesa.level('derrick'), 1);
  assert.equal(foundTown(g, 'mesa'), null, 'once');
});

test('the Mesa sits on the ring east of the Capital, and comes last in the town order', () => {
  assert.equal(TOWN_ORDER[TOWN_ORDER.length - 1], 'mesa');
  const [x, z] = SITES.mesa;
  assert.ok(x > 7 && Math.abs(z) < 4, 'east of the Capital: ' + SITES.mesa);
});

test('every Mesa workshop runs on its inputs, and wire, dynamos and steel are its imports', () => {
  const g = mesa('m3'), t = g.town;
  assert.deepEqual(TOWNS.mesa.imports.sort(), ['dynamos', 'steel', 'wire']);
  for (const id of TOWNS.mesa.buildings) {
    t.buildings[id] = 1;
    for (const k of Object.keys(BUILDINGS[id].inputs)) t.goods[k] = 1e4;
  }
  const had = Object.fromEntries(TOWNS.mesa.goods.map(k => [k, t.goods[k] || 0]));
  run(g, 20);
  for (const id of TOWNS.mesa.buildings) {
    const k = BUILDINGS[id].makes;
    assert.ok(output(t, id) > 0, id + ' works');
    assert.ok((t.goods[k] || 0) > had[k] || t.sold?.[k] || g.shared.market, id + ' made ' + k);
  }
  for (const k of TOWNS.mesa.goods) assert.equal(GOODS[k].town, 'mesa');
});

test('the Mesa: a road and a sky lane, and wave 10 brings the war wagon until the Sky pirate comes', () => {
  const g = mesa('m4'), t = g.town;
  assert.equal(lanesOf(t).length, 2, 'the road and the sky lane (part 2b)');
  assert.equal(planWave(t, 10, 'mixed').pop(), 'wagon', 'the war wagon at wave 10');
  assert.ok(!planWave(t, 4, 'mixed').includes('boat'), 'no river, no boats');
  for (const k of Object.keys(TOWERS)) assert.ok(TOWERS[k].goods.mesa, k + ' can be built in the Mesa');
});

test('a Crossbow in the Mesa is paid with crude oil', () => {
  const g = mesa('m5'), t = g.town;
  t.goods.oil = 100;
  const spot = t.def.board.spots.findIndex((_, i) => !t.def.board.pits.includes(i));
  assert.ok(buildTower(g, t, spot, 'crossbow'));
  assert.ok(t.goods.oil < 100);
});

test('the strip walks the Mesa up its chain, and sends the player to Silver Falls for wire', () => {
  const g = mesa('m6'), t = g.town;
  assert.equal(goalNow(g).text, 'Tap the Oil Derrick and upgrade it to level 4');
  t.buildings.derrick = 5; run(g, 1);
  assert.equal(goalNow(g).text, 'Tap the Bauxite Pit lot, then tap Build');
  t.buildings.bauxitepit = 5; t.buildings.refinery = 3; t.buildings.aluminum = 3; t.buildings.rubberfarm = 3; t.buildings.tireworks = 5; t.buildings.motorworks = 1;
  g.towns.falls.buildings.wiremill = 0; run(g, 1);
  assert.equal(goalNow(g).text, 'Tap Map, Silver Falls, then build a Wire Mill');
});

test('a game saved in Thunder Mesa loads back the same', () => {
  const g = mesa('m7');
  g.town.buildings.refinery = 2;
  const h = loadGame(decode(encode(g, 0)).game);
  assert.equal(h.towns.mesa.level('refinery'), 2);
  assert.equal(h.town.id, 'mesa');
});

// part 1b: the Falls' strip leads to the Mesa through the Rail Office, then the save, and each step is a newcomer tap
import { goalTap } from '../tools/firstplay.js';
import { Rng } from '../src/core/rng.js';
import { ALL_GOALS } from '../src/core/goals.js';
test('the strip in Silver Falls asks for the Rail Office and its upgrades before the save, and the newcomer taps each', () => {
  const g = falls('m1b', { nodes: 0, coins: 0 });
  g.shared.tree.founded.splice(0, Infinity, 'market'); g.shared.capital.open = true;
  for (const id of ALL_GOALS()) g.shared.goals.done[id] = true;
  g.go('falls'); g.step(STEP);
  const at = () => goalNow(g, false), rng = new Rng('m1b');
  assert.equal(at().id, 'next:mesa:inst');
  assert.equal(at().text, INST_WORDS.build('Rail Office', 'open', 'Thunder Mesa'));
  assert.equal(goalTap(g, g.town, rng), null, 'no coins for it yet: no tap');
  g.town.coins = 1e12;
  assert.ok(goalTap(g, g.town, rng).run(), 'the newcomer builds it');
  assert.equal(at().id, 'next:mesa:nodes');
  assert.equal(at().text, INST_WORDS.up('Rail Office', 'open', 'Thunder Mesa'), 'it says upgrade, as the label on the Capital does');
  assert.deepEqual(at().meter(g), [0, 3]);
  assert.equal(goalTap(g, g.town, rng), null, 'no Influence yet: no tap');
  g.shared.capital.influence = 1e6;
  for (let i = 0; i < 3; i++) { assert.equal(at().id, 'next:mesa:nodes'); assert.ok(goalTap(g, g.town, rng).run()); }
  assert.equal(g.shared.tree.nodes.transport, 3);
  assert.notEqual(at().id, 'next:mesa:nodes', 'three upgrades: the strip moves on');
});

import { GOALS } from '../src/data/goals.js';
import { goalCheck } from '../tools/balance.js';
test('every Mesa strip step is timed for the road bot, and the Falls-era bots leave them out', () => {
  const m = GOALS.filter(x => x.town === 'mesa');
  assert.ok(m.length >= 10 && m.every(x => !x.side && x.within >= 9 * 60), 'each has a within past the Mesa window');
  const camp = { goals: {}, dc: { seed: 1 } };
  assert.ok(goalCheck([camp], true, ['mesa']).rows.every(r => !r.id.startsWith('m-')));
  assert.ok(goalCheck([camp], true).rows.some(r => r.id.startsWith('m-')));
});
