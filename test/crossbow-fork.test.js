// The Crossbow's level-20 fork (owner, 2026-11-22: "We need level 20 options for crossbow"): Piercing Bolts, a bolt that
// goes on through up to 3 raiders in a line with softer hits, or Sharpshooter, much harder and slower hits always at
// the toughest raider in reach. On top of either level-5 path, so the Crossbow has 4 ways to finish.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { upgradeTower, towerStats, forkNext, pierced } from '../src/core/defense.js';
import { nextTowerUp } from '../src/core/automation.js';
import { FORKS, PIERCE } from '../src/data/towers.js';
import { EXPLAINERS } from '../src/data/explainers.js';
import { options } from '../tools/balance.js';
import { explainTower } from '../src/core/explain.js';

const rich = g => { const t = g.town; t.coins = 1e15; for (const k of ['timber', 'copper', 'bricks', 'tools', 'planks', 'clay', 'ore']) { t.goods[k] = 1e12; t.sell[k] = false; } return t; };
const hold = t => Object.assign(t.waves, { phase: 'break', timer: 999, hold: true, foes: [], queue: [] });
const tower = (t, spot, kind, level, path = 'a', fork = null) => { t.towers = t.towers.filter(x => x.spot !== spot); const x = { spot, kind, level, path: level >= 5 ? path : null, fork, cd: 0, spent: 0, pulses: 0 }; t.towers.push(x); return x; };
const foe = (id, s, extra = {}) => ({ id, kind: 'raider', lane: 0, hp: 1e9, max: 1e9, s, slow: 0, slowT: 0, frozenT: 1e9, poison: 0, poisonT: 0, rot: 0, brittle: 0, ...extra });
/* A straight test road along x, 60 long, with one pad: on the road's line past its end (raiders ride straight at it) or
   beside its middle (they ride across its aim). */
const straight = (t, pad) => { t.def = { ...t.def, board: { ...t.def.board, road: [[0, 0], [60, 0]], vault: [61, 0], spots: [pad], pits: [], river: null } }; t.vault = { hp: 1e15, max: 1e15 }; };

test('a Crossbow at level 19 picks Piercing Bolts or Sharpshooter on either path, and keeps its path', () => {
  for (const path of ['a', 'b']) for (const fork of ['a', 'b']) {
    const g = newGame('x1' + path + fork, 'gulch'), t = rich(g); hold(t);
    const x = tower(t, 0, 'crossbow', 19, path);
    assert.ok(forkNext(x));
    assert.equal(upgradeTower(g, t, 0), false, 'no fork named');
    assert.ok(upgradeTower(g, t, 0, fork));
    assert.equal(x.level, 20); assert.equal(x.fork, fork); assert.equal(x.path, path);
  }
  // a Crossbow raised past 20 before this fork shipped picks with its next level and keeps its levels (old saves)
  const g = newGame('x1old', 'gulch'), t = rich(g); hold(t);
  const old = tower(t, 0, 'crossbow', 24, 'b');
  assert.ok(forkNext(old));
  assert.ok(upgradeTower(g, t, 0, 'b')); assert.equal(old.level, 25); assert.equal(old.fork, 'b'); assert.equal(old.path, 'b');
});

test('each Crossbow fork changes its stats as its card says', () => {
  const g = newGame('x2', 'gulch'), t = rich(g);
  const none = towerStats(t, tower(t, 0, 'crossbow', 20, 'a')), pb = towerStats(t, tower(t, 0, 'crossbow', 20, 'a', 'a')), sh = towerStats(t, tower(t, 0, 'crossbow', 20, 'a', 'b'));
  const P = FORKS.crossbow.a, S = FORKS.crossbow.b;
  for (const [s, F] of [[pb, P], [sh, S]]) for (const k of ['dmg', 'rate', 'range']) assert.ok(Math.abs(s[k] - none[k] * (F[k] || 1)) < 1e-9, k);
  assert.equal(pb.pierce, PIERCE.count); assert.equal(none.pierce, 0); assert.equal(sh.pierce, 0);
  assert.ok(sh.sharp && !pb.sharp && !none.sharp);
  assert.ok(pb.dmg < none.dmg, 'softer hits');
  assert.ok(sh.dmg > none.dmg * 2 && sh.rate < none.rate, 'much harder, slower hits');
  // the card's Damage and Shots rows name the fork
  const ex = explainTower(t, tower(t, 0, 'crossbow', 20, 'a', 'b'));
  assert.ok(ex.dmg.rows.some(r => r.label === S.name) && ex.rate.rows.some(r => r.label === S.name));
});

