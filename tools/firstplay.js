// node tools/firstplay.js [--seeds 6] [--minutes 140]: the newcomer bot (CLAUDE.md, Bots with different play styles).
// It plays a new game the way someone on their first try does, straight on the simulation core:
//   - it is slow: after each tap it waits 3-8 seconds before the next one;
//   - it uses only what is on screen: the board, the goal strip, and the side buttons src/core/reveal.js puts out
//     (Research only once the Research button is out, Perks only once Perks is out);
//   - it follows the goal strip when it can pay for what the goal asks, and otherwise buys towers when it sees the
//     raiders get through (the vault bar) or its towers are few for the wave number, and the building that pays best
//     when they are not;
//   - it makes a wrong buy 30% of the time: any other thing it can pay for, on any pad, with any path.
// It saves up and holds the waves only when the goal strip asks (for Iron Ridge), saves (towers only when raiders get
// through) while the strip counts coins for a goal it says is ready within GOAL_SAVE (or a building's card shows the
// price of the upgrade the strip asks for), taps Resume waves when the strip asks
// (or 45 s after a lost boss in play), calls a wave early only when the
// strip asks, hires no foremen and does not sign a charter.
// Targets (GDD.md, Pacing targets; PLAN.md M2): no town on hold over 10 min unless saving for its next town, Dry Creek won within 20 min, Copper Gulch wave 10 within 14 min after
// it opens, and never stuck for more than 3 min in the first hour. Skill pays: the careful player of tools/balance.js,
// who calls waves early, is at least 20% faster on both (medians over the seeds). "Stuck" is a stretch with nothing it can pay for
// and nothing new on screen (a goal done, a new tower kind, a new town, a new button).
// Prints a table per seed and "ok" or the misses.
import { newGame } from '../src/core/setup.js';
import { Rng } from '../src/core/rng.js';
import { goalNow, goalContext, earnRate, readyIn, savingFor, RESUME_LOST, FIGHT_LOW } from '../src/core/goals.js';
import { tabs, look, lookGoods, lookPerks } from '../src/core/reveal.js';
import { build, cost, unlocked } from '../src/core/economy.js';
import { buildTower, upgradeTower, towerAt, towerCost, canPay, callEarly, setHold } from '../src/core/defense.js';
import { itemsOf, researchBlock, startResearch } from '../src/core/research.js';
import { PERKS } from '../src/data/perks.js';
import { perkState, pickPerk } from '../src/core/charter.js';
import { PATHS, PATH_LEVEL } from '../src/data/towers.js';
import { options, buildValue, campaign } from './balance.js';
import { nextTowns, foundTown, canFound } from '../src/core/empire.js';
import { canFoundCapital, foundCapital, takeContract } from '../src/core/capital.js';
import { foundBlock, foundInstitution } from '../src/core/tree.js';
import { INSTITUTIONS } from '../src/data/institutions.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] : d; };
const SEEDS = arg('seeds', 6), MINUTES = arg('minutes', 165); // long enough to found Iron Ridge and the Capital
export const WAIT = [3, 8], WRONG = .3, FOLLOW = .7;
export const STUCK_LIMIT = 180;
/* Waves on hold (Evaluation 2, 2026-11-19): from about an hour in, every seed's Gulch and Ridge sat on hold for the
   rest of the run (the Gulch held to save for the Ridge, the Ridge's vault fell while away). No town may hold its waves
   longer than HELD_LIMIT seconds at a stretch while the strip is not asking it to save for its next town. */
export const HELD_LIMIT = 600;
/* The newcomer cannot see how strong the next wave is. It adds a tower when it has none, when a raider reached the
   vault in this wave or the last one, when the vault bar is below VAULT_LOW, and about every WAVES_PER_TOWER waves
   as the wave number climbs. */
