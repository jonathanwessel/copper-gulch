// Defense: waves along the road, towers and their costs, paths at level 5, bounties, leaks and the fallen vault.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, loadGame } from '../src/core/setup.js';
import { buildTower, upgradeTower, sellTower, towerCost, towerStats, towerAt, callEarly, roadOf, planWave, towerReserve, setHold } from '../src/core/defense.js';
import { pointAt, makePath } from '../src/core/path.js';
import { TOWERS, PATHS, PATH_LEVEL } from '../src/data/towers.js';
import { WAVE, FOES } from '../src/data/foes.js';

const run = (g, sec) => { for (let i = 0; i < sec * 4; i++) g.step(.25); };
const rich = g => { const t = g.town; t.coins = 1e9; for (const k of ['timber', 'ore', 'copper', 'bricks', 'tools', 'planks', 'clay']) { t.goods[k] = 1e6; t.sell[k] = false; } return t; };

test('path: length and points along a polyline', () => {
  const p = makePath([[0, 0], [3, 0], [3, 4]]);
  assert.equal(p.length, 7);
  assert.deepEqual(pointAt(p, 3), [3, 0]);
  assert.deepEqual(pointAt(p, 5), [3, 2]);
  assert.deepEqual(pointAt(p, 99), [3, 4]);
});

test('the first wave comes after the opening rest, rides the road and reaches the vault', () => {
  const g = newGame('d'), t = g.town, ev = g.bus.record();
  run(g, WAVE.first - 1); assert.equal(t.waves.phase, 'break');
  run(g, 2); assert.equal(t.waves.phase, 'wave');
  assert.ok(ev.some(([n, d]) => n === 'wave:start' && d.wave === 1));
  run(g, 60);
  assert.ok(ev.some(([n]) => n === 'leak'), 'with no towers raiders reach the vault');
  assert.ok(t.vault.hp < WAVE.vault || t.breaches);
});

test('towers cost coins and the town goods, and a crossbow downs raiders for a bounty', () => {
  const g = newGame('d'), t = g.town;
  const c = towerCost(t, 'crossbow');
  assert.ok(c.coins > 0 && c.goods.timber > 0);
  assert.equal(buildTower(g, t, 5, 'crossbow'), false, 'not without the timber');
  t.coins = 1000; t.goods.timber = 100;
  assert.equal(buildTower(g, t, 5, 'crossbow'), true);
  assert.equal(buildTower(g, t, 5, 'cannon'), false, 'one tower per spot');
  assert.equal(t.goods.timber, 100 - c.goods.timber);
  for (const s of [3, 4, 9, 10]) buildTower(g, t, s, 'crossbow');
  const kills = []; g.bus.on('kill', e => kills.push(e));
  run(g, WAVE.first + 40);
  assert.ok(kills.length > 0 && kills.every(k => k.coins > 0));
  assert.ok(t.bestWave >= 1, 'wave 1 cleared');
});

test('upgrades raise damage; level 5 needs a path, and the path changes the tower', () => {
  const g = newGame('p'), t = rich(g);
  buildTower(g, t, 0, 'crossbow');
  const d1 = towerStats(t, towerAt(t, 0)).dmg;
  for (let i = 0; i < 3; i++) assert.ok(upgradeTower(g, t, 0));
  assert.ok(towerStats(t, towerAt(t, 0)).dmg > d1);
  assert.equal(towerAt(t, 0).level, PATH_LEVEL - 1);
  assert.equal(upgradeTower(g, t, 0), false, 'a path must be chosen');
  const before = towerStats(t, towerAt(t, 0));
  assert.ok(upgradeTower(g, t, 0, 'a'));
  const after = towerStats(t, towerAt(t, 0));
  assert.equal(towerAt(t, 0).path, 'a');
  assert.ok(after.rate > before.rate * 1.5, 'Repeater fires much faster');
  for (const k of Object.keys(TOWERS)) assert.deepEqual(Object.keys(PATHS[k]), ['a', 'b']);
});

test('selling a tower returns part of its cost and frees the spot', () => {
  const g = newGame('s'), t = rich(g);
  buildTower(g, t, 2, 'cannon'); upgradeTower(g, t, 2);
  const spent = towerAt(t, 2).spent, coins = t.coins;
  const back = sellTower(g, t, 2);
  assert.ok(back > 0 && back < spent);
  assert.equal(t.coins, coins + back);
  assert.equal(towerAt(t, 2), null);
});

test('splash, frost and poison each work', () => {
  for (const kind of ['cannon', 'frost', 'still']) {
    const g = newGame('k' + kind), t = rich(g);
    for (const s of [1, 2, 3, 4, 5]) buildTower(g, t, s, kind);
    const kills = []; g.bus.on('kill', e => kills.push(e));
    run(g, WAVE.first + 60);
    assert.ok(kills.length > 0, kind + ' downs raiders');
  }
  const g = newGame('slow'), t = rich(g);
  buildTower(g, t, 8, 'frost'); // beside the first pass, near where raiders come in
  let chilled = false;
  for (let i = 0; i < (WAVE.first + 30) * 4 && !chilled; i++) { g.step(.25); chilled = t.waves.foes.some(f => f.slowT > 0); }
  assert.ok(chilled, 'frost chills');
});

