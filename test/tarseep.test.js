// Thunder Mesa part 3 (PLAN.md M6b): Tar Seep, the fourth outpost. It opens with the Mesa (and in an old save that
// already has the Mesa, when it loads), drills crude oil and taps rubber, builds the Crossbow and the Cannon with crude
// oil, has a gully under a leaning derrick for its entrance and no mortar pits, brings the bandit wagon at 10 and 15,
// is won at wave 15, and the Mesa's strip sends the player there once the pirate airship is beaten.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, loadGame } from '../src/core/setup.js';
import { encode, decode } from '../src/core/save.js';
import { build, unlocked, output } from '../src/core/economy.js';
import { buildTower, towerCost } from '../src/core/defense.js';
import { foundTown } from '../src/core/empire.js';
import { goalNow } from '../src/core/goals.js';
import { STEP } from '../src/core/clock.js';
import { mapRules } from '../tools/audit.js';
import { TOWNS, TOWN_ORDER } from '../src/data/towns/index.js';
import { GOALS } from '../src/data/goals.js';
import { EXPLAINERS } from '../src/data/explainers.js';
import { SITES, CAPITAL } from '../src/data/empire.js';
import { ENT_BOX } from '../src/render/empire-plan.js';

const run = (g, seconds) => { for (let i = 0; i < seconds * 4; i++) g.step(STEP); };
const F = TOWNS.mesa.found;
function falls(seed) {
  const g = newGame(seed, 'gulch');
  g.addTown('ridge'); g.addTown('falls');
  g.towns.falls.bestWave = F.wave; g.town.coins = F.coins * 1.1;
  g.shared.tree.founded.push('transport'); g.shared.tree.nodes.transport = F.nodes.transport;
  g.shared.charter.deeds = F.deeds || 0;
  return g;
}

test('founding Thunder Mesa opens Tar Seep, new and not won, beside it on the ring', () => {
  const g = falls('ts1');
  assert.ok(foundTown(g, 'mesa'));
  const t = g.towns.tarseep;
  assert.ok(t && !t.won && t.bestWave === 0, 'open, not won');
  assert.equal(TOWNS.mesa.outpost, 'tarseep');
  assert.ok(TOWN_ORDER.indexOf('tarseep') < TOWN_ORDER.indexOf('mesa'), 'listed before its town, as Sandy Bend before the Falls');
  // farther out than the Mesa, on the outer ring
  const d = id => Math.hypot(SITES[id][0] - CAPITAL[0], SITES[id][1] - CAPITAL[1]);
  assert.ok(d('tarseep') > d('mesa') + 5);
});

test('an old save that already has Thunder Mesa gets Tar Seep when it loads, and keeps everything else', () => {
  const g = falls('ts2'); foundTown(g, 'mesa'); g.go('mesa');
  g.towns.mesa.bestWave = 24;
  const old = JSON.parse(encode(g, 0));
  delete old.game.towns.tarseep; // a save made before part 3
  const back = loadGame(decode(JSON.stringify(old)).game);
  assert.ok(back.towns.tarseep && !back.towns.tarseep.won, 'Tar Seep opens, to be played');
  assert.equal(back.towns.mesa.bestWave, 24);
  assert.equal(back.active, 'mesa', 'the player stays where they were');
  // a save with no Mesa gets no Tar Seep
  const early = loadGame(decode(encode(falls('ts3'), 0)).game);
  assert.equal(early.towns.tarseep, undefined);
});

test('the Oil Well drills crude oil, the Rubber Grove opens at Oil Well level 2 and taps rubber', () => {
  const g = newGame('ts4', 'tarseep'), t = g.town;
  assert.equal(t.level('oilwell'), 1);
  assert.equal(unlocked(t, 'rubbergrove'), false);
  t.coins = 1e4;
  assert.ok(build(g, t, 'oilwell'));
  assert.equal(unlocked(t, 'rubbergrove'), true);
  assert.ok(build(g, t, 'rubbergrove'));
  assert.ok(output(t, 'oilwell') > 0 && output(t, 'rubbergrove') > 0);
  run(g, 30);
  assert.ok(t.goods.oil > 0 || t.lifetime > 0, 'crude oil is made (kept or sold)');
});

