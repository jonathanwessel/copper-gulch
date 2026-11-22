/* Foremen: a building the player has raised to FOREMAN_LEVEL by hand can get a foreman, hired with coins. A working
   foreman buys that building's next level by itself whenever the level costs no more than SHARE of the coins on hand,
   so the town always keeps the other half for towers and research. Its switch turns it off and on.
   A foreman also waits on a level that would not pay (PLAN.md M4, Idle income grows): while its own building is short
   of an input (another level would make nothing more), and while the next level would take longer than PAYBACK to earn
   its price back at today's prices (a flooded good earns almost nothing more), unless a workshop or the towers are
   short of its good: then the level is wanted whatever the price (`foremanWait`).
   town.foremen[building] is true (working) or false (hired, switched off); a building missing from it has none.
   Events: 'foreman:hire' { town, id, cost }. Foremen keep working while the game catches up time away. */
import { BUILDINGS } from '../data/buildings.js';
import { GOODS } from '../data/goods.js';
import { build, cost, unlocked, buildingsOf, output, uses, importers, isOutpost, isGrid, gridOf, onGrid } from './economy.js';
import { marginal, saturation } from './market.js';

export const FOREMAN_LEVEL = 10;   // the level a building must reach by hand first
export const HIRE = 3;             // a foreman costs this many times the building's next level
export const SHARE = .5;           // a foreman buys a level when it costs at most this share of the coins on hand
export const PAYBACK = 3600;       // seconds: a foreman buys a level only if it earns its price back within this time
export const FLOODED = .5;         // below this share of its base price a good reads as flooded on the card

export const hasForeman = (town, id) => !!town.foremen && id in town.foremen;
export const foremanOn = (town, id) => !!(town.foremen && town.foremen[id]);
export const canHire = (town, id) => !!BUILDINGS[id] && !hasForeman(town, id) && town.level(id) >= FOREMAN_LEVEL;
export const hireCost = (town, id) => HIRE * cost(town, id);

/* Hire a foreman for a building. Returns true when hired. */
export function hireForeman(game, town, id) {
  if (!canHire(town, id)) return false;
  const c = hireCost(town, id);
  if (!town.spend(c)) return false;
  town.foremen[id] = true;
  game.bus.emit('foreman:hire', { town: town.id, id, cost: c });
  return true;
}
/* Switch a hired foreman on or off. */
export function setForeman(town, id, on) { if (hasForeman(town, id)) town.foremen[id] = !!on; }

/* The building of a town that ran short of a good in the last step (it has less than a second of that building's
   use in the yard), or null. */
export function shortOf(town, good) {
  if (isGrid(good)) return gridOf(town).share < 1 ? buildingsOf(town).find(onGrid) || null : null; // the grid is short for all alike
  return buildingsOf(town).find(id => town.starved && town.starved[id] && BUILDINGS[id].inputs[good]
    && (town.goods[good] || 0) < output(town, id) * uses(town, id, good)) || null;
}
/* Who is short of a good this town makes: { town, id } for a workshop here, in a town it ships the good to, or (for an
   outpost) in any town it feeds; { town, id: 'towers' } when its towers keep more of it than the yard holds; or null. */
export function wanted(game, town, good) {
  const towns = [town, ...importers(game, town).filter(t => t.def.imports.includes(good))];
  if (isOutpost(town)) towns.push(...Object.values(game.towns).filter(t => !isOutpost(t) && t !== town));
  for (const t of towns) { const id = shortOf(t, good); if (id) return { town: t, id }; }
  if (((town.keep || {})[good] || 0) > (town.goods[good] || 0) + 1e-9) return { town, id: 'towers' };
  return null;
}
/* The coins a second one more level of a building would add at today's prices: the extra units it makes, each worth
   what one more sold now adds (src/core/market.js, marginal), less the inputs they use at the same measure. */
export function nextGain(game, town, id) {
  const b = BUILDINGS[id], L = town.level(id), now = output(town, id);
  town.buildings[id] = L + 1; const next = output(town, id); town.buildings[id] = L; if (!L) delete town.buildings[id];
  const net = marginal(game, town, b.makes) - Object.keys(b.inputs).reduce((a, g) => a + uses(town, id, g) * marginal(game, town, g), 0);
  return (next - now) * net;
}
/* A shipped input that the next level would outrun: the good, or null. The level is too many when the town's workshops
   would then use more than IMPORT_SLACK times what the town that makes the good makes of it a second. The slack lets
   them run a little short, which shows on the map and tells the player to raise the maker.
   2026.11.22-8: the Falls' Telegraph Office was short of wire during a wire boom, so the Wire Mill's foreman raised it
   from level 13 to 28 in three minutes, past what Gulch copper could feed by about 17 levels, and the mill sat starved
   for the rest of the hour. */
export const IMPORT_SLACK = 1.25;
export function importShort(game, town, id) {
  if (!game || !game.towns) return null;
  for (const good of Object.keys(BUILDINGS[id].inputs)) {
    if (!((town.def && town.def.imports) || []).includes(good)) continue;
    const src = game.towns[GOODS[good].town], mk = src && src.def.buildings.find(b => BUILDINGS[b].makes === good);
    if (!mk || !src.level(mk)) continue;
    const L = town.level(id); town.buildings[id] = L + 1;
    const need = town.def.buildings.reduce((a, u) => a + (town.level(u) && BUILDINGS[u].inputs[good] ? uses(town, u, good) * output(town, u) : 0), 0);
    town.buildings[id] = L; if (!L) delete town.buildings[id];
    if (need > IMPORT_SLACK * output(src, mk) + 1e-9) return good;
  }
  return null;
}
/* Why a foreman waits on its building's next level, or null when the level is worth buying:
     { why: 'short', good }    the building ran short of this input, so another level would make nothing more, or
                               the next level would use more of a shipped input than reaches it (importShort)
     { why: 'flooded', good }  its good sells for under FLOODED of its price and nobody is short of it
     { why: 'slow', good }     the next level would take longer than PAYBACK to earn back its price */
export function foremanWait(game, town, id) {
  const b = BUILDINGS[id];
  if (!town.level(id)) return null;
  if (town.starved && town.starved[id]) {
    const g = Object.keys(b.inputs).find(k => isGrid(k) ? gridOf(town).share < 1 : (town.goods[k] || 0) < output(town, id) * uses(town, id, k)) || Object.keys(b.inputs)[0];
    if (g) return { why: 'short', good: g };
  }
  const far = importShort(game, town, id);
  if (far) return { why: 'short', good: far };
  if (wanted(game, town, b.makes)) return null;
  if (nextGain(game, town, id) * PAYBACK >= cost(town, id)) return null;
  return { why: saturation(game, b.makes) < FLOODED ? 'flooded' : 'slow', good: b.makes };
}

/* Each working foreman buys at most one level per step, the cheapest level first, when it can pay and the level is
   worth buying. */
export function foremenWork(game, town) {
  const ids = buildingsOf(town).filter(id => foremanOn(town, id) && unlocked(town, id)).sort((a, b) => cost(town, a) - cost(town, b));
  for (const id of ids) if (cost(town, id) <= town.coins * SHARE + 1e-9 && !foremanWait(game, town, id)) build(game, town, id);
}

export const foremen = {
  id: 'foremen',
  init(town) { town.foremen = town.foremen || {}; },
  load(town) { town.foremen = town.foremen || {}; },
  step(town, dt, game) { foremenWork(game, town); },
};
