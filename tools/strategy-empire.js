// node tools/strategy-empire.js [--seeds 6] [--nomesa] [--who active,minmax,swarm,economy,defense] [--lanes 12]: each strategy's
// own empire run, from a new game through the Capital and Silver Falls to Thunder Mesa (part 1c, 2026.11.26-7) (empire() in tools/balance.js with the Capital and
// the Falls), side by side in child processes. Prints per run when each place opened, the Ridge's best wave every half
// hour of the Falls save, and the Ridge's towers at the end, then the median time each strategy opens Silver Falls
// against the best one (PLAN.md M6a, the swarm's Ridge wall: the Falls strategy table starts every strategy from the
// active player's game, so no gate saw a strategy that never got there on its own).
// One run alone: node tools/strategy-empire.js --one <who> <seed>.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const argv = process.argv, arg = (k, d) => { const i = argv.indexOf('--' + k); return i > 0 ? argv[i + 1] : d; };
const h = x => x == null ? 'never' : (x / 3600).toFixed(2) + ' h';

if (argv.includes('--one')) {
  const i = argv.indexOf('--one'), who = argv[i + 1], seed = +argv[i + 2];
  const { empire } = await import('./balance.js');
  // on to Thunder Mesa too unless --nomesa (PLAN.md M6b, part 1c)
  const toMesa = !argv.includes('--nomesa');
  const e = empire(seed, who, { capital: true, falls: true, mesa: toMesa }), g = e.game, rt = g.towns.ridge;
  const kinds = {}; for (const x of (rt && rt.towers) || []) kinds[x.kind] = (kinds[x.kind] || []).concat(x.level);
  const spots = rt ? rt.def.board.spots.length : 0;
  console.log(JSON.stringify({
    who, seed, dc: e.dc && e.dc.won, found: e.found, capital: e.capital ?? null, falls: e.fallsFound ?? null,
    ridgeAtCap: e.capSave ? e.capSave.final.best : null, ridgeBest: rt ? rt.bestWave : null, ridgeWave: rt ? rt.wave : null,
    log: e.fLog || [], towers: Object.entries(kinds).map(([k, v]) => k + ' ' + v.sort((a, b) => b - a).join(',')).join(' · '),
    pads: (rt ? rt.towers.length : 0) + '/' + spots, losses: rt ? (rt.breaches || 0) : null, end: g.stats.steps * .25,
    mesaRun: toMesa && e.fallsFound != null, mesa: e.mesaFound ?? null, mHeld: e.mHeld || 0, mPrice: e.mPriceMin ?? null, mSigned: e.mSigned || null,
    mW10: e.mesa ? e.mesa.w10 : null, mEarly: e.mesa ? e.mesa.breaches.filter(w => w <= 3) : [], fallsBest: g.towns.falls ? g.towns.falls.bestWave : null,
    mLog: (e.mLog || []).map(([hh, p, all, best]) => [hh, Math.round(p / 1e3), Math.round(all / 1e3), best]),
    mTowers: g.towns.mesa ? g.towns.mesa.towers.map(t => t.kind[0] + t.level).join(' ') : '',
  }));
  process.exit(0);
}

