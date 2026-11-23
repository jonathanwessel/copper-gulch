// node tools/progress.js <dir> [--seeds 3] [--who newcomer,active,...]: the bots' progression table (PLAN.md M6a,
// clarity pass part 2). Each bot plays as it does in its own tool, and a watcher on the core's step (every 5 seconds
// of play) records, without changing a single choice:
//   - waits: the longest stretch in each hour with nothing to buy or see (no building, tower, upgrade or research the
//     purse can pay for in the place in play, no town, Capital, institution, Empire upgrade or contract ready, no perk to
//     pick, and nothing new: an unlock, a goal done, a research finished, a milestone);
//   - unlocks: every new town, tower kind, button, research item, institution, route and the charter offer, with the
//     time between them;
//   - layers: for each hour, the share of time the town (something to buy where you are), the empire (a town, the
//     Capital, an institution, an upgrade or a contract) and the perks (a pick, or a new deed in the last 10 minutes)
//     each have something worth doing;
//   - stalls: the longest stretch where no place's best wave climbed and nothing unlocked, and where it was;
//   - charters: for each signed charter, the time back to the wave it was signed at, against the first climb there.
// The bots: newcomer (tools/firstplay.js, 6 hours), active and the four strategies (tools/balance.js, empire to the end
// of Silver Falls, the last town there is: Thunder Mesa's gate), idle (tools/idle.js, 6 idle hours after the Capital).
// It prints one table per measure and writes each run's numbers to <dir>/<who>-<seed>.json.
// One run alone: node tools/progress.js --one <who> <seed> <file>.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Game } from '../src/core/game.js';
import { cost, unlocked, isOutpost } from '../src/core/economy.js';
import { towerCost, canPay, towerAt, towerOpen, fitsSpot } from '../src/core/defense.js';
import { TOWERS } from '../src/data/towers.js';
import { tabs } from '../src/core/reveal.js';
import { itemsOf, researchBlock } from '../src/core/research.js';
import { nextTowns, canFound } from '../src/core/empire.js';
import { canFoundCapital, capitalOf, capitalOpen } from '../src/core/capital.js';
import { foundBlock, nodeBlock } from '../src/core/tree.js';
import { INSTITUTIONS } from '../src/data/institutions.js';
import { perksToPick, deedsFor } from '../src/core/charter.js';

const SAMPLE = 20; // steps: 5 seconds of play
const UNLOCKS = ['town:open', 'town:found', 'tower:open', 'research:open', 'research:new', 'orders:open', 'capital:found', 'institution:found', 'charter:offer', 'route:open', 'outpost:won'];
const NEWS = ['goal:done', 'research:done', 'milestone'];
const instIds = () => (Array.isArray(INSTITUTIONS) ? INSTITUTIONS.map(x => x.id) : Object.keys(INSTITUTIONS));

/* Something to buy in the place in play, right now. */
export function townCan(g, t) {
  if (!t || !t.def) return false;
  for (const id of t.def.buildings || []) if (unlocked(t, id) && t.coins >= cost(t, id)) return true;
  for (const x of t.towers || []) if (canPay(t, towerCost(t, x.kind, x.level))) return true;
  const spots = (t.def.board && t.def.board.spots) || [];
  for (const kind of Object.keys(TOWERS)) {
    if (!towerOpen(t, kind) || !canPay(t, towerCost(t, kind, 0))) continue;
    for (let i = 0; i < spots.length; i++) if (!towerAt(t, i) && fitsSpot(t, i, kind)) return true;
  }
  if (tabs(g, t).research && !t.lab) for (const id of itemsOf(t)) if (researchBlock(t, id) === null) return true;
  return false;
}
/* Something ready at the empire's level: a town to found, the Capital, an institution, an Empire upgrade, a contract. */
export function empireCan(g) {
  if (nextTowns(g).some(n => canFound(g, n.id))) return true;
  if (!capitalOpen(g)) return canFoundCapital(g);
  for (const id of instIds()) if (foundBlock(g, id) === null || nodeBlock(g, id) === null) return true;
  const c = capitalOf(g);
  return !c.active && (c.offers || []).length > 0;
}

