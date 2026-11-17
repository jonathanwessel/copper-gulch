/* A new game or a loaded one, with every system in its order. The interface, the bots and the tests all start here. */
import { Game } from './game.js';
import { market } from './market.js';
import { economy } from './economy.js';
import { defense } from './defense.js';
import { TOWNS } from '../data/towns/index.js';

export const SYSTEMS = [market, economy, defense];

export function newGame(seed = 'cg') {
  const g = new Game({ seed, systems: SYSTEMS, defs: TOWNS });
  g.addTown('gulch');
  return g;
}

export function loadGame(data) { return Game.fromJSON(data, { systems: SYSTEMS, defs: TOWNS }); }
