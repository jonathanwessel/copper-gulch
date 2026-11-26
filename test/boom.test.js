// Market depth, part 1 (M6a): booms and busts, one good at a time, and a sell mode per good (Always, Skip busts,
// Booms only, Off). Every mode keeps the tower reserve, and no buy-and-sell loop earns coins (the M6a target).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, loadGame } from '../src/core/setup.js';
import { encode, decode, migrate, SAVE_VERSION } from '../src/core/save.js';
import * as M from '../src/core/market.js';
import { BOOM, boomNow, boomable, sellMode, setSellMode, sellsNow, eventFactor, price, quote, marginal, SELL_MODES } from '../src/core/market.js';
import { sellSurplus } from '../src/core/economy.js';
import { explainPrice } from '../src/core/explain.js';
import { goodsSwitch, boomWord, MODE_LINES } from '../src/ui/format.js';
import { EXPLAINERS } from '../src/data/explainers.js';
import { GOODS } from '../src/data/goods.js';

/* A game with two towns open (the Gulch and Iron Ridge), so the boom clock runs (boomsOpen). */
const two = seed => { const g = newGame(seed, 'gulch'); g.addTown('ridge'); return g; };
/* Run a game for `secs` seconds in 1-second steps. */
const run = (g, secs) => { for (let i = 0; i < secs; i++) g.step(1); };
/* Every boom or bust a game starts over `secs` seconds: [{ at, good, f }]. */
function events(g, secs) {
  const out = []; let last = 0;
  for (let i = 0; i < secs; i++) { g.step(1); const m = g.shared.market; if ((m.started || 0) !== last) { last = m.started; out.push({ at: i + 1, good: m.boom.good, f: m.boom.f, made: boomable(g).length }); } }
  return out;
}

test('the first boom or bust comes 8 minutes in, then one every 3 to 5 minutes, on one good at a time', () => {
  const g = two('boom-1');
  const ev = events(g, 3 * 3600);
  assert.ok(ev.length > 30, 'many in three hours: ' + ev.length);
  assert.equal(ev[0].at, BOOM.first);
  for (let i = 1; i < ev.length; i++) {
    const gap = ev[i].at - ev[i - 1].at;
    assert.ok(gap >= BOOM.gap[0] - 1 && gap <= BOOM.gap[1] + 1, 'gap ' + gap);
    if (ev[i].made > 1) assert.notEqual(ev[i].good, ev[i - 1].good, 'never the same good twice in a row');
  }
  const booms = ev.filter(e => e.f > 1).length, busts = ev.filter(e => e.f < 1).length;
  assert.ok(booms > 0 && busts > 0, booms + ' booms, ' + busts + ' busts');
  for (const e of ev) assert.ok(e.f === BOOM.up || e.f === BOOM.down);
});

test('a boom lasts its time and moves only its own good, and the market never has two at once', () => {
  const g = two('boom-2');
  run(g, BOOM.first);
  const b = boomNow(g); assert.ok(b, 'a boom or bust is on');
  assert.equal(Object.keys(g.shared.market.event).length, 1);
  assert.equal(eventFactor(g, b.good), b.f);
  for (const o of Object.keys(GOODS)) if (o !== b.good) assert.equal(eventFactor(g, o), 1);
  run(g, BOOM.last - 1); assert.ok(boomNow(g));
  run(g, 2); assert.equal(boomNow(g), null); assert.equal(eventFactor(g, b.good), 1);
});

test('booms fall only on goods the empire makes, never on power', () => {
  const g = two('boom-3');
  const made = boomable(g);
  assert.ok(made.length > 0);
  for (const e of events(g, 2 * 3600)) { assert.ok(boomable(g).includes(e.good), e.good); assert.ok(!GOODS[e.good].grid); }
  assert.deepEqual(made, [...made].sort());
});

test('the same seed gives the same booms; a big catch-up chunk gives the same as small steps', () => {
  const a = events(two('boom-4'), 2 * 3600), b = events(two('boom-4'), 2 * 3600);
  assert.deepEqual(a, b);
  const fine = two('boom-4'), coarse = two('boom-4');
  run(fine, 3600); for (let i = 0; i < 60; i++) coarse.coarse(60);
  assert.equal(fine.shared.market.started, coarse.shared.market.started);
  assert.equal(fine.shared.market.last, coarse.shared.market.last);
});

test('a boom raises the price and a bust lowers it, and the price box says so', () => {
  const g = newGame('boom-5', 'drycreek'), t = g.town, good = 'ore';
  const base = price(g, t, good);
  g.shared.market.event = { [good]: BOOM.up }; g.shared.market.boom = { good, f: BOOM.up, left: 60 };
  assert.ok(Math.abs(price(g, t, good) - base * BOOM.up) < 1e-9);
  assert.ok(explainPrice(g, t, good).rows.some(r => r.label === 'Demand high')); // clarity fix 8r: Boom read as jargon
  g.shared.market.event = { [good]: BOOM.down };
  assert.ok(Math.abs(price(g, t, good) - base * BOOM.down) < 1e-9);
  assert.ok(explainPrice(g, t, good).rows.some(r => r.label === 'Demand low'));
  // a foreman's sum leaves it out: a level lasts, a boom does not
  const m0 = marginal(g, t, good); g.shared.market.event = {}; assert.equal(marginal(g, t, good), m0);
});

