// The second fork at level 20 (M6a, owner idea 2026-11-20): a Snake Oil Still picks Slow Rot or Last Call on top of its
// level-5 path. Slow Rot's poison never wears off and is best at the start of the road; Last Call hits harder the
// nearer the raider is to the vault. Auto-towers never makes the choice, and old saves load with no fork taken.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { upgradeTower, towerStats, towerAt, roadOf, startWave, waveRun, forkNext, nearFactor, isPit } from '../src/core/defense.js';
import { nextTowerUp } from '../src/core/automation.js';
import { pointAt, dist } from '../src/core/path.js';
import { FORKS, FORK_LEVEL, NEAR, ROCKETS } from '../src/data/towers.js';
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

// --- part 2: the Cannon's fork (Rocket Battery or Big Shell) -------------------------------------------------------
test('a Cannon at level 19 picks Rocket Battery or Big Shell, and each changes its stats', () => {
  const g = newGame('c1', 'gulch'), t = rich(g); hold(t);
  const x = tower(t, 0, 'cannon', 19, 'a');
  assert.ok(forkNext(x));
  assert.equal(upgradeTower(g, t, 0), false);
  assert.ok(upgradeTower(g, t, 0, 'b')); assert.equal(x.fork, 'b');
  const none = towerStats(t, tower(t, 0, 'cannon', 20, 'a', null)), rk = towerStats(t, tower(t, 0, 'cannon', 20, 'a', 'a')), big = towerStats(t, tower(t, 0, 'cannon', 20, 'a', 'b'));
  const R = FORKS.cannon.a, B = FORKS.cannon.b;
  assert.equal(rk.rockets, ROCKETS.count); assert.equal(none.rockets, 0); assert.equal(big.rockets, 0);
  for (const [s, F] of [[rk, R], [big, B]]) for (const k of ['dmg', 'rate', 'range', 'splash']) assert.ok(Math.abs(s[k] - none[k] * (F[k] || 1)) < 1e-9, k);
  assert.ok(rk.range > none.range && rk.rate < none.rate, 'rockets reach farther and reload slower');
  assert.equal(big.boss, B.boss); assert.equal(none.boss, 1);
});

test('a volley sends each rocket at its own raider, nearest the vault first, and a rocket follows its raider', () => {
  const g = newGame('c2', 'gulch'), t = rich(g), r = roadOf(t);
  t.vault = { hp: 1e15, max: 1e15 };
  t.def = { ...t.def, board: { ...t.def.board, spots: [pointAt(r, 8)], pits: [] } };
  tower(t, 0, 'cannon', 20, 'a', 'a');
  const shots = [];
  g.bus.on('shot', e => shots.push(e));
  Object.assign(t.waves, { phase: 'wave', queue: [], foes: [5, 6, 7, 8, 9, 10].map((s, k) => raider(k + 1, s, { frozenT: 0, kind: 'raider' })) });
  g.step(.25);
  const v = shots.filter(e => e.rocket != null);
  assert.equal(v.length, ROCKETS.count);
  assert.deepEqual(v.map(e => e.foe).sort(), [3, 4, 5, 6], 'the four nearest the vault: ' + v.map(e => e.foe));
  assert.equal(t.waves.shells.length, ROCKETS.count);
  // the raiders keep riding while the rockets fly; each rocket still lands on its own raider
  const before = t.waves.foes.map(f => f.max - f.hp);
  for (let i = 0; i < 4; i++) g.step(.25);
  const hit = t.waves.foes.map((f, k) => f.max - f.hp - before[k]);
  for (const id of [3, 4, 5, 6]) assert.ok(hit[id - 1] > 0, 'raider ' + id + ' was hit: ' + hit);
});

test('Big Shell hits a boss twice as hard as the same shot hits a raider', () => {
  const g = newGame('c3', 'gulch'), t = rich(g), r = roadOf(t);
  t.def = { ...t.def, board: { ...t.def.board, spots: [pointAt(r, 8)], pits: [] } };
  const st = towerStats(t, tower(t, 0, 'cannon', 20, 'a', 'b'));
  Object.assign(t.waves, { phase: 'wave', queue: [], foes: [raider(1, 9, { kind: 'wagon' })] });
  g.step(.25);
  const f = t.waves.foes[0], armor = 0.35;
  assert.ok(Math.abs((f.max - f.hp) - st.dmg * FORKS.cannon.b.boss * (1 - armor)) < 1e-6, 'took ' + (f.max - f.hp));
});

test('each Cannon fork is the best buy somewhere: rockets on raiders far apart, Big Shell on a packed group and the boss', () => {
  // a straight test road 60 long, one pad by its middle; a run of raiders too tough to fall
  const dealt = (fork, gap, kind) => {
    const g = newGame('c4', 'gulch'), t = rich(g);
    t.def = { ...t.def, board: { ...t.def.board, road: [[0, 0], [60, 0]], vault: [61, 0], spots: [[30, 1.3]], pits: [], river: null } };
    t.vault = { hp: 1e15, max: 1e15 };
    tower(t, 0, 'cannon', 20, 'a', fork);
    Object.assign(t.waves, { phase: 'wave', queue: [], foes: Array.from({ length: 12 }, (_, k) => raider(k + 1, -k * gap, { frozenT: 0, kind })) });
    t.waves.foes.forEach((f, k) => { f.s = 14 - k * gap; });
    for (let i = 0; i < 600 && t.waves.foes.length; i++) g.step(.25);
    return (g.dealt && g.dealt.gulch && g.dealt.gulch.cannon) || 0;
  };
  const spreadA = dealt('a', 2.5, 'raider'), spreadB = dealt('b', 2.5, 'raider');
  const packedA = dealt('a', .4, 'raider'), packedB = dealt('b', .4, 'raider');
  const bossA = dealt('a', 3, 'wagon'), bossB = dealt('b', 3, 'wagon');
  assert.ok(spreadA > spreadB, 'raiders far apart: rockets ' + spreadA + ', Big Shell ' + spreadB);
  assert.ok(packedB > packedA, 'a packed group: Big Shell ' + packedB + ', rockets ' + packedA);
  assert.ok(bossB > bossA, 'wagons: Big Shell ' + bossB + ', rockets ' + bossA);
});

test('a Cannon one level from its fork shows its own explainer', () => {
  const e = EXPLAINERS.find(x => x.covers.includes('fork:cannon'));
  assert.ok(e);
  assert.equal(e.when({ forkCannon: null }), false);
  assert.deepEqual(e.at({ forkCannon: 3 }), { tower: 3 });
  assert.ok(!/[;:]/.test(e.text) && e.text.includes('Rocket Battery') && e.text.includes('Big Shell'));
});

test('the bots weigh both Cannon forks, and Auto-towers leaves that choice to the player too', () => {
  const g = newGame('c6', 'gulch'), t = rich(g); hold(t);
  t.towers = []; tower(t, 0, 'cannon', 19);
  const ups = options(t).filter(o => o.up && o.spot === 0);
  assert.deepEqual(ups.map(o => o.path).sort(), ['a', 'b']);
  assert.ok(ups.every(o => o.value > 0 && Number.isFinite(o.value)));
  assert.equal(nextTowerUp(t).tower, null);
});
