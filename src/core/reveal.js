/* What the play screen shows (GDD.md, Onboarding): which side buttons are out, and which carry a dot because something
   there wants the player. Pure reads of the game, so the newcomer bot (tools/firstplay.js) can use only what a player
   sees. The few things a player has looked at (the Goods list, the Perks sheet, a town visited) are kept in the town's
   flags by look(), lookGoods() and lookPerks(), which the screen calls.
   Pause, Hold waves and Menu are always out (owner rule). */
import { BUILDINGS } from '../data/buildings.js';
import { isOutpost } from './economy.js';
import { researchOpen, researchAnywhere, itemsOf, researchBlock } from './research.js';
import { charterOffered, perksToPick, deedsFor } from './charter.js';
import { nextTowns } from './empire.js';
import { GOODS } from '../data/goods.js';
import { TOWERS } from '../data/towers.js';
import { towerOpen, towerIn } from './defense.js';
import { anyAuto } from './automation.js';
import { armsOpen, armsHere } from './arms.js';

/* The goods the Goods list shows: what this town's built buildings make (power is not a good: the Water Wheel's card
   shows it). */
export const listedGoods = town => Object.entries(BUILDINGS).filter(([id, b]) => b.town === town.id && town.level(id) > 0 && !GOODS[b.makes].grid).map(([, b]) => b.makes);

/* The goods strip in its room of `max` chips: { list, more }, `more` goods left for the Goods sheet. */
export function stripFit(town, max = Infinity) {
  const all = stripGoods(town);
  if (all.length <= max) return { list: all, more: 0 };
  // too many for the room: the goods the towers pay with, then what the town makes, then what it ships in, with the
  // last place a "more" chip that opens the Goods sheet (always room for the tower goods: the owner rule)
  const tower = towerGoods(town), made = new Set(listedGoods(town));
  const rank = g => (tower.has(g) ? 0 : made.has(g) ? 1 : 2);
  const keep = all.slice().sort((a, b) => rank(a) - rank(b)).slice(0, Math.max(tower.size, max - 1));
  return { list: all.filter(g => keep.includes(g)), more: all.length - keep.length };
}
/* The goods the town's open or standing towers pay with. */
function towerGoods(town) {
  const s = new Set();
  for (const [k, d] of Object.entries(TOWERS)) if (towerIn(town, k) && (towerOpen(town, k) || (town.towers || []).some(t => t.kind === k))) for (const g of Object.keys(d.goods[town.id] || {})) s.add(g);
  return s;
}
/* The goods strip (owner rule: the player can always see how much of each good they have): every good this town makes
   with a built building, has in stock, or pays for an open tower kind or the next upgrade of a tower it has, the town's
   own goods first. */
export function stripGoods(town) {
  const want = new Set(listedGoods(town));
  for (const [g, n] of Object.entries(town.goods || {})) if (n >= 1) want.add(g);
  // goods shipped in for a built workshop stay on the strip at 0 (review of 2026.11.19-7: the Ridge's bricks came and went)
  for (const g of (town.def && town.def.imports) || []) if (Object.entries(BUILDINGS).some(([id, b]) => b.town === town.id && town.level(id) > 0 && g in b.inputs)) want.add(g);
  for (const g of towerGoods(town)) want.add(g);
  // the town's own goods first, then what it ships in (review of 2026.11.20-11: Iron Ridge's strip led with the Gulch's
  // Bricks and Tools), each part in the order of the goods list
  const own = g => (GOODS[g].town === town.id ? 0 : 1);
  return Object.keys(GOODS).filter(g => want.has(g) && !GOODS[g].grid).sort((x, y) => own(x) - own(y));
}

/* Which buttons are out. Goods once there are two goods to compare (or once the player met it in another town). */
export function tabs(game, town) {
  const seen = (game.shared && game.shared.seen) || {};
  return {
    pause: true, hold: true, menu: true,
    goods: !!seen.goods || listedGoods(town).length >= 2,
    research: researchOpen(town) || researchAnywhere(game), // every town once any town researches (owner, 2026-11-20)
    perks: charterOffered(game) && !isOutpost(town),
    chip: Object.keys(game.towns).length + nextTowns(game).length > 1,
    strip: stripGoods(town).length > 0,
    auto: anyAuto(game), // once the War Office or the University stands at the Capital
    arms: armsOpen(game) && armsHere(town), // Call to arms: the War Office's Armory, in a place with workers
  };
}

/* Which buttons carry a dot. towns: town id -> true for another town that wants a visit. Only one side button has a
   dot at a time, the first of DOT_ORDER that wants one (review of 2026.11.19-14: red dots on Goods, Research and Perks
   all at once said nothing); the next shows once that one is opened. */
export const DOT_ORDER = ['perks', 'goods', 'auto', 'research']; // research last: it wants a visit most often
export function dots(game, town) {
  const t = tabs(game, town), f = town.flags || {};
  const towns = {};
  for (const [id, o] of Object.entries(game.towns)) {
    if (o === town) continue;
    if ((o.breaches || 0) > ((o.flags && o.flags.breachSeen) || 0)) towns[id] = true; // raided while you were away
  }
  const want = {
    goods: t.goods && listedGoods(town).some(g => !f['listed:' + g]),
    research: t.research && !town.lab && itemsOf(town).some(id => !researchBlock(town, id)),
    perks: t.perks && (perksToPick(game) > 0 || deedsFor(town) > (f.deedsShown || 0)),
    auto: t.auto && !((game.shared.seen || {})['auto:sheet']), // never opened yet
  };
  const first = DOT_ORDER.find(k => want[k]), out = { towns };
  for (const k of DOT_ORDER) out[k] = k === first;
  return out;
}

/* The player is looking at this town: what happened to it while away is now known. */
export function look(town) { town.flags.breachSeen = town.breaches || 0; }
/* The player opened the Goods list. */
export function lookGoods(town) { for (const g of listedGoods(town)) town.flags['listed:' + g] = true; }
/* The player opened the Perks sheet. */
export function lookPerks(town) { town.flags.deedsShown = deedsFor(town); }
