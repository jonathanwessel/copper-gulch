// The second fork at level 20 (M6a, owner idea 2026-11-20): a Snake Oil Still picks Slow Rot or Last Call on top of its
// level-5 path. Slow Rot's poison never wears off and is best at the start of the road; Last Call hits harder the
// nearer the raider is to the vault. Auto-towers never makes the choice, and old saves load with no fork taken.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { upgradeTower, towerStats, towerAt, roadOf, startWave, waveRun, forkNext, nearFactor, isPit } from '../src/core/defense.js';
import { nextTowerUp } from '../src/core/automation.js';
import { pointAt, dist } from '../src/core/path.js';
import { FORKS, FORK_LEVEL, NEAR } from '../src/data/towers.js';
import { migrate, SAVE_VERSION } from '../src/core/save.js';
import { EXPLAINERS } from '../src/data/explainers.js';
import { options } from '../tools/balance.js';

const rich = g => { const t = g.town; t.coins = 1e15; for (const k of ['timber', 'copper', 'bricks', 'tools', 'planks', 'clay', 'ore']) { t.goods[k] = 1e12; t.sell[k] = false; } return t; };
const hold = t => Object.assign(t.waves, { phase: 'break', timer: 999, hold: true, foes: [], queue: [] });
const tower = (t, spot, kind, level, path = 'a', fork = null) => { t.towers = t.towers.filter(x => x.spot !== spot); const x = { spot, kind, level, path: level >= 5 ? path : null, fork, cd: 0, spent: 0, pulses: 0 }; t.towers.push(x); return x; };
const raider = (id, s, extra = {}) => ({ id, kind: 'brute', lane: 0, hp: 1e9, max: 1e9, s, slow: 0, slowT: 0, frozenT: 1e9, poison: 0, poisonT: 0, rot: 0, brittle: 0, ...extra });
/* Pads that are not mortar pits, by where the road passes closest to them (0 at the entrance, 1 at the vault). */
const padsAlong = t => {
  const r = roadOf(t);
  return t.def.board.spots.map((p, i) => { let best = 0, bd = 1e9; for (let s = 0; s <= r.length; s += .1) { const d = dist(p, pointAt(r, s)); if (d < bd) { bd = d; best = s; } } return [i, best / r.length]; })
    .filter(([i]) => !isPit(t, i)).sort((a, b) => a[1] - b[1]);
};

test('a Still at level 19 needs one of its two forks to reach 20, and keeps its path', () => {
  const g = newGame('f1', 'gulch'), t = rich(g); hold(t);
  const x = tower(t, 0, 'still', 19, 'b');
  assert.ok(forkNext(x));
  assert.equal(upgradeTower(g, t, 0), false, 'no fork named');
  assert.equal(upgradeTower(g, t, 0, 'z'), false, 'not a fork');
  assert.ok(upgradeTower(g, t, 0, 'a'));
  assert.equal(x.level, FORK_LEVEL); assert.equal(x.fork, 'a'); assert.equal(x.path, 'b');
  assert.ok(upgradeTower(g, t, 0)); assert.equal(x.level, 21); assert.equal(x.fork, 'a', 'the fork stays');
  // a kind with no second fork passes level 20 as any other level
  const c = tower(t, 1, 'crossbow', 19);
  assert.ok(!forkNext(c) && upgradeTower(g, t, 1)); assert.equal(c.fork, null);
});

test('Slow Rot trades its normal poison and some hit for a poison that never wears off', () => {
  const g = newGame('f2', 'gulch'), t = rich(g); hold(t);
  const plain = towerStats(t, tower(t, 0, 'still', 20, 'a', null)), rot = towerStats(t, tower(t, 0, 'still', 20, 'a', 'a'));
  assert.ok(rot.rot > 0 && rot.poison === 0 && plain.rot === 0 && plain.poison > 0);
  assert.ok(Math.abs(rot.dmg - plain.dmg * FORKS.still.a.dmg) < 1e-6);
  assert.ok(Math.abs(rot.rot - FORKS.still.a.rot * rot.dmg * rot.rate) < 1e-6);
  // a rotting raider far from every tower keeps losing health at the same pace for half a minute
  t.towers = [];
  Object.assign(t.waves, { phase: 'wave', queue: [], foes: [raider(1, 2, { rot: 10 })] });
  for (let i = 0; i < 120; i++) g.step(.25);
  const f = t.waves.foes[0];
  assert.ok(Math.abs(f.max - f.hp - 300) < 1, 'lost ' + (f.max - f.hp));
});

