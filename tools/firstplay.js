// node tools/firstplay.js [--seeds 6] [--minutes 60]: the newcomer bot (CLAUDE.md, Bots with different play styles).
// It plays a new game the way someone on their first try does, straight on the simulation core:
//   - it is slow: after each tap it waits 3-8 seconds before the next one;
//   - it uses only what is on screen: the board, the goal strip, and the side buttons src/core/reveal.js puts out
//     (Research only once the Research button is out, Perks only once Perks is out);
//   - it follows the goal strip when it can pay for what the goal asks, and otherwise buys towers when it sees the
//     raiders get through (the vault bar) or its towers are few for the wave number, and the building that pays best
//     when they are not;
//   - it makes a wrong buy 30% of the time: any other thing it can pay for, on any pad, with any path.
// It never saves up, never calls a wave early, hires no foremen and does not sign a charter.
// Targets (GDD.md, Pacing targets; PLAN.md M2): Dry Creek won within 20 min, Copper Gulch wave 10 within 14 min after
// it opens, and never stuck for more than 3 min in the first hour. Waves come on a clock, so a newcomer who holds them
// keeps the careful player's pace; the limits are upper ones (decision, M2 Bots and checks). "Stuck" is a stretch with nothing it can pay for
// and nothing new on screen (a goal done, a new tower kind, a new town, a new button).
// Prints a table per seed and "ok" or the misses.
import { newGame } from '../src/core/setup.js';
import { Rng } from '../src/core/rng.js';
import { goalNow, goalContext } from '../src/core/goals.js';
import { tabs, look, lookGoods, lookPerks } from '../src/core/reveal.js';
import { build, cost, unlocked } from '../src/core/economy.js';
import { buildTower, upgradeTower, towerAt, towerCost, canPay } from '../src/core/defense.js';
import { itemsOf, researchBlock, startResearch } from '../src/core/research.js';
import { PERKS } from '../src/data/perks.js';
import { perkState, pickPerk } from '../src/core/charter.js';
import { PATHS, PATH_LEVEL } from '../src/data/towers.js';
import { options, buildValue } from './balance.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] : d; };
const SEEDS = arg('seeds', 6), MINUTES = arg('minutes', 60);
export const WAIT = [3, 8], WRONG = .3, FOLLOW = .7;
export const STUCK_LIMIT = 180;
/* The newcomer cannot see how strong the next wave is. It adds a tower when it has none, when a raider reached the
   vault in this wave or the last one, when the vault bar is below VAULT_LOW, and about every WAVES_PER_TOWER waves
   as the wave number climbs. */
export const VAULT_LOW = .7, WAVES_PER_TOWER = 4;
const short = (t, leak) => !t.towers.length || leak >= t.wave - 1 || t.vault.hp < VAULT_LOW * t.vault.max || t.towers.length < 1 + Math.floor(t.wave / WAVES_PER_TOWER);

/* Everything the newcomer could tap now and pay for: [{ what, label, value, run }]. */
export function choices(game, town, rng) {
  const out = [], tb = tabs(game, town);
  for (const id of town.def.buildings) if (unlocked(town, id) && town.coins >= cost(town, id)) out.push({ what: 'building', label: id, value: buildValue(game, town, id), run: () => build(game, town, id) });
  for (const o of options(town)) if (o.can) {
    const path = o.up && o.level + 1 === PATH_LEVEL ? o.path : null;
    out.push({ what: o.up ? 'upgrade' : 'tower', label: o.kind + '@' + o.spot, value: o.value, up: o.up, level: o.level, run: () => o.up ? upgradeTower(game, town, o.spot, path || o.path) : buildTower(game, town, o.spot, o.kind) });
  }
  if (tb.research && !town.lab) for (const id of itemsOf(town)) if (researchBlock(town, id) === null) out.push({ what: 'research', label: id, value: 0, run: () => startResearch(game, town, id) });
  return out;
}

