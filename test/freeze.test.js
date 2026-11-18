// Deep Freeze cannot hold a raider forever (found by the idle bot, M4): a raider that thaws walks for FREEZE.again
// seconds before any lens can freeze it again, however many lenses overlap. With 11 lenses on Iron Ridge's road the
// raiders stood frozen for half an hour and one wave took 40 minutes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, loadGame } from '../src/core/setup.js';
import { buildTower, upgradeTower, towerStats, roadOf } from '../src/core/defense.js';
import { pointAt, dist } from '../src/core/path.js';
import { PATH_LEVEL, FREEZE } from '../src/data/towers.js';

/* The Gulch with a Deep Freeze lens on every near pad, and one brute with a lot of health where most lenses reach. */
function frozenRoad(seed) {
  const g = newGame(seed, 'gulch'), t = g.town;
  t.coins = 1e12; t.wave = 12;
  for (const k of ['timber', 'ore', 'copper', 'bricks', 'tools', 'planks', 'clay']) { t.goods[k] = 1e9; t.sell[k] = false; }
  const near = t.def.board.spots.slice(0, t.def.board.far).map((_, i) => i);
  for (const s of near) {
    if (!buildTower(g, t, s, 'frost')) continue;
    while (t.towers.find(x => x.spot === s).level < PATH_LEVEL + 2) upgradeTower(g, t, s, 'a');
  }
  const road = roadOf(t), reach = s => t.towers.filter(x => dist(t.def.board.spots[x.spot], pointAt(road, s)) <= towerStats(t, x).range).length;
  let best = 1, most = 0;
  for (let s = 1; s < road.length - 6; s += .25) { const n = reach(s); if (n > most) { most = n; best = s; } }
  Object.assign(t.waves, { phase: 'wave', queue: [], hold: true, foes: [{ id: 1, kind: 'brute', hp: 1e12, max: 1e12, s: best, slow: 0, slowT: 0, frozenT: 0, poison: 0, poisonT: 0, brittle: 0 }] });
  return { g, t, most };
}

test('stacked Deep Freeze lenses freeze a raider now and then, never for good', () => {
  const { g, t, most } = frozenRoad('fz1');
  assert.ok(most >= 2, 'more than one lens reaches one spot of the road (' + most + ')');
  const f = t.waves.foes[0], start = f.s;
  let frozen = 0, run = 0, longest = 0, steps = 0, freezes = 0, was = false;
  for (let i = 0; i < 30 * 4; i++) {
    g.step(.25); steps++;
    const now = f.frozenT > 0;
    if (now) { frozen++; run++; longest = Math.max(longest, run); if (!was) freezes++; } else run = 0;
    was = now;
  }
  assert.ok(freezes >= 2, 'it is frozen again and again (' + freezes + ' times)');
  assert.ok(longest * .25 <= FREEZE.seconds + .25 + 1e-9, 'one freeze lasts ' + longest * .25 + ' s');
  assert.ok(frozen / steps <= (FREEZE.seconds + .25) / (FREEZE.seconds + FREEZE.again) + .05, 'frozen ' + Math.round(100 * frozen / steps) + '% of the time');
  assert.ok(f.s > start + 5, 'it keeps walking (' + (f.s - start).toFixed(1) + ')');
});

test('the wait before the next freeze survives a save', () => {
  const { g, t } = frozenRoad('fz2'), f = t.waves.foes[0];
  for (let i = 0; i < 40 && !(f.thawT > 0 && f.frozenT <= 0); i++) g.step(.25);
  assert.ok(f.thawT > 0 && f.frozenT <= 0, 'thawed and waiting');
  const h = loadGame(JSON.parse(JSON.stringify(g.toJSON()))), f2 = h.town.waves.foes[0];
  assert.equal(f2.thawT, f.thawT);
  for (let i = 0; i < 4; i++) { g.step(.25); h.step(.25); }
  assert.deepEqual([f2.s, f2.frozenT, f2.thawT], [f.s, f.frozenT, f.thawT]);
});
