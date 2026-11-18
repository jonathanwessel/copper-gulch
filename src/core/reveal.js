/* What the play screen shows (GDD.md, Onboarding): which side buttons are out, and which carry a dot because something
   there wants the player. Pure reads of the game, so the newcomer bot (tools/firstplay.js) can use only what a player
   sees. The few things a player has looked at (the Goods list, the Perks sheet, a town visited) are kept in the town's
   flags by look(), lookGoods() and lookPerks(), which the screen calls.
   Pause, Hold waves and Menu are always out (owner rule). */
import { BUILDINGS } from '../data/buildings.js';
import { isOutpost } from './economy.js';
import { researchOpen, itemsOf, researchBlock } from './research.js';
import { charterOffered, perksToPick, deedsFor } from './charter.js';
import { nextTowns } from './empire.js';
import { GOODS } from '../data/goods.js';
import { TOWERS } from '../data/towers.js';
import { towerOpen, towerIn } from './defense.js';
import { anyAuto } from './automation.js';

/* The goods the Goods list shows: what this town's built buildings make. */
export const listedGoods = town => Object.entries(BUILDINGS).filter(([id, b]) => b.town === town.id && town.level(id) > 0).map(([, b]) => b.makes);

/* The goods strip (owner rule: the player can always see how much of each good they have): every good this town makes
   with a built building, has in stock, or pays for an open tower kind or the next upgrade of a tower it has, in the
   order of the goods list. */
export function stripGoods(town) {
  const want = new Set(listedGoods(town));
  for (const [g, n] of Object.entries(town.goods || {})) if (n >= 1) want.add(g);
  for (const [k, d] of Object.entries(TOWERS)) if (towerIn(town, k) && (towerOpen(town, k) || (town.towers || []).some(t => t.kind === k))) for (const g of Object.keys(d.goods[town.id] || {})) want.add(g);
  return Object.keys(GOODS).filter(g => want.has(g));
}

/* Which buttons are out. Goods once there are two goods to compare (or once the player met it in another town). */
export function tabs(game, town) {
  const seen = (game.shared && game.shared.seen) || {};
  return {
    pause: true, hold: true, menu: true,
    goods: !!seen.goods || listedGoods(town).length >= 2,
    research: researchOpen(town),
    perks: charterOffered(game) && !isOutpost(town),
    chip: Object.keys(game.towns).length + nextTowns(game).length > 1,
    strip: stripGoods(town).length > 0,
    auto: anyAuto(game), // once the War Office or the University stands at the Capital
  };
}

/* Which buttons carry a dot. towns: town id -> true for another town that wants a visit. */
export function dots(game, town) {
  const t = tabs(game, town), f = town.flags || {};
  const towns = {};
  for (const [id, o] of Object.entries(game.towns)) {
    if (o === town) continue;
    if ((o.breaches || 0) > ((o.flags && o.flags.breachSeen) || 0)) towns[id] = true; // raided while you were away
  }
  return {
    goods: t.goods && listedGoods(town).some(g => !f['listed:' + g]),
    research: t.research && !town.lab && itemsOf(town).some(id => !researchBlock(town, id)),
    perks: t.perks && (perksToPick(game) > 0 || deedsFor(town) > (f.deedsShown || 0)),
    auto: t.auto && !((game.shared.seen || {})['auto:sheet']), // never opened yet
    towns,
  };
}

/* The player is looking at this town: what happened to it while away is now known. */
export function look(town) { town.flags.breachSeen = town.breaches || 0; }
/* The player opened the Goods list. */
export function lookGoods(town) { for (const g of listedGoods(town)) town.flags['listed:' + g] = true; }
/* The player opened the Perks sheet. */
export function lookPerks(town) { town.flags.deedsShown = deedsFor(town); }
