/* The empire market: one market for every town. A good's price is
     base x saturation x event x the town's price factor,
   where saturation = REC / (REC + sellRate / depth). sellRate is the recent units per second sold of that good
   (empire-wide), and it recovers toward zero with time constant TAU. So flooding one good halves its price at
   `depth` units per second, while a spread of goods, and goods higher up the chain, pay best.
   A sale pays the average price over the saturation it causes, so one big sale pays the same as many small ones. */
import { GOODS } from '../data/goods.js';
import { BUILDINGS } from '../data/buildings.js';
import { Rng } from './rng.js';

export const REC = 1;    // saturation's recovery constant
export const TAU = 60;   // seconds: how fast a flooded market recovers

/* Booms and busts (GDD.md, Market): one good at a time. A new one starts every 3 to 5 minutes (gap, from the start of
   the last), on a good some town or outpost makes (so a good held for a boom always gets one), never the same good
   twice in a row while there is another, and lasts `last` seconds.
   A boom multiplies its price by `up`, a bust by `down`. The clock runs only once a second town (not an outpost) is
   open, so the first comes `first` seconds after Iron Ridge is founded: Dry Creek and the Gulch's first hour have
   none (a new player learns the core first, and the first hour's pacing stays as it was; 2026.11.22-3, the strategy
   bots' Gulch wave 20 flipped on the war wagon with any change to their coins). The market keeps its own random stream
   (m.rng), so a town's luck never moves it. */
export const BOOM = { first: 480, gap: [180, 300], last: 90, up: 1.6, down: .6, bust: .45, retry: 30 };

/* Each good's sell mode (GDD.md, Market): Always (the default, town.sell[good] missing), Skip busts ('skip'), Booms only
   ('boom') or Off (false, as the old Sell switch). Every mode keeps the workshops' buffer and the tower reserve, and
   only market sales wait: routes, the Capital's contract and an outpost's goods for the towns go on. */
export const SELL_MODES = ['always', 'skip', 'boom', 'off'];
export const sellMode = (town, g) => { const v = (town.sell || {})[g]; return v === false ? 'off' : v === 'skip' || v === 'boom' ? v : 'always'; };
export function setSellMode(town, g, mode) {
  if (mode === 'off') town.sell[g] = false; else if (mode === 'skip' || mode === 'boom') town.sell[g] = mode; else delete town.sell[g];
}
/* Whether a mode sells now, given the good's event factor e (1 none, over 1 a boom, under 1 a bust). */
export const sellsNow = (mode, e) => (mode === 'always' ? true : mode === 'skip' ? !(e < 1) : mode === 'boom' ? e > 1 : false);

/* The goods a boom or bust can fall on: what the empire's buildings make (power is never sold). */
export function boomable(game) {
  const s = new Set();
  for (const t of Object.values(game.towns)) for (const [id, L] of Object.entries(t.buildings || {})) { const g = L > 0 && BUILDINGS[id] && BUILDINGS[id].makes; if (g && GOODS[g] && !GOODS[g].grid) s.add(g); }
  return [...s].sort();
}

/* Start the next boom or bust, or look again in BOOM.retry seconds while no building stands yet. */
function startBoom(m, game) {
  const r = Rng.from(m.rng), all = boomable(game), other = all.filter(g => g !== m.last), list = other.length ? other : all; // one good made: it can come again
  if (!list.length) { m.wait = BOOM.retry; m.rng = r.state; return; }
  const good = r.pick(list), f = r.chance(BOOM.bust) ? BOOM.down : BOOM.up;
  m.event = { [good]: f }; m.boom = { good, f, left: BOOM.last }; m.last = good;
  m.wait = r.range(BOOM.gap[0], BOOM.gap[1]);
  m.rng = r.state;
  m.started = (m.started || 0) + 1;
}
/* Move the boom clock on by dt seconds (any size: catch-up chunks are a minute). */
export const boomsOpen = game => Object.values(game.towns).filter(t => !(t.def && t.def.kind === 'outpost')).length >= 2;
export function boomTick(game, dt) {
  const m = game.shared.market;
  if (!boomsOpen(game)) return;
  while (dt > 1e-9) {
    const end = m.boom ? m.boom.left : Infinity, step = Math.min(dt, end, m.wait);
    dt -= step; m.wait -= step;
    if (m.boom) { m.boom.left -= step; if (m.boom.left <= 1e-9) { m.boom = null; m.event = {}; } }
    if (m.wait <= 1e-9) startBoom(m, game);
  }
}

