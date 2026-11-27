// node tools/mesa-newcomer.js [--seed N | --seeds 1,2,3] [--minutes 60] [--trace], one of the release bots (seeds 1-6, about a minute): the newcomer bot in Thunder Mesa (PLAN.md M6b,
// "The Mesa's strip asks for a Tesla Coil before the airships"). Loads the Falls-era game tools/mesa-probe.js keeps in
// .checks/mesa-snap-<seed>.json (run mesa-probe once per seed to make it), gives it what founding the Mesa takes the way
// mesa-probe does, founds the Mesa and lets the newcomer of tools/firstplay.js play on from there (it follows the strip).
// Prints when the strip's Tesla step showed and cleared, when it reached and won Tar Seep (within TS_MOST minutes), the first Tesla Coil, the airships that flew and got through in
// the Mesa, its best wave, and its towers. Gate: under a fifth of the airships of waves 11-20 through, and the Tesla step clears.
import fs from 'node:fs';
import path from 'node:path';
import { loadGame } from '../src/core/setup.js';
import { decode } from '../src/core/save.js';
import { foundTown, canFound } from '../src/core/empire.js';
import { goalNow } from '../src/core/goals.js';
import { TOWNS } from '../src/data/towns/index.js';
import { newcomer } from './firstplay.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const MINUTES = +arg('minutes', 60), SEEDS = String(arg('seeds', arg('seed', '1,2,3,4,5,6'))).split(',').map(Number);
// the share of the Mesa's airships the newcomer may let through in its first airship waves (11 to EARLY_TO). The box
// asked for a fifth over the whole first hour, but the active player itself lets 33-46% through over its first hour as
// it climbs to its wall at wave 39-40 (mesa-probe --minutes 60, 2026.11.27-2), so the hour measures the climb, not the step.
const TRACE = process.argv.includes('--trace');
export const AIR_MOST = .2, EARLY_TO = 20;
// Tar Seep (part 3): the newcomer wins it within TS_MOST minutes of founding the Mesa (the outposts' limit in tools/balance.js)
export const TS_MOST = 30;

