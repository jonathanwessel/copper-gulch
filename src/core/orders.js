/* Town orders (GDD.md, Market). Pure: no DOM, no three.js, no Math.random.
   Each town (not an outpost) has its own board of offers and its own reputation (0 to ORDERS.max), kept in
   game.shared.orders.towns[id] = { rep, offers: [order], active: order | null, n, wait, filled, missed }, so a charter
   keeps the reputation (it only clears the board). game.shared.orders = { rng, wait, towns } has the clock that opens
   them: ORDERS.first seconds once two towns have each beaten wave ORDERS.wave (ordersReady), and then they stay open.
   order: { id, good, need, got, coins, minutes, time, left, rush, age }: need units of a good this town makes, coins
   paid when full, `time` seconds to fill it once taken (left counts down), and age on the board.
   The player takes one order at a time (takeOrder). While it runs, the town sends the good to the buyer by itself,
   from what it has above its workshops' buffer and its tower reserve, after routes and the Capital's contract and
   before the market sells any (claim, called by src/core/economy.js), so what an order needs is kept from sale.
   Nothing takes an order but the player: the goal strip and Auto never do.
   Events: 'orders:open' { town }, 'order:take' { town, id, good }, 'order:done' { town, id, good, coins, rep },
   'order:miss' { town, id, good, rep, gaveUp }. */
import { ORDERS } from '../data/orders.js';
import { GOODS } from '../data/goods.js';
import { BUILDINGS } from '../data/buildings.js';
import { Rng } from './rng.js';
import { isOutpost } from './economy.js';
import { spareRate, spareNow, nice } from './capital.js';
import { saturation, rateRise, averageSaturation } from './market.js';

const O = game => game.shared.orders;
/* Two towns (not outposts) have each beaten wave ORDERS.wave: the orders clock runs. */
export const ordersReady = game => Object.values(game.towns).filter(t => !isOutpost(t) && (t.bestWave || 0) >= ORDERS.wave).length >= 2;
/* Whether orders are open in the empire (their first clock has run out). */
export const ordersOpen = game => !!(O(game) && O(game).wait <= 1e-9);
/* A town's orders state, or null for an outpost or before orders open. */
export function ordersOf(game, town) {
  const o = O(game);
  if (!o || !town || isOutpost(town) || !ordersOpen(game)) return null;
  return o.towns[town.id] ||= { rep: 0, offers: [], active: null, n: 1, wait: 0, filled: 0, missed: 0 };
}
export const repOf = (game, town) => { const s = ordersOf(game, town); return s ? s.rep : 0; };
export const rushOpen = (game, town) => repOf(game, town) >= ORDERS.rushAt;

/* Goods an order can ask for in a town: what its buildings make (not power), with spare output, and not the good of
   another offer, the running order or the Capital's running contract. */
export function orderGoods(game, town, st) {
  const c = game.shared.capital, busy = new Set([...st.offers.map(o => o.good), ...(st.active ? [st.active.good] : []), ...(c && c.active && c.active.town === town.id ? [c.active.good] : [])]);
  const out = [];
  for (const id of town.def.buildings) {
    const g = BUILDINGS[id].makes;
    if (!town.level(id) || !GOODS[g] || GOODS[g].grid || busy.has(g) || out.some(x => x.good === g)) continue;
    const r = spareRate(game, town, g);
    if (r > 1e-6) out.push({ good: g, rate: r });
  }
  return out;
}

/* What a unit sells for on the market now, with no boom or bust (an order's price starts there). */
export const marketNow = (game, town, good) => GOODS[good].price * saturation(game, good) * town.mods.factor('price');
/* What a unit of an order's load would fetch on the market if the whole load were sold over the order's time: the
   load floods the market as a sale would, so a big load is worth less a unit (the sell-mode probe, 2026.11.25-8: priced
   at today's price, an order for minutes of a big town's output paid far past what the market could ever take, and a
   town that held its goods earned 30 times the coins). An order pays this times its premium. */
export const loadPrice = (game, town, good, need, time) => { const m = game.shared.market, r0 = (m && m.rate[good]) || 0; return GOODS[good].price * averageSaturation(good, r0, r0 + rateRise(need, time)) * town.mods.factor('price'); };
/* What an order pays: need x the market's price for its load x pay, more with reputation, and more for a rush. */
export const orderPay = (unit, need, rep, rush) => Math.round(need * unit * ORDERS.pay * (1 + ORDERS.repPay * rep / ORDERS.max) * (rush ? ORDERS.rush.pay : 1));