export const VAULT_LOW = .7, WAVES_PER_TOWER = 4;
/* Saving for a coin goal (clarity fix 2, PLAN.md M6a): while the strip counts coins for a goal ("136 / 500 · about 2 min
   to go") that is ready within GOAL_SAVE seconds at the empire's income, the newcomer saves, as a player reading
   it would: it buys a tower only when raiders get through, and nothing else. */
export const GOAL_SAVE = 600, LOST_BUYS = 3;
/* "Build more towers, then tap Resume waves": true while the newcomer still builds first (it has bought fewer than
   LOST_BUYS towers or upgrades since the loss and can pay for one more), so it does both acts the strip names. */
export const buildFirst = (game, town, rng, bought) => goalNow(game) === RESUME_LOST && bought < LOST_BUYS && choices(game, town, rng).some(c => c.what === 'tower' || c.what === 'upgrade');
/* The coins a goal counts: its need on the strip, or for a goal to upgrade a building, the next level's price, which its
   card shows as have / need (a tap on the strip opens it; clarity fix 3b part 2: "Tap the Rolling Mill and upgrade it
   to level 5" sat 10-14 minutes after the Capital while the newcomer spent each coin as it came). */
export function goalNeed(game, town, g) {
  if (!g) return null;
  if (g.need) return g.need;
  if (typeof g.at !== 'function' || g.away || g.there) return null;
  let at = null; try { at = g.at(goalContext(game, town)) || {}; } catch (e) { return null; }
  if (at.tower != null) { const t = towerAt(town, at.tower); return t ? towerCost(town, t.kind, t.level).coins : null; }
  return at.plot && town.level(at.plot) > 0 && unlocked(town, at.plot) ? cost(town, at.plot) : null;
}
const hurting = (t, low = VAULT_LOW) => !t.towers.length || t.vault.hp < low * t.vault.max;
/* The goal names one tower to raise (its strip counts that tower's price, clarity fix 3b part 2c). */
export function goalTower(game, town, g) {
  if (!g || typeof g.at !== 'function' || g.away || g.there) return false;
  try { return (g.at(goalContext(game, town)) || {}).tower != null; } catch (e) { return false; }
}
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
  if (at.go) {
    const id = at.go; // Map (or the back button), then the town's card: Play, or Start for a town not founded yet
    if (!game.towns[id]) return canFound(game, id) ? { what: 'go', label: id, run: () => !!foundTown(game, id) && game.go(id) } : null;
    return { what: 'go', label: id, run: () => game.go(id) };
  }
  // the empire's next step once it can be taken: Map, then the Capital's or the town's Start (clarity fix 3)
  if (g.next && g.id.endsWith(':go')) {
    if (g.next === 'capital') return canFoundCapital(game) ? { what: 'go', label: 'capital', run: () => foundCapital(game) } : null;
    return canFound(game, g.next) ? { what: 'go', label: g.next, run: () => !!foundTown(game, g.next) && game.go(g.next) } : null;
  }
  // the Capital's first building: Map, the Capital, its Buildings tab, a Build button (any of them)
  if (g.next === 'contract') { const o = game.shared.capital.offers; return o.length ? { what: 'go', label: 'contract', run: () => takeContract(game, rng.pick(o).id) } : null; }
  if (g.next === 'institution') { const ids = INSTITUTIONS.map(i => i.id).filter(id => foundBlock(game, id) === null); return ids.length ? { what: 'go', label: 'institution', run: () => foundInstitution(game, rng.pick(ids)) } : null; }
  if (g.resume) return town.waves.hold ? { what: 'resume', label: 'waves', run: () => { setHold(game, town, false); return true; } } : null;
  if (at.el && at.el.includes('holdWaves')) return town.waves.hold ? null : { what: 'hold', label: 'waves', run: () => { setHold(game, town, true); return true; } };
  if (at.el && at.el.includes('callWave')) return town.waves.phase === 'break' ? { what: 'call', label: 'wave ' + town.wave, run: () => callEarly(game, town) >= 0 } : null;
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
/* hook(game, seconds, r), when given, runs after every step; it returns true to end the run early (tools/playthrough.js
   records the moments a newcomer meets this way). */
