// The Frost Lens's level-20 fork (PLAN.md M6a, second fork part 3, 2026-11-24): Blizzard chills a much longer stretch of
// road with softer hits, Cold Snap slows raiders much more over a short reach with softer hits. On top of either
// level-5 path, so the lens has 4 ways to finish. Both trade the lens's own hits for help to the towers around it,
// since it led the late damage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { upgradeTower, towerStats, forkNext, startWave } from '../src/core/defense.js';
import { nextTowerUp } from '../src/core/automation.js';
import { FORKS, TOWERS, SLOW_MOST } from '../src/data/towers.js';
import { EXPLAINERS } from '../src/data/explainers.js';
import { options } from '../tools/balance.js';
import { explainTower } from '../src/core/explain.js';

const rich = g => { const t = g.town; t.coins = 1e15; for (const k of ['timber', 'copper', 'bricks', 'tools', 'planks', 'clay', 'ore']) { t.goods[k] = 1e12; t.sell[k] = false; } return t; };
const hold = t => Object.assign(t.waves, { phase: 'break', timer: 999, hold: true, foes: [], queue: [] });
const tower = (t, spot, kind, level, path = 'a', fork = null) => { t.towers = t.towers.filter(x => x.spot !== spot); const x = { spot, kind, level, path: level >= 5 ? path : null, fork, cd: 0, spent: 0, pulses: 0 }; t.towers.push(x); return x; };
/* A straight test road along x with one pad beside its middle, and raiders that never fall. */
const straight = (t, pad) => { t.def = { ...t.def, board: { ...t.def.board, road: [[0, 0], [60, 0]], vault: [61, 0], spots: [pad], pits: [], river: null } }; t.vault = { hp: 1e15, max: 1e15 }; };

test('a Frost Lens at level 19 picks Blizzard or Cold Snap on either path, and keeps its path', () => {
  for (const path of ['a', 'b']) for (const fork of ['a', 'b']) {
    const g = newGame('fz1' + path + fork, 'gulch'), t = rich(g); hold(t);
    const x = tower(t, 0, 'frost', 19, path);
    assert.ok(forkNext(x));
    assert.equal(upgradeTower(g, t, 0), false, 'no fork named');
    assert.ok(upgradeTower(g, t, 0, fork));
    assert.equal(x.level, 20); assert.equal(x.fork, fork); assert.equal(x.path, path);
  }
  // a lens raised past 20 before this fork shipped picks with its next level and keeps its levels (old saves)
  const g = newGame('fz1old', 'gulch'), t = rich(g); hold(t);
  const old = tower(t, 0, 'frost', 23, 'b');
  assert.ok(forkNext(old));
  assert.ok(upgradeTower(g, t, 0, 'a')); assert.equal(old.level, 24); assert.equal(old.fork, 'a'); assert.equal(old.path, 'b');
});

test('each Frost fork changes its stats as its card says', () => {
  const g = newGame('fz2', 'gulch'), t = rich(g);
  for (const path of ['a', 'b']) {
    const none = towerStats(t, tower(t, 0, 'frost', 20, path)), bz = towerStats(t, tower(t, 0, 'frost', 20, path, 'a')), cs = towerStats(t, tower(t, 0, 'frost', 20, path, 'b'));
    const B = FORKS.frost.a, C = FORKS.frost.b;
    for (const [s, F] of [[bz, B], [cs, C]]) for (const k of ['dmg', 'rate', 'range']) assert.ok(Math.abs(s[k] - none[k] * (F[k] || 1)) < 1e-9, k);
    assert.ok(bz.range > none.range * 1.2 && bz.dmg < none.dmg, 'Blizzard reaches much farther, softer hits');
    assert.ok(cs.range < none.range && cs.dmg < none.dmg, 'Cold Snap a short reach, softer hits');
    assert.equal(bz.slow, none.slow);
    assert.equal(cs.slow, Math.min(SLOW_MOST, TOWERS.frost.slow * C.slow));
    assert.ok(cs.slow > none.slow * 1.3, 'Cold Snap slows much more');
    // a path's own power stays (Deep Freeze freezes, Brittle Ice makes slowed raiders take more)
    assert.equal(cs.freeze, none.freeze); assert.equal(bz.brittle, none.brittle);
  }
  // the card's Damage and Range rows name the fork, and its Slows row reads the new share
  const ex = explainTower(t, tower(t, 0, 'frost', 20, 'a', 'b'));
  assert.ok(ex.dmg.rows.some(r => r.label === FORKS.frost.b.name) && ex.range.rows.some(r => r.label === FORKS.frost.b.name));
});

/* How long a raider takes to cross the stretch of road past a lens, and the lens's own damage to it. */
function cross(fork, pad = [30, 1.2]) {
  const g = newGame('fz3' + fork, 'gulch'), t = rich(g); straight(t, pad);
  tower(t, 0, 'frost', 20, 'b', fork);
  startWave(g, t);
  t.waves.queue = []; t.waves.foes = [{ id: 1, kind: 'raider', lane: 0, hp: 1e12, max: 1e12, s: 20, slow: 0, slowT: 0, frozenT: 0, poison: 0, poisonT: 0, rot: 0, eat: 0, brittle: 0 }];
  // near: seconds within a plain level-20 lens's reach of the pad's place along the road
  const f = t.waves.foes[0], R = towerStats(t, { kind: 'frost', level: 20, path: 'b', fork: null }).range; let steps = 0, reached = null, near = 0;
  for (; f.s < 40 && steps < 4000; steps++) { g.step(.25); if (reached === null && f.hp < 1e12) reached = f.s; if (Math.abs(f.s - pad[0]) < R) near += .25; }
  return { time: near, hurt: 1e12 - f.hp, reached };
}

test('Cold Snap holds a raider far longer on the road by it, Blizzard reaches it sooner', () => {
  const none = cross(null), bz = cross('a'), cs = cross('b');
  assert.ok(cs.time > none.time * 1.2, 'Cold Snap ' + cs.time + ' s against ' + none.time + ' s');
  assert.ok(bz.reached < none.reached - 1, 'Blizzard first hits at ' + bz.reached + ', no fork at ' + none.reached);
  // a raider walking past a lens set back from the road: only Blizzard's reach finds it
  const far = towerStats(newGame('fz3r', 'gulch').town, { kind: 'frost', level: 20, path: 'b', fork: null }).range + .4;
  assert.equal(cross(null, [30, far]).hurt, 0);
  assert.ok(cross('a', [30, far]).hurt > 0);
});

test('a Frost Lens one level from its fork shows its own explainer', () => {
  const e = EXPLAINERS.find(x => x.covers.includes('fork:frost'));
  assert.ok(e, 'an explainer covers fork:frost');
  assert.equal(e.when({ forkFrost: null }), false);
  assert.deepEqual(e.at({ forkFrost: 5 }), { tower: 5 });
  for (const k of ['a', 'b']) assert.ok(e.text.includes(FORKS.frost[k].name), 'the card names ' + FORKS.frost[k].name);
});

test('the bots weigh both Frost forks, and Auto-towers leaves the choice to the player', () => {
  const g = newGame('fz5', 'gulch'), t = rich(g); hold(t);
  tower(t, 0, 'frost', 19);
  const ups = options(t).filter(o => o.up && o.spot === 0);
  assert.deepEqual(ups.map(o => o.path).sort(), ['a', 'b']);
  const n = nextTowerUp(t);
  assert.equal(n.tower, null); assert.equal(n.needPath, 1);
});
