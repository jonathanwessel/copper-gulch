/* Production: every building makes its good from its inputs, each step, as far as the yard holds the inputs.
   Surplus is sold on the empire market, keeping a buffer of each input the town's workshops need.
   Buildings are leveled with coins; reaching each milestone level doubles a building's output. */
import { BUILDINGS, MILESTONES } from '../data/buildings.js';
import { GOODS } from '../data/goods.js';
import { sell, sellMode, sellsNow, eventFactor, held } from './market.js';

export const KEEP_SECONDS = 10; // a workshop's inputs are kept for this many seconds of its use, never sold

/* The buildings this town can have, in production order (suppliers before their consumers). */
export function buildingsOf(town) {
  const ids = town.def ? town.def.buildings : Object.keys(BUILDINGS).filter(id => BUILDINGS[id].town === town.id);
  return ids.slice().sort((a, b) => GOODS[BUILDINGS[a].makes].tier - GOODS[BUILDINGS[b].makes].tier);
}

/* How much of a good a building uses for each unit it makes (research can raise it, e.g. Hot Furnaces). */
export const uses = (town, id, g) => BUILDINGS[id].inputs[g] * town.mods.factor('use:' + id + ':' + g);

export const milestonesAt = level => MILESTONES.filter(m => level >= m).length;

/* Units per second a building makes at full supply. */
export function output(town, id) {
  const b = BUILDINGS[id], L = town.level(id);
  if (!L) return 0;
  return b.rate * L * 2 ** milestonesAt(L) * town.mods.factor('prod') * town.mods.factor('prod:' + id);
}

/* What each part of a building's rate comes from, for the "explain" view. */
export function explainOutput(town, id) {
  const b = BUILDINGS[id], L = town.level(id), m = milestonesAt(L);
  return [
    { source: 'Base rate', factor: b.rate }, { source: 'Level ' + L, factor: L },
    ...(m ? [{ source: m + ' milestone' + (m > 1 ? 's' : ''), factor: 2 ** m }] : []),
    ...town.mods.explain('prod').parts.map(p => ({ source: p.source, factor: p.mul })),
    ...town.mods.explain('prod:' + id).parts.map(p => ({ source: p.source, factor: p.mul })),
  ];
}

export function cost(town, id, levels = 1) {
  const b = BUILDINGS[id], L = town.level(id), f = town.mods.factor('cost') * town.mods.factor('cost:build');
  let sum = 0;
  for (let i = 0; i < levels; i++) sum += Math.ceil(b.cost * b.growth ** (L + i) * f);
  return sum;
}

/* What still blocks a building: [{ id, level }] of unmet needs (empty when it can be built). */
export function missing(town, id) {
  return Object.entries(BUILDINGS[id].needs || {}).filter(([n, lv]) => town.level(n) < lv).map(([n, lv]) => ({ id: n, level: lv }));
}
export const unlocked = (town, id) => missing(town, id).length === 0;

/* Buy one level. Returns true when bought. */
export function build(game, town, id) {
  if (!BUILDINGS[id] || !unlocked(town, id)) return false;
  const c = cost(town, id);
  if (!town.spend(c)) return false;
  const level = town.buildings[id] = town.level(id) + 1;
  game.bus.emit('build', { town: town.id, id, level, cost: c });
  if (MILESTONES.includes(level)) game.bus.emit('milestone', { town: town.id, id, level });
  return true;
}

/* Units per second each good is used by the town's workshops at full supply. */
export function demand(town) {
  const d = {};
  for (const id of buildingsOf(town)) {
    const out = output(town, id);
    for (const g of Object.keys(BUILDINGS[id].inputs)) if (!isGrid(g)) d[g] = (d[g] || 0) + out * uses(town, id, g);
  }
  return d;
}

/* The power grid (Silver Falls): power is made and used in the same moment, never kept or sold. gridShare is the share
   of what the workshops want that the grid can give (1 when it keeps up); every workshop on the grid runs at that
   share. { made, want, share } in units a second. */
export const isGrid = g => !!(GOODS[g] && GOODS[g].grid);
export function gridOf(town) {
  let made = 0, want = 0;
  for (const id of buildingsOf(town)) {
    const b = BUILDINGS[id];
    if (isGrid(b.makes)) made += output(town, id);
    for (const g of Object.keys(b.inputs)) if (isGrid(g)) want += output(town, id) * uses(town, id, g);
  }
  return { made, want, share: want > 1e-9 ? Math.min(1, made / want) : 1 };
}
export const onGrid = id => Object.keys(BUILDINGS[id].inputs).some(isGrid);

