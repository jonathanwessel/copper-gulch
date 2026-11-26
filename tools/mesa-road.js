// node tools/mesa-road.js: the active player's road from Silver Falls to Thunder Mesa (PLAN.md M6b, part 1b), one of the
// release bots in tools/bots.js. It runs 6 seeds side by side (each a child of this file, into .checks/mesa-road-<seed>.txt)
// and gates them: the Mesa founded at 9-14 h of play on every seed and never before the Telegraph Works and the Falls'
// charter (GDD, Pacing targets; it was 20-30 h until part 1b, see PLAN.md), its wave 10 at 7-9 minutes
// from getting there with no breach in waves 1-3, and every Mesa strip step done within its `within` (src/data/goals.js).
// It is a bot of its own, not part of tools/balance.js, since balance.js plays its seeds one after another (31 minutes)
// and each seed is a 2-minute empire run and 2-4 hours of play past it.
// node tools/mesa-road.js --seed N [--snap]: one seed. It plays the empire through the Falls hour (tools/balance.js
// empire), then on with toMesa, printing one line each hour of play: the purse held unspent, what every town earned in
// the last minute, the Falls' best wave, the Rail Office's upgrades, the deeds held and what the Falls' charter would pay.
// --snap starts from the game an hour into the Falls kept in .checks/mesa-snap-<seed>.json (tools/mesa-probe.js writes
// it), for trying numbers; --deeds, --wave and --coins try another founding rule in this process only.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { empire, capitalPick, toMesa, MESA_PLAY } from './balance.js';
import { loadGame } from '../src/core/setup.js';
import { encode, decode } from '../src/core/save.js';
import { TOWNS } from '../src/data/towns/index.js';
import { GOALS } from '../src/data/goals.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const k = n => n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : Math.round(n / 1e3) + 'K';
export const MESA_AT = [9, 14], MESA_W10 = [7, 9], SEEDS = 6;
const MESA_GOALS = GOALS.filter(x => x.town === 'mesa' && x.within);

