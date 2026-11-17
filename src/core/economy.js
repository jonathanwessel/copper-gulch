/* Production: every building makes its good from its inputs, each step, as far as the yard holds the inputs.
   Surplus is sold on the empire market, keeping a buffer of each input the town's workshops need.
   Buildings are leveled with coins; reaching each milestone level doubles a building's output. */
import { BUILDINGS, MILESTONES } from '../data/buildings.js';
import { GOODS } from '../data/goods.js';
import { sell } from './market.js';

export const KEEP_SECONDS = 10; // a workshop's inputs are kept for this many seconds of its use, never sold

/* The buildings this town can have, in production order (suppliers before their consumers). */
export function buildingsOf(town) {
  const ids = town.def ? town.def.buildings : Object.keys(BUILDINGS).filter(id => BUILDINGS[id].town === town.id);
  return ids.slice().sort((a, b) => GOODS[BUILDINGS[a].makes].tier - GOODS[BUILDINGS[b].makes].tier);
}

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
  const b = BUILDINGS[id], L = town.level(id), f = town.mods.factor('cost');
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
    for (const [g, n] of Object.entries(BUILDINGS[id].inputs)) d[g] = (d[g] || 0) + out * n;
  }
  return d;
}

/* Make goods for dt seconds. Records which buildings ran short of inputs in town.starved. */
export function produce(town, dt) {
  town.starved = {};
  for (const id of buildingsOf(town)) {
    const b = BUILDINGS[id], want = output(town, id) * dt;
    if (!(want > 0)) continue;
    let made = want;
    for (const [g, n] of Object.entries(b.inputs)) made = Math.min(made, (town.goods[g] || 0) / n);
    if (made < want * .999) town.starved[id] = true;
    if (made <= 0) continue;
    for (const [g, n] of Object.entries(b.inputs)) town.goods[g] -= made * n;
    town.addGood(b.makes, made);
    town.made[b.makes] = (town.made[b.makes] || 0) + made;
  }
}

/* Sell what the town does not need: every good set to sell (town.sell[good] !== false), above the workshops' buffer. */
export function sellSurplus(game, town, dt) {
  const need = demand(town);
  for (const g of Object.keys(town.goods)) {
    if (town.sell[g] === false) continue;
    const extra = town.goods[g] - (need[g] || 0) * KEEP_SECONDS;
    if (extra > 1e-9) sell(game, town, g, extra, dt);
  }
}

export const economy = {
  id: 'economy',
  init(town) {
    const s = town.def && town.def.start;
    town.made = {}; town.sell = {}; town.starved = {};
    if (s) { town.coins = s.coins || 0; Object.assign(town.buildings, s.buildings || {}); }
  },
  load(town) { town.made ||= {}; town.sell ||= {}; town.starved ||= {}; },
  step(town, dt, game) { produce(town, dt); sellSurplus(game, town, dt); },
};