test('a piercing bolt hits up to 3 raiders in a line behind the first, and none off the line', () => {
  const at = [0, 0], pos = new Map(), fs = [];
  const add = (id, x, z) => { const f = foe(id, 0); pos.set(f, [x, z]); fs.push(f); return f; };
  const first = add(1, 2, 0); add(2, 3, .2); add(3, 4, -.3); add(4, 4.2, 0); add(5, 3, 2); add(6, 1, 0); add(7, 2 + PIERCE.depth + .5, 0);
  const hit = pierced(fs, pos, at, first, PIERCE.count).map(f => f.id);
  assert.deepEqual(hit, [1, 2, 3], 'the first, then the two nearest on the line past it: ' + hit);
  // a raider off to the side (5), one in front of the first (6) and one too far past it (7) are never hit
  const all = pierced(fs, pos, at, first, 9).map(f => f.id);
  assert.ok(!all.includes(5) && !all.includes(6) && !all.includes(7), all.join());
});

test('Piercing Bolts beats Sharpshooter on a row of raiders riding at it, and Sharpshooter wins on a wagon', () => {
  const dealt = (fork, kind, gap, n) => {
    const g = newGame('x4', 'gulch'), t = rich(g);
    straight(t, [63, 0]); // past the road's end: the raiders ride straight at it, one behind the other
    tower(t, 0, 'crossbow', 20, 'a', fork);
    Object.assign(t.waves, { phase: 'wave', queue: [], foes: Array.from({ length: n }, (_, k) => foe(k + 1, 0, { kind, frozenT: 0 })) });
    t.waves.foes.forEach((f, k) => { f.s = 56 - k * gap; });
    for (let i = 0; i < 40; i++) g.step(.25);
    return (g.dealt && g.dealt.gulch && g.dealt.gulch.crossbow) || 0;
  };
  const rowA = dealt('a', 'runner', .9, 10), rowB = dealt('b', 'runner', .9, 10);
  assert.ok(rowA > rowB, 'a row of horsemen: Piercing Bolts ' + rowA + ', Sharpshooter ' + rowB);
  const bossA = dealt('a', 'wagon', 4, 1), bossB = dealt('b', 'wagon', 4, 1);
  assert.ok(bossB > bossA, 'a war wagon alone: Sharpshooter ' + bossB + ', Piercing Bolts ' + bossA);
});

test('Sharpshooter aims at the raider with the most health in reach, not the one nearest the vault', () => {
  const g = newGame('x5', 'gulch'), t = rich(g);
  straight(t, [30, 1.3]);
  tower(t, 0, 'crossbow', 20, 'a', 'b');
  const shots = []; g.bus.on('shot', e => shots.push(e));
  Object.assign(t.waves, { phase: 'wave', queue: [], foes: [foe(1, 31, { hp: 100, max: 100 }), foe(2, 29, { hp: 5000, max: 5000, kind: 'brute' }), foe(3, 30, { hp: 300, max: 300 })] });
  g.step(.25);
  assert.ok(shots.length && shots.every(e => e.foe === 2), 'aimed at ' + shots.map(e => e.foe));
  // a normal Crossbow on the same raiders aims at the one nearest the vault
  const h = newGame('x5b', 'gulch'), u = rich(h); straight(u, [30, 1.3]); tower(u, 0, 'crossbow', 20, 'a');
  const s2 = []; h.bus.on('shot', e => s2.push(e));
  Object.assign(u.waves, { phase: 'wave', queue: [], foes: [foe(1, 31, { hp: 100, max: 100 }), foe(2, 29, { hp: 5000, max: 5000, kind: 'brute' }), foe(3, 30, { hp: 300, max: 300 })] });
  h.step(.25);
  assert.equal(s2[0].foe, 1);
});

test('a Crossbow one level from its fork shows its own explainer', () => {
  const e = EXPLAINERS.find(x => x.covers.includes('fork:crossbow'));
  assert.ok(e);
  assert.equal(e.when({ forkCrossbow: null }), false);
  assert.deepEqual(e.at({ forkCrossbow: 5 }), { tower: 5 });
  assert.ok(!/[;:]/.test(e.text) && e.text.includes('Piercing Bolts') && e.text.includes('Sharpshooter'));
  assert.ok(!/best|start of the road|near the vault/i.test(e.text), e.text);
});

test('the bots weigh both Crossbow forks, and Auto-towers leaves that choice to the player', () => {
  const g = newGame('x6', 'gulch'), t = rich(g); hold(t);
  t.towers = []; tower(t, 0, 'crossbow', 19, 'b');
  const ups = options(t).filter(o => o.up && o.spot === 0);
  assert.deepEqual(ups.map(o => o.path).sort(), ['a', 'b']);
  assert.ok(ups.every(o => o.value > 0 && Number.isFinite(o.value)));
  assert.equal(nextTowerUp(t).tower, null);
});
