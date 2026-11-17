/* A new game or a loaded one, with every system in its order. The interface, the bots and the tests all start here. */
import { Game } from './game.js';
import { market } from './market.js';
import { economy } from './economy.js';
import { defense } from './defense.js';
import { research } from './research.js';
import { foremen } from './foremen.js';
import { charter } from './charter.js';
import { outpost, grantOutpost } from './outpost.js';
import { goals } from './goals.js';
import { TOWNS } from '../data/towns/index.js';

export const SYSTEMS = [market, economy, defense, research, foremen, charter, outpost, goals];

/* A new game starts in Dry Creek Outpost. `start` opens another town alone instead (the Gulch-only bots and tests). */
export function newGame(seed = 'cg', start = 'drycreek') {
  const g = new Game({ seed, systems: SYSTEMS, defs: TOWNS });
  g.addTown(start);
  return g;
}

/* A saved game. Outposts a save migration granted (game.shared.grant) are opened here, as won and running. */
export function loadGame(data) {
  const g = Game.fromJSON(data, { systems: SYSTEMS, defs: TOWNS });
  const grant = g.shared.grant;
  if (grant) { delete g.shared.grant; for (const id of Object.keys(grant)) if (TOWNS[id] && !g.towns[id]) grantOutpost(g, id); }
  return g;
}