if (arg('seed') == null) {
  // the parent: six seeds side by side, then the gates
  const me = fileURLToPath(import.meta.url), t0 = Date.now(), pass = process.argv.slice(2);
  fs.mkdirSync('.checks', { recursive: true });
  const runs = await Promise.all(Array.from({ length: +arg('seeds', SEEDS) }, (_, i) => new Promise(done => {
    const s = i + 1, file = path.join('.checks', 'mesa-road-' + s + '.txt'), out = fs.openSync(file, 'w');
    const p = spawn(process.execPath, [me, '--seed', String(s), ...pass], { stdio: ['ignore', out, out] });
    p.on('exit', code => {
      fs.closeSync(out);
      const txt = fs.readFileSync(file, 'utf8'), line = txt.split(/\r?\n/).find(l => l.startsWith('result '));
      done({ seed: s, code, r: line ? JSON.parse(line.slice(7)) : null, tail: txt.trim().split(/\r?\n/).slice(-3).join(' | ') });
    });
  })));
  const misses = [], close = [];
  console.log('Thunder Mesa from the active player\'s road (seed | Falls founded | Falls charter | Mesa founded | held to save | Mesa wave 10 | breaches 1-3):');
  for (const { seed, code, r, tail } of runs) {
    if (!r) { misses.push(`seed ${seed}: no result (exit ${code}): ${tail}`); continue; }
    const h = r.found == null ? null : r.found / 3600;
    console.log(`  ${seed} | ${(r.falls / 3600).toFixed(2)} h | ${r.signed ? (r.signed.at / 3600).toFixed(2) + ' h at wave ' + r.signed.wave + ', ' + r.signed.deeds + ' deeds' : 'none'} | ${h == null ? 'never' : h.toFixed(2) + ' h'} | ${Math.round(r.held / 60)} min | ${r.w10 == null ? 'never' : (r.w10 / 60).toFixed(1) + ' min'} | ${r.early.join(',') || 'none'}`);
    console.log(`     purse each hour: ${r.log.map(([hh, p, all]) => hh + 'h ' + k(p) + ' (' + k(all) + '/min)').join(', ')}`);
    if (h == null || h < MESA_AT[0] || h > MESA_AT[1]) misses.push(`seed ${seed}: Thunder Mesa founded at ${h == null ? 'never' : h.toFixed(2) + ' h'} (window ${MESA_AT[0]}-${MESA_AT[1]} h)`);
    else if (h < MESA_AT[0] * 1.05 || h > MESA_AT[1] * .95) close.push(`seed ${seed}: Mesa founded at ${h.toFixed(2)} h`);
    if (h != null) {
      // never before the Falls era's firsts: its top workshop and its charter (the Silver Falls floor box's rule, 2026-11-24)
      const tg = r.goals['f-telegraph'];
      if (tg == null || tg > r.found) misses.push(`seed ${seed}: the Mesa came before the Telegraph Works`);
      if (!r.signed) misses.push(`seed ${seed}: the Mesa came before the Falls' charter`);
      if (r.w10 == null || r.w10 < MESA_W10[0] * 60 || r.w10 > MESA_W10[1] * 60) misses.push(`seed ${seed}: Mesa wave 10 at ${r.w10 == null ? 'never' : (r.w10 / 60).toFixed(1) + ' min'} (want ${MESA_W10[0]}-${MESA_W10[1]})`);
      if (r.early.length) misses.push(`seed ${seed}: the Mesa breached in waves ${r.early.join(',')}`);
      for (const x of MESA_GOALS) if (r.goals[x.id] == null || r.goals[x.id] > x.within * 60) misses.push(`seed ${seed}: goal ${x.id} not done within ${x.within} min`);
    }
  }
  for (const c of close) console.log('close ' + c);
  console.log((misses.length ? 'FAIL ' + misses.join('; ') : 'ok Thunder Mesa founded at ' + MESA_AT.join('-') + ' h on every seed, after the Telegraph Works and the Falls charter, wave 10 at 7-9 min') + ` (${((Date.now() - t0) / 60000).toFixed(1)} min)`);
  process.exitCode = misses.length ? 1 : 0;
} else {
  const SEED = +arg('seed'), STRATEGY = arg('strategy', 'active'), t0 = Date.now();
  const snapFile = path.join('.checks', 'mesa-snap-' + SEED + '.json');
  let g, goals = {}, fallsAt = null;
  if (process.argv.includes('--snap') && fs.existsSync(snapFile)) g = loadGame(decode(fs.readFileSync(snapFile, 'utf8')).game);
  else {
    const e = empire(SEED, 'active', { capital: true, falls: true });
    if (!e.game.towns.falls) { console.log(`seed ${SEED}: Silver Falls never opened`); process.exit(1); }
    g = e.game; goals = e.goals; fallsAt = e.fallsFound;
    fs.mkdirSync('.checks', { recursive: true }); fs.writeFileSync(snapFile, encode(g, 0));
  }
  const F = TOWNS.mesa.found;
  for (const x of ['deeds', 'wave', 'coins']) if (arg(x) != null) F[x] = +arg(x);
  const now = () => g.stats.steps * .25, out = { capital: now() };
  g.bus.on('goal:done', e => { goals[e.id] ??= now(); });
  out.pick = capitalPick(g, out, now, t => Object.values(g.towns).filter(x => x !== t));
  console.log(`founding rule: Falls wave ${F.wave}, deeds ${F.deeds || 0}, coins ${k(F.coins)}, Rail Office ${F.nodes.transport}`);
  console.log(`seed ${SEED}: from ${(now() / 3600).toFixed(2)} h of play, purse ${k(g.town.coins)}`);
  toMesa(SEED, g, STRATEGY, out, now, { saveMinutes: arg('save') == null ? undefined : +arg('save'), log: ([h, purse, all, best, rail, deeds, pays]) => console.log(`  ${h} h: purse ${k(purse)}, ${k(all)} a minute, Falls best wave ${best}, Rail Office ${rail}, deeds ${deeds}, the Falls' charter pays ${pays}`) });
  const found = out.mesaFound == null ? 'never' : (out.mesaFound / 3600).toFixed(2) + ' h';
  const w10 = out.mesa && out.mesa.w10 != null ? (out.mesa.w10 / 60).toFixed(1) + ' min' : 'never';
  console.log(`seed ${SEED} ${STRATEGY}: Thunder Mesa founded at ${found} (want ${MESA_AT[0]}-${MESA_AT[1]} h), held ${Math.round((out.mHeld || 0) / 60)} min to save, Mesa wave 10 at ${w10} (want ${MESA_W10[0]}-${MESA_W10[1]}) after ${MESA_PLAY} min there, took ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  if (out.mSigned) console.log(`  signed the Falls' charter at ${(out.mSigned.at / 3600).toFixed(2)} h, wave ${out.mSigned.wave}, ${out.mSigned.deeds} deeds`);
  if (out.mesa) {
    const m = g.towns.mesa;
    console.log(`  Mesa breaches ${out.mesa.breaches.join(',') || 'none'}, best wave ${m.bestWave}, towers ${m.towers.map(t => t.kind[0] + t.level).join(' ')}`);
    console.log(`  buildings ${TOWNS.mesa.buildings.filter(b => m.level(b)).map(b => b + ' ' + m.level(b)).join(', ')}`);
  }
  console.log('result ' + JSON.stringify({ seed: SEED, falls: fallsAt, found: out.mesaFound, held: out.mHeld || 0, signed: out.mSigned, w10: out.mesa ? out.mesa.w10 : null, early: out.mesa ? out.mesa.breaches.filter(w => w <= 3) : [], log: out.mLog, goals }));
}
