// node tools/tesla-runs.js [--seed 1] [--waves 5] [--level L] [--sets "dmg=7;a.dmg=.7,archits=.5"]: runs of the waves for the
// Tesla Coil on Thunder Mesa's board (PLAN.md M6b, part 2a), the way tools/fork-runs.js runs a level-20 fork. The active
// player's road to the Mesa and its first hour there (tools/balance.js toMesa, from .checks/mesa-snap-<seed>.json when it
// is there, a few minutes; the Mesa game is kept in .checks/mesa-end-<seed>.json for the next try, --fresh plays it
// again), then on each normal pad in turn a tower of each kind and path at level L (the median level of the Mesa's
// towers) plays the next waves on a copy of the town with a vault that never falls. Prints, per pad, each candidate's
// own damage and leaks, the kind the runs favor by damage for the coins to build it to L, and the kind the bots' guess
// (worth per coin) picks there, then how many pads each favors. A set is a list of stat=value for TOWERS.tesla, a.stat
// or b.stat for its paths, and the bots' ARC_HITS and ROD_SHARE as archits= and rod=. --kinds tesla,cannon,crossbow picks the candidates (the
// Frost Lens and the Still help the others more than they hit, so their own damage is no fair judge, and the Mortar has
// its own pits).
import fs from 'node:fs';
import path from 'node:path';
import * as BAL from './balance.js';
import { empire, capitalPick, toMesa, worth } from './balance.js';
import { loadGame } from '../src/core/setup.js';
import { encode, decode } from '../src/core/save.js';
import { Town } from '../src/core/town.js';
import { fight, startWave, fitsSpot, towerCost, isPit } from '../src/core/defense.js';
import { STEP } from '../src/core/clock.js';
import { TOWERS, PATHS, PATH_LEVEL } from '../src/data/towers.js';
import { GOODS } from '../src/data/goods.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SEED = +arg('seed', 1), WAVES = +arg('waves', 5), KINDS = arg('kinds', 'tesla,cannon,crossbow').split(',');
const endFile = path.join('.checks', 'mesa-end-' + SEED + '.json'), snapFile = path.join('.checks', 'mesa-snap-' + SEED + '.json');

/* The Mesa an hour after the active player founds it. */
function mesaGame() {
  if (fs.existsSync(endFile) && !process.argv.includes('--fresh')) return loadGame(decode(fs.readFileSync(endFile, 'utf8')).game);
  let g;
  if (fs.existsSync(snapFile)) g = loadGame(decode(fs.readFileSync(snapFile, 'utf8')).game);
  else { const e = empire(SEED, 'active', { capital: true, falls: true }); g = e.game; fs.mkdirSync('.checks', { recursive: true }); fs.writeFileSync(snapFile, encode(g, 0)); }
  const now = () => g.stats.steps * .25, out = { capital: now() };
  out.pick = capitalPick(g, out, now, t => Object.values(g.towns).filter(x => x !== t));
  toMesa(SEED, g, 'active', out, now);
  if (!g.towns.mesa) { console.log(`seed ${SEED}: Thunder Mesa never founded`); process.exit(1); }
  fs.mkdirSync('.checks', { recursive: true }); fs.writeFileSync(endFile, encode(g, 0));
  return g;
}

/* WAVES waves on a copy of the town with one tower put on spot: its own damage and the raiders that got through. */
function runs(town, spot, tw) {
  const c = Town.fromJSON(town.toJSON(), town.def);
  c.vault = { hp: 1e15, max: 1e15 };
  c.towers = c.towers.filter(x => x.spot !== spot).concat([{ spot, cd: 0, spent: 0, pulses: 0, fork: null, ...tw }]);
  for (const t of c.towers) t.cd = 0;
  Object.assign(c.waves, { phase: 'break', timer: 0, hold: false, queue: [], foes: [], shells: [], fires: [], bossLeaked: false });
  let leaks = 0;
  const g = { active: c.id, catching: false, dealt: {}, dealtSpot: {}, bus: { emit(type) { if (type === 'leak') leaks++; } } };
  for (let w = 0; w < WAVES; w++) {
    if (!startWave(g, c)) break;
    for (let n = 0; c.waves.phase === 'wave' && n < 40000; n++) fight(g, c, STEP);
  }
  return { own: (g.dealtSpot[c.id] || {})[spot] || 0, leaks };
}
/* Coins to build a kind and raise it to level L, with its goods at their base price. */
const toLevel = (town, kind, L) => { let a = 0; for (let i = 0; i < L; i++) { const c = towerCost(town, kind, i); a += c.coins + Object.entries(c.goods).reduce((s, [g, n]) => s + GOODS[g].price * n, 0); } return a; };