/* What the goal strip asks for, as a tap the newcomer can make now (or null). */
export function goalTap(game, town, rng) {
  const g = goalNow(game);
  if (!g || !g.at) return null;
  const c = goalContext(game, town), at = g.at(c) || {};
  if (at.el && at.el.includes('townChip')) { const id = at.el.match(/data-town="(\w+)"/)[1]; return { what: 'go', label: id, run: () => game.go(id) }; }
  if (at.el && at.el.includes('research')) {
    if (!tabs(game, town).research || town.lab) return null;
    const items = itemsOf(town).filter(id => researchBlock(town, id) === null);
    return items.length ? { what: 'research', label: items[0], run: () => startResearch(game, town, rng.pick(items)) } : null;
  }
  if (at.plot) return unlocked(town, at.plot) && town.coins >= cost(town, at.plot) ? { what: 'building', label: at.plot, run: () => build(game, town, at.plot) } : null;
  if (g.kind && at.spot != null) return canPay(town, towerCost(town, g.kind, 0)) ? { what: 'tower', label: g.kind + '@' + at.spot, run: () => buildTower(game, town, at.spot, g.kind) } : null;
  if (at.tower != null) {
    const t = towerAt(town, at.tower);
    if (!t || !canPay(town, towerCost(town, t.kind, t.level))) return null;
    const path = t.level + 1 === PATH_LEVEL ? rng.pick(Object.keys(PATHS[t.kind])) : t.path;
    return { what: 'upgrade', label: t.kind + '@' + t.spot, run: () => upgradeTower(game, town, t.spot, path) };
  }
  return null;
}

/* One newcomer's first session: a new game in Dry Creek, then the Gulch once it opens, for `minutes` of play. */
export function newcomer(seed, minutes = MINUTES) {
  const g = newGame('first-' + seed), rng = new Rng('newcomer-' + seed);
  const r = { seed, firstTower: null, dcWon: null, gulchAt: null, wave10: null, breaches: [], buys: 0, wrong: 0, goalTaps: 0, research: 0, taps: [], stuck: { longest: 0, at: 0 }, tabsUsed: [], log: [] };
  let next = rng.range(...WAIT), lastNews = 0, lastLeak = { drycreek: -99, gulch: -99 }, lastGap = 0;
  const now = () => g.stats.steps * .25;
  const news = () => { lastNews = now(); };
  g.bus.on('goal:done', news); g.bus.on('tower:open', news); g.bus.on('town:open', news); g.bus.on('charter:offer', news);
  g.bus.on('leak', e => { lastLeak[e.town] = g.towns[e.town].wave; });
  g.bus.on('breach', e => { if (e.town === g.active) r.breaches.push(e.town + ' ' + e.wave); });
  g.bus.on('wave:clear', e => { if (e.town === 'gulch' && e.wave === 10 && r.wave10 === null && r.gulchAt !== null) r.wave10 = now() - r.gulchAt; });
  let seenTabs = '';
  for (let s = 0; s < minutes * 240; s++) {
    g.step(.25);
    const t = g.town, at = now();
    if (r.dcWon === null && g.towns.drycreek.won) { r.dcWon = at; news(); }
    const tb = tabs(g, t), shown = Object.keys(tb).filter(k => tb[k]).join(',');
    if (shown !== seenTabs) { seenTabs = shown; news(); } // a new button came out
    // stuck: nothing to pay for and nothing new on screen (measured each second, first hour only)
    if (s % 4 === 0 && at <= 3600) {
      const can = choices(g, t, rng).length > 0 || goalTap(g, t, rng.fork('look')); // the go-to-the-Gulch goal is a tap too
      if (can) lastGap = at;
      const idle = at - Math.max(lastGap, lastNews);
      if (idle > r.stuck.longest) r.stuck = { longest: idle, at: Math.max(lastGap, lastNews) };
    }
    if (at < next) continue;
    // the newcomer looks at what the dots point to (the screen calls these when a sheet opens)
    look(t); if (tb.goods) lookGoods(t); if (tb.perks) lookPerks(t);
    for (const k of ['research', 'perks', 'goods']) if (tb[k] && !r.tabsUsed.includes(k)) r.tabsUsed.push(k);
    // a perk waiting: it picks a side at random
    if (tb.perks) for (const p of PERKS) if (perkState(g, p.id) === 'open') pickPerk(g, p.id, rng.pick(['a', 'b']));
    let tap = null;
    const goal = goalTap(g, t, rng);
    if (goal && (goal.what === 'go' || rng.chance(FOLLOW))) { tap = goal; r.goalTaps++; }
    if (!tap) {
      const all = choices(g, t, rng);
      if (!all.length) { next = at + 1; continue; } // nothing it can pay for: it looks again in a second
      const weak = short(t, lastLeak[t.id]);
      const pool = weak ? all.filter(c => c.what === 'tower' || c.what === 'upgrade') : all.filter(c => c.what === 'building' || c.what === 'research');
      const best = (pool.length ? pool : all).slice().sort((a, b) => b.value - a.value)[0];
      if (weak && !pool.length) { next = at + 1; continue; } // it wants a tower and waits for the coins
      if (rng.chance(WRONG)) { tap = rng.pick(all); if (tap !== best) r.wrong++; }
      else tap = best;
    }
    if (tap.run()) {
      if (tap.what === 'tower') r.firstTower ??= at;
      if (tap.what === 'research') r.research++;
      if (tap.what === 'go') { r.gulchAt = at; news(); }
      else r.buys++;
      r.taps.push(at);
      if (r.log.length < 400) r.log.push([Math.round(at), g.active, tap.what, tap.label]);
      next = at + rng.range(...WAIT);
    } else next = at + 1;
  }
  r.final = Object.fromEntries(Object.entries(g.towns).map(([id, t]) => [id, { wave: t.wave, best: t.bestWave, towers: t.towers.map(x => x.kind + x.level + (x.path || '')), buildings: { ...t.buildings } }]));
  r.game = g;
  return r;
}

