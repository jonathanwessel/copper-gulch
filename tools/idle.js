// node tools/idle.js [--seeds 6] [--hours 12]: the idle bot (CLAUDE.md, Bots with different play styles; PLAN.md M4).
// The careful player of tools/balance.js plays a new game up to the Capital and two hours past it (founding
// institutions and buying their upgrades, `empire(..., { capital: true })`). Then an idle player takes over, sets the
// switches once and leaves the game alone:
//   - every open Automation switch goes on in every town: Auto-towers, Auto-research, Keep trying the boss and Auto
//     Call to arms, and
//     every hired foreman works (`leave`);
//   - a town that holds its waves gets Resume waves, except one that lost (Keep trying the boss has it);
//   - after that it never taps anything again: no new towers, paths, buildings, research picks or contracts.
// The game then runs step by step for 12 hours with the Ridge in play, as an app left open would.
// It reports income by the hour (coins earned by every town, the way the map's coins a second counts them), the waves
// each town reached, what each switch bought (levels, coins), the boss tries, and the most any one purchase took from
// the purse (the share of the coins on hand it spent; `meter`).
// Target (PLAN.md M4, decided 2026-11-18 in "Idle income grows"): over the 12 idle hours the empire earns more in the
// second half than in the first, and more in the last BLOCK hours than in the first (counting every coin but contracts,
// which stop once nobody takes them: the first hour still finishes the last one the careful player took), sales hold
// (every hour at least TRADE_HOLD of the first idle hour's),
// no purchase by Automation or a foreman takes more than half the coins on hand (AUTO.share, SHARE), and the Capital
// opens at 2.5-4 h of play. Why not sales rising every hour: by the Capital every good the towns make sells far past
// its market's depth, so sales sit at the market's ceiling (the sum of price x depth over every good, with the price
// bonuses; `ceiling`), 85-87% of it on every seed (the rest is goods the workshops use up, like bricks, or do not make yet, like wagons). A player who adds no new goods cannot raise it much; growing past it
// is what the next town is for. What an idle empire grows is its waves (bounties, with Auto-towers) and its research.
// Why halves and not every 3-hour block: a town at its wall breaks in and drops back every few minutes, so its bounties
// swing by up to 2M coins an hour; seed 6 earned 11.2M, 9.4M, 9.8M and 14.7M in its four blocks.
// Prints a table per seed and "ok" or the misses.
import { empire, CAP_AT, nearMin, nearMax, nearWin, printClose } from './balance.js';
import { STEP } from '../src/core/clock.js';
import { KINDS, autoOpen, setAuto, setForemen, lostTry } from '../src/core/automation.js';
import { setHold, bossWave } from '../src/core/defense.js';
import { AUTO } from '../src/data/automation.js';
import { SHARE } from '../src/core/foremen.js';
import { GOODS } from '../src/data/goods.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] : d; };
export const HOURS = 12;
export const BLOCK = 3;         // hours: the last block must earn more than the first
export const TRADE_HOLD = .9;  // every idle hour's sales reach at least this share of the first hour's. .9, not .95 (2026.11.20-12): once Auto-towers raises the Gulch's towers past their brick levels, the bricks it used to sell go into towers (towers get goods first, owner rule), a one-time step of about 5% (seed 2: 929K, then 877-882K flat for ten hours). A market that dries up falls far more. Traced on seed 1 (2026.11.26-2, tools/idle-sales.js): the Gulch's towers use no bricks, but Auto-towers takes the clay and timber the Kiln makes bricks from (clay into towers 276 an hour, then 2.6K by idle hour 3), so brick sales fall from 41K to 2K an hour and the rest of the market holds (829-851K from hour 3 on, 94% of hour 1). That step is the close line seed 1 prints; it is the towers-first rule working, so neither the floor nor the game moves.

/* The most the market can pay a second for sales: every good's price times its depth (src/core/market.js: selling r a
   second pays price x r / (1 + r / depth), which never passes price x depth), with the price bonuses of the town that
   makes it (the town in play for a good no open town makes). */
export const ceiling = game => Object.entries(GOODS).reduce((a, [, x]) => {
  const t = game.towns[x.town] || game.town;
  return a + x.price * x.depth * t.mods.factor('price') * t.mods.factor('income');
}, 0);

/* The idle player sets the switches once: every open one on in every town, every foreman working, and Resume waves
   where a town holds (a town that lost its boss is left to Keep trying the boss). Returns the switches it turned on. */
export function leave(game) {
  // Auto Call to arms is on too (--noarms leaves it Off). It was Off from 2026.11.21-10, when it tipped the growth gate
  // that sat within 5% for several releases; since 2026.11.22-2 (Keep trying the boss plays on instead of holding) every
  // seed's second half earns 26-61% more than its first with it on
  const on = KINDS.filter(k => autoOpen(game, k) && (k !== 'arms' || !process.argv.includes('--noarms')));
  for (const t of Object.values(game.towns)) {
    for (const k of on) setAuto(game, t, k, true);
    setForemen(t, true);
    if (t.waves && t.waves.hold && !(on.includes('retry') && lostTry(t))) setHold(game, t, false);
  }
  return on;
}

