// M3, Bots for Iron Ridge and Pine Hollow: the goal strip lines for founding the Ridge, the numbers the bots tuned
// (the Ridge's price, Pine Hollow's bounty and start, the Boiler Shop's place in the chain), and the careful player's
// helpers (saving with the waves held, raising the Gulch's makers when the Ridge runs short of what they ship).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { goalNow, goalText, goalContext } from '../src/core/goals.js';
import { setHold, wavesOf } from '../src/core/defense.js';
import { canFound, foundTown } from '../src/core/empire.js';
import { WAVE } from '../src/data/foes.js';
import { BUILDINGS } from '../src/data/buildings.js';
import { TOWNS } from '../src/data/towns/index.js';
import { GOALS } from '../src/data/goals.js';
import { tendImports, play } from '../tools/balance.js';
import { goalTap } from '../tools/firstplay.js';
import { Rng } from '../src/core/rng.js';

/* A Gulch past its early goals, at best wave `wave` with `coins`. */
function gulch(seed, wave, coins) {
  const g = newGame(seed, 'gulch'), t = g.town;
  for (const x of GOALS) if (x.town === 'gulch' && !x.within) g.shared.goals.done[x.id] = true;
  t.bestWave = wave; t.coins = coins;
  return g;
}

test('the goal strip says to hold the waves and save for Iron Ridge, then to tap it, once wave 20 is beaten', () => {
  let g = gulch('rb1', 19, 0);
  assert.equal(goalNow(g), null, 'nothing before wave 20');
  g = gulch('rb1', 20, 500);
  const hold = goalNow(g);
  assert.equal(hold.id, 'g-hold');
  assert.equal(hold.text, 'Tap Hold waves so raids cannot cost you coins');
  assert.deepEqual(hold.at(goalContext(g, g.town)), { el: '#holdWaves' });
  g.town.waves.hold = true; g.step(.25); // held: that step is done, and the next one counts the coins
  const save = goalNow(g);
  assert.equal(save.id, 'g-save');
  assert.equal(goalText(g, g.town, save), 'Save coins to open Iron Ridge');
  assert.equal(save.need, TOWNS.ridge.found.coins, 'the strip counts up to the real price');
  assert.deepEqual(save.at(goalContext(g, g.town)), { el: '#coins' });
  g.town.waves.hold = false;
  g.town.coins = 15000;
  const go = goalNow(g);
  assert.equal(go.id, 'g-found');
  assert.equal(go.text, 'Tap Map, Iron Ridge, then Start Iron Ridge');
  assert.deepEqual(go.at({ back: 'drycreek' }), { el: '#mapBtn', go: 'ridge' });
  foundTown(g, 'ridge'); g.step(.25);
  assert.ok(g.shared.goals.done['g-save'] && g.shared.goals.done['g-found'], 'both done once the Ridge is founded');
  assert.equal(goalNow(g), null);
});

test('the newcomer follows those lines: it taps Hold waves, then founds the Ridge and goes there', () => {
  const g = gulch('rb2', 22, 100), rng = new Rng('rb2');
  const hold = goalTap(g, g.town, rng);
  assert.equal(hold.what, 'hold');
  assert.ok(hold.run());
  assert.equal(g.town.waves.hold, true);
  assert.equal(goalTap(g, g.town, rng), null, 'nothing to tap while it saves');
  g.town.coins = 16000;
  const go = goalTap(g, g.town, rng);
  assert.deepEqual([go.what, go.label], ['go', 'ridge']);
  assert.ok(go.run());
  assert.equal(g.active, 'ridge');
  assert.equal(g.towns.gulch.coins, 1000 + g.defs.ridge.start.coins + g.defs.pinehollow.start.coins);
});

test('Pine Hollow: raiders pay three times the usual bounty and its waves are softer, since timber sells for little by then', () => {
  const ph = { def: TOWNS.pinehollow };
  for (const w of [1, 5, 15]) {
    assert.ok(Math.abs(wavesOf(ph).bounty(w) - 3 * WAVE.bounty(w)) < 1e-9);
    assert.ok(Math.abs(wavesOf(ph).hp(w) - .7 * WAVE.hp(w)) < 1e-9);
  }
  assert.equal(wavesOf(ph).pace, 60);
  assert.equal(TOWNS.pinehollow.start.coins, 150);
});

test('the Boiler Shop comes early in the Ridge: Steel Mill at Blast Furnace 3, Boiler Shop at Steel Mill 3', () => {
  assert.deepEqual(BUILDINGS.steelmill.needs, { furnace: 3 });
  assert.deepEqual(BUILDINGS.boilershop.needs, { steelmill: 3 });
  assert.ok(BUILDINGS.boilershop.needs.steelmill < BUILDINGS.rolling.needs.steelmill, 'it opens before the Rolling Mill');
});

test('tendImports raises the Gulch\'s Kiln, or the Clay Pit that feeds it, when the Boiler Shop runs short of bricks', () => {
  const g = gulch('rb3', 20, 2e5); foundTown(g, 'ridge'); g.go('ridge');
  const G = g.towns.gulch, r = g.towns.ridge, imp = { raised: [] };
  Object.assign(G.buildings, { camp: 10, pit: 5, kiln: 1 });
  Object.assign(r.buildings, { steelmill: 3, boilershop: 1 });
  r.goods.steel = 100; r.goods.bricks = 0; r.starved = { boilershop: true };
  G.starved = {};
  tendImports(g, r, imp);
  assert.equal(G.level('kiln'), 2);
  G.starved = { kiln: true }; G.goods.clay = 0; G.goods.timber = 50;
  tendImports(g, r, imp);
  assert.equal(G.level('pit'), 6, 'the Kiln is short of clay, so the Clay Pit goes up');
  assert.equal(imp.raised.length, 2);
  r.goods.bricks = 5; G.starved = {};
  tendImports(g, r, imp);
  assert.equal(imp.raised.length, 2, 'nothing while the Ridge has bricks');
});

test('saving: the careful player holds the waves, switches foremen off and keeps its coins, then lets go', () => {
  const g = newGame('rb4', 'gulch'), t = g.town;
  t.buildings.camp = 12; t.foremen = { camp: true }; t.coins = 5000;
  let on = true; const bought = [];
  for (const ev of ['tower:build', 'tower:upgrade', 'research:start', 'foreman:hire']) g.bus.on(ev, () => bought.push(ev));
  const r = play(4, 1, 'active', null, { game: g, save: () => on, until: tt => tt.t >= 30 });
  assert.equal(t.waves.hold, true);
  assert.equal(t.foremen.camp, false);
  assert.ok(r.saving !== undefined);
  assert.deepEqual(bought, [], 'no towers, research or foremen while it saves');
  assert.ok(!t.lab);
  on = false;
  play(4, 1, 'active', null, { game: g, save: () => on, until: tt => tt.t >= 40 });
  assert.equal(t.waves.hold, false);
});