test('the Crossbow and the Cannon cost coins and crude oil, and there are no mortar pits', () => {
  const g = newGame('ts5', 'tarseep'), t = g.town;
  assert.deepEqual(TOWNS.tarseep.towers, ['crossbow', 'cannon']);
  assert.deepEqual(Object.keys(towerCost(t, 'crossbow', 0).goods), ['oil']);
  assert.deepEqual(Object.keys(towerCost(t, 'cannon', 0).goods), ['oil']);
  assert.deepEqual(TOWNS.tarseep.board.pits, []);
  assert.deepEqual(mapRules(TOWNS, ['tarseep']), []);
  t.coins = 1e4; t.goods.oil = 100;
  assert.ok(buildTower(g, t, 0, 'crossbow'));
  assert.ok(t.goods.oil < 100, 'oil spent');
});

test('its entrance is a gully under a leaning derrick, with its measured size for the map', () => {
  const e = TOWNS.tarseep.board.entrance;
  assert.equal(e.kind, 'gully');
  assert.ok(ENT_BOX.gully && ENT_BOX.gully.back > 5);
});

test('the bandit wagon comes at 10 and 15, and beating wave 15 wins it', () => {
  const g = newGame('ts6', 'tarseep'), t = g.town;
  assert.deepEqual(TOWNS.tarseep.waves.bosses, [10, 15]);
  t.coins = 1e6; t.goods.oil = 1e4; for (let i = 0; i < 6; i++) assert.ok(buildTower(g, t, i, 'crossbow'));
  t.wave = 10; t.waves.timer = 0; run(g, 1);
  assert.ok(t.waves.queue.includes('bandits') || t.waves.foes.some(f => f.kind === 'bandits'), 'the bandit wagon rides at wave 10');
  t.bestWave = 15; g.step(STEP);
  assert.equal(t.won, true);
});

test('the strip walks Tar Seep to its win and back, and the Mesa sends the player there after the pirate airship', () => {
  const ids = GOALS.filter(x => x.town === 'tarseep').map(x => x.id);
  assert.deepEqual(ids, ['t-tower', 't-rubber', 't-three', 't-win', 't-back']);
  assert.ok(GOALS.filter(x => x.town === 'tarseep').every(x => x.within && !x.side), 'the active player\'s road checks them');
  const seep = GOALS.find(x => x.id === 'm-seep');
  assert.equal(seep.text, 'Tap Map, then tap Tar Seep');
  // in order: right after the pirate step
  const order = GOALS.map(x => x.id);
  assert.equal(order.indexOf('m-seep'), order.indexOf('m-pirate') + 1);
  const g = falls('ts7'); foundTown(g, 'mesa'); g.go('mesa');
  const m = g.towns.mesa;
  m.bestWave = 19; g.step(STEP);
  assert.notEqual((goalNow(g, false) || {}).id, 'm-seep', 'not before wave 20');
  m.bestWave = 20; for (const t of Object.values(g.towns)) t.coins = 0;
  for (const x of GOALS) if (x.town === 'mesa' && x.id !== 'm-seep') g.shared.goals.done[x.id] = true;
  g.step(STEP);
  const s = goalNow(g, false);
  assert.equal(s && s.id, 'm-seep');
  // the explainer the first time the player gets there
  assert.ok(EXPLAINERS.some(x => x.town === 'tarseep' && (x.covers || []).includes('welcome:tarseep')));
  g.go('tarseep'); g.step(STEP);
  assert.equal(goalNow(g, false).id, 't-tower');
  g.towns.tarseep.bestWave = 15; g.step(STEP); g.go('mesa'); g.step(STEP);
  assert.ok(g.shared.goals.done['m-seep'] && g.shared.goals.done['t-back']);
});
