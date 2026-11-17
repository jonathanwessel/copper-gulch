/* Founding new towns (GDD.md, Towns and eras). A later town names in its data what founding it takes
   (town.def.found): the town that pays (from), the best wave that town must have reached (wave) and the coins it pays
   (coins). It shows as a locked town button once the paying town's best wave reaches `shows`. Founding opens the town
   and its outpost (town.def.outpost). Events: 'town:found' { town, from, coins }. */
import { TOWNS, TOWN_ORDER } from '../data/towns/index.js';

/* Towns not yet open whose founding the player can see: [{ id, from, wave, coins, ready, short }]. */
export function nextTowns(game) {
  const out = [];
  for (const id of TOWN_ORDER) {
    const d = TOWNS[id], f = d.found;
    if (!f || game.towns[id]) continue;
    const from = game.towns[f.from];
    if (!from || (from.bestWave || 0) < (f.shows ?? f.wave)) continue;
    out.push({ id, ...f, waveOk: from.bestWave >= f.wave, coinsOk: from.coins + 1e-9 >= f.coins, ready: canFound(game, id) });
  }
  return out;
}

/* Can the player found this town now? */
export function canFound(game, id) {
  const d = TOWNS[id], f = d && d.found, from = f && game.towns[f.from];
  return !!(f && from && !game.towns[id] && from.bestWave >= f.wave && from.coins + 1e-9 >= f.coins);
}

/* Found it: the paying town pays, the town and its outpost open. Returns the new town, or null. */
export function foundTown(game, id) {
  if (!canFound(game, id)) return null;
  const d = TOWNS[id], from = game.towns[d.found.from];
  from.coins -= d.found.coins;
  const t = game.addTown(id);
  if (d.outpost && TOWNS[d.outpost] && !game.towns[d.outpost]) game.addTown(d.outpost);
  game.bus.emit('town:found', { town: id, from: from.id, coins: d.found.coins });
  return t;
}