export function newcomer(seed, minutes = MINUTES, hook = null) {
  const g = newGame('first-' + seed), rng = new Rng('newcomer-' + seed);
  const heldFrom = {}, lostBuys = {};
  const r = { held2: { longest: 0, town: null, at: 0 }, goalHeld: {}, seed, ridgeAt: null, savedFrom: null, firstTower: null, dcWon: null, gulchAt: null, wave10: null, breaches: [], buys: 0, wrong: 0, goalTaps: 0, research: 0, taps: [], stuck: { longest: 0, at: 0 }, tabsUsed: [], log: [] };
  let next = rng.range(...WAIT), lastNews = 0, lastLeak = { drycreek: -99, gulch: -99 }, lastGap = 0;
  const now = () => g.stats.steps * .25;
  const news = () => { lastNews = now(); };
  g.bus.on('goal:done', news); g.bus.on('tower:open', news); g.bus.on('town:open', news); g.bus.on('charter:offer', news);
  g.bus.on('leak', e => { lastLeak[e.town] = g.towns[e.town].wave; });
  g.bus.on('breach', e => { if (e.town === g.active) r.breaches.push(e.town + ' ' + e.wave); });
  g.bus.on('wave:clear', e => { if (e.town === 'gulch' && e.wave === 10 && r.wave10 === null && r.gulchAt !== null) r.wave10 = now() - r.gulchAt; });
  let seenTabs = '';
  const earnHist = []; let earnPer = 0;
  const RETRY = 45;
  for (let s = 0; s < minutes * 240; s++) {
    g.step(.25);
    const t = g.town, at = now();
    if (hook && hook(g, at, r)) break;
    // a lost boss holds the waves: the newcomer reads the card, builds a while, then taps Resume waves
    // (not while it saves: the strip then keeps the town held, clarity fix 3b part 2)
    if (t.waves.autoHold && s % 4 === 0 && !savingFor(g, t)) { r.heldAt ??= at; if (at - r.heldAt >= RETRY) { setHold(g, t, false); r.heldAt = null; } }
    if (r.dcWon === null && g.towns.drycreek.won) { r.dcWon = at; news(); }
    if (r.pineWon == null && g.towns.pinehollow && g.towns.pinehollow.won) r.pineWon = at;
    const tb = tabs(g, t), shown = Object.keys(tb).filter(k => tb[k]).join(',');
    if (shown !== seenTabs) { seenTabs = shown; news(); } // a new button came out
    // stuck: nothing to pay for and nothing new on screen (measured each second, first hour only)
    if (s % 4 === 0 && at <= 3600) {
      const can = choices(g, t, rng).length > 0 || goalTap(g, t, rng.fork('look')); // the go-to-the-Gulch goal is a tap too
      if (can) lastGap = at;
      const idle = at - Math.max(lastGap, lastNews);
      if (idle > r.stuck.longest) r.stuck = { longest: idle, at: Math.max(lastGap, lastNews) };
    }
    // how long each goal sits on the strip, in seconds (its steps count as the goal: "g-tools>sawmill" is g-tools)
    if (s % 4 === 0) earnPer = earnRate(g, earnHist);
    if (s % 4 === 0) { const gn = goalNow(g); if (gn) { const b = gn.id.split('>')[0]; r.goalHeld[b] = (r.goalHeld[b] || 0) + 1; } }
    if (s % 4 === 0) for (const x of Object.values(g.towns)) {
      const held = x.waves && x.waves.hold && !x.won && !savingFor(g, x);
      if (!held) { delete heldFrom[x.id]; continue; }
      heldFrom[x.id] ??= at;
      if (at - heldFrom[x.id] > r.held2.longest) r.held2 = { longest: at - heldFrom[x.id], town: x.id, at: heldFrom[x.id] };
    }
    if (at < next) continue;
    // the newcomer looks at what the dots point to (the screen calls these when a sheet opens)
    look(t); if (tb.goods) lookGoods(t); if (tb.perks) lookPerks(t);
    for (const k of ['research', 'perks', 'goods']) if (tb[k] && !r.tabsUsed.includes(k)) r.tabsUsed.push(k);
    // a perk waiting: it picks a side at random
    if (tb.perks) for (const p of PERKS) if (perkState(g, p.id) === 'open') pickPerk(g, p.id, rng.pick(['a', 'b']));
    let tap = null;
    // the Iron Ridge button: once its card says the wave is done, the newcomer saves for it (towers only when the
    // raiders get through), and taps Start the moment it can pay
    // (or the Capital, clarity fix 3)
    const saving = savingFor(g, t) && !!t.waves.hold; // it saves once it holds the waves, as the goal strip says
    if (saving) r.savedFrom ??= at;
    let goal = goalTap(g, t, rng);
    // "Build more towers, then tap Resume waves": it buys LOST_BUYS towers or upgrades first while it can pay for one,
    // then resumes (clarity fix 3b part 2: it tapped Resume at once, and the newcomer's Ridge lost its wave-10 boss for
    // 30 minutes with every tower at level 1)
    if (!t.waves.autoHold) delete lostBuys[t.id];
    if (goal && goal.what === 'resume' && buildFirst(g, t, rng, lostBuys[t.id] || 0)) goal = null;
    const gn = goalNow(g), need = goalNeed(g, t, gn), eta = need ? readyIn(t.coins, need, earnPer) : null;
    const goalSaving = !saving && eta !== null && eta <= GOAL_SAVE;
    if (goalSaving) r.goalSaved = (r.goalSaved || 0) + 1;
    if (goal && (goal.what === 'go' || rng.chance(FOLLOW))) { tap = goal; r.goalTaps++; }
    if (!tap) {
      const all = choices(g, t, rng).filter(c => !(saving || goalSaving) || c.what === 'tower' || c.what === 'upgrade');
      if (!all.length) { next = at + 1; continue; } // nothing it can pay for: it looks again in a second
      // while it holds the waves no raider comes, so only too few towers for the wave number makes it buy one
      // saving for a goal, only a vault under VAULT_LOW makes it buy (not a raider or two, nor towers against the wave)
      // a goal that raises one tower is itself the defense: saving for it, a low vault does not make it buy another
    // (clarity fix 3b part 2c: on seed 2 the Ridge lost wave 29 for 11 minutes while the strip asked for one tower at
    // level 15 and the newcomer spread each coin over 23 towers)
    // saving for the Capital's first building, only a vault at the strip's own fight line (FIGHT_LOW, where it turns to
    // "Stop the war wagon") makes it buy (clarity fix 3b part 2d: at VAULT_LOW, 17 of 25 hearts with "about 1 min to go"
    // took 42K of a 43.5K save on seed 1, and the save broke at every wave of a wall on seeds 5 and 6)
    const weak = saving ? t.towers.length < 1 + Math.floor(t.wave / WAVES_PER_TOWER) : goalSaving ? hurting(t, gn && gn.next === 'institution' ? FIGHT_LOW : VAULT_LOW) && !goalTower(g, t, gn) : short(t, lastLeak[t.id]);
      const pool = weak ? all.filter(c => c.what === 'tower' || c.what === 'upgrade') : all.filter(c => c.what === 'building' || c.what === 'research');
      const best = (pool.length ? pool : all).slice().sort((a, b) => b.value - a.value)[0];
      if (weak && !pool.length) { next = at + 1; continue; } // it wants a tower and waits for the coins
      if ((saving || goalSaving) && !weak) { next = at + 1; continue; } // saving: it buys nothing it does not need
      if (rng.chance(WRONG)) { tap = rng.pick(all); if (tap !== best) r.wrong++; }
      else tap = best;
    }
    if (tap.run()) {
      if (tap.what === 'tower') r.firstTower ??= at;
      if (tap.what === 'research') r.research++;
      if (tap.what === 'go') { if (tap.label === 'gulch') r.gulchAt ??= at; else if (tap.label === 'ridge') r.ridgeAt ??= at; else if (tap.label === 'pinehollow') r.pineAt ??= at; else if (tap.label === 'capital') r.capitalAt ??= at; news(); } // the first time: the resume step sends it back later
      else if (tap.what === 'hold') r.held ??= at;
      else if (tap.what === 'call') r.calls = (r.calls || 0) + 1;
      else r.buys++;
      if ((tap.what === 'tower' || tap.what === 'upgrade') && t.waves.autoHold) lostBuys[t.id] = (lostBuys[t.id] || 0) + 1;
      r.taps.push(at);
      if (r.log.length < 400) r.log.push([Math.round(at), g.active, tap.what, tap.label]);
      next = at + rng.range(...WAIT);
    } else next = at + 1;
  }
  r.end = now();
  r.final = Object.fromEntries(Object.entries(g.towns).map(([id, t]) => [id, { wave: t.wave, best: t.bestWave, towers: t.towers.map(x => x.kind + x.level + (x.path || '')), buildings: { ...t.buildings } }]));
  r.game = g;
  return r;
}