test('the vault falls: the town loses a tenth of its coins and drops back two waves', () => {
  const g = newGame('b'), t = g.town, ev = g.bus.record();
  let after = null; g.bus.on('breach', () => { after = { wave: t.wave, hp: t.vault.hp }; });
  t.wave = 5; t.coins = 1000; t.vault.hp = 1; t.buildings = {}; // no income, so the loss is exact
  run(g, WAVE.first + 60);
  const b = ev.find(([n]) => n === 'breach');
  assert.ok(b, 'breach');
  assert.equal(b[1].lost, 100);
  assert.equal(after.wave, 3);
  assert.equal(after.hp, t.vault.max);
});

test('every tenth wave brings the war wagon; waves are the same for the same seed', () => {
  const g = newGame('w');
  const q = planWave(g.town, 10, 'mixed');
  assert.equal(q.at(-1), 'wagon');
  assert.ok(FOES.wagon.boss);
  const a = newGame('same'), b = newGame('same');
  run(a, 120); run(b, 120);
  assert.deepEqual(a.toJSON(), b.toJSON());
});

test('held waves wait while the town keeps working, and start once released', () => {
  const g = newGame('h'), t = g.town;
  setHold(g, t, true);
  const l0 = t.lifetime;
  run(g, WAVE.first + 30);
  assert.equal(t.waves.phase, 'break', 'no wave while held');
  assert.equal(t.waves.timer, 0);
  assert.ok(t.lifetime > l0, 'the economy keeps running');
  setHold(g, t, false); g.step(.25);
  assert.equal(t.waves.phase, 'wave');
  assert.equal(loadGame(JSON.parse(JSON.stringify(g.toJSON()))).town.waves.hold, false);
});

test('calling a wave early pays a bonus; a break is required', () => {
  const g = newGame('e'), t = g.town, c0 = t.coins;
  const bonus = callEarly(g, t);
  assert.ok(bonus > 0 && t.coins === c0 + bonus);
  assert.equal(t.waves.phase, 'wave');
  assert.equal(callEarly(g, t), -1);
});

test('the town keeps goods for its next tower, and defense rests while time away is caught up', () => {
  const g = newGame('r'), t = g.town;
  assert.equal(towerReserve(t).timber, towerCost(t, 'crossbow').goods.timber);
  const w = t.waves.timer;
  g.catchUp(600);
  assert.equal(t.waves.timer, w, 'no waves while away');
  assert.equal(t.waves.phase, 'break');
});

test('a battle in progress survives a save and load exactly', () => {
  const g = newGame('sv'), t = rich(g);
  buildTower(g, t, 4, 'crossbow'); buildTower(g, t, 9, 'still');
  run(g, WAVE.first + 8);
  assert.ok(t.waves.foes.length > 0);
  const h = loadGame(JSON.parse(JSON.stringify(g.toJSON())));
  run(g, 20); run(h, 20);
  assert.deepEqual(h.toJSON(), g.toJSON());
  assert.ok(roadOf(t).length > 15);
});

test('the wave pace: a wave cleared fast still waits, so the next comes a full pace after the last one started', () => {
  const g = newGame('pace'), t = rich(g), starts = [];
  for (let s = 0; s < 12; s++) buildTower(g, t, s, 'crossbow');
  for (const tw of t.towers) for (let L = 1; L < 8; L++) upgradeTower(g, t, tw.spot, 'a');
  g.bus.on('wave:start', () => starts.push(t.t));
  run(g, WAVE.first + 3 * WAVE.pace + 5);
  assert.ok(starts.length >= 3, 'three waves started');
  for (let i = 1; i < starts.length; i++) assert.ok(starts[i] - starts[i - 1] >= WAVE.pace - .26, 'wave ' + (i + 1) + ' came ' + (starts[i] - starts[i - 1]) + ' s after the last');
});

test('after a long wave the rest is still at least WAVE.rest, and Call now skips the wait for a bonus', () => {
  const g = newGame('pace2'), t = g.town;
  Object.assign(t.waves, { phase: 'wave', queue: [], foes: [], age: WAVE.pace + 30 });
  g.step(.25); // nothing left on the road: the wave is cleared
  assert.equal(t.waves.phase, 'break');
  assert.ok(Math.abs(t.waves.timer - WAVE.rest) < 1e-9, 'rest ' + t.waves.timer);
  Object.assign(t.waves, { phase: 'wave', queue: [], foes: [], age: 5 });
  g.step(.25);
  assert.ok(Math.abs(t.waves.timer - (WAVE.pace - 5.25)) < 1e-9, 'waits out the pace: ' + t.waves.timer);
  assert.ok(callEarly(g, t) > 0); assert.equal(t.waves.phase, 'wave');
});

test('the Cannon and the Snake Oil Still are paid with ore and planks, so they come before the Smelter', () => {
  const g = newGame('early'), t = g.town;
  assert.deepEqual(Object.keys(towerCost(t, 'cannon', 0).goods), ['ore']);
  assert.deepEqual(Object.keys(towerCost(t, 'still', 0).goods).sort(), ['ore', 'planks']);
  t.coins = 1000; t.goods.ore = 20; t.goods.planks = 20;
  assert.ok(buildTower(g, t, 1, 'cannon')); assert.ok(buildTower(g, t, 2, 'still'));
  assert.equal(t.buildings.smelter, undefined);
});
