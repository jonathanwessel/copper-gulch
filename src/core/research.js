/* Town research: items with levels, bought with coins, that finish after a wait. One runs at a time per town, in
   town.lab = { id, left, total } (null when idle); finished levels are in town.research[id]. Each level's bonus is a
   named source on a stat ("Sharp Saws research"), so the explain view lists it.
   Research opens when the town's `researchOpens` building is built (Copper Gulch: the Sawmill), and keeps going
   while the game catches up time away. Events: 'research:open' { town }, 'research:start' { town, id, level },
   'research:done' { town, id, level }, 'research:new' { town, id } (an item with `opens` shows up). */
import { RESEARCH, GROWTH, TIME, TIME_GROWTH } from '../data/research.js';

export const researchLevel = (town, id) => (town.research && town.research[id]) || 0;
/* Has this item shown up yet? An item with `opens` waits for that best wave (a level already done keeps it). */
export const itemShown = (town, id) => !RESEARCH[id].opens || (town.bestWave || 0) >= RESEARCH[id].opens || researchLevel(town, id) > 0;
/* The research items this town has now, in the order its card lists them. */
export const itemsOf = town => ((town.def && town.def.research) || []).filter(id => itemShown(town, id));
export const researchOpen = town => !!(town.flags && town.flags['open:research']);

/* Coins and seconds for the next level of an item (or for level L + 1). */
export function researchCost(town, id, L = researchLevel(town, id)) {
  return Math.ceil(RESEARCH[id].cost * GROWTH ** L * town.mods.factor('cost'));
}
export function researchTime(town, id, L = researchLevel(town, id)) {
  return TIME * TIME_GROWTH ** L;
}
/* Why an item cannot start now: 'closed', 'max', 'busy', 'coins', or null when it can. */
export function researchBlock(town, id) {
  if (!RESEARCH[id] || !itemsOf(town).includes(id) || !researchOpen(town)) return 'closed';
  if (researchLevel(town, id) >= RESEARCH[id].max) return 'max';
  if (town.lab) return 'busy';
  if (town.coins + 1e-9 < researchCost(town, id)) return 'coins';
  return null;
}

/* Pay for the next level of an item and start it. Returns true when started. */
export function startResearch(game, town, id) {
  if (researchBlock(town, id)) return false;
  const c = researchCost(town, id), s = researchTime(town, id);
  town.spend(c);
  town.lab = { id, left: s, total: s };
  game.bus.emit('research:start', { town: town.id, id, level: researchLevel(town, id) + 1, cost: c });
  return true;
}

/* Put every finished level's bonus (and its downside) on the town's stats. Safe to run again: it sets, never adds. */
export function applyResearch(town) {
  for (const id of itemsOf(town)) {
    const r = RESEARCH[id], L = researchLevel(town, id), source = r.name + ' research';
    for (const e of [...r.effects, ...(r.downside || [])]) town.mods.set(e.stat, source, { mul: 1 + e.per * L });
  }
}

function advance(game, town, dt) {
  if (!researchOpen(town)) {
    const b = town.def && town.def.researchOpens;
    if (b && town.level(b) > 0) { town.flags['open:research'] = true; game.bus.emit('research:open', { town: town.id }); }
  }
  for (const id of (town.def && town.def.research) || []) if (RESEARCH[id].opens && !town.flags['new:' + id] && researchOpen(town) && itemShown(town, id)) {
    town.flags['new:' + id] = true; game.bus.emit('research:new', { town: town.id, id });
  }
  const lab = town.lab;
  if (!lab) return;
  lab.left -= dt * town.mods.factor('research');
  if (lab.left > 1e-9) return;
  town.research[lab.id] = researchLevel(town, lab.id) + 1;
  town.lab = null;
  applyResearch(town);
  game.bus.emit('research:done', { town: town.id, id: lab.id, level: town.research[lab.id] });
}

export const research = {
  id: 'research',
  init(town) { town.research = town.research || {}; town.lab = null; applyResearch(town); },
  load(town) { town.research = town.research || {}; town.lab = town.lab || null; applyResearch(town); },
  step(town, dt, game) { advance(game, town, dt); },
};
