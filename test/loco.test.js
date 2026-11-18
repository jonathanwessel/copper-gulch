// M3, the Locomotive Works on Gulch tools: the Ridge's goal strip leads to its top workshop, sends the player to the
// Gulch for a Toolsmith, and the careful bot follows it (tools/balance.js, goalBuilding and tendImports).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { goalNow } from '../src/core/goals.js';
import { foundTown } from '../src/core/empire.js';
import { unlocked } from '../src/core/economy.js';
import { BUILDINGS } from '../src/data/buildings.js';
import { GOALS } from '../src/data/goals.js';
import { goalBuilding, tendImports } from '../tools/balance.js';

/* A game with the Gulch built up and Iron Ridge founded and in play. */
function ridge(seed) {
  const g = newGame(seed, 'gulch'), t = g.town;
  for (const x of GOALS) if (x.town === 'gulch' && !x.within) g.shared.goals.done[x.id] = true;
  t.bestWave = 20; t.coins = 1e6;
  foundTown(g, 'ridge'); g.go('ridge');
  return g;
}
const build = (t, levels) => Object.assign(t.buildings, levels);

test('the Locomotive Works opens at Rolling Mill 5 and Boiler Shop 5', () => {
  assert.deepEqual(BUILDINGS.loco.needs, { rolling: 5, boilershop: 5 });
  assert.equal(BUILDINGS.loco.cost, 15000);
  assert.equal(BUILDINGS.rolling.cost, 3000);
});

test('the Ridge goal strip walks the chain to the Locomotive Works', () => {
  const g = ridge('lw1'), r = g.towns.ridge, seen = [];
  const next = () => { g.step(.25); const x = goalNow(g); seen.push(x && x.id); return x; };
  build(r, { ironmine: 5, colliery: 3 });
  assert.equal(next().id, 'r-furnace');
  assert.deepEqual(goalNow(g).at(), { plot: 'furnace' });
  build(r, { furnace: 3 }); build(r, { steelmill: 3 });
  assert.equal(next().id, 'r-boiler');
  build(r, { boilershop: 1 });
  assert.equal(next().id, 'r-steel5');
  build(r, { steelmill: 5 });
  assert.equal(next().id, 'r-rolling');
  build(r, { rolling: 1 });
  const tools = next();
  assert.equal(tools.id, 'r-tools');
  assert.equal(tools.text, 'Go to Copper Gulch and build a Toolsmith there');
  assert.deepEqual(tools.at({ back: 'gulch' }), { el: '#backBtn', go: 'gulch' }, 'the back button goes there');
  assert.deepEqual(tools.at({ back: 'pinehollow' }), { el: '#mapBtn', go: 'gulch' }, 'else Map');
  assert.deepEqual(tools.there, ['gulch', 'toolsmith']);
  g.towns.gulch.buildings.toolsmith = 1;
  assert.equal(next().id, 'r-rolling5');
  build(r, { rolling: 5 });
  assert.equal(next().id, 'r-boiler5');
  build(r, { boilershop: 5 });
  assert.ok(unlocked(r, 'loco'));
  assert.equal(next().id, 'r-loco');
  build(r, { loco: 1 });
  assert.equal(next(), null);
  assert.ok(g.shared.goals.done['g-tools'], 'the Gulch line for the Toolsmith is done too');
});

test('in Copper Gulch the strip asks for the Toolsmith once the Ridge has its Rolling Mill', () => {
  const g = ridge('lw2');
  g.go('gulch'); g.step(.25);
  assert.notEqual((goalNow(g) || {}).id, 'g-tools');
  g.towns.ridge.buildings.rolling = 1; g.step(.25);
  const x = goalNow(g);
  assert.equal(x.id, 'g-tools');
  assert.deepEqual(x.at(), { plot: 'toolsmith' });
});

test('the careful bot reads a goal in another town as the next level that opens its building there', () => {
  const g = ridge('lw3'), r = g.towns.ridge, gt = g.towns.gulch;
  build(r, { ironmine: 5, colliery: 3, furnace: 3, steelmill: 5, boilershop: 1, rolling: 1 });
  for (const id of ['r-furnace', 'r-boiler', 'r-steel5', 'r-rolling']) g.shared.goals.done[id] = true;
  assert.equal(goalNow(g).id, 'r-tools');
  build(gt, { camp: 10, mine: 6, saw: 4, smelter: 5 });
  let gb = goalBuilding(g, r);
  assert.equal(gb.town, gt); assert.equal(gb.id, 'saw', 'the Sawmill is what still keeps the Toolsmith locked');
  gt.buildings.saw = 10;
  gb = goalBuilding(g, r);
  assert.equal(gb.id, 'toolsmith');
  // a goal on this town's own board names its plot, once it can be built
  gt.buildings.toolsmith = 1; g.step(.25);
  assert.equal(goalNow(g).id, 'r-rolling5');
  assert.deepEqual(goalBuilding(g, r), { town: r, id: 'rolling' });
});

test('once a workshop that uses tools is on its way, the bot gets the Gulch its first Toolsmith', () => {
  const g = ridge('lw4'), r = g.towns.ridge, gt = g.towns.gulch, imp = { raised: [] };
  build(gt, { camp: 10, saw: 10, mine: 6, smelter: 5 }); delete gt.buildings.toolsmith;
  tendImports(g, r, imp);
  assert.equal(gt.level('toolsmith'), 0, 'nothing uses tools yet');
  build(r, { ironmine: 5, colliery: 3, furnace: 3, steelmill: 5, boilershop: 1, rolling: 1 });
  tendImports(g, r, imp);
  assert.equal(gt.level('toolsmith'), 1);
  assert.ok(imp.raised.some(x => x.startsWith('toolsmith')));
});
