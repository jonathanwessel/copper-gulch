// Market depth, part 2 (M6a): town orders. Each town's buyers ask for a load of a good it makes by a deadline; a filled
// order pays coins and raises the town's reputation, a missed one lowers it, and rush orders come from reputation 60.
// What a running order needs is kept from sale, after the tower reserve, and nothing but the player takes an order.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, loadGame } from '../src/core/setup.js';
import { encode, decode, migrate, SAVE_VERSION } from '../src/core/save.js';
import { ORDERS } from '../src/data/orders.js';
import { ordersOf, ordersOpen, takeOrder, giveUpOrder, orderPay, rushOpen, marketNow, loadPrice } from '../src/core/orders.js';
import { sellSurplus, demand, KEEP_SECONDS } from '../src/core/economy.js';
import { signCharter } from '../src/core/charter.js';
import { GOODS } from '../src/data/goods.js';
import { BUILDINGS } from '../src/data/buildings.js';
import { incomeLabel } from '../src/core/explain.js';

/* Two towns, each past wave 10, so the orders clock runs (ordersReady). */
const two = seed => { const g = newGame(seed, 'gulch'); g.addTown('ridge'); g.towns.gulch.bestWave = g.towns.ridge.bestWave = ORDERS.wave; return g; };
const run = (g, secs, dt = 1) => { for (let i = 0; i < secs; i += dt) g.step(dt); };
const open = seed => { const g = two(seed); run(g, ORDERS.first + 1); return g; };
/* Fill a town's board at once: wait out its retry. */
const full = g => run(g, ORDERS.retry + 1);

test('no orders until two towns have beaten wave 10; then they open ORDERS.first seconds later', () => {
  const g = newGame('ord-1', 'gulch'); g.town.bestWave = 40;
  run(g, 2 * ORDERS.first);
  assert.equal(ordersOpen(g), false); assert.equal(ordersOf(g, g.town), null);
  g.addTown('ridge'); g.towns.ridge.bestWave = ORDERS.wave - 1;
  run(g, 2 * ORDERS.first); assert.equal(ordersOpen(g), false);
  g.towns.ridge.bestWave = ORDERS.wave;
  const seen = []; g.bus.on('orders:open', e => seen.push(e.town));
  run(g, ORDERS.first - 2); assert.equal(ordersOpen(g), false);
  run(g, 3); assert.equal(ordersOpen(g), true);
  assert.deepEqual(seen.sort(), ['gulch', 'ridge']);
  assert.ok(ordersOf(g, g.towns.gulch).offers.length >= 1);
});

test('outposts have no orders', () => {
  const g = newGame('ord-2'); g.addTown('gulch'); g.addTown('ridge'); g.towns.gulch.bestWave = g.towns.ridge.bestWave = 10; g.towns.drycreek.bestWave = 10;
  run(g, ORDERS.first + 1);
  assert.equal(ordersOf(g, g.towns.drycreek), null);
  assert.ok(!('drycreek' in g.shared.orders.towns));
});

test('an offer asks for a good the town makes, a few minutes of its spare output, with time to spare', () => {
  const g = open('ord-3');
  for (const id of ['gulch', 'ridge']) {
    const t = g.towns[id];
    for (let i = 1; i < 4; i++) t.buildings[t.def.buildings[i]] ||= 1; // more kinds of goods
  }
  run(g, ORDERS.stale + ORDERS.retry + 2); // the first boards go stale and new ones come
  for (const id of ['gulch', 'ridge']) {
    const t = g.towns[id], st = ordersOf(g, t);
    assert.equal(st.offers.length, ORDERS.board, id);
    const made = t.def.buildings.filter(b => t.level(b) > 0).map(b => BUILDINGS[b].makes);
    assert.equal(new Set(st.offers.map(o => o.good)).size, st.offers.length, 'two different goods');
    for (const o of st.offers) {
      assert.ok(made.includes(o.good), o.good);
      assert.ok(!GOODS[o.good].grid);
      assert.ok(o.minutes >= ORDERS.minutes[0] && o.minutes <= ORDERS.minutes[1]);
      assert.equal(o.time, Math.round(o.minutes * 60 * ORDERS.time));
      assert.ok(o.need >= ORDERS.least[GOODS[o.good].tier]);
      assert.ok(o.coins > 0);
      assert.equal(o.rush, false);
    }
  }
});

test('a taken order fills from spare goods before the market sells any, then pays and raises reputation', () => {
  const g = open('ord-4'), t = g.towns.gulch, st = ordersOf(g, t), o = st.offers[0];
  const done = []; g.bus.on('order:done', e => done.push(e));
  assert.ok(takeOrder(g, t, o.id));
  assert.equal(st.active.id, o.id);
  const before = g.shared.purse.coins, sold = g.shared.market.sold[o.good] || 0;
  let soldBy = null; g.bus.on('order:done', () => { soldBy = (g.shared.market.sold[o.good] || 0) - sold; });
  run(g, o.minutes * 60 + 30);
  assert.equal(done.length, 1); assert.equal(done[0].coins, o.coins);
  assert.equal(st.active, null); assert.equal(st.filled, 1); assert.equal(st.rep, ORDERS.fill);
  assert.ok(g.shared.purse.coins >= before + o.coins - 1);
  assert.ok((t.tally.order || 0) >= o.coins - 1e-6, 'filed under Orders filled');
  assert.equal(incomeLabel('order'), 'Orders filled');
  // while it ran nothing of that good went to the market: all of its spare went to the buyer
  assert.ok(soldBy < o.need * .05, 'sold ' + soldBy);
});