export const market = {
  id: 'market',
  setup(game) {
    if (!game.shared.market) game.shared.market = { rate: {}, event: {}, sold: {} };
    const m = game.shared.market;
    if (!m.rng) m.rng = new Rng(game.seed + ':market').state;
    if (m.wait === undefined) { m.wait = BOOM.first; m.boom = null; m.last = null; }
  },
  /* Sales rates fade with time: each good's rate decays by e^(-dt/TAU). Then the boom clock moves on. */
  tick(dt, game) {
    const m = game.shared.market, k = Math.exp(-dt / TAU);
    for (const g in m.rate) { m.rate[g] *= k; if (m.rate[g] < 1e-9) delete m.rate[g]; }
    boomTick(game, dt);
  },
};
/* The boom or bust on now: { good, f, left } (seconds left), or null. */
export const boomNow = game => (game.shared.market && game.shared.market.boom) || null;

const M = game => game.shared.market;
export const saturationAt = (good, rate) => REC / (REC + rate / GOODS[good].depth);
export function saturation(game, good) { return saturationAt(good, M(game).rate[good] || 0); }
export function eventFactor(game, good) { return M(game).event[good] || 1; }

/* The price of one unit right now, for a town. */
export function price(game, town, good) {
  return GOODS[good].price * saturation(game, good) * eventFactor(game, good) * town.mods.factor('price');
}

/* What one more unit a second sold right now adds to the coins a second, for a town: selling more also lowers the
   price of every unit sold, so it is base x saturation squared (the slope of rate x price), with the town's bonuses.
   A flooded good adds almost nothing (src/core/foremen.js uses it to wait). No boom or bust: it lasts a minute and a
   half, and a level lasts. */
export function marginal(game, town, good) {
  return GOODS[good].price * saturation(game, good) ** 2 * town.mods.factor('price') * town.mods.factor('income');
}

/* How much the sales rate rises when n units are sold over a span of `span` seconds (0: at once). Selling s
   units per second in steps of any size settles at rate s. */
export function rateRise(n, span = 0) {
  return span > 0 ? n / span * (1 - Math.exp(-span / TAU)) : n / TAU;
}

/* Average saturation while the rate rises from r0 to r1: the integral of REC / (REC + r / d) dr, divided by the rise. */
export function averageSaturation(good, r0, r1) {
  if (r1 - r0 < 1e-12) return saturationAt(good, r0);
  const d = GOODS[good].depth;
  return REC * d * Math.log((REC + r1 / d) / (REC + r0 / d)) / (r1 - r0);
}

/* What selling n units would pay, without selling. */
export function quote(game, town, good, n, span = 0) {
  const r0 = M(game).rate[good] || 0, r1 = r0 + rateRise(n, span);
  return n * GOODS[good].price * averageSaturation(good, r0, r1) * eventFactor(game, good) * town.mods.factor('price') * town.mods.factor('income');
}

/* Sell up to n units from a town's yard, at the prices of `priceBy` (the town itself, or for a won outpost out of play
   the town in play, whose stalls sell its goods). The coins go into the shared purse as the selling town's own earnings.
   Returns the coins earned. */
export function sell(game, town, good, n, span = 0, priceBy = town) {
  n = Math.min(n, town.goods[good] || 0);
  if (!(n > 0)) return 0;
  const coins = quote(game, priceBy, good, n, span), m = M(game);
  m.rate[good] = (m.rate[good] || 0) + rateRise(n, span);
  m.sold[good] = (m.sold[good] || 0) + n;
  town.goods[good] -= n;
  town.earn(coins, false, 'sale:' + good);
  if (!town.flags.firstSale) { town.flags.firstSale = true; game.bus.emit('first:sale', { town: town.id, good }); }
  return coins;
}