test('Last Call hits harder the nearer the raider is to the vault', () => {
  const g = newGame('f3', 'gulch'), t = rich(g), r = roadOf(t);
  assert.equal(nearFactor(r, 0), NEAR.base); assert.equal(nearFactor(r, r.length), NEAR.base + NEAR.gain);
  assert.ok(nearFactor(r, r.length) / nearFactor(r, 0) > 5);
  // the same Still hits a raider at the start and one at the end of the road: the late one takes more
  const hit = s => {
    const g2 = newGame('f3', 'gulch'), t2 = rich(g2), x = tower(t2, 0, 'still', 20, 'a', 'b'), p = t2.def.board.spots[0];
    t2.def = { ...t2.def, board: { ...t2.def.board, spots: t2.def.board.spots.map((q, i) => (i === 0 ? pointAt(roadOf(t2), s) : q)) } };
    Object.assign(t2.waves, { phase: 'wave', queue: [], foes: [raider(1, s)] });
    g2.step(.25);
    assert.ok(x && p);
    return t2.waves.foes[0].max - t2.waves.foes[0].hp;
  };
  const early = hit(2), late = hit(r.length - 2);
  assert.ok(early > 0 && late > early * 3, early + ' then ' + late);
});

test('each fork is the best buy somewhere: Slow Rot by the entrance, Last Call by the vault', () => {
  // a straight test road 40 long with one pad by its start and one by its end; brutes too tough to fall ride all of it
  const dealt = (spot, fork) => {
    const g = newGame('f4', 'gulch'), t = rich(g);
    t.def = { ...t.def, board: { ...t.def.board, road: [[0, 0], [40, 0]], vault: [41, 0], spots: [[3, 1.2], [38, 1.2]], pits: [], river: null } };
    t.vault = { hp: 1e15, max: 1e15 };
    tower(t, spot, 'still', 20, 'a', fork);
    Object.assign(t.waves, { phase: 'wave', queue: [], foes: [0, 1, 2, 3, 4, 5].map(k => raider(k + 1, -k * 1.2, { frozenT: 0, s: 0 })) });
    t.waves.foes.forEach((f, k) => { f.s = -k * 1.2; });
    for (let i = 0; i < 400 && t.waves.foes.length; i++) g.step(.25);
    return (g.dealt && g.dealt.gulch && g.dealt.gulch.still) || 0;
  };
  const a0 = dealt(0, 'a'), b0 = dealt(0, 'b'), a1 = dealt(1, 'a'), b1 = dealt(1, 'b'), n0 = dealt(0, null), n1 = dealt(1, null);
  assert.ok(a0 > b0 && a0 > n0, 'by the entrance Slow Rot ' + a0 + ', Last Call ' + b0 + ', no fork ' + n0);
  assert.ok(b1 > a1 && b1 > n1, 'by the vault Last Call ' + b1 + ', Slow Rot ' + a1 + ', no fork ' + n1);
});

test('the bots weigh both forks, and Auto-towers leaves the choice to the player', () => {
  const g = newGame('f5', 'gulch'), t = rich(g); hold(t);
  tower(t, 0, 'still', 19);
  const ups = options(t).filter(o => o.up && o.spot === 0);
  assert.deepEqual(ups.map(o => o.path).sort(), ['a', 'b']);
  const n = nextTowerUp(t);
  assert.equal(n.tower, null); assert.equal(n.needPath, 1);
  tower(t, 1, 'crossbow', 19);
  assert.equal(nextTowerUp(t).tower.kind, 'crossbow');
});

test('save v22: old towers have taken no fork and no raider rots', () => {
  assert.ok(SAVE_VERSION >= 22);
  const m = migrate({ v: 21, at: 0, game: { towns: { gulch: { towers: [{ spot: 0, kind: 'still', level: 20, path: 'a' }], waves: { phase: 'wave', queue: [], foes: [{ id: 1 }] } } } } });
  assert.equal(m.game.towns.gulch.towers[0].fork, null);
  assert.equal(m.game.towns.gulch.waves.foes[0].rot, 0);
});

test('a tower one level from its fork shows the explainer on it', () => {
  const e = EXPLAINERS.find(x => x.covers.includes('fork'));
  assert.ok(e);
  assert.equal(e.when({ forkReady: null }), false);
  assert.deepEqual(e.at({ forkReady: 4 }), { tower: 4 });
  assert.ok(!/[;:]/.test(e.text) && e.text.includes('Slow Rot') && e.text.includes('Last Call'));
});