test('each sell mode sells only when it should, and keeps the tower reserve', () => {
  for (const [mode, none, boom, bust] of [['always', true, true, true], ['skip', true, true, false], ['boom', false, true, false], ['off', false, false, false]]) {
    assert.equal(sellsNow(mode, 1), none, mode + ' with nothing on'); assert.equal(sellsNow(mode, BOOM.up), boom, mode + ' in a boom'); assert.equal(sellsNow(mode, BOOM.down), bust, mode + ' in a bust');
  }
  const sold = (mode, f) => {
    const g = newGame('boom-6', 'drycreek'), t = g.town;
    t.goods = { ore: 500 }; t.keep = { ore: 120 }; setSellMode(t, 'ore', mode);
    g.shared.market.event = f === 1 ? {} : { ore: f };
    const c = t.coins; sellSurplus(g, t, .25);
    return { left: t.goods.ore, coins: t.coins - c };
  };
  for (const mode of SELL_MODES) for (const f of [1, BOOM.up, BOOM.down]) {
    const r = sold(mode, f);
    assert.ok(r.left >= 120 - 1e-6, mode + ' kept the tower reserve at ' + f + ': ' + r.left);
    if (sellsNow(mode, f)) assert.ok(r.coins > 0 && r.left < 500, mode + ' sold at ' + f);
    else assert.equal(r.left, 500, mode + ' held at ' + f);
  }
  // a boom pays more for the same goods than no event, and a bust less
  assert.ok(sold('always', BOOM.up).coins > sold('always', 1).coins && sold('always', 1).coins > sold('always', BOOM.down).coins);
});

test('the modes are kept in town.sell as before: Off is false, Always is no entry', () => {
  const t = { sell: {} };
  assert.equal(sellMode(t, 'ore'), 'always');
  setSellMode(t, 'ore', 'skip'); assert.equal(t.sell.ore, 'skip'); assert.equal(sellMode(t, 'ore'), 'skip');
  setSellMode(t, 'ore', 'boom'); assert.equal(sellMode(t, 'ore'), 'boom');
  setSellMode(t, 'ore', 'off'); assert.equal(t.sell.ore, false); assert.equal(sellMode(t, 'ore'), 'off');
  setSellMode(t, 'ore', 'always'); assert.ok(!('ore' in t.sell));
});

test('a good on Booms only always gets a boom in time, so it is never held for good', () => {
  const g = two('boom-7'), t = g.town;
  const goods = boomable(g);
  for (const good of goods) setSellMode(t, good, 'boom');
  const booms = new Set(events(g, 6 * 3600).filter(e => e.f > 1).map(e => e.good));
  for (const good of goods) assert.ok(booms.has(good), good + ' boomed in six hours');
});

test('a pile a mode held back sells out over about half a minute, and pays more than all in one step', () => {
  const after = (mode, secs) => {
    const g = newGame('boom-9', 'drycreek'), t = g.town;
    t.goods = { ore: 600 }; t.keep = {}; setSellMode(t, 'ore', mode);
    const c = t.coins, start = t.goods.ore;
    for (let i = 0; i < secs * 4; i++) { sellSurplus(g, t, .25); M.market.tick(.25, g); }
    return { sold: start - t.goods.ore, coins: t.coins - c };
  };
  const step = after('skip', .25), dump = after('always', .25);
  assert.ok(step.sold < .02 * dump.sold, 'Skip busts let out ' + step.sold + ' of ' + dump.sold + ' in one step');
  const paced = after('skip', 150), all = after('always', 150);
  assert.ok(paced.sold > .97 * all.sold, 'the pile was out in two and a half minutes: ' + paced.sold + ' of ' + all.sold);
  assert.ok(paced.coins > 1.05 * all.coins, 'paced ' + paced.coins + ' against all at once ' + all.coins);
  assert.equal(M.held('always', 50, .25), 50); assert.equal(M.held('off', 50, .25), 50);
});

test('Booms only holds a good while no boom is on', () => {
  const g = newGame('boom-8', 'drycreek'), t = g.town;
  t.goods = { ore: 300 }; t.keep = {}; setSellMode(t, 'ore', 'boom');
  const c = t.coins; sellSurplus(g, t, .25);
  assert.equal(t.coins, c); assert.equal(t.goods.ore, 300);
});

