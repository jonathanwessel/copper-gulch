/* Foremen: a building the player has raised to FOREMAN_LEVEL by hand can get a foreman, hired with coins. A working
   foreman buys that building's next level by itself whenever the level costs no more than SHARE of the coins on hand,
   so the town always keeps the other half for towers and research. Its switch turns it off and on.
   town.foremen[building] is true (working) or false (hired, switched off); a building missing from it has none.
   Events: 'foreman:hire' { town, id, cost }. Foremen keep working while the game catches up time away. */
import { BUILDINGS } from '../data/buildings.js';
import { build, cost, unlocked, buildingsOf } from './economy.js';

export const FOREMAN_LEVEL = 10;   // the level a building must reach by hand first
export const HIRE = 3;             // a foreman costs this many times the building's next level
export const SHARE = .5;           // a foreman buys a level when it costs at most this share of the coins on hand

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

/* Each working foreman buys at most one level per step, the cheapest level first. */
export function foremenWork(game, town) {
  const ids = buildingsOf(town).filter(id => foremanOn(town, id) && unlocked(town, id)).sort((a, b) => cost(town, a) - cost(town, b));
  for (const id of ids) if (cost(town, id) <= town.coins * SHARE + 1e-9) build(game, town, id);
}

export const foremen = {
  id: 'foremen',
  init(town) { town.foremen = town.foremen || {}; },
  load(town) { town.foremen = town.foremen || {}; },
  step(town, dt, game) { foremenWork(game, town); },
};
