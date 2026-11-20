// node tools/reserve.js [--seeds 3] [--idle-hours 2]
// The tower reserve (owner, 2026-11-19: "auto sell needs to be less aggressive and keep more inventory. It's a pain to
// build towers"): how many seconds a tower buy waited on goods with its coins there (src/core/defense.js,
// goodsBlocked), under the rule before 2026.11.19-15 and the new default, for the Active player (40 minutes of the
// Gulch), the Newcomer (90 minutes from a new game) and the Idle player (left to automation after the Capital).
// The new default must cut each by at least 75% (CUT). Prints a table and ok, or FAIL lines.
import { Game } from '../src/core/game.js';
import { RESERVE, towerCost, canPay, buildTower, upgradeTower } from '../src/core/defense.js';
import { isOutpost, WORKSHOP } from '../src/core/economy.js';
import { STEP } from '../src/core/clock.js';
import { play, empire, options } from './balance.js';
import { newcomer } from './firstplay.js';
import { leave } from './idle.js';

export const CUT = .75;
export const OLD = { levels: 1, towers: 1, floor: 0, cap: 0, lots: 2, kind: 'cheapest', spare: false };
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] : d; };

/* The buy a player wants next, by the bots' own ranking (tools/balance.js, options): it waits on goods when its coins
   are there and a good it needs is not, though the yard held enough of that good at some point since the town's last
   tower buy (peak): the good was there and went to the market or a workshop instead. That is the owner's pain. A good
   still coming in for the first time (a Mine just built, a Mortar before any Kiln) is waiting on a maker, which no
   reserve fixes. (src/core/defense.js, goodsBlocked, asks whether any buy at all could be made, which a busy player
   nearly always can: it never told the owner's pain.) */
const got = (t, g) => ((t.made || {})[g] || 0) + ((t.shipped || {})[g] || 0) + ((t.drawn || {})[g] || 0) > 0; // the town gets this good at all
export function wantBlocked(town, peak = null) {
  if (!town || !town.def || !town.def.board || town.won) return false;
  const o = options(town)[0];
  if (!o) return false;
  const t = o.up ? town.towers.find(x => x.spot === o.spot) : null, c = towerCost(town, o.kind, t ? t.level : 0);
  return town.coins + 1e-9 >= c.coins && !canPay(town, c) && Object.entries(c.goods).some(([g, n]) => !town.has(g, n) && got(town, g) && (!peak || (peak[g] || 0) + 1e-9 >= n));
}
/* Count goods-blocked seconds while `fn` runs: the town in play, or every town (all) once counting is on. Per town,
   peaks holds the most of each good the yard had since its last tower buy (spent changed). */
const meter = { on: false, all: false, s: 0, n: 0, miss: 0, buys: 0, peaks: new Map() };
function peakOf(t) {
  const spent = t.towers.reduce((a, x) => a + x.spent, 0), p = meter.peaks.get(t.id);
  if (!p || p.spent !== spent) { meter.peaks.set(t.id, { spent, goods: { ...t.goods } }); return meter.peaks.get(t.id).goods; }
  for (const [g, n] of Object.entries(t.goods)) if (n > (p.goods[g] || 0)) p.goods[g] = n;
  return p.goods;
}
const step0 = Game.prototype.step;
Game.prototype.step = function (dt = STEP) {
  const r = step0.call(this, dt);
  if (meter.on && ++meter.n % 4 === 0) for (const t of meter.all ? Object.values(this.towns).filter(x => !isOutpost(x)) : [this.town]) if (t && t.towers && wantBlocked(t, peakOf(t))) meter.s += 4 * dt; // sampled once a second
  return r;
};
function measure(rule, fn) {
  const keep = { ...RESERVE }, spare = WORKSHOP.spare; Object.assign(RESERVE, rule); WORKSHOP.spare = rule.spare ?? spare;
  meter.s = 0; meter.on = false; meter.all = false; meter.miss = 0; meter.buys = 0; meter.peaks = new Map();
  try { fn(); } finally { Object.assign(RESERVE, keep); WORKSHOP.spare = spare; meter.on = false; }
  return meter.s;
}

/* The saver plays like the owner: the active player, who every SAVER.every seconds holds its coins for SAVER.save
   seconds (waves held, foremen off, as the bots save to found a town), then buys in a burst: the best buy whose coins
   are there, again and again, up to SAVER.burst buys. Each buy in the burst that has its coins but not its goods is a
   miss (meter.miss, which the table shows for this player in place of seconds). */
export const SAVER = { every: 600, save: 240, burst: 8 };
function burst(g, t) {
  const skip = new Set(), key = o => (o.up ? 's' + o.spot : o.kind); // a tower, or a new kind, counts once a burst
  const costOf = o => towerCost(t, o.kind, o.up ? t.towers.find(x => x.spot === o.spot).level : 0);
  for (let n = 0; n < SAVER.burst;) {
    const o = options(t).find(o => !skip.has(key(o)) && t.coins + 1e-9 >= costOf(o).coins);
    if (!o) return;
    const c = costOf(o);
    if (!canPay(t, c)) {
      if (Object.entries(c.goods).some(([k, m]) => !t.has(k, m) && got(t, k))) meter.miss++;
      skip.add(key(o));
      continue;
    }
    if (!(o.up ? upgradeTower(g, t, o.spot, o.path) : buildTower(g, t, o.spot, o.kind))) return;
    meter.buys++; n++;
  }
}
export const players = {
  active: seed => { meter.on = true; play(seed, 40, 'active'); },
  newcomer: seed => { meter.on = true; newcomer(seed, 90); },
  saver: seed => {
    let was = false;
    play(seed, 60, 'active', null, { sign: false, save: (t, r) => {
      const now = t.t > 300 && t.t % SAVER.every < SAVER.save;
      if (was && !now) { burst(r.game, t); }
      was = now; return now;
    }, tick: (g, t, r) => { r.game = g; } });
    meter.s = meter.miss;
  },
  idle: (seed, hours) => {
    const e = empire(seed, 'active', { capital: true }), g = e.game;
    leave(g); meter.on = true; meter.all = true;
    for (let i = 0; i < hours * 3600 / STEP; i++) g.step(STEP);
  },
};

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/reserve.js')) {
  const seeds = arg('seeds', 3), hours = arg('idle-hours', 2), fails = [];
  console.log('waited on goods with the coins there (seconds, summed over seeds): player | old rule | new default | cut');
  for (const k of ['levels', 'towers', 'floor', 'cap']) if (process.argv.includes('--' + k)) RESERVE[k] = arg(k, RESERVE[k]); // try other sizes
  const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
  for (const [name, fn] of Object.entries(players)) {
    if (only && only !== name) continue;
    let old = 0, now = 0;
    for (let s = 1; s <= seeds; s++) { old += measure(OLD, () => fn(s, hours)); now += measure({}, () => fn(s, hours)); }
    const cut = old > 0 ? 1 - now / old : (now > 0 ? -1 : 1);
    console.log(name + ' | ' + Math.round(old) + ' | ' + Math.round(now) + ' | ' + Math.round(cut * 100) + '%');
    if (cut < CUT) fails.push(name + ': cut ' + Math.round(cut * 100) + '%, want at least ' + CUT * 100 + '%');
  }
  for (const f of fails) console.log('FAIL ' + f);
  if (!fails.length) console.log('ok');
  process.exitCode = fails.length ? 1 : 0;
}
