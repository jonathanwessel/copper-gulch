/* The empire market: one market for every town. A good's price is
     base x saturation x event x the town's price factor,
   where saturation = REC / (REC + sellRate / depth). sellRate is the recent units per second sold of that good
   (empire-wide), and it recovers toward zero with time constant TAU. So flooding one good halves its price at
   `depth` units per second, while a spread of goods, and goods higher up the chain, pay best.
   A sale pays the average price over the saturation it causes, so one big sale pays the same as many small ones. */
import { GOODS } from '../data/goods.js';

export const REC = 1;    // saturation's recovery constant
export const TAU = 60;   // seconds: how fast a flooded market recovers

export const market = {
  id: 'market',
  setup(game) { if (!game.shared.market) game.shared.market = { rate: {}, event: {}, sold: {} }; },
  /* Sales rates fade with time: each good's rate decays by e^(-dt/TAU). */
  tick(dt, game) {
    const m = game.shared.market, k = Math.exp(-dt / TAU);
    for (const g in m.rate) { m.rate[g] *= k; if (m.rate[g] < 1e-9) delete m.rate[g]; }
  },
};

const M = game => game.shared.market;
export const saturationAt = (good, rate) => REC / (REC + rate / GOODS[good].depth);
export function saturation(game, good) { return saturationAt(good, M(game).rate[good] || 0); }
export function eventFactor(game, good) { return M(game).event[good] || 1; }

/* The price of one unit right now, for a town. */
export function price(game, town, good) {
  return GOODS[good].price * saturation(game, good) * eventFactor(game, good) * town.mods.factor('price');
}

/* What one more unit a second sold right now adds to the coins a second, for a town: selling more also lowers the
   price of every unit sold, so it is base x saturation squared (the slope of rate x price), with the event and the
   town's bonuses. A flooded good adds almost nothing (src/core/foremen.js uses it to wait). */
export function marginal(game, town, good) {
  return GOODS[good].price * saturation(game, good) ** 2 * eventFactor(game, good) * town.mods.factor('price') * town.mods.factor('income');
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
