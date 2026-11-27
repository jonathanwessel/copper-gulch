/* A new game or a loaded one, with every system in its order. The interface, the bots and the tests all start here. */
import { Game } from './game.js';
import { market } from './market.js';
import { economy } from './economy.js';
import { defense } from './defense.js';
import { arms } from './arms.js';
import { research } from './research.js';
import { foremen } from './foremen.js';
import { charter } from './charter.js';
import { outpost, grantOutpost } from './outpost.js';
import { goals } from './goals.js';
import { capital } from './capital.js';
import { orders } from './orders.js';
import { tree } from './tree.js';
import { automation } from './automation.js';
import { TOWNS } from '../data/towns/index.js';

export const SYSTEMS = [market, economy, defense, arms, research, foremen, charter, outpost, goals, capital, orders, tree, automation];

/* A new game starts in Dry Creek Outpost. `start` opens another town alone instead (the Gulch-only bots and tests). */
export function newGame(seed = 'cg', start = 'drycreek') {
  const g = new Game({ seed, systems: SYSTEMS, defs: TOWNS });
  g.addTown(start);
  return g;
}

/* A saved game. Outposts a save migration granted (game.shared.grant) are opened here, as won and running. A town
   whose outpost came in a later release than the town (Tar Seep, M6b part 3, after Thunder Mesa) opens it here as
   founding does, new and not won, so an old save gets the new outpost to play (New choices reach old saves). */
// only these: every other outpost shipped with its town, and a test game made without one must stay without it
const LATE = ['tarseep'];
export function loadGame(data) {
  const g = Game.fromJSON(data, { systems: SYSTEMS, defs: TOWNS });
  const grant = g.shared.grant;
  if (grant) { delete g.shared.grant; for (const id of Object.keys(grant)) if (TOWNS[id] && !g.towns[id]) grantOutpost(g, id); }
  for (const t of Object.values(g.towns)) { const o = t.def && t.def.outpost; if (LATE.includes(o) && !g.towns[o]) g.addTown(o); }
  return g;
}
