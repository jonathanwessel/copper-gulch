// Rush and big contracts at the Capital (clarity fix 3b part 3a, PLAN.md M6a): each kind opens once the Capital has
// filled its count of contracts, once, with its card; an open kind comes up on the board while none of it is there or
// running; a rush one asks less, pays twice the Influence and has a clock that starts when it is taken; a big one asks
// much more and pays more for each minute; an old save past the count gets the kind too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, loadGame } from '../src/core/setup.js';
import { encode, decode, migrate, SAVE_VERSION } from '../src/core/save.js';
import { foundTown } from '../src/core/empire.js';
import { capitalOf, foundCapital, takeContract, dropContract } from '../src/core/capital.js';
import { CAPITAL_DEF } from '../src/data/capital.js';
import { EXPLAINERS } from '../src/data/explainers.js';
import { GOODS } from '../src/data/goods.js';

const F = CAPITAL_DEF.found, C = CAPITAL_DEF.contracts, K = C.kinds;
const run = (g, seconds) => { for (let i = 0; i < seconds * 4; i++) g.step(.25); };
function capital(seed = 'kinds') {
  const g = newGame(seed, 'gulch'), gu = g.town;
  gu.bestWave = 20; gu.coins = 1e9;
  foundTown(g, 'ridge');
  const r = g.towns.ridge;
  Object.assign(gu.buildings, { camp: 12, mine: 12, pit: 12, saw: 10, smelter: 10, kiln: 8, toolsmith: 4 });
  Object.assign(r.buildings, { rquarry: 12, ironmine: 12, colliery: 12, furnace: 10, steelmill: 8, rolling: 4, boilershop: 3 });
  for (const t of [gu, r, g.towns.pinehollow]) if (t.waves) t.waves.hold = true;
  r.bestWave = F.wave; gu.coins = 1e9;
  run(g, 30);
  assert.ok(foundCapital(g));
  return { g, c: capitalOf(g) };
}
/* Redraw the whole board until an offer of this kind is on it. */
function drawUntil(g, c, kind) {
  for (let i = 0; i < 60; i++) {
    const o = c.offers.find(x => x.kind === kind);
    if (o) return o;
    c.offers = []; run(g, C.retry + 1);
  }
  throw new Error('no ' + kind + ' offer in 60 boards');
}

test('no kind before its count, each opens once at it with its event, and its card covers it', () => {
  const { g, c } = capital('k1'), ev = g.bus.record();
  c.filled = K.rush.at - 1; run(g, 1);
  assert.deepEqual(c.opened, {}, 'nothing open one short of the rush count');
  for (let i = 0; i < 20; i++) { c.offers = []; run(g, C.retry + 1); assert.ok(c.offers.every(o => !o.kind), 'only plain offers'); }
  c.filled = K.rush.at; run(g, 1);
  assert.deepEqual(c.opened, { rush: true });
  c.filled = K.big.at; run(g, 1); run(g, 1);
  assert.deepEqual(c.opened, { rush: true, big: true });
  const news = ev.filter(([n]) => n === 'contract:new').map(([, e]) => e.kind);
  assert.deepEqual(news, ['rush', 'big'], 'one contract:new each');
  for (const k of ['rush', 'big']) assert.ok(EXPLAINERS.find(e => e.covers.includes('contract:' + k)).when({ contractKinds: c.opened }), k + ' card shows');
});

test('a rush offer asks less, pays twice the Influence for its minutes and has a clock that fits its ask', () => {
  const { g, c } = capital('k2');
  c.filled = K.big.at; run(g, 1);
  const o = drawUntil(g, c, 'rush'), tier = GOODS[o.good].tier;
  assert.ok(o.minutes >= K.rush.minutes[0] && o.minutes <= K.rush.minutes[1], 'its own short ask');
  assert.equal(o.influence, Math.max(1, Math.round(C.influence[tier] * o.minutes / C.per * K.rush.influence)));
  assert.ok(o.time > 0 && o.time % 10 === 0, 'a clock in whole tens of seconds');
  assert.ok(c.offers.filter(x => x.kind === 'rush').length === 1, 'one rush offer on the board at most');
  const b = drawUntil(g, c, 'big');
  assert.ok(b.minutes >= K.big.minutes[0] && b.minutes <= K.big.minutes[1] && b.time === undefined, 'a big one asks for long and has no clock');
  assert.ok(b.influence / b.minutes >= .9 * C.influence[GOODS[b.good].tier] / C.per * K.big.influence, 'big pays its Influence for each minute');
});

test('a rush clock starts when taken; it pays when filled in time and is lost, unpaid, when it runs out', () => {
  const { g, c } = capital('k3'), ev = g.bus.record();
  c.filled = K.rush.at; run(g, 1);
  let o = drawUntil(g, c, 'rush');
  run(g, 5);
  assert.equal(c.offers.find(x => x.id === o.id).left, undefined, 'no clock on the board');
  assert.ok(takeContract(g, o.id));
  assert.equal(c.active.left, o.time);
  // filled in time: the town sends by itself
  const inf0 = c.influence;
  c.active.got = c.active.need; run(g, 1);
  assert.ok(!c.active || c.active.id !== o.id, 'done');
  assert.ok(c.influence > inf0, 'paid its Influence');
  // run out: nothing paid, the board fills again
  o = drawUntil(g, c, 'rush');
  assert.ok(takeContract(g, o.id));
  const town = g.towns[o.town]; town.goods[o.good] = 0; const coins0 = g.shared.purse.coins, inf1 = c.influence;
  c.active.got = 0; c.active.need = 1e12; // never filled
  run(g, o.time + 2);
  assert.equal(c.active, null, 'the rush contract ended');
  assert.equal(c.influence, inf1, 'no Influence');
  assert.ok(g.shared.purse.coins <= coins0 + 1e6, 'no contract coins');
  assert.equal(c.missed, 1);
  assert.equal(ev.filter(([n, e]) => n === 'contract:miss' && e.id === o.id).length, 1);
  assert.equal(c.offers.length, C.board, 'the board fills again');
  assert.ok(dropContract(g) === false);
});

test('an old save (v27) past both counts gets both kinds on its first step, with their news', () => {
  const { g, c } = capital('k4');
  c.filled = 15; delete c.opened; delete c.missed;
  const old = JSON.parse(encode(g, 0)); old.v = 27; delete old.game.shared.capital.opened; delete old.game.shared.capital.missed;
  const s = migrate(old);
  assert.equal(s.v, SAVE_VERSION);
  assert.deepEqual(s.game.shared.capital.opened, {});
  const g2 = loadGame(s.game), ev = g2.bus.record();
  run(g2, 1);
  assert.deepEqual(capitalOf(g2).opened, { rush: true, big: true });
  assert.deepEqual(ev.filter(([n]) => n === 'contract:new').map(([, e]) => e.kind), ['rush', 'big']);
  void decode;
});