/* Draw one new offer onto a town's board, or null when nothing can be asked for. */
function offer(game, town, st) {
  const list = orderGoods(game, town, st);
  if (!list.length) return null;
  const o = O(game), r = Rng.from(o.rng);
  const rush = st.rep >= ORDERS.rushAt && r.chance(ORDERS.rush.chance);
  const x = r.pick(list), span = rush ? ORDERS.rush.minutes : ORDERS.minutes;
  const minutes = Math.round(r.range(span[0], span[1]) * 2) / 2;
  o.rng = r.state;
  const need = Math.max(ORDERS.least[GOODS[x.good].tier] || 5, nice(x.rate * 60 * minutes));
  const time = Math.round(minutes * 60 * (rush ? ORDERS.rush.time : ORDERS.time));
  const a = { id: st.n++, good: x.good, need, got: 0, coins: Math.max(1, orderPay(loadPrice(game, town, x.good, need, time), need, st.rep, rush)), minutes, time, left: time, rush, age: 0 };
  st.offers.push(a);
  return a;
}
function fill(game, town, st) {
  while (st.offers.length < ORDERS.board) if (!offer(game, town, st)) { st.wait = ORDERS.retry; return; }
  st.wait = 0;
}

/* Take an offer. An order already running is given up first, and that counts as missed. */
export function takeOrder(game, town, id) {
  const st = ordersOf(game, town), i = st ? st.offers.findIndex(o => o.id === id) : -1;
  if (i < 0) return false;
  if (st.active) giveUpOrder(game, town);
  st.active = st.offers.splice(i, 1)[0];
  st.active.left = st.active.time;
  game.bus.emit('order:take', { town: town.id, id, good: st.active.good });
  fill(game, town, st);
  return true;
}
function miss(game, town, st, gaveUp) {
  const a = st.active; st.active = null;
  st.rep = Math.max(0, st.rep - ORDERS.miss); st.missed++;
  game.bus.emit('order:miss', { town: town.id, id: a.id, good: a.good, rep: st.rep, gaveUp });
}
/* Give up the running order: what was sent stays with the buyer, unpaid, and the reputation falls as for a miss. */
export function giveUpOrder(game, town) {
  const st = ordersOf(game, town);
  if (!st || !st.active) return false;
  miss(game, town, st, true);
  return true;
}

/* Send what the town has to spare toward its running order (src/core/economy.js calls this before it sells). An
   order whose time ran out (left 0) and is still short is missed here, so the goods of the step it ran out in count. */
/* dt: the step's seconds. What an order takes counts on the market's sales rate as a sale of the same units does, so
   the next offer's price falls as a sale's would (the sell-mode probe, 2026.11.25-8: a town that held its goods kept
   its price at full while orders filled from the pile one after another, and earned 30 times the coins). */
export function claim(game, town, dt = 0) {
  const st = ordersOf(game, town), a = st && st.active;
  if (!a) return;
  const n = Math.min(spareNow(town, a.good), a.need - a.got);
  if (n > 1e-9) { town.goods[a.good] -= n; a.got += n; const m = game.shared.market; if (m) m.rate[a.good] = (m.rate[a.good] || 0) + rateRise(n, dt); }
  if (a.got >= a.need - 1e-6) {
    st.active = null; st.filled++;
    st.rep = Math.min(ORDERS.max, st.rep + (a.rush ? ORDERS.rushFill : ORDERS.fill));
    town.earn(a.coins, false, 'order');
    game.bus.emit('order:done', { town: town.id, id: a.id, good: a.good, coins: a.coins, rep: st.rep, rush: a.rush });
    if (st.offers.length < ORDERS.board) fill(game, town, st);
  } else if (a.left <= 1e-9) miss(game, town, st, false); // its time ran out (tick), after this step's goods went in
}

export const orders = {
  id: 'orders',
  setup(game) {
    if (!game.shared.orders) game.shared.orders = { rng: new Rng(game.seed + ':orders').state, wait: ORDERS.first, towns: {} };
    const o = game.shared.orders; o.towns ||= {};
    if (!o.rng) o.rng = new Rng(game.seed + ':orders').state;
  },
  /* A charter starts the town over: its board and running order go, its reputation stays. */
  init(town, game) { const st = game.shared.orders && game.shared.orders.towns[town.id]; if (st) { st.offers = []; st.active = null; st.wait = 0; } },
  tick(dt, game) {
    const o = O(game);
    if (o.wait > 1e-9) { if (!ordersReady(game)) return; o.wait -= dt; if (o.wait > 1e-9) return; o.wait = 0; }
    for (const town of Object.values(game.towns)) {
      if (isOutpost(town)) continue;
      const fresh = !o.towns[town.id], st = ordersOf(game, town);
      if (fresh) game.bus.emit('orders:open', { town: town.id });
      if (st.active) st.active.left = Math.max(0, st.active.left - dt); // claim misses it once this step's goods are in
      for (let i = st.offers.length - 1; i >= 0; i--) if ((st.offers[i].age += dt) >= ORDERS.stale) st.offers.splice(i, 1);
      if (st.offers.length < ORDERS.board && (st.wait -= dt) <= 0) fill(game, town, st);
    }
  },
  claim,
};
