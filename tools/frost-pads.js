// node tools/frost-pads.js [--seeds 6] [--seed N]: which Silver Falls pads give the Frost Lens its damage share (PLAN.md
// M6a, Two close gates: the Falls' late Frost share read 35.0-35.3% against a 36% limit in three releases). Plays the
// active bot's empire to Silver Falls (tools/balance.js), then the Falls' hour from that snapshot with the per-pad count
// on (game.dealtSpot, src/core/defense.js), and prints each pad's tower, its direct damage after the Falls' first
// 30 minutes, its share of all the towers' damage then, and how much road it reaches on each lane (units of lane
// inside its ring), so a high share can be read as one pad over two stretches, many pads, or the boat lane. --stand
// plays with the standing guess on (tools/balance.js, standShare; --standeff N tries its number), whose guess per pad
// is printed either way.
import { empire, playFalls, standShare, tune } from './balance.js';
import { decode } from '../src/core/save.js';
import { loadGame } from '../src/core/setup.js';
import { lanesOf, towerStats } from '../src/core/defense.js';
import { pointAt } from '../src/core/path.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] : d; };
const SEEDS = arg('seeds', 6), ONE = arg('seed', 0), SPLIT = 30 * 60;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const all = { kind: {}, frostOne: 0, frostTwo: 0, frostN: 0 };
// --standeff N: try the standing guess's number (tools/balance.js, standShare) without editing it
if (arg('standeff', 0)) tune('standeff', arg('standeff', 0));
for (let s = ONE || 1; s <= (ONE || SEEDS); s++) {
  const e = empire(s, 'active', { capital: true, falls: true });
  if (!e.fallsSnap) { console.log(`seed ${s}: no Falls`); continue; }
  const g = loadGame(decode(e.fallsSnap).game), ft = g.towns.falls, from = ft.t;
  g.dealtSpot = {};
  let early = null;
  const off = g.bus.on('wave:clear', () => { if (!early && ft.t - from >= SPLIT) early = { ...(g.dealtSpot.falls || {}) }; });
  playFalls(s, g, 'active', 60, null);
  off();
  const end = g.dealtSpot.falls || {}, late = {};
  for (const [k, v] of Object.entries(end)) late[k] = v - ((early && early[k]) || 0);
  const tot = Object.values(late).reduce((a, b) => a + b, 0) || 1, lanes = lanesOf(ft), spots = ft.def.board.spots;
  const rows = ft.towers.map(t => {
    const st = towerStats(ft, t), at = spots[t.spot];
    const first = [], reach = lanes.map((L, i) => { let n = 0; for (let x = 0; x <= L.length; x += .25) { const d = dist(at, pointAt(L, x)); if (d <= st.range && d >= (st.minRange || 0)) { n += .25; if (first[i] == null) first[i] = x; } } return n; });
    return { t, dmg: late[t.spot] || 0, reach, first, lens: lanes.map(L => L.length), up: standShare(ft, t.spot, st.minRange || 0, st.range) };
  }).sort((a, b) => b.dmg - a.dmg);
  const byKind = {};
  for (const r of rows) byKind[r.t.kind] = (byKind[r.t.kind] || 0) + r.dmg;
  console.log(`seed ${s}: Falls wave ${ft.wave}, after its first 30 min: ${Object.entries(byKind).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + Math.round(100 * v / tot) + '%').join(', ')} (hits and shells by pad; poison ticks and burning ground have no pad and are left out)`);
  for (const r of rows) console.log(`  pad ${r.t.spot} | ${r.t.kind} ${r.t.level}${r.t.path || ''}${r.t.fork || ''} | ${(100 * r.dmg / tot).toFixed(1)}% | standing guess ${Math.round(100 * r.up)}% | road in reach ${r.reach.map((x, i) => x.toFixed(1) + (r.first[i] != null ? ' from ' + r.first[i].toFixed(1) + ' of ' + r.lens[i].toFixed(0) : '')).join(' + ')}`);
  for (const [k, v] of Object.entries(byKind)) all.kind[k] = (all.kind[k] || 0) + v / tot;
  const fr = rows.filter(r => r.t.kind === 'frost');
  all.frostN += fr.length; all.frostTwo += fr.filter(r => r.reach.filter(x => x > 0).length > 1).length;
}
const n = ONE ? 1 : SEEDS;
console.log('mean share by kind: ' + Object.entries(all.kind).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + (100 * v / n).toFixed(1) + '%').join(', '));
console.log(`frost towers ${all.frostN}, of them reaching both lanes ${all.frostTwo}`);