/* The checks: Dry Creek won within 20 min, the Gulch's wave 10 within 14 min after it opens, never stuck 3 min. */
export const DC_WON = 20 * 60, GULCH_WAVE10 = 14 * 60;
export function misses(r) {
  const m = [], mm = x => x === null ? 'never' : (x / 60).toFixed(1) + ' min';
  if (r.dcWon === null || r.dcWon > DC_WON) m.push(`seed ${r.seed}: Dry Creek won at ${mm(r.dcWon)} (want within 20 min)`);
  if (r.wave10 === null || r.wave10 > GULCH_WAVE10) m.push(`seed ${r.seed}: Copper Gulch wave 10 at ${mm(r.wave10)} after it opened (want within 14 min)`);
  if (r.stuck.longest > STUCK_LIMIT) m.push(`seed ${r.seed}: stuck for ${mm(r.stuck.longest)} from minute ${(r.stuck.at / 60).toFixed(1)} (want under 3 min)`);
  return m;
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/firstplay.js')) {
  const all = [], mm = x => x === null ? 'never' : (x / 60).toFixed(1) + ' min';
  console.log('newcomer: seed | first tower | Dry Creek won | Gulch wave 10 (from when it opens) | breaches | longest stuck (from min) | buys, wrong, by the goal strip | research | buttons used | final towers (Dry Creek / Gulch)');
  for (let s = 1; s <= SEEDS; s++) {
    const r = newcomer(s);
    console.log(`${s} | ${r.firstTower === null ? 'never' : Math.round(r.firstTower) + ' s'} | ${mm(r.dcWon)} | ${mm(r.wave10)} | ${r.breaches.join(', ') || 'none'} | ${mm(r.stuck.longest)} (${(r.stuck.at / 60).toFixed(1)}) | ${r.buys}, ${r.wrong}, ${r.goalTaps} | ${r.research} | ${r.tabsUsed.join(',') || '-'} | ${r.final.drycreek.towers.join(' ')} / ${(r.final.gulch?.towers || []).join(' ')}`);
    all.push(...misses(r));
  }
  console.log(all.length ? all.map(m => 'FAIL ' + m).join('\n') : 'ok');
  process.exitCode = all.length ? 1 : 0;
}