const seeds = +arg('seeds', 6), who = arg('who', 'active,minmax,swarm,economy,defense').split(','), lanes = +arg('lanes', 10);
const jobs = []; for (const w of who) for (let s = 1; s <= seeds; s++) jobs.push([w, s]);
const me = fileURLToPath(import.meta.url), runs = [];
let next = 0;
const lane = async () => {
  while (next < jobs.length) {
    const [w, s] = jobs[next++];
    const out = await new Promise(done => {
      let buf = '';
      const p = spawn(process.execPath, [me, '--one', w, String(s)], { stdio: ['ignore', 'pipe', 'inherit'] });
      p.stdout.on('data', d => { buf += d; });
      p.on('exit', () => done(buf));
    });
    const line = out.trim().split(/\r?\n/).filter(l => l.startsWith('{')).pop();
    if (!line) { console.log(`${w} ${s}: no result`); continue; }
    const r = JSON.parse(line); runs.push(r);
    const half = r.log.filter(([t]) => Math.abs(t * 2 - Math.round(t * 2)) < .05).map(([t, w2, k]) => `${t}h w${w2} ${k}K`).join(' ');
    console.log(`${r.who} ${r.seed} | Dry Creek ${h(r.dc)} | Ridge ${h(r.found)} | Capital ${h(r.capital)} (Ridge best ${r.ridgeAtCap}) | Falls ${h(r.falls)} | Ridge best ${r.ridgeBest}, pads ${r.pads}, ${r.towers} | ${half}`);
    if (r.mesaRun) console.log(`   Mesa ${h(r.mesa)} (Falls best ${r.fallsBest}, charter ${r.mSigned ? h(r.mSigned.at) + ' w' + r.mSigned.wave : 'none'}, held ${Math.round(r.mHeld / 60)} min${r.mPrice == null ? '' : ' of a ' + Math.round(r.mPrice) + ' min price'}) | wave 10 ${r.mW10 == null ? 'never' : (r.mW10 / 60).toFixed(1) + ' min'} | breaches 1-3 ${r.mEarly.join(',') || 'none'} | ${r.mTowers} | each hour ${r.mLog.map(([hh, p, all, b]) => hh + 'h ' + p + 'K ' + all + 'K/min w' + b).join(', ')}`);
  }
};
await Promise.all(Array.from({ length: lanes }, lane));
const med = a => { const b = a.filter(x => x != null).sort((x, y) => x - y); return b.length * 2 <= a.length ? null : b[Math.floor(b.length / 2)]; };
const rows = who.map(w => { const rs = runs.filter(r => r.who === w); return { w, n: rs.filter(r => r.falls != null).length, of: rs.length, falls: med(rs.map(r => r.falls)), cap: med(rs.map(r => r.capital)), mn: rs.filter(r => r.mesa != null).length, mesa: med(rs.map(r => r.mesa)), mesaRun: rs.some(r => r.mesaRun) }; });
const best = Math.min(...rows.map(r => r.falls ?? Infinity));
console.log('strategy | Capital (median) | Silver Falls (median) | opened on | behind the best');
for (const r of rows) console.log(`  ${r.w} | ${h(r.cap)} | ${h(r.falls)} | ${r.n}/${r.of} | ${r.falls == null ? '-' : Math.round(100 * (r.falls / best - 1)) + '%'}`);
const mBest = Math.min(...rows.map(r => r.mesa ?? Infinity));
if (rows.some(r => r.mesaRun)) {
  console.log('strategy | Thunder Mesa (median) | founded on | behind the best');
  for (const r of rows) console.log(`  ${r.w} | ${h(r.mesa)} | ${r.mn}/${r.of} | ${r.mesa == null ? '-' : Math.round(100 * (r.mesa / mBest - 1)) + '%'}`);
}
// the gate (CLAUDE.md, Strategies must stay close): every strategy's median Silver Falls within SLACK of the best one,
// and a median at all (it opens on more than half the seeds); a line within 5% of the limit prints "close"
const SLACK = 1.25, W10 = [7, 9], misses = [];
for (const r of rows) {
  if (r.falls == null) misses.push(`${r.w}: Silver Falls opened on ${r.n} of ${r.of} seeds in its own empire run (want more than half)`);
  else if (r.falls > best * SLACK) misses.push(`${r.w}: Silver Falls at ${h(r.falls)}, ${Math.round(100 * (r.falls / best - 1))}% behind the best (${h(best)}, limit 25%)`);
  else if (r.falls > best * SLACK * .95) console.log(`close: ${r.w} opens Silver Falls ${Math.round(100 * (r.falls / best - 1))}% behind the best (limit 25%)`);
  // part 1c: the same for Thunder Mesa, plus its wave 10 at 7-9 minutes from getting there on every seed that founds it
  if (!r.mesaRun) continue;
  if (r.mesa == null) misses.push(`${r.w}: Thunder Mesa founded on ${r.mn} of ${r.of} seeds in its own empire run (want more than half)`);
  else if (r.mesa > mBest * SLACK) misses.push(`${r.w}: Thunder Mesa at ${h(r.mesa)}, ${Math.round(100 * (r.mesa / mBest - 1))}% behind the best (${h(mBest)}, limit 25%)`);
  else if (r.mesa > mBest * SLACK * .95) console.log(`close: ${r.w} founds Thunder Mesa ${Math.round(100 * (r.mesa / mBest - 1))}% behind the best (limit 25%)`);
  for (const x of runs.filter(y => y.who === r.w && y.mesa != null)) {
    if (x.mW10 == null || x.mW10 < W10[0] * 60 || x.mW10 > W10[1] * 60) misses.push(`${r.w} ${x.seed}: Mesa wave 10 at ${x.mW10 == null ? 'never' : (x.mW10 / 60).toFixed(1) + ' min'} (want ${W10.join('-')})`);
    if (x.mEarly.length) misses.push(`${r.w} ${x.seed}: the Mesa breached in waves ${x.mEarly.join(',')}`);
    // the Mesa's save holds at most twice its price over the income when it started, plus 10 minutes for a short price
    // (the long Mesa saves box, 2026.11.26-10: the Ridge's and Sandy Bend's foremen spent 52-87 minute saves)
    if (x.mPrice != null && x.mHeld / 60 > 2 * x.mPrice + 10) misses.push(`${r.w} ${x.seed}: the Mesa save held ${Math.round(x.mHeld / 60)} min for a price of ${Math.round(x.mPrice)} min of income (want at most twice, plus 10)`);
  }
}
console.log(misses.length ? misses.map(m => 'FAIL ' + m).join('\n') : 'ok');
process.exitCode = misses.length ? 1 : 0;