const g = mesaGame(), m = g.towns.mesa;
const lv = m.towers.filter(t => !TOWERS[t.kind].long).map(t => t.level).sort((a, b) => a - b);
const L = +arg('level', lv[Math.floor(lv.length / 2)] || 15);
console.log(`seed ${SEED}: Mesa at wave ${m.wave}, towers ${m.towers.map(t => t.kind[0] + t.level + (t.path || '')).join(' ')}; candidates at level ${L}, ${WAVES} waves`);
m.flags['open:tesla'] = true;
const base = { t: { ...TOWERS.tesla }, a: { ...PATHS.tesla.a }, b: { ...PATHS.tesla.b } };
for (const set of (arg('sets', '') || '').split(';')) {
  Object.assign(TOWERS.tesla, base.t);
  for (const s of ['a', 'b']) { for (const k of Object.keys(PATHS.tesla[s])) delete PATHS.tesla[s][k]; Object.assign(PATHS.tesla[s], base[s]); }
  for (const kv of set.split(',').filter(Boolean)) {
    const [key, v] = kv.split('='), [side, stat] = key.includes('.') ? key.split('.') : ['t', key];
    if (key === 'archits' || key === 'rod') BAL.tune(key, +v); else if (side === 't') TOWERS.tesla[stat] = +v; else PATHS.tesla[side][stat] = +v;
  }
  if (set) console.log('set ' + set);
  const tally = { runs: {}, guess: {}, teslaPath: { a: 0, b: 0 }, teslaGuess: { a: 0, b: 0 } };
  for (let i = 0; i < m.def.board.spots.length; i++) {
    if (isPit(m, i) || !fitsSpot(m, i, 'tesla')) continue;
    const cand = [];
    for (const kind of KINDS) for (const p of Object.keys(PATHS[kind])) {
      const tw = { kind, level: L, path: L >= PATH_LEVEL ? p : null }, r = runs(m, i, tw), coins = toLevel(m, kind, L);
      const keep = m.towers; m.towers = keep.filter(x => x.spot !== i);
      const guess = worth(m, { spot: i, ...tw }) / coins; m.towers = keep;
      cand.push({ name: kind + '.' + p, kind, p, ...r, per: r.own / coins, guess });
    }
    const best = cand.slice().sort((a, b) => b.per - a.per)[0], pick = cand.slice().sort((a, b) => b.guess - a.guess)[0];
    const ts = cand.filter(c => c.kind === 'tesla'), tb = ts.slice().sort((a, b) => b.own - a.own)[0], tg = ts.slice().sort((a, b) => b.guess - a.guess)[0];
    tally.runs[best.kind] = (tally.runs[best.kind] || 0) + 1; tally.guess[pick.kind] = (tally.guess[pick.kind] || 0) + 1; tally.teslaPath[tb.p]++; tally.teslaGuess[tg.p]++;
    const M = n => (n / 1e6).toFixed(2) + 'M';
    console.log(`seed ${SEED} | pad ${i} | ${cand.map(c => c.name + ' ' + M(c.own) + ' ' + c.leaks).join(' | ')} | runs ${best.name} | guess ${pick.name} | tesla runs ${tb.p} guess ${tg.p}`);
  }
  const f = o => Object.entries(o).map(([k, v]) => k + ' ' + v).join(', ');
  console.log(`seed ${SEED} | pads best for the coins by the runs: ${f(tally.runs)} | by the guess: ${f(tally.guess)} | Tesla paths by the runs: ${f(tally.teslaPath)}, by the guess: ${f(tally.teslaGuess)}${set ? ' | set ' + set : ''}`);
}