test('no buy-and-sell loop earns coins (M6a target)', () => {
  // the market only buys from the player: no market action turns coins into goods
  const g = newGame('boom-9', 'drycreek'), t = g.town;
  t.goods = { ore: 200, stone: 200 }; t.coins = 1000;
  for (const [name, fn] of Object.entries(M)) {
    if (typeof fn !== 'function' || name === 'setSellMode' || name === 'boomTick') continue;
    const goods = { ...t.goods }, coins = t.coins;
    try { fn(g, t, 'ore', 50, .25); } catch (e) { /* a reader with other arguments */ }
    for (const k of Object.keys(goods)) assert.ok((t.goods[k] || 0) <= goods[k] + 1e-9, name + ' added ' + k);
    if (t.coins > coins) assert.ok((t.goods.ore || 0) < goods.ore, name + ' paid coins for nothing');
  }
  // a sale pays no more than the price now, and splitting it never pays more than one sale
  const once = newGame('boom-9', 'drycreek'), split = newGame('boom-9', 'drycreek');
  for (const x of [once, split]) { x.town.goods = { ore: 400 }; x.shared.market.event = { ore: BOOM.up }; }
  const p = price(once, once.town, 'ore'), q = quote(once, once.town, 'ore', 400);
  assert.ok(q <= 400 * p * once.town.mods.factor('income') + 1e-9);
  const a = M.sell(once, once.town, 'ore', 400);
  let b = 0; for (let i = 0; i < 40; i++) b += M.sell(split, split.town, 'ore', 10);
  assert.ok(b <= a * (1 + 1e-9), 'split ' + b + ' against ' + a);
  // a buy the market gets later (the Stock Exchange) must lose coins on a buy and sell at once
  if (typeof M.buy === 'function') {
    const x = newGame('boom-9', 'drycreek'); x.town.coins = 1e6; const c0 = x.town.coins;
    M.buy(x, x.town, 'ore', 100); M.sell(x, x.town, 'ore', 100);
    assert.ok(x.town.coins < c0);
  }
});

test('save v26: an old save gets the boom clock of a new game; a game with a boom on keeps it', () => {
  const g = two('boom-10');
  const old = JSON.parse(encode(g, 1));
  delete old.game.shared.market.wait; delete old.game.shared.market.boom; delete old.game.shared.market.last; delete old.game.shared.market.rng;
  old.v = 25;
  const m = migrate(old);
  assert.equal(m.v, SAVE_VERSION); assert.ok(SAVE_VERSION >= 26);
  assert.equal(m.game.shared.market.wait, BOOM.first); assert.equal(m.game.shared.market.boom, null);
  const back = loadGame(m.game); assert.ok(Array.isArray(back.shared.market.rng));
  run(g, BOOM.first + 5);
  const b = boomNow(g), again = loadGame(decode(encode(g, 2)).game);
  assert.deepEqual(boomNow(again), b);
  const ev1 = events(g, 1200), ev2 = events(again, 1200);
  assert.deepEqual(ev1, ev2, 'the same booms after a save and load');
});

test('the words: modes, the time left and the explainer', () => {
  assert.equal(goodsSwitch({ selling: true }), 'Sell spare · ' + MODE_LINES.always);
  assert.equal(goodsSwitch({ selling: false }), 'Sell spare · ' + MODE_LINES.off);
  assert.equal(goodsSwitch({ mode: 'skip' }), 'Sell spare · Stops selling while the price is down.'); // its line (clarity fix 8h)
  for (const w of Object.values(MODE_LINES)) assert.doesNotMatch(w, /[:;]/);
  assert.equal(boomWord(BOOM.up, 72), 'Boom 1:12'); assert.equal(boomWord(BOOM.down, 44.2), 'Bust 0:45');
  assert.equal(boomWord(BOOM.up, 90).length, boomWord(BOOM.up, 5).length, 'one width');
  const e = EXPLAINERS.find(x => x.id === 'boom');
  assert.ok(e && e.covers.includes('boom'));
  const h = f => ({ boom: { good: 'ore', f, left: 80 }, boomChip: true, t: 5 });
  assert.ok(e.when(h(BOOM.up))); assert.ok(!e.when({ ...h(BOOM.up), boomChip: false }), 'only when its good is on the strip');
  for (const f of [BOOM.up, BOOM.down]) { const s = e.say(h(f)); assert.match(s, /Copper ore/); assert.match(s, /Sell spare/); assert.doesNotMatch(s, /[:;]/); }
  assert.match(e.say(h(BOOM.up)), /is up right now/); assert.match(e.say(h(BOOM.down)), /is down right now/);
});

test('no boom before a second town opens: Dry Creek and the first Gulch hour play as before', () => {
  const g = newGame('boom-11', 'drycreek');
  run(g, 1800); assert.equal(g.shared.market.started || 0, 0); assert.equal(g.shared.market.wait, BOOM.first);
  g.addTown('gulch'); run(g, 3600); assert.equal(g.shared.market.started || 0, 0, 'Dry Creek and the Gulch are one town and an outpost');
  g.addTown('ridge'); run(g, BOOM.first - 1); assert.equal(g.shared.market.started || 0, 0);
  run(g, 1); assert.equal(g.shared.market.started, 1, 'the first comes 8 minutes after Iron Ridge opens');
});