test('an order never takes the tower reserve or the workshops buffer', () => {
  const g = open('ord-5'), t = g.towns.gulch, st = ordersOf(g, t), o = st.offers[0];
  takeOrder(g, t, o.id);
  const g0 = o.good;
  t.keep = { ...(t.keep || {}), [g0]: 500 };
  t.goods[g0] = 520;
  sellSurplus(g, t, .25);
  const buf = (demand(t)[g0] || 0) * KEEP_SECONDS;
  assert.ok(st.active.got <= 20 - buf + 1e-6, 'took ' + st.active.got);
  assert.ok(t.goods[g0] >= 500 - 1e-6);
});

test('a missed order lowers reputation, never under 0, and giving up counts as a miss', () => {
  const g = open('ord-6'), t = g.towns.gulch, st = ordersOf(g, t);
  st.rep = 20;
  const miss = []; g.bus.on('order:miss', e => miss.push(e));
  const o = st.offers[0]; takeOrder(g, t, o.id);
  st.active.need = 1e9; // never filled
  run(g, o.time + 2);
  assert.equal(miss.length, 1); assert.equal(miss[0].gaveUp, false);
  assert.equal(st.rep, 20 - ORDERS.miss); assert.equal(st.missed, 1); assert.equal(st.active, null);
  full(g);
  takeOrder(g, t, st.offers[0].id);
  assert.ok(giveUpOrder(g, t));
  assert.equal(miss[1].gaveUp, true); assert.equal(st.rep, 0);
  assert.equal(giveUpOrder(g, t), false);
});

test('taking another offer gives up the running one', () => {
  const g = open('ord-7'), t = g.towns.gulch, st = ordersOf(g, t);
  t.buildings.mine ||= 1; full(g);
  st.rep = 30;
  assert.equal(st.offers.length, 2);
  const [a, b] = st.offers;
  takeOrder(g, t, a.id); takeOrder(g, t, b.id);
  assert.equal(st.active.id, b.id); assert.equal(st.missed, 1); assert.equal(st.rep, 30 - ORDERS.miss);
});

test('rush orders come only from reputation 60, with a smaller ask, a tighter deadline and more pay', () => {
  const g = open('ord-8'), t = g.towns.gulch, st = ordersOf(g, t);
  const draw = n => { const out = []; for (let i = 0; i < n; i++) { st.offers = []; st.wait = 0; g.step(1); out.push(...st.offers); } return out; };
  st.rep = 59; assert.equal(rushOpen(g, t), false);
  assert.ok(draw(40).every(o => !o.rush));
  st.rep = 60; assert.equal(rushOpen(g, t), true);
  const list = draw(60), rush = list.filter(o => o.rush);
  assert.ok(rush.length > 5 && rush.length < list.length, rush.length + ' of ' + list.length);
  for (const o of rush) {
    assert.ok(o.minutes >= ORDERS.rush.minutes[0] && o.minutes <= ORDERS.rush.minutes[1]);
    assert.equal(o.time, Math.round(o.minutes * 60 * ORDERS.rush.time));
  }
  assert.ok(orderPay(1, 100, 60, true) > orderPay(1, 100, 60, false));
});

test('reputation raises what an order pays, up to half more at 100, and a filled rush order raises it more', () => {
  assert.ok(orderPay(13, 100, 100, false) > orderPay(13, 100, 0, false));
  assert.equal(orderPay(13, 100, 100, false), Math.round(100 * 13 * ORDERS.pay * (1 + ORDERS.repPay)));
  const g = open('ord-9'), t = g.towns.gulch, st = ordersOf(g, t);
  st.rep = 95; st.offers[0].rush = true; const o = st.offers[0];
  takeOrder(g, t, o.id); st.active.need = 1; st.active.got = 1;
  g.step(1);
  assert.equal(st.rep, ORDERS.max);
});

test('an order pays more than selling its load on the market over its time, a big load less a unit, and less on a flooded good', () => {
  const g = open('ord-16'), t = g.towns.gulch;
  for (const o of ordersOf(g, t).offers) { assert.ok(o.coins / o.need > loadPrice(g, t, o.good, o.need, o.time), o.good); assert.ok(loadPrice(g, t, o.good, o.need, o.time) <= marketNow(g, t, o.good) + 1e-9); }
  assert.ok(loadPrice(g, t, 'timber', 1e5, 300) < loadPrice(g, t, 'timber', 100, 300) / 5, 'a load far past the market depth fetches far less a unit');
  const fresh = marketNow(g, t, 'timber');
  g.shared.market.rate.timber = 40; // flooded
  assert.ok(marketNow(g, t, 'timber') < fresh / 2);
  assert.ok(orderPay(marketNow(g, t, 'timber'), 100, 0, false) < orderPay(fresh, 100, 0, false) / 2);
});

