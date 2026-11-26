// node tools/mesa-probe.js [--seed 1] [--minutes 20] [--strategy active]: Thunder Mesa's wave 10 from a Falls-era game
// (PLAN.md M6b, part 1a; tools/mesa-road.js plays the real road there since part 1b). Plays the active player's empire through the Capital and an hour of Silver Falls
// (tools/balance.js empire, falls: true), prints its purse and income there, then gives it what founding the Mesa takes
// (the Falls' wave, the Rail Office's three upgrades, and the price added to the purse, so the purse it keeps after
// paying is the one it had), founds the Mesa and plays it with goals on. Prints the minutes to wave 10 from getting
// there (the GDD's 7-9), the breaches in waves 1-3 and its best wave. The arrival is a stand-in until part 1b's bots
// play the Falls era to a real one; the game after the Falls hour is kept in .checks/mesa-snap-<seed>.json so a second
// try skips the empire run (--fresh runs it again).
import fs from 'node:fs';
import path from 'node:path';
import { empire, playFalls } from './balance.js';
import { loadGame } from '../src/core/setup.js';
import { encode, decode } from '../src/core/save.js';
import { foundTown, canFound } from '../src/core/empire.js';
import { TOWNS } from '../src/data/towns/index.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SEED = +arg('seed', 1), MINUTES = +arg('minutes', 20), STRATEGY = arg('strategy', 'active');
const snapFile = path.join('.checks', 'mesa-snap-' + SEED + '.json');
let g;
if (!process.argv.includes('--fresh') && fs.existsSync(snapFile)) g = loadGame(decode(fs.readFileSync(snapFile, 'utf8')).game);
else {
  const t0 = Date.now(), e = empire(SEED, 'active', { capital: true, falls: true });
  if (!e.game.towns.falls) { console.log(`seed ${SEED}: Silver Falls never opened`); process.exit(1); }
  g = e.game;
  fs.mkdirSync('.checks', { recursive: true }); fs.writeFileSync(snapFile, encode(g, 0));
  console.log(`seed ${SEED}: empire run ${((Date.now() - t0) / 60000).toFixed(1)} min, Falls founded at ${(e.fallsFound / 3600).toFixed(2)} h`);
}
const F = TOWNS.mesa.found, falls = g.towns.falls, play = g.stats.steps * .25;
const rate = Object.values(g.towns).reduce((a, t) => a + (t.lifetime || 0), 0) / Math.max(1, play); // a rough coins a second over the whole game
console.log(`seed ${SEED}: at ${(play / 3600).toFixed(2)} h of play, purse ${Math.round(g.town.coins / 1e3)}K, about ${Math.round(rate * 60 / 1e3)}K coins a minute over the game so far, Falls best wave ${falls.bestWave}, Rail Office ${(g.shared.tree.nodes || {}).transport || 0} upgrades`);
falls.bestWave = Math.max(falls.bestWave || 0, F.wave);
if (!g.shared.tree.founded.includes('transport')) g.shared.tree.founded.push('transport');
g.shared.tree.nodes.transport = Math.max(g.shared.tree.nodes.transport || 0, F.nodes.transport);
g.town.coins += F.coins;
g.shared.charter.deeds = Math.max(g.shared.charter.deeds, F.deeds || 0); // the deeds the Falls' charter would bring (part 1b)
if (!canFound(g, 'mesa')) { console.log('cannot found the Mesa'); process.exit(1); }
foundTown(g, 'mesa'); g.go('mesa');
// playFalls times wave 10 from the Falls' own clock; the Mesa's starts at 0 when it is founded
const m = g.towns.mesa, from = m.t, r = playFalls(SEED, g, STRATEGY, MINUTES, null);
r.w10 = r.wave10 == null ? null : r.wave10 - from;
const w10 = r.w10 == null ? 'never' : (r.w10 / 60).toFixed(1) + ' min';
console.log(`seed ${SEED} ${STRATEGY}: Mesa wave 10 at ${w10} (want 7-9), breaches in waves 1-3: ${r.breaches.filter(w => w <= 3).join(',') || 'none'}, all breaches ${r.breaches.join(',') || 'none'}, best wave ${m.bestWave} after ${MINUTES} min`);
console.log(`  towers ${m.towers.map(t => t.kind[0] + t.level).join(' ')}, buildings ${TOWNS.mesa.buildings.filter(b => m.level(b)).map(b => b + ' ' + m.level(b)).join(', ')}`);