/* The watcher: one record per game, filled as the game steps. */
const REC = new WeakMap();
function rec(g) {
  let r = REC.get(g);
  if (r) return r;
  const now = () => g.stats.steps * .25;
  r = { hours: [], waves: [], unlocks: [], charters: [], stall: { longest: 0 }, best: {}, reach: {}, openAt: {}, deeds: {}, lastNews: 0, lastCan: 0, lastClimb: 0, lastDeed: -1e9, tabs: '', wait: { from: 0 } };
  REC.set(g, r);
  for (const ev of UNLOCKS) g.bus.on(ev, e => { r.unlocks.push([Math.round(now()), ev + (e && (e.town || e.id || e.kind) ? ' ' + (e.town || e.id || e.kind) + (e.kind && e.town ? ' ' + e.kind : '') : '')]); r.lastNews = now(); if (ev === 'town:open' && e.town) r.openAt[e.town] ??= now(); });
  for (const ev of NEWS) g.bus.on(ev, () => { r.lastNews = now(); });
  g.bus.on('wave:clear', e => { ((r.reach[e.town] ||= {})[e.wave]) ??= now(); });
  g.bus.on('charter:sign', e => { r.charters.push({ town: e.town, wave: e.wave, deeds: e.deeds, at: now(), first: (r.reach[e.town] || {})[e.wave] - (r.openAt[e.town] || 0), back: null }); });
  return r;
}
function watch(g) {
  if (g.stats.steps % SAMPLE) return;
  const r = rec(g), at = g.stats.steps * .25, t = g.town, h = Math.floor(at / 3600);
  const H = r.hours[h] ||= { n: 0, town: 0, empire: 0, perks: 0, wait: 0, waitAt: null, waitWhere: null, unlocks: 0 };
  const sig = t ? Object.entries(tabs(g, t)).filter(([, v]) => v).map(([k]) => k).join(',') : '';
  if (sig !== r.tabs) { if (r.tabs) { r.unlocks.push([Math.round(at), 'button ' + sig]); r.lastNews = at; } r.tabs = sig; }
  let climbed = false;
  for (const x of Object.values(g.towns)) {
    const b = x.bestWave || 0;
    if (b > (r.best[x.id] ?? -1)) { if (r.best[x.id] !== undefined) climbed = true; }
    r.best[x.id] = b;
    if (!isOutpost(x)) { const d = deedsFor(x); if (d > (r.deeds[x.id] || 0)) r.lastDeed = at; r.deeds[x.id] = d; }
  }
  for (const c of r.charters) if (c.back === null && g.towns[c.town] && (g.towns[c.town].bestWave || 0) >= c.wave) c.back = at - c.at;
  if (climbed) r.lastClimb = at;
  if (at % 300 === 0) r.waves.push([at, Object.fromEntries(Object.values(g.towns).filter(x => !isOutpost(x)).map(x => [x.id, x.bestWave || 0]))]);
  const tc = townCan(g, t), ec = empireCan(g), pick = perksToPick(g) > 0, pc = pick || at - r.lastDeed < 600;
  H.n++; if (tc) H.town++; if (ec) H.empire++; if (pc) H.perks++;
  if (tc || ec || pick) r.lastCan = at;
  const from = Math.max(r.lastCan, r.lastNews), wait = at - from;
  if (wait > H.wait) { H.wait = wait; H.waitAt = Math.round(from); H.waitWhere = g.active + ' wave ' + (t ? t.wave : '?'); }
  const sfrom = Math.max(r.lastClimb, r.lastNews), stall = at - sfrom;
  if (stall > r.stall.longest) r.stall = { longest: stall, at: Math.round(sfrom), where: g.active, wave: t ? t.wave : null, best: { ...r.best } };
}
const step0 = Game.prototype.step;
Game.prototype.step = function (dt) { const out = step0.call(this, dt); watch(this); return out; };