test('an offer nobody takes is replaced after a while', () => {
  const g = open('ord-10'), t = g.towns.gulch, st = ordersOf(g, t);
  const first = st.offers[0].id;
  run(g, ORDERS.stale + ORDERS.retry + 2);
  assert.ok(!st.offers.some(o => o.id === first));
  assert.ok(st.offers.length >= 1);
});

test('a charter clears the board and the running order but keeps the reputation', () => {
  const g = open('ord-11'), t = g.towns.gulch, st = ordersOf(g, t);
  st.rep = 44; takeOrder(g, t, st.offers[0].id);
  t.bestWave = 60; t.lifetime = 1e12; // enough for a deed
  const paid = signCharter(g, t);
  assert.ok(paid > 0, 'the charter was signed');
  const s2 = ordersOf(g, t);
  assert.equal(s2.rep, 44); assert.equal(s2.active, null);
});

test('nobody but the player takes an order: hours of play with every system running take none', () => {
  const g = open('ord-12');
  let took = 0; g.bus.on('order:take', () => took++);
  run(g, 3 * 3600, 5);
  assert.equal(took, 0);
  for (const id of ['gulch', 'ridge']) assert.equal(ordersOf(g, g.towns[id]).active, null);
});

test('a big catch-up chunk counts the goods of the step an order runs out in', () => {
  const g = open('ord-13'), t = g.towns.gulch, st = ordersOf(g, t), o = st.offers[0];
  takeOrder(g, t, o.id);
  st.active.left = 30; st.active.got = st.active.need - 1;
  t.goods[o.good] = (t.goods[o.good] || 0) + 1000;
  g.coarse(60);
  assert.equal(st.filled, 1); assert.equal(st.missed, 0);
});

test('the same seed gives the same orders, and a save keeps them', () => {
  const a = open('ord-14'), b = open('ord-14');
  run(a, 1200); run(b, 1200);
  assert.deepEqual(a.shared.orders, b.shared.orders);
  const t = a.towns.gulch; takeOrder(a, t, ordersOf(a, t).offers[0].id); ordersOf(a, t).rep = 33;
  const c = loadGame(decode(encode(a, 0)).game);
  assert.deepEqual(c.shared.orders, JSON.parse(JSON.stringify(a.shared.orders)));
  run(a, 300); run(c, 300);
  assert.deepEqual(c.shared.orders, JSON.parse(JSON.stringify(a.shared.orders)));
});

test('an old save gets the orders clock as a new game has it', () => {
  const g = two('ord-15'); const s = JSON.parse(encode(g, 0));
  delete s.game.shared.orders; s.v = 26;
  const m = migrate(s);
  assert.equal(m.v, SAVE_VERSION);
  assert.equal(m.game.shared.orders.wait, ORDERS.first);
  const l = loadGame(m.game);
  run(l, ORDERS.first + 1);
  assert.ok(ordersOpen(l));
  assert.ok(ordersOf(l, l.towns.gulch).offers.length >= 1);
});

test('what an order takes counts on the market like a sale, so the next offer pays less a unit (the sell-mode probe)', () => {
  const g = open('ord-flood'), t = g.towns.gulch, st = ordersOf(g, t), o = st.offers[0], m = g.shared.market;
  // nothing of the good goes to market: only the order moves it
  t.sell[o.good] = false;
  const r0 = m.rate[o.good] || 0, unit0 = marketNow(g, t, o.good);
  t.goods[o.good] = (t.goods[o.good] || 0) + o.need * 3; // a held pile, as on Off or Booms only
  assert.ok(takeOrder(g, t, o.id));
  run(g, 2, .25);
  assert.equal(st.active, null, 'filled at once from the pile');
  assert.ok((m.rate[o.good] || 0) > r0 + o.need / 400, 'its delivery raised the sales rate');
  assert.ok(marketNow(g, t, o.good) < unit0, 'so the good is worth less a unit now');
});

test('holding goods and filling orders one after another pays no more than the order premium over selling them', () => {
  // two games on one seed: one sells everything, one holds every good and fills orders from the pile for 30 minutes
  const coins = hold => {
    const g = open('ord-hold'), t = g.towns.gulch;
    for (const k of Object.keys(t.goods)) { t.goods[k] += 5000; if (hold) t.sell[k] = false; }
    const before = g.shared.purse.coins;
    for (let s = 0; s < 1800; s += 5) {
      run(g, 5, .25);
      const st = ordersOf(g, t);
      if (hold && st && !st.active && st.offers.length) takeOrder(g, t, st.offers[0].id);
    }
    return g.shared.purse.coins - before;
  };
  const sold = coins(false), held = coins(true), top = ORDERS.pay * (1 + ORDERS.repPay) * ORDERS.rush.pay;
  assert.ok(held <= sold * top, 'held ' + Math.round(held) + ' against sold ' + Math.round(sold) + ' times ' + top.toFixed(2));
});
