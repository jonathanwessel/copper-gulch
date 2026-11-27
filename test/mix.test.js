// Every tower finish against every boss wave, on one road (2026.11.23-3: a 6-hour newcomer run crashed when a raider
// spreading poison fell in the same step the war wagon's crew jumped off; two systems no test had put together).
// Each town's first boss wave runs to its end against towers of every kind with every path and fork, set by hand on its
// pads at a low, a middle and a high level, on a few seeds. It checks nothing breaks, the wave ends and the boss
// reaches its stage at some level, not the balance. It did not reproduce that crash (it needs a carrier falling in
// the very step of the stage), which test/boss.test.js checks head on; it covers the rest of the mix.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { startWave, fight, fitsSpot, bossWave, bossKind } from '../src/core/defense.js';
import { TOWERS, PATHS, FORKS } from '../src/data/towers.js';

const FINISHES = [];
for (const kind of Object.keys(TOWERS)) for (const path of Object.keys(PATHS[kind] || { x: 1 })) for (const fork of Object.keys(FORKS[kind] || { x: 1 })) FINISHES.push({ kind, path: PATHS[kind] ? path : null, fork: FORKS[kind] ? fork : null });

/* boss: the boss to meet, the town's first boss wave of it (Thunder Mesa meets the war wagon first, then the pirate airship). */
function run(id, seed, level, boss = null) {
  const g = newGame('mix-' + id + seed + '-' + level, id === 'drycreek' ? undefined : 'gulch');
  if (id !== 'drycreek' && id !== 'gulch') { g.addTown(id); g.active = id; }
  const t = g.towns[id], spots = t.def.board.spots;
  t.towers = [];
  let k = seed; // a different finish on each pad, shifted by the seed
  for (let i = 0; i < spots.length; i++) for (let tries = 0; tries < FINISHES.length; tries++, k++) {
    const f = FINISHES[k % FINISHES.length];
    if (!fitsSpot(t, i, f.kind)) continue;
    t.towers.push({ spot: i, kind: f.kind, level, path: level >= 5 ? f.path : null, fork: level >= 20 ? f.fork : null, cd: 0, spent: 1000, pulses: 0 });
    k++; break;
  }
  let w = 1; while (!(bossWave(t, w) && (!boss || bossKind(t, w) === boss)) && w < 200) w++;
  t.wave = w; t.waves.hold = false; t.waves.phase = 'break'; t.waves.timer = 0;
  assert.ok(startWave(g, t), 'the boss wave starts');
  let stages = 0, s = 0; g.bus.on('stage', () => stages++);
  for (; s < 4 * 900 && t.waves.phase !== 'break'; s++) fight(g, t, .25);
  return { stages, ended: s < 4 * 900, towers: t.towers.length };
}

for (const [id, boss] of [['drycreek'], ['gulch'], ['ridge'], ['falls'], ['mesa', 'skypirate']]) for (const seed of [1, 2, 3, 4, 5, 6]) test(`${id} ${boss || ''} boss wave against every tower finish, seed ${seed}`, () => {
  let stages = 0;
  for (const level of [3, 8, 14, 22]) {
    const r = run(id, seed, level, boss);
    assert.ok(r.towers >= 5, 'towers on the pads');
    assert.ok(r.ended, 'the wave ends at level ' + level);
    stages += r.stages;
  }
  assert.ok(stages >= 1, 'the boss reached its stage at some level');
});
