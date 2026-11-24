/* A stalled workshop says why (clarity fix 6, PLAN.md M6a, review 6). The newcomer's Boiler Shop sat short of steel
   94-96% of the time on every seed (tools/stall-probe.js), and its Locomotive Works then waited 9 to 31 minutes for a
   first boiler, with no word anywhere but "It ran out of materials".
   town.stall[id] (src/core/economy.js, produce) counts the seconds a built workshop has made under STALL_SHARE of its
   rate for want of a good (also when the towers get it first: the steel mill of the newcomer's Ridge was held for
   towers while the strip asked to upgrade it to level 21 behind a Blast Furnace at level 3), not while the workers are out. It climbs while short and falls twice
   as fast once it runs, so a stall shows after STALL_SECONDS and does not flicker. stallOf names the good it waits for
   and the building that makes it; the building card, the Goods sheet, the goal strip and the bots all read it. */
import { BUILDINGS } from '../data/buildings.js';
import { GOODS } from '../data/goods.js';
import { TOWNS } from '../data/towns/index.js';
import { uses, isGrid, gridOf, output, STALL_SHARE, STALL_SECONDS, STALL_MAX } from './economy.js';
export { STALL_SHARE, STALL_SECONDS, STALL_MAX };

/* The building that makes a good for this town: one of its own, else the town that makes the good. { town, id, built }. */
export function makerOf(game, town, good) {
  const own = ((town.def && town.def.buildings) || []).find(id => BUILDINGS[id] && BUILDINGS[id].makes === good);
  if (own) return { town: town.id, id: own, built: town.level(own) > 0 };
  const home = GOODS[good] && GOODS[good].town, t = home && game.towns[home];
  const defs = t ? t.def.buildings : ((TOWNS[home] && TOWNS[home].buildings) || []);
  const id = (defs || []).find(b => BUILDINGS[b] && BUILDINGS[b].makes === good);
  return id ? { town: home, id, built: !!t && t.level(id) > 0 } : null;
}

/* The input a short workshop has least of: power when the grid is short and every good is there. */
export function shortInput(town, id) {
  const ins = Object.keys(BUILDINGS[id].inputs), ku = town.keepUse || {}, out = output(town, id);
  let best = null, low = Infinity;
  for (const g of ins) {
    if (isGrid(g)) continue;
    const n = Math.max(0, (town.goods[g] || 0) - (ku[g] || 0)) / uses(town, id, g);
    if (n < low) { low = n; best = g; }
  }
  const grid = ins.find(isGrid);
  if (grid && gridOf(town).share < .999 && !(low < out)) return grid;
  return best;
}

/* null, or { good, maker } for a workshop stalled long enough to say so. */
export function stallOf(game, town, id) {
  if (!town.level(id) || !((town.stall || {})[id] >= STALL_SECONDS)) return null;
  const good = shortInput(town, id);
  return good ? { good, maker: makerOf(game, town, good), held: town.starved[id] === 'towers' } : null;
}

const lower = g => GOODS[g].name.toLowerCase();
const placeName = id => (TOWNS[id] && (TOWNS[id].short || TOWNS[id].name)) || 'another town';
/* "Waits for steel from the Steel Mill", "Waits for bricks from Copper Gulch" (the card names the building there: the
   fresh-eyes read of 2026.11.24-9 found "from the Toolsmith in Copper Gulch" wrapping to three lines on a phone). */
export function stallWords(game, town, s) {
  if (!s) return '';
  const m = s.maker, name = m ? BUILDINGS[m.id].name : null;
  if (!name) return 'Waits for ' + lower(s.good);
  return 'Waits for ' + lower(s.good) + ' from ' + (m.town !== town.id ? placeName(m.town) : 'the ' + name);
}
/* What to do about it, one short line: "Upgrade the Steel Mill", "Build a Kiln in Copper Gulch". */
export function stallFix(game, town, s) {
  if (!s || !s.maker) return '';
  const m = s.maker, there = m.town !== town.id ? ' in ' + placeName(m.town) : '';
  return (m.built ? 'Upgrade the ' : 'Build a ') + BUILDINGS[m.id].name + there;
}
/* The town's stalled workshop that makes this good, if any (the Goods sheet's row for that good). */
export function goodStall(game, town, good) {
  const id = ((town.def && town.def.buildings) || []).find(b => BUILDINGS[b] && BUILDINGS[b].makes === good && Object.keys(BUILDINGS[b].inputs).length);
  return id ? stallOf(game, town, id) : null;
}
