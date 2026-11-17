/* Outposts (GDD.md, Outposts): small raw-goods camps. The game starts in Dry Creek Outpost; clearing its goal wave
   (town.def.goal) wins it and opens the next town (town.def.opens). A won outpost keeps working on its own: its raids
   stay at the goal wave's strength without the boss, one every town.def.raid seconds (src/core/defense.js), and while
   it is out of play its goods go to the town in play (src/core/economy.js, feed). town.won marks a won outpost.
   Events: 'outpost:won' { town, opens }. */
import { isOutpost } from './economy.js';
import { towerCost } from './defense.js';

export { isOutpost };

/* Win an outpost: mark it, keep its waves at the goal for good, and open the town it leads to. */
export function winOutpost(game, town) {
  const d = town.def;
  town.won = true;
  town.wave = d.goal; town.bestWave = Math.max(town.bestWave, d.goal);
  Object.assign(town.waves, { phase: 'break', timer: d.raid || 120, queue: [] });
  game.bus.emit('outpost:won', { town: town.id, opens: d.opens || null });
  if (d.opens && !game.towns[d.opens]) game.addTown(d.opens);
}

/* An outpost as a player who already won it would leave it (the save migration for games already past it): its
   buildings at `level`, a Crossbow on each of its first `towers` pads, won and running. */
export function grantOutpost(game, id, { level = 5, towers = 2 } = {}) {
  const had = !!game.towns[id], purse = game.shared.purse.coins;
  const t = game.towns[id] || game.addTown(id);
  if (!had) t.coins = purse; // a granted outpost brings no start coins
  for (const b of t.def.buildings) t.buildings[b] = Math.max(t.level(b), level);
  const kind = (t.def.towers || ['crossbow'])[0];
  for (let i = 0; i < towers && i < t.def.board.spots.length; i++) {
    if (t.towers.some(x => x.spot === i)) continue;
    t.towers.push({ spot: i, kind, level: 1, path: null, cd: 0, spent: towerCost(t, kind, 0).coins, pulses: 0 });
  }
  t.bestWave = Math.max(t.bestWave, t.def.goal);
  t.won = true; t.wave = t.def.goal;
  Object.assign(t.waves, { phase: 'break', timer: t.def.raid || 120, queue: [], foes: [], shells: [], fires: [] });
  return t;
}

export const outpost = {
  id: 'outpost',
  init(town) { if (isOutpost(town)) town.won = false; },
  load(town) { if (isOutpost(town)) town.won = !!town.won; },
  step(town, dt, game) {
    if (isOutpost(town) && !town.won && town.bestWave >= town.def.goal) winOutpost(game, town);
  },
};
