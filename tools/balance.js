// node tools/balance.js [--seeds 3] [--minutes 40]: plays Copper Gulch with a steady, sensible player (no waiting,
// no mistakes) straight on the simulation core, and checks the pacing targets that exist so far:
//   the first tower under 1 minute; wave 10 cleared in 7-9 minutes; no breach in waves 1-3.
// (The M1 target box adds the first charter offer at 35-45 minutes once charters exist.)
// Prints a table per seed and "ok" or the misses.
import { newGame } from '../src/core/setup.js';
import { build, cost, unlocked } from '../src/core/economy.js';
import { buildTower, upgradeTower, towerCost, canPay, towerAt } from '../src/core/defense.js';
import { BUILDINGS } from '../src/data/buildings.js';
import { GOODS } from '../src/data/goods.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] : d; };
const SEEDS = arg('seeds', 3), MINUTES = arg('minutes', 40);

/* One player's run: every second, defend first when the defense is thin for the coming wave, then the best-paying
   building; towers go on the spots that reach two passes first; a tower is raised before it falls behind the waves. */
export function play(seed, minutes = MINUTES) {
  const g = newGame('balance-' + seed), t = g.town, r = { seed, firstTower: null, wave10: null, breaches: [], waveAt: {} };
  g.bus.on('wave:clear', e => { if (e.wave === 10 && r.wave10 === null) r.wave10 = t.t; });
  g.bus.on('breach', e => r.breaches.push(e.wave));
  const spots = t.def.board.spots.map((_, i) => i); // listed best first in the data
  for (let s = 0; s < minutes * 60 * 4; s++) {
    g.step(.25);
    if (s % (60 * 4) === 0) r.waveAt[s / 240] = t.wave;
    if (s % 4) continue;
    const want = Math.min(spots.length, 1 + Math.ceil(t.wave / 3));
    if (t.towers.length < want) {
      const spot = spots.find(i => !towerAt(t, i));
      if (buildTower(g, t, spot, 'crossbow')) { r.firstTower ??= t.t; continue; }
    } else {
      const low = t.towers.slice().sort((a, b) => a.level - b.level)[0];
      if (low && low.level < 1 + t.wave / 3 && canPay(t, towerCost(t, low.kind, low.level))) { upgradeTower(g, t, low.spot, low.level % 2 ? 'a' : 'b'); continue; }
    }
    let best = null, bv = 0;
    for (const id of t.def.buildings) {
      if (!unlocked(t, id)) continue;
      const b = BUILDINGS[id], v = (b.rate * GOODS[b.makes].price + (t.level(id) ? 0 : 2)) / cost(t, id);
      if (v > bv) { bv = v; best = id; }
    }
    if (best && t.coins >= cost(t, best)) build(g, t, best);
  }
  r.final = { wave: t.wave, best: t.bestWave, lifetime: Math.round(t.lifetime), towers: t.towers.length, buildings: { ...t.buildings } };
  return r;
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/balance.js')) {
  const misses = [];
  console.log('seed | first tower | wave 10 | breaches (waves) | wave at 10/20/30/40 min | lifetime coins');
  for (let s = 1; s <= SEEDS; s++) {
    const r = play(s), w10 = r.wave10 === null ? 'never' : (r.wave10 / 60).toFixed(1) + ' min';
    console.log(`${s} | ${r.firstTower === null ? 'never' : Math.round(r.firstTower) + ' s'} | ${w10} | ${r.breaches.join(',') || 'none'} | ${[10, 20, 30, 40].map(m => r.waveAt[m] ?? '-').join('/')} | ${r.final.lifetime}`);
    if (r.firstTower === null || r.firstTower > 60) misses.push(`seed ${s}: first tower at ${r.firstTower} s (want under 60)`);
    if (r.wave10 === null || r.wave10 < 7 * 60 || r.wave10 > 9 * 60) misses.push(`seed ${s}: wave 10 at ${w10} (want 7-9 min)`);
    if (r.breaches.some(w => w <= 3)) misses.push(`seed ${s}: a breach in waves 1-3`);
  }
  console.log(misses.length ? misses.map(m => 'FAIL ' + m).join('\n') : 'ok');
  process.exitCode = misses.length ? 1 : 0;
}