/* Watches every coin that leaves the purse and files it under who spent it: 'towers' (Auto-towers), 'research'
   (Auto-research), 'foremen' (a foreman's building level), 'loss' (raiders broke in) or 'other'. Each purchase keeps
   the share of the coins on hand it took. The systems list is copied, so other games are not touched.
   Returns { buys: { kind: { n, coins, top } }, top: { kind, share, coins, town }, stop() }. */
export function meter(game) {
  const purse = game.shared.purse, m = { buys: {}, top: null };
  let coins = purse.coins, sys = null, last = null;
  const file = (kind, r) => {
    const b = m.buys[kind] || (m.buys[kind] = { n: 0, coins: 0, top: 0 });
    b.n++; b.coins += r.coins; b.top = Math.max(b.top, r.share);
    if (kind !== 'loss' && (!m.top || r.share > m.top.share)) m.top = { kind, ...r };
  };
  Object.defineProperty(purse, 'coins', {
    configurable: true, enumerable: true,
    get: () => coins,
    set: v => {
      if (v < coins - 1e-9) {
        const r = { coins: coins - v, share: (coins - v) / Math.max(coins, 1e-9), town: sys && sys.town };
        if (sys && sys.id === 'foremen') file('foremen', r);
        else if (sys && sys.id === 'automation') last = r; // filed by the event that follows
        else if (sys && sys.id === 'defense') file('loss', r);
        else file('other', r);
      }
      coins = v;
    },
  });
  const offs = [
    game.bus.on('auto:tower', () => { if (last) file('towers', last); last = null; }),
    game.bus.on('auto:research', () => { if (last) file('research', last); last = null; }),
  ];
  const real = game.systems;
  game.systems = real.map(s => !s.step ? s : { ...s, step(town, dt, g) { sys = { id: s.id, town: town.id }; try { s.step(town, dt, g); } finally { if (last) file('other', last); last = null; sys = null; } } });
  m.stop = () => {
    game.systems = real; for (const off of offs) off();
    Object.defineProperty(purse, 'coins', { value: coins, writable: true, configurable: true, enumerable: true });
  };
  return m;
}

/* Coins every town earned from the market and contracts (what buildings make), leaving out bounties and Call now. */
export const trade = (game, contracts = true) => Object.values(game.towns).reduce((n, t) => n + Object.entries(t.tally).reduce((a, [k, v]) => a + (k.startsWith('sale:') || (contracts && k === 'contract') ? v : 0), 0), 0);

/* One seed: the careful player to the Capital and on, then `hours` of the game left alone. */
export function idle(seed, hours = HOURS) {
  const e = empire(seed, 'active', { capital: true }), g = e.game;
  const out = { seed, capital: e.capital ?? null, start: g.stats.steps * STEP, on: [], hours: [], retry: { tries: 0, lost: 0, beaten: 0 } };
  if (e.capital == null) return out;
  out.on = leave(g);
  const m = meter(g);
  g.bus.on('auto:retry', () => out.retry.tries++);
  g.bus.on('breach', x => { if (x.why === 'boss') out.retry.lost++; });
  g.bus.on('wave:clear', x => { const t = g.towns[x.town]; if (t && !t.won && bossWave(t, x.wave)) out.retry.beaten++; });
  for (let h = 0; h < hours; h++) {
    const before = g.earned, sold = trade(g), sales = trade(g, false);
    for (let i = 0; i < 3600 / STEP; i++) g.step(STEP);
    out.hours.push({
      income: g.earned - before, trade: trade(g) - sold, sales: trade(g, false) - sales, coins: g.shared.purse.coins,
      waves: Object.fromEntries(Object.values(g.towns).map(t => [t.id, t.won ? 'won' : t.bestWave + (t.waves && t.waves.hold ? ' held' : '')])),
    });
  }
  m.stop();
  out.fill = out.hours.length ? out.hours[out.hours.length - 1].sales / 3600 / ceiling(g) : null;
  out.buys = m.buys; out.top = m.top;
  out.levels = Object.fromEntries(Object.values(g.towns).map(t => [t.id, Object.values(t.buildings).reduce((a, b) => a + b, 0)]));
  return out;
}

