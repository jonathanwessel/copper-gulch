// node tools/fork-runs.js --kind cannon [--seed 1] [--waves 5]: runs of the waves for the level-20 fork of one tower
// kind (PLAN.md, M6a). The active player's late Iron Ridge and Silver Falls (tools/balance.js empire), and on each pad
// in turn a level-20 tower of that kind with no fork, then each fork, plays the next waves on a copy of the town with a
// vault that never falls. Prints, per pad, how far along the road it sits, the damage of each side and the leaks, the
// side the runs favor and the side the careful player's worth (options) picks for a level-19 tower there, so a new
// fork's numbers and the bots' guess are both checked against real waves, not the guess alone (part 1, 2026.11.21-7:
// the guess picked Last Call on 34 of 36 Ridge pads, against the runs). --path a runs one level-5 path only, and
// --sets "a.dmg=.6;a.dmg=.65,b.rate=.45" tries each set of fork numbers in turn on the same late towns (one empire
// run, about 2 minutes, then the waves for each set), with ROCKET_HITS and the like set as "hits=2". --noruns skips the waves, for trying a worth number alone.
import * as BAL from './balance.js';
const { empire, options } = BAL;
import { Town } from '../src/core/town.js';
import { fight, startWave, fitsSpot, roadOf, towerOpen } from '../src/core/defense.js';
import { STEP } from '../src/core/clock.js';
import { FORKS, FORK_LEVEL, PATHS } from '../src/data/towers.js';
import { pointAt, dist } from '../src/core/path.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const NORUNS = process.argv.includes('--noruns'), KIND = arg('kind', 'cannon'), SEED = +arg('seed', 1), WAVES = +arg('waves', 5), PATH = arg('path', null);

/* Where the road passes closest to a pad: 0 at the entrance, 1 at the vault. */
const along = (town, p) => { const r = roadOf(town); let best = 0, bd = 1e9; for (let s = 0; s <= r.length; s += .1) { const d = dist(p, pointAt(r, s)); if (d < bd) { bd = d; best = s; } } return best / r.length; };

/* WAVES waves on a copy of the town with the tower at spot replaced: the kind's damage and the raiders that got through. */
export function runs(town, spot, kind, path, fork, waves = WAVES) {
  const c = Town.fromJSON(town.toJSON(), town.def);
  c.vault = { hp: 1e15, max: 1e15 };
  c.towers = c.towers.filter(x => x.spot !== spot).concat([{ spot, kind, level: FORK_LEVEL, path, fork, cd: 0, spent: 0, pulses: 0 }]);
  for (const t of c.towers) t.cd = 0;
  Object.assign(c.waves, { phase: 'break', timer: 0, hold: false, queue: [], foes: [], shells: [], fires: [], bossLeaked: false });
  let leaks = 0;
  const g = { active: c.id, catching: false, dealt: {}, bus: { emit(type) { if (type === 'leak') leaks++; } } };
  for (let w = 0; w < waves; w++) {
    if (!startWave(g, c)) break;
    for (let n = 0; c.waves.phase === 'wave' && n < 40000; n++) fight(g, c, STEP);
  }
  const d = g.dealt[c.id] || {}, all = Object.values(d).reduce((a, b) => a + b, 0);
  return { own: d[kind] || 0, all, leaks };
}

export function forkRuns(e, kind = KIND) {
  const rows = [];
  for (const id of ['ridge', 'falls']) {
    const t = e.game && e.game.towns[id];
    if (!t || !towerOpen(t, kind)) continue;
    for (let i = 0; i < t.def.board.spots.length; i++) {
      if (!fitsSpot(t, i, kind)) continue;
      for (const path of PATH ? [PATH] : Object.keys(PATHS[kind])) {
        const out = { town: id, spot: i, path, at: along(t, t.def.board.spots[i]) };
        for (const f of [null, ...Object.keys(FORKS[kind])]) out[f || 'none'] = NORUNS ? { own: 0, all: 0, leaks: 0 } : runs(t, i, kind, path, f);
        const keep = t.towers;
        t.towers = keep.filter(x => x.spot !== i).concat([{ spot: i, kind, level: FORK_LEVEL - 1, path, fork: null, cd: 0, spent: 0, pulses: 0 }]);
        const o = options(t).filter(o => o.up && o.spot === i).sort((a, b) => b.value - a.value)[0];
        t.towers = keep;
        out.guess = o ? o.path : '-';
        out.best = Object.keys(FORKS[kind]).sort((a, b) => out[b].own - out[a].own || out[a].leaks - out[b].leaks)[0];
        rows.push(out);
      }
    }
  }
  return rows;
}

if (process.argv[1].endsWith('fork-runs.js')) {
  const e = empire(SEED, 'active', { capital: true, falls: true });
  const base = JSON.parse(JSON.stringify(FORKS[KIND]));
  for (const set of (arg('sets', '') || '').split(';')) {
  for (const k of Object.keys(FORKS[KIND])) { for (const x of Object.keys(FORKS[KIND][k])) delete FORKS[KIND][k][x]; Object.assign(FORKS[KIND][k], base[k]); }
  for (const kv of set.split(',').filter(Boolean)) { const [key, v] = kv.split('='), [side, stat] = key.split('.'); if (stat) FORKS[KIND][side][stat] = +v; else BAL.tune(side, +v); }
  if (set) console.log('set ' + set);
  const rows = forkRuns(e), F = Object.keys(FORKS[KIND]), N = k => FORKS[KIND][k].name, M = n => (n / 1e6).toFixed(2) + 'M';
  for (const r of rows) console.log(`seed ${SEED} | ${r.town} pad ${r.spot} ${r.path} at ${r.at.toFixed(2)} | none ${M(r.none.own)} ${r.none.leaks} | ${F.map(k => N(k) + ' ' + M(r[k].own) + ' ' + r[k].leaks).join(' | ')} | runs ${N(r.best)} | guess ${r.guess === '-' ? '-' : N(r.guess)}`);
  for (const id of ['ridge', 'falls']) {
    const rs = rows.filter(r => r.town === id);
    if (!rs.length) continue;
    const won = k => rs.filter(r => r.best === k).length, guessed = k => rs.filter(r => r.guess === k).length, agree = rs.filter(r => r.guess === r.best).length;
    const sum = k => rs.reduce((a, r) => a + r[k].own, 0) / rs.length;
    console.log(`seed ${SEED} | ${id} | runs: ${F.map(k => N(k) + ' ' + won(k)).join(', ')} | guess: ${F.map(k => N(k) + ' ' + guessed(k)).join(', ')} | agree ${agree} of ${rs.length} | mean ${['none', ...F].map(k => (k === 'none' ? 'none' : N(k)) + ' ' + M(sum(k))).join(', ')}${set ? ' | set ' + set : ''}`);
  }
  }
}