/* Make goods for dt seconds. Records which buildings ran short of inputs in town.starved, and in town.ran[id] what
   each one really made a second, smoothed over about RAN_SECONDS (its card shows it when short, review of 2026.11.19-4:
   "Makes 1 boiler a second" beside "Not enough bricks"). town.ran is optional and only for the screen. */
export const RAN_SECONDS = 3;
/* Workshops leave the tower reserve alone (owner, 2026-11-19: "It's a pain to build towers"): a workshop only uses
   what the town has above town.keepUse (the towers' own need, src/core/defense.js, reserves), so the Smelter never eats
   the ore a Cannon is waiting for. A workshop held back
   that way is marked town.starved[id] = 'towers' (its card says so). WORKSHOP.spare false is the rule before
   2026.11.19-15 (tools/reserve.js compares them). */
export const WORKSHOP = { spare: true };
/* town.stall[id]: seconds a built workshop has run under STALL_SHARE of its rate for want of a good, held for towers or not (src/core/stall.js). */
export const STALL_SHARE = .5, STALL_SECONDS = 20, STALL_MAX = 60;
export function produce(town, dt) {
  town.starved = {};
  const stall = town.stall ||= {};
  const ran = town.ran ||= {}, k = 1 - Math.exp(-dt / RAN_SECONDS);
  // the workers are out fighting (Call to arms, src/core/arms.js): nothing is made
  if (town.arms && town.arms.t > 1e-9) { for (const id of Object.keys(ran)) ran[id] -= ran[id] * k; return; }
  const grid = buildingsOf(town).some(onGrid) ? gridOf(town).share : 1, keep = WORKSHOP.spare ? town.keepUse || {} : {};
  for (const id of buildingsOf(town)) {
    const b = BUILDINGS[id], want = output(town, id) * dt;
    if (!(want > 0) || isGrid(b.makes)) { delete ran[id]; continue; } // power goes straight onto the grid
    let made = onGrid(id) ? want * grid : want;
    const need = Object.keys(b.inputs).filter(g => !isGrid(g)).map(g => [g, uses(town, id, g)]);
    let all = made;
    for (const [g, n] of need) {
      all = Math.min(all, (town.goods[g] || 0) / n);
      made = Math.min(made, Math.max(0, (town.goods[g] || 0) - (keep[g] || 0)) / n);
    }
    if (made < want * .999) town.starved[id] = all >= want * .999 ? 'towers' : true;
    ran[id] = id in ran ? ran[id] + (made / dt - ran[id]) * k : made / dt;
    // short of a good, or held back for the towers (its maker is too small for both): climbs while short, falls twice as fast once it runs
    if (Object.keys(b.inputs).length) {
      const short = !!town.starved[id] && ran[id] < want / dt * STALL_SHARE;
      stall[id] = Math.max(0, Math.min(STALL_MAX, (stall[id] || 0) + (short ? dt : -2 * dt)));
    }
    if (made <= 0) continue;
    for (const [g, n] of need) town.goods[g] -= made * n;
    town.addGood(b.makes, made);
    town.made[b.makes] = (town.made[b.makes] || 0) + made;
  }
}

/* Outposts (GDD.md, Outposts): an outpost that is not in play sends its goods to the towns. The town in play draws
   what its workshops are short of first, up to their KEEP_SECONDS buffer, then the other towns' workshops, and the rest
   of the outpost's surplus sells into the shared purse, at the prices of the town in play (its research and perks on
   prices), as the outpost's own earnings. feedTarget returns that town, or null; feedTowns the towns it feeds, the one
   in play first. */
export const isOutpost = town => !!(town && town.def && town.def.kind === 'outpost');
export function feedTarget(game, town) {
  const a = game.town;
  return isOutpost(town) && a && a !== town && !isOutpost(a) ? a : null;
}
export function feedTowns(game, town) {
  if (!isOutpost(town) || game.town === town) return [];
  const all = Object.values(game.towns).filter(t => !isOutpost(t));
  return all.sort((a, b) => (b === game.town) - (a === game.town));
}
/* Move goods from an outpost into a town's yard, up to its workshops' buffer. Records them in to.drawn[good]. */
export function feed(game, from, to, extra) {
  const need = demand(to);
  for (const g of Object.keys(extra)) {
    const n = Math.min(extra[g], (need[g] || 0) * KEEP_SECONDS - (to.goods[g] || 0));
    if (!(n > 1e-9)) continue;
    from.goods[g] -= n; extra[g] -= n; to.addGood(g, n);
    to.drawn = to.drawn || {}; to.drawn[g] = (to.drawn[g] || 0) + n;
    if (!to.flags['drew:' + from.id]) { to.flags['drew:' + from.id] = true; game.bus.emit('outpost:draw', { town: to.id, from: from.id, good: g }); }
  }
}