async function runOne(who, seed) {
  let g;
  if (who === 'newcomer') {
    const { newcomer } = await import('./firstplay.js');
    g = newcomer(seed, 360).game;
  } else if (who === 'idle') {
    const { idle } = await import('./idle.js');
    const { empire } = await import('./balance.js');
    // idle() builds its own game; catch it on its first step
    let first = null; const s0 = Game.prototype.step;
    Game.prototype.step = function (dt) { first ??= this; return s0.call(this, dt); };
    idle(seed, 6); g = first; Game.prototype.step = s0;
    void empire;
  } else {
    const { empire } = await import('./balance.js');
    g = empire(seed, who, { capital: true, falls: true }).game;
  }
  const r = rec(g);
  return { who, seed, end: g.stats.steps * .25, hours: r.hours, waves: r.waves, unlocks: r.unlocks, charters: r.charters, stall: r.stall, towns: Object.fromEntries(Object.values(g.towns).map(x => [x.id, { best: x.bestWave, record: x.record || 0, won: !!x.won }])), capital: capitalOpen(g) };
}

/* The longest gap between unlocks up to the Capital's founding (before = true) or after it (the gate of clarity fix
   3b: 45 minutes). */
export function stretch(r, before) {
  const cap = (r.unlocks.find(x => x[1] === 'capital:found') || [Infinity])[0];
  let p = 0, w = 0;
  for (const [t] of r.unlocks) { if (before ? t <= cap : p >= cap) w = Math.max(w, t - p); p = t; }
  return before || cap < Infinity ? w : null;
}
const mm = s => s == null ? '-' : s >= 3600 ? (s / 3600).toFixed(1) + ' h' : (s / 60).toFixed(1) + ' min';
const med = a => { const b = a.filter(x => x != null && Number.isFinite(x)).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; };
export function report(runs) {
  const who = [...new Set(runs.map(r => r.who))], lines = [];
  const maxH = Math.max(...runs.map(r => r.hours.length));
  lines.push('## Longest wait with nothing to buy or see, by hour of play (median over seeds; worst seed in brackets)');
  lines.push('| bot | ' + Array.from({ length: maxH }, (_, h) => 'h' + (h + 1)).join(' | ') + ' |');
  lines.push('|---|' + Array.from({ length: maxH }, () => '---').join('|') + '|');
  for (const w of who) {
    const rs = runs.filter(r => r.who === w);
    lines.push('| ' + w + ' | ' + Array.from({ length: maxH }, (_, h) => { const v = rs.map(r => r.hours[h] && r.hours[h].n > 60 ? r.hours[h].wait : null); const m = med(v), x = Math.max(...v.filter(y => y != null)); return m == null ? '' : mm(m) + (x > m ? ' (' + mm(x) + ')' : ''); }).join(' | ') + ' |');
  }
  lines.push('', '## Time between unlocks (median gap, longest gap and where it ended)');
  lines.push('| bot | seed | unlocks | median gap | longest gap | ended by | longest to the Capital | longest after it |');
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const r of runs) {
    const u = r.unlocks, gaps = u.map((x, i) => [x[0] - (i ? u[i - 1][0] : 0), x]);
    const long = gaps.slice().sort((a, b) => b[0] - a[0])[0] || [null, ['-', '-']];
    lines.push(`| ${r.who} | ${r.seed} | ${u.length} | ${mm(med(gaps.map(x => x[0])))} | ${mm(long[0])} from ${mm(long[1][0] - long[0])} | ${long[1][1]} | ${mm(stretch(r, true))} | ${mm(stretch(r, false))} |`);
  }
  lines.push('', '## Where each bot stalls (no best wave climbs and nothing unlocks)');
  lines.push('| bot | seed | longest stall | from | in | best waves then | end of run |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const r of runs) lines.push(`| ${r.who} | ${r.seed} | ${mm(r.stall.longest)} | ${mm(r.stall.at)} | ${r.stall.where} wave ${r.stall.wave} | ${Object.entries(r.stall.best || {}).map(([k, v]) => k + ' ' + v).join(', ')} | ${mm(r.end)} |`);
  lines.push('', '## Something worth doing in each layer, share of the hour (median over seeds: town / empire / perks)');
  lines.push('| bot | ' + Array.from({ length: maxH }, (_, h) => 'h' + (h + 1)).join(' | ') + ' |');
  lines.push('|---|' + Array.from({ length: maxH }, () => '---').join('|') + '|');
  const pc = (H, k) => H && H.n > 60 ? H[k] / H.n : null, P = x => x == null ? '-' : Math.round(100 * x);
  for (const w of who) {
    const rs = runs.filter(r => r.who === w);
    lines.push('| ' + w + ' | ' + Array.from({ length: maxH }, (_, h) => { const hs = rs.map(r => r.hours[h]); if (!hs.some(H => H && H.n > 60)) return ''; return ['town', 'empire', 'perks'].map(k => P(med(hs.map(H => pc(H, k))))).join(' / '); }).join(' | ') + ' |');
  }
  lines.push('', '## Charters: time back to the signed wave, against the first climb there');
  lines.push('| bot | seed | town | signed at | wave | deeds | first climb | back after | share |');
  lines.push('|---|---|---|---|---|---|---|---|---|');
  for (const r of runs) for (const c of r.charters) lines.push(`| ${r.who} | ${r.seed} | ${c.town} | ${mm(c.at)} | ${c.wave} | ${c.deeds} | ${mm(c.first)} | ${c.back == null ? 'never (run ended ' + mm(r.end - c.at) + ' later)' : mm(c.back)} | ${c.back == null || !c.first ? '-' : Math.round(100 * c.back / c.first) + '%'} |`);
  if (!runs.some(r => r.charters.length)) lines.push('| none signed | | | | | | | | |');
  lines.push('', '## Where each run ended');
  for (const r of runs) lines.push(`- ${r.who} ${r.seed}: ${mm(r.end)}, ${r.capital ? 'Capital open, ' : 'no Capital, '}${Object.entries(r.towns).map(([k, v]) => k + ' ' + (v.won ? 'won' : v.best + (v.record > v.best ? ' (record ' + v.record + ')' : ''))).join(', ')}`);
  return lines.join('\n');
}