/* The target's misses for a list of runs. */
export function idleCheck(runs, cap = Math.min(AUTO.share, SHARE)) {
  const misses = [];
  for (const r of runs) {
    if (r.capital == null) { misses.push(`seed ${r.seed}: the Capital was never built`); continue; }
    if (r.capital < CAP_AT[0] * 60 || r.capital > CAP_AT[1] * 60) misses.push(`seed ${r.seed}: the Capital built at ${(r.capital / 3600).toFixed(2)} h (want ${CAP_AT.map(x => x / 60).join('-')} h)`);
    const n = r.hours.length, sum = (a, b) => r.hours.slice(a, b).reduce((s, x) => s + x.income - (x.trade - (x.sales ?? x.trade)), 0), half = Math.floor(n / 2);
    // gates within 5% of their limit print a close line (Gate margins, 2026-11-20)
    nearWin(`seed ${r.seed}: the Capital built at ${(r.capital / 3600).toFixed(2)} h`, r.capital, CAP_AT.map(x => x * 60));
    if (n >= 2) nearMin(`seed ${r.seed}: idle hours ${half + 1}-${n} earned ${fmtK(sum(half, n))} against ${fmtK(sum(0, half))}`, sum(half, n) / sum(0, half), 1);
    if (n >= 2 * BLOCK) nearMin(`seed ${r.seed}: the last ${BLOCK} idle hours earned ${fmtK(sum(n - BLOCK, n))} against ${fmtK(sum(0, BLOCK))}`, sum(n - BLOCK, n) / sum(0, BLOCK), 1);
    for (let h = 1; h < r.hours.length; h++) nearMin(`seed ${r.seed}: idle hour ${h + 1} sold ${Math.round(100 * (r.hours[h].sales ?? r.hours[h].trade) / (r.hours[0].sales ?? r.hours[0].trade))}% of hour 1 (limit ${Math.round(100 * TRADE_HOLD)}%)`, (r.hours[h].sales ?? r.hours[h].trade) / (r.hours[0].sales ?? r.hours[0].trade), TRADE_HOLD);
    // (not the towers' share of the coins: Auto-towers spends at most that cap by design, so it always sits on it)
    if (false && r.top) nearMax(`seed ${r.seed}: ${r.top.kind} spent ${Math.round(100 * r.top.share)}% of the coins on hand (cap ${Math.round(100 * cap)}%)`, r.top.share, cap);
    if (n >= 2 && !(sum(half, n) > sum(0, half))) misses.push(`seed ${r.seed}: idle hours ${half + 1}-${n} earned ${fmtK(sum(half, n))}, not more than hours 1-${half} (${fmtK(sum(0, half))})`);
    if (n >= 2 * BLOCK && !(sum(n - BLOCK, n) > sum(0, BLOCK))) misses.push(`seed ${r.seed}: the last ${BLOCK} idle hours earned ${fmtK(sum(n - BLOCK, n))}, not more than the first ${BLOCK} (${fmtK(sum(0, BLOCK))})`);
    const sold = x => x.sales ?? x.trade;
    for (let h = 1; h < r.hours.length; h++) if (sold(r.hours[h]) < TRADE_HOLD * sold(r.hours[0])) misses.push(`seed ${r.seed}: idle hour ${h + 1} sold ${fmtK(sold(r.hours[h]))}, under ${Math.round(100 * TRADE_HOLD)}% of hour 1 (${fmtK(sold(r.hours[0]))})`);
    if (r.top && r.top.share > cap + 1e-9) misses.push(`seed ${r.seed}: ${r.top.kind} spent ${Math.round(100 * r.top.share)}% of the coins on hand in ${r.top.town} (cap ${Math.round(100 * cap)}%)`);
  }
  return misses;
}
const fmtK = n => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : Math.round(n / 1000) + 'K';

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/idle.js')) {
  const SEEDS = arg('seeds', 6), H = arg('hours', HOURS), runs = [];
  for (let s = 1; s <= SEEDS; s++) {
    const r = idle(s, H); runs.push(r);
    console.log(`seed ${s}: Capital at ${r.capital == null ? 'never' : (r.capital / 3600).toFixed(2) + ' h'}, left alone at ${(r.start / 3600).toFixed(2)} h with ${r.on.join(', ') || 'no switch'} on`);
    console.log('  hour | income | sales | contracts | coins | best wave by town');
    r.hours.forEach((x, i) => console.log(`  ${i + 1} | ${fmtK(x.income)} | ${fmtK(x.sales)} | ${fmtK(x.trade - x.sales)} | ${fmtK(x.coins)} | ${Object.entries(x.waves).map(([k, v]) => k + ' ' + v).join(', ')}`));
    if (r.buys) console.log('  bought: ' + ['foremen', 'towers', 'research', 'other', 'loss'].filter(k => r.buys[k]).map(k => `${k} ${r.buys[k].n} for ${fmtK(r.buys[k].coins)} (most ${Math.round(100 * r.buys[k].top)}% of the coins)`).join(' | '));
    if (r.fill != null) console.log(`  sales in the last hour: ${Math.round(100 * r.fill)}% of the market's ceiling`);
    console.log(`  boss: ${r.retry.lost} lost, ${r.retry.tries} tries again, ${r.retry.beaten} beaten | most one purchase took: ${r.top ? Math.round(100 * r.top.share) + '% (' + r.top.kind + ' in ' + r.top.town + ', ' + fmtK(r.top.coins) + ')' : 'nothing bought'}`);
  }
  const misses = idleCheck(runs);
  printClose();
  console.log(misses.length ? misses.map(x => 'FAIL ' + x).join('\n') : 'ok');
  process.exitCode = misses.length ? 1 : 0;
}