/* Skill pays (PLAN.md M2): the careful player (tools/balance.js, which calls waves early) beats the newcomer by at
   least SKILL on the median time to win Dry Creek and on the median time to the Gulch's wave 10. Returns the misses. */
export const SKILL = 1.2;
export function skillGap(nc, careful) {
  const med = a => { const b = a.filter(x => x != null).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; };
  const out = [], rows = [['Dry Creek won', nc.map(r => r.dcWon), careful.map(c => c.dc.won)], ['Gulch wave 10', nc.map(r => r.wave10), careful.map(c => c.gulch && c.gulch.wave10)]];
  for (const [what, a, b] of rows) {
    const n = med(a), c = med(b);
    out.push({ what, newcomer: n, careful: c, ok: n !== null && c !== null && n >= SKILL * c });
  }
  return out;
}

/* The checks: Dry Creek won within 20 min, the Gulch's wave 10 within 14 min after it opens, never stuck 3 min. */
/* Pine Hollow (Evaluation 2: the newcomer never went there): once the Ridge stands it goes there by the strip, and
   wins it within PINE_WON of getting there. Checked when the run leaves that long after the Ridge was founded. */
export const PINE_WON = 40 * 60;
export const DC_WON = 20 * 60, GULCH_WAVE10 = 14 * 60, RIDGE_AT = 135 * 60; // Iron Ridge founded within 2 h 15 min of play
/* The Capital (clarity fix 3, PLAN.md M6a): the newcomer opens it within CAPITAL_AT of play on most seeds (at least
   CAPITAL_MOST of them) and on the median seed. Before the fix it never did in 5.5 hours (150K against a purse that
   peaked at 22K). */