const me = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === me) {
  const a = process.argv.slice(2);
  if (a[0] === '--one') {
    const out = await runOne(a[1], +a[2]);
    fs.writeFileSync(a[3], JSON.stringify(out));
  } else {
    const dir = a[0];
    if (!dir) { console.error('usage: node tools/progress.js <dir> [--seeds 3] [--who newcomer,active]'); process.exit(2); }
    const arg = (k, d) => { const i = a.indexOf('--' + k); return i > 0 ? a[i + 1] : d; };
    const seeds = +arg('seeds', 3), who = arg('who', 'newcomer,active,minmax,swarm,economy,defense,idle').split(',');
    fs.mkdirSync(dir, { recursive: true });
    const jobs = [];
    for (const w of who) for (let s = 1; s <= seeds; s++) jobs.push([w, s]);
    const files = [];
    let i = 0;
    const lane = async () => { while (i < jobs.length) { const [w, s] = jobs[i++], f = path.join(dir, `${w}-${s}.json`); files.push(f); await new Promise(done => spawn(process.execPath, [me, '--one', w, String(s), f], { stdio: ['ignore', 'ignore', 'inherit'] }).on('exit', done)); } };
    await Promise.all(Array.from({ length: Math.min(+arg('lanes', 12), jobs.length) }, lane));
    const runs = files.filter(f => fs.existsSync(f)).map(f => JSON.parse(fs.readFileSync(f, 'utf8'))).sort((x, y) => who.indexOf(x.who) - who.indexOf(y.who) || x.seed - y.seed);
    const text = report(runs);
    fs.writeFileSync(path.join(dir, 'progress.md'), text);
    console.log(text);
  }
}