/* Routes (GDD.md, Supply chains): a town ships the goods it makes to every later town that imports them, as much as
   that town's workshops are short of (up to their KEEP_SECONDS buffer), from what it has above its own buffer and
   tower reserve. No coins change hands: every town shares one purse, so a route only moves goods (from.sent counts
   them). Shipping goes on in every town, in play or not, and before the maker sells anything. to.shipped[good] counts what came in; the first load of a good emits 'route:open'.
   Routes ignore the Sell switch: it only stops sales on the market. */
export function importers(game, town) {
  return Object.values(game.towns).filter(t => t !== town && !isOutpost(t) && t.def && (t.def.imports || []).some(g => GOODS[g].town === town.id));
}
export function ship(game, from, dt) {
  const tos = importers(game, from);
  if (!tos.length) return;
  const need = demand(from), keep = from.keep || {};
  for (const to of tos) {
    const want = demand(to);
    for (const g of to.def.imports) {
      if (GOODS[g].town !== from.id) continue;
      const spare = (from.goods[g] || 0) - (need[g] || 0) * KEEP_SECONDS - (keep[g] || 0);
      const n = Math.min(spare, (want[g] || 0) * KEEP_SECONDS - (to.goods[g] || 0));
      if (!(n > 1e-9)) continue;
      from.goods[g] -= n; to.addGood(g, n);
      from.sent = from.sent || {}; from.sent[g] = (from.sent[g] || 0) + n;
      to.shipped = to.shipped || {}; to.shipped[g] = (to.shipped[g] || 0) + n;
      if (!to.flags['route:' + g]) { to.flags['route:' + g] = true; game.bus.emit('route:open', { town: to.id, from: from.id, good: g }); }
    }
  }
}

/* Sell what the town does not need: every good not set to Off (town.sell[good] !== false), above the workshops'
   buffer and what the town keeps for its next tower (town.keep, set by the defense), after routes and the Capital's
   contract have taken theirs. Imported goods are never sold. An outpost out of play first feeds the towns and sells
   the rest. A good on Skip busts or Booms only still feeds the towns; only its sale waits (src/core/market.js). */
export function sellSurplus(game, town, dt) {
  ship(game, town, dt);
  for (const s of game.systems) if (s.claim) s.claim(game, town, dt); // the Capital's running contract takes its goods next (src/core/capital.js)
  const need = demand(town), keep = town.keep || {}, extra = {}, imports = (town.def && town.def.imports) || [];
  for (const g of Object.keys(town.goods)) {
    if (town.sell[g] === false || imports.includes(g)) continue;
    const n = town.goods[g] - (need[g] || 0) * KEEP_SECONDS - (keep[g] || 0);
    if (n > 1e-9) extra[g] = n;
  }
  for (const to of feedTowns(game, town)) feed(game, town, to, extra);
  const prices = feedTarget(game, town) || town;
  for (const [g, n] of Object.entries(extra)) {
    const mode = sellMode(town, g);
    if (n > 1e-9 && sellsNow(mode, eventFactor(game, g))) sell(game, town, g, held(mode, n, dt), dt, prices);
  }
}

/* How long coins count as earned lately (town.recent): a fallen vault loses at most that much (src/core/defense.js). */
export const RECENT_SECONDS = 300;

export const economy = {
  id: 'economy',
  init(town) {
    const s = town.def && town.def.start;
    town.made = {}; town.sell = {}; town.starved = {}; town.drawn = {}; town.shipped = {}; town.stall = {};
    // a new town's start coins go into the purse once; a charter starts the town over but never touches the purse
    if (s) { if (!town.charters) town.coins += s.coins || 0; Object.assign(town.buildings, s.buildings || {}); }
  },
  load(town) { town.made ||= {}; town.sell ||= {}; town.starved ||= {}; town.drawn ||= {}; town.shipped ||= {}; town.stall ||= {}; },
  step(town, dt, game) { produce(town, dt); sellSurplus(game, town, dt); town.recent = (town.recent || 0) * Math.exp(-dt / RECENT_SECONDS); },
};
