// M5, Bots for Silver Falls and Sandy Bend: the careful player's helpers for the Falls (a pad's reach counts the river,
// the Water Wheel comes first when the grid is short, the import and grid bookkeeping), the Falls' goal strip, and the
// numbers the bots tuned (the Falls' price).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { foundTown } from '../src/core/empire.js';
import { gridOf } from '../src/core/economy.js';
import { goalNow, goalText } from '../src/core/goals.js';
import { GOALS } from '../src/data/goals.js';
import { TOWNS } from '../src/data/towns/index.js';
import { cover, gridFirst, fallsTick, goalBuilding } from '../tools/balance.js';

/* A game in Silver Falls, founded from a Ridge at the Falls' wave. */
function falls(seed) {
  const g = newGame(seed, 'gulch');
  g.addTown('ridge');
  const f = TOWNS.falls.found;
  g.towns.ridge.bestWave = f.wave; g.town.coins = f.coins * 2; g.shared.charter.deeds = f.deeds;
  assert.ok(foundTown(g, 'falls'));
  g.go('falls');
  for (const x of GOALS) if (x.town !== 'falls') g.shared.goals.done[x.id] = true;
  return g;
}

test('a pad by the river counts the river it reaches as well as the road', () => {
  const g = falls('fb1'), t = g.town, ridge = g.towns.ridge;
  // pad 1 sits between the Quartz Mine and the water: it reaches both, and the river adds to its road
  const both = cover(t, 1, 0, 2.4);
  const roadOnly = (() => { const b = t.def.board, keep = b.river; delete b.river; try { return cover({ def: { ...t.def, board: { ...b } } }, 1, 0, 2.4); } finally { b.river = keep; } })();
  assert.ok(both > 0 && roadOnly > 0);
  assert.notEqual(both, roadOnly, 'the river changes what the pad covers');
  // a town with no river counts its road as before
  assert.ok(cover(ridge, 0, 0, 2.4) > 0);
});

test('the careful player raises the Water Wheel when the grid is short, or when the next level would make it short', () => {
  const g = falls('fb2'), t = g.town;
  t.buildings = { sandpit: 8, waterwheel: 1, glassworks: 2 };
  assert.equal(gridOf(t).share, 1);
  assert.equal(gridFirst(t, 'sandpit'), 'sandpit', 'not on the grid: its pick stands');
  assert.equal(gridFirst(t, 'glassworks'), 'waterwheel', 'one more Glassworks level would leave the grid short');
  t.buildings.waterwheel = 6;
  assert.equal(gridFirst(t, 'glassworks'), 'glassworks', 'the grid has room');
  t.buildings = { sandpit: 8, waterwheel: 1, glassworks: 4 };
  assert.ok(gridOf(t).share < 1);
  assert.equal(gridFirst(t, 'sandpit'), 'waterwheel', 'short now: the wheel first');
  assert.equal(gridFirst(g.towns.ridge, 'steelmill'), 'steelmill', 'a town with no grid is left alone');
});

test('the Falls bookkeeping counts a Wire Mill short of copper against the imports, and a short grid apart', () => {
  const g = falls('fb3'), t = g.town, imp = { run: {}, built: {}, short: {}, raised: [], at: {} };
  t.buildings = { sandpit: 8, waterwheel: 1, glassworks: 3, wiremill: 1 };
  t.starved = { wiremill: true }; t.goods.copper = 0;
  fallsTick(t, imp);
  assert.equal(imp.built.wiremill, 1);
  assert.equal(imp.run.wiremill || 0, 0, 'no copper: held up by the import');
  t.goods.copper = 50;
  fallsTick(t, imp);
  assert.equal(imp.run.wiremill, 1, 'copper on hand: a short grid is not the import\'s fault');
  assert.ok(imp.gridN >= 2 && imp.grid > 0, 'the grid share is averaged over the seconds');
});

test('the Falls goal strip walks up the chain and sends the player to the town that makes a missing import', () => {
  const g = falls('fb4'), t = g.town;
  g.shared.capital.open = true; // the Capital comes before the Falls in play; while only its coins are missing its save leads the strip
  let gl = goalNow(g);
  assert.equal(gl.id, 'f-sand4', 'on arrival the strip has a step: the Sand Pit opens the next buildings');
  assert.equal(gl.text, 'Tap the Sand Pit and upgrade it to level 4');
  t.buildings = { sandpit: 4 }; g.step(.25);
  gl = goalNow(g);
  assert.equal(gl.id, 'f-wheel');
  assert.equal(goalText(g, t, gl), 'Tap the Water Wheel lot, then tap Build');
  t.buildings = { sandpit: 8, waterwheel: 5, glassworks: 3, wiremill: 1 };
  g.towns.gulch.buildings = { camp: 5, mine: 5 };
  g.step(.25);
  gl = goalNow(g);
  assert.equal(gl.id, 'f-copper');
  assert.equal(gl.text, 'Tap Map, Copper Gulch, then build a Smelter');
  assert.deepEqual(gl.at({ back: 'ridge' }), { el: '#mapBtn', go: 'gulch' });
  const gb = goalBuilding(g, t);
  assert.equal(gb.town, g.towns.gulch, 'the bot reads the town the goal names');
  g.towns.gulch.buildings.smelter = 1; g.step(.25);
  assert.ok(g.shared.goals.done['f-copper']);
  for (const x of GOALS.filter(x => x.town === 'falls')) assert.ok(x.within >= 360, x.id + ' has a time for the bots');
});

test('Silver Falls costs Ridge wave 52, 1M coins and 5 deeds (tuned by the Falls bots)', () => {
  const f = TOWNS.falls.found;
  assert.deepEqual([f.wave, f.coins, f.deeds], [52, 1e6, 5]);
});