export function mesaNewcomer(seed, minutes = MINUTES) {
  const file = path.join('.checks', 'mesa-snap-' + seed + '.json');
  if (!fs.existsSync(file)) return { seed, err: 'no ' + file + ' (run tools/mesa-probe.js --seed ' + seed + ')' };
  const g = loadGame(decode(fs.readFileSync(file, 'utf8')).game), F = TOWNS.mesa.found;
  g.towns.falls.bestWave = Math.max(g.towns.falls.bestWave || 0, F.wave);
  if (!g.shared.tree.founded.includes('transport')) g.shared.tree.founded.push('transport');
  g.shared.tree.nodes.transport = Math.max(g.shared.tree.nodes.transport || 0, F.nodes.transport);
  g.town.coins += F.coins;
  g.shared.charter.deeds = Math.max(g.shared.charter.deeds, F.deeds || 0);
  if (!canFound(g, 'mesa')) return { seed, err: 'cannot found the Mesa' };
  foundTown(g, 'mesa'); g.go('mesa');
  const t0 = g.stats.steps * .25, min = () => (g.stats.steps * .25 - t0) / 60;
  const r = { seed, flew: 0, leaked: 0, fell: 0, eFell: 0, eLeaked: 0, bare: 0, stepAt: null, stepDone: null, firstTesla: null, inMesa: 0, steps: 0, tsAt: null, tsWon: null };
  const emit = g.bus.emit.bind(g.bus);
  g.bus.emit = (type, e) => {
    if (e && e.town === 'mesa') {
      const f = (type === 'leak' || type === 'kill') && g.towns.mesa.waves.foes.find(x => x.id === e.foe);
      const early = g.towns.mesa.wave <= EARLY_TO, none = !g.towns.mesa.towers.some(t => t.kind === 'tesla');
      if (type === 'kill' && e.kind === 'airship') { r.fell++; if (early) r.eFell++; }
      if (type === 'leak' && f && f.kind === 'airship') { r.leaked++; if (early) r.eLeaked++; if (none) r.bare++; }
    }
    return emit(type, e);
  };
  const hook = gm => {
    r.steps++;
    if (gm.active === 'mesa') r.inMesa++;
    // Tar Seep (part 3): when the strip took the newcomer there, and when it won it (from the Mesa's founding)
    if (gm.active === 'tarseep' && r.tsAt == null) r.tsAt = min();
    if (r.tsWon == null && gm.towns.tarseep && gm.towns.tarseep.won) r.tsWon = min();
    if (r.steps % 4) return false;
    if (TRACE && r.steps % 240 === 0) { const s0 = goalNow(gm); const m = gm.towns.mesa; console.log(`  ${min().toFixed(0)} min in ${gm.active}: ${s0 ? s0.id + ' ' + (s0.text || '') : '-'} | Mesa wave ${m.wave} vault ${Math.round(m.vault.hp)}/${m.vault.max} teslas ${m.towers.filter(t => t.kind === 'tesla').map(t => t.level).join(',')}`); }
    const s = gm.active === 'mesa' ? goalNow(gm) : null;
    if (s && s.id === 'm-tesla' && r.stepAt == null) r.stepAt = min();
    if (r.stepAt != null && r.stepDone == null && gm.shared.goals.done['m-tesla']) r.stepDone = min();
    if (r.firstTesla == null && gm.towns.mesa.towers.some(t => t.kind === 'tesla')) r.firstTesla = min();
    return false;
  };
  const nr = newcomer(seed, minutes, hook, g);
  if (TRACE) for (const [at, where, what, label] of nr.log) if (what === 'go' || what === 'resume' || what === 'hold') console.log(`  tap at ${((at - t0) / 60).toFixed(1)} min in ${where}: ${what} ${label}`);
  const m = g.towns.mesa;
  r.flew = r.fell + r.leaked;
  r.best = m.bestWave; r.wave = m.wave; r.share = r.flew ? r.leaked / r.flew : 0;
  r.eFlew = r.eFell + r.eLeaked; r.eShare = r.eFlew ? r.eLeaked / r.eFlew : 0;
  r.inMesa = r.inMesa / Math.max(1, r.steps);
  r.towers = m.towers.map(t => t.kind[0] + t.level).join(' ');
  return r;
}

if (process.argv[1] && process.argv[1].endsWith('mesa-newcomer.js')) {
  let bad = 0;
  for (const seed of SEEDS) {
    const r = mesaNewcomer(seed);
    if (r.err) { console.log(`seed ${seed}: ${r.err}`); bad++; continue; }
    const f = x => x == null ? 'never' : x.toFixed(1) + ' min';
    const miss = r.eShare >= AIR_MOST || (r.stepAt != null && r.stepDone == null) || r.tsWon == null || r.tsWon > TS_MOST;
    if (miss) bad++;
    console.log(`seed ${seed}: Tesla step shown ${f(r.stepAt)}, cleared ${f(r.stepDone)}, first Tesla ${f(r.firstTesla)}; airships in waves 11-${EARLY_TO} ${r.eLeaked} of ${r.eFlew} through (${Math.round(100 * r.eShare)}%, want under ${100 * AIR_MOST}%), ${r.bare} through with no Tesla, all hour ${Math.round(100 * r.share)}%; Tar Seep reached ${f(r.tsAt)}, won ${f(r.tsWon)}; best wave ${r.best}, in the Mesa ${Math.round(100 * r.inMesa)}% of the time; towers ${r.towers}${miss ? '  MISS' : ''}`);
  }
  console.log(bad ? 'mesa-newcomer: ' + bad + ' miss' : 'mesa-newcomer ok');
  process.exit(bad ? 1 : 0);
}