export const CAPITAL_AT = 150 * 60, CAPITAL_MOST = 2 / 3;
export function capitalMiss(runs) {
  const at = runs.map(r => r.capitalAt ?? null), inTime = at.filter(x => x !== null && x <= CAPITAL_AT).length;
  const med = at.map(x => x === null ? Infinity : x).sort((a, b) => a - b)[Math.floor(at.length / 2)];
  const words = at.map(x => x === null ? 'never' : (x / 60).toFixed(0)).join(' ');
  return inTime >= Math.ceil(CAPITAL_MOST * runs.length) && med <= CAPITAL_AT ? null : `the newcomer opened the Capital at ${words} min (want ${Math.ceil(CAPITAL_MOST * runs.length)} of ${runs.length} seeds and the median within ${CAPITAL_AT / 60} min)`;
}
export function misses(r) {
  const m = [], mm = x => x === null ? 'never' : (x / 60).toFixed(1) + ' min';
  if (r.dcWon === null || r.dcWon > DC_WON) m.push(`seed ${r.seed}: Dry Creek won at ${mm(r.dcWon)} (want within 20 min)`);
  if (r.wave10 === null || r.wave10 > GULCH_WAVE10) m.push(`seed ${r.seed}: Copper Gulch wave 10 at ${mm(r.wave10)} after it opened (want within 14 min)`);
  if (r.held2.longest > HELD_LIMIT) m.push(`seed ${r.seed}: ${r.held2.town} held its waves for ${mm(r.held2.longest)} from minute ${(r.held2.at / 60).toFixed(1)} (want under ${HELD_LIMIT / 60} min)`);
  if (r.stuck.longest > STUCK_LIMIT) m.push(`seed ${r.seed}: stuck for ${mm(r.stuck.longest)} from minute ${(r.stuck.at / 60).toFixed(1)} (want under 3 min)`);
  if (r.ridgeAt !== null && r.end - r.ridgeAt > PINE_WON + 15 * 60) {
    if (r.pineAt == null) m.push(`seed ${r.seed}: never went to Pine Hollow (want the strip to send it there)`);
    else if (r.pineWon == null || r.pineWon - r.pineAt > PINE_WON) m.push(`seed ${r.seed}: Pine Hollow won at ${mm(r.pineWon == null ? null : r.pineWon - r.pineAt)} after getting there (want within ${PINE_WON / 60} min)`);
  }
  if (r.ridgeAt === null || r.ridgeAt > RIDGE_AT) m.push(`seed ${r.seed}: Iron Ridge founded at ${mm(r.ridgeAt)} of play (want within 2 h 15 min)`);
  return m;
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/firstplay.js')) {
  const all = [], runs = [], mm = x => x === null ? 'never' : (x / 60).toFixed(1) + ' min';
  console.log('newcomer: seed | first tower | Dry Creek won | Gulch wave 10 (from when it opens) | breaches | longest stuck (from min) | buys, wrong, by the goal strip | research | buttons used | Ridge founded (waves held from) | final towers (Dry Creek / Gulch) | longest hold not saving (town) | Pine Hollow (went at, won after)');
  for (let s = 1; s <= SEEDS; s++) {
    const r = newcomer(s);
    console.log(`${s} | ${r.firstTower === null ? 'never' : Math.round(r.firstTower) + ' s'} | ${mm(r.dcWon)} | ${mm(r.wave10)} | ${r.breaches.join(', ') || 'none'} | ${mm(r.stuck.longest)} (${(r.stuck.at / 60).toFixed(1)}) | ${r.buys}, ${r.wrong}, ${r.goalTaps} | ${r.research} | ${r.tabsUsed.join(',') || '-'} | ${mm(r.ridgeAt)} (${mm(r.held)}) | ${r.final.drycreek.towers.join(' ')} / ${(r.final.gulch?.towers || []).join(' ')} | ${mm(r.held2.longest)} (${r.held2.town || '-'}) | ${mm(r.pineAt ?? null)}, ${r.pineWon != null && r.pineAt != null ? mm(r.pineWon - r.pineAt) : 'never'}`);
    all.push(...misses(r)); runs.push(r);
  }
  const capMiss = capitalMiss(runs);
  console.log('Capital opened at ' + runs.map(r => r.capitalAt == null ? 'never' : (r.capitalAt / 60).toFixed(0)).join(' ') + ' min' + (capMiss ? '' : ' ok'));
  if (capMiss) all.push(capMiss);
  const careful = []; for (let s = 1; s <= SEEDS; s++) careful.push(campaign(s, 'active', 15));
  for (const x of skillGap(runs, careful)) {
    console.log(`skill: ${x.what}, median newcomer ${mm(x.newcomer)}, careful player ${mm(x.careful)}` + (x.ok ? ' ok' : ''));
    if (!x.ok) all.push(`skill: ${x.what} takes the newcomer ${mm(x.newcomer)} and the careful player ${mm(x.careful)} (want the newcomer at least 20% slower)`);
  }
  console.log(all.length ? all.map(m => 'FAIL ' + m).join('\n') : 'ok');
  process.exitCode = all.length ? 1 : 0;
}
