// Clarity fix 6 (PLAN.md M6a, review 6): a stalled workshop says why. town.stall counts the seconds a built workshop
// has run under half its rate for want of a good; stallOf names the good and the building that makes it; the goal
// strip asks for that building while a goal needs it, in this town or (feedStep) in the town that makes it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { produce } from '../src/core/economy.js';
import { stallOf, stallWords, stallFix, goodStall, STALL_SECONDS } from '../src/core/stall.js';
import { goalNow, goalText } from '../src/core/goals.js';
import { GOALS } from '../src/data/goals.js';

const run = (t, s) => { for (let i = 0; i < s * 4; i++) produce(t, .25); };
/* Iron Ridge in play beside the Gulch, its goals done up to "upgrade the Boiler Shop to level 5", and a Boiler Shop
   at level 10 behind a Steel Mill at level 3 (about a quarter of the steel it needs). */
function ridge() {
  const g = newGame('stall', 'gulch');
  g.addTown('ridge');
  g.active = 'ridge';
  const r = g.towns.ridge, gu = g.towns.gulch, done = g.shared.goals.done;
  for (const x of GOALS) { if (x.id === 'r-boiler5') break; if (x.town === 'ridge') done[x.id] = true; }
  for (const t of [r, gu]) Object.assign(t.waves, { phase: 'break', timer: 999, hold: false });
  Object.assign(r.buildings, { rquarry: 5, ironmine: 5, colliery: 3, furnace: 3, steelmill: 3, boilershop: 10 });
  Object.assign(gu.buildings, { camp: 5, pit: 5, kiln: 1 }); Object.assign(gu.goods, { clay: 1e6, timber: 1e6 });
  Object.assign(r.goods, { pigiron: 1e6, coal: 1e6, bricks: 1e6, steel: 0 });
  return { g, r, gu };
}

test('a workshop short of a good for a while is stalled, and names the good and its maker', () => {
  const { g, r } = ridge();
  run(r, STALL_SECONDS / 2);
  assert.equal(stallOf(g, r, 'boilershop'), null, 'not after a moment');
  run(r, STALL_SECONDS);
  const s = stallOf(g, r, 'boilershop');
  assert.ok(s, 'stalled after a while');
  assert.equal(s.good, 'steel');
  assert.deepEqual(s.maker, { town: 'ridge', id: 'steelmill', built: true });
  assert.equal(stallWords(g, r, s), 'Waits for steel from the Steel Mill');
  assert.equal(stallFix(g, r, s), 'Upgrade the Steel Mill');
  assert.equal(stallWords(g, r, goodStall(g, r, 'boilers')), 'Waits for steel from the Steel Mill', 'the Goods row of boilers');
  assert.equal(stallOf(g, r, 'steelmill'), null, 'its maker runs');
  // fed again, it clears within a little while and does not flicker back
  r.goods.steel = 1e6;
  run(r, 30);
  assert.equal(stallOf(g, r, 'boilershop'), null);
});

test('a workshop held back for the towers is stalled too, so the strip looks past it', () => {
  const { g, r } = ridge();
  r.goods.steel = 1e5; r.keepUse = { steel: 1e6 };
  run(r, 40);
  const s = stallOf(g, r, 'boilershop');
  assert.ok(s && s.held, 'held for towers');
  assert.equal(s.good, 'steel');
});

test('the strip asks for the maker in this town while a goal needs it', () => {
  const { g, r } = ridge();
  const before = goalNow(g);
  assert.equal(before.id, 'r-boiler5', 'no stall yet: the goal itself');
  run(r, 40);
  const s = goalNow(g);
  assert.equal(s.text, 'Tap the Steel Mill and upgrade it. The Boiler Shop needs more steel');
  assert.deepEqual(s.at({}), { plot: 'steelmill' });
  r.goods.steel = 1e6; run(r, 40);
  assert.equal(goalNow(g).id, 'r-boiler5', 'the step goes with the stall');
});

test('a maker in another town: the strip sends the player there, and that town asks for it', () => {
  const { g, r } = ridge();
  Object.assign(r.goods, { steel: 1e6, bricks: 0 });
  run(r, 40);
  const s = goalNow(g);
  assert.equal(s.text, 'Tap Map, Copper Gulch, then upgrade the Kiln. The Boiler Shop needs more bricks');
  assert.deepEqual(s.there, ['gulch', 'kiln']);
  assert.equal(s.at({ back: null }).go, 'gulch');
  assert.equal(stallWords(g, r, stallOf(g, r, 'boilershop')), 'Waits for bricks from Copper Gulch');
  g.prev = 'gulch';
  assert.equal(goalText(g, r, s), 'Tap ◂ Copper Gulch, then upgrade the Kiln. The Boiler Shop needs more bricks', 'the back button by name');
  g.active = 'gulch';
  const f = goalNow(g);
  assert.equal(f.text, 'Tap the Kiln and upgrade it. Iron Ridge needs more bricks');
  assert.deepEqual(f.at({}), { plot: 'kiln' });
  r.goods.bricks = 1e6; run(r, 40);
  assert.notEqual(goalNow(g).id, f.id, 'gone once the Ridge has bricks');
});
