// Evaluation 2: the newcomer never played Pine Hollow, since nothing on the goal strip sent it there. The Ridge's strip
// now sends the player to win it, Pine Hollow's own strip walks to the win, then sends the player back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { goalNow, goalText } from '../src/core/goals.js';
import { foundTown } from '../src/core/empire.js';
import { GOALS } from '../src/data/goals.js';
import { winOutpost } from '../src/core/outpost.js';

function ridge(seed) {
  const g = newGame(seed, 'gulch'), t = g.town;
  for (const x of GOALS) if (x.town === 'gulch' && !x.within) g.shared.goals.done[x.id] = true;
  t.bestWave = 20; t.coins = 1e6;
  foundTown(g, 'ridge'); g.go('ridge');
  return g;
}

test('the Ridge sends the player to Pine Hollow after its first workshop, until Pine Hollow is won', () => {
  const g = ridge('ph1'), r = g.towns.ridge;
  Object.assign(r.buildings, { ironmine: 5, colliery: 3 }); g.step(.25);
  assert.equal(goalNow(g).id, 'r-furnace', 'the Ridge first');
  r.buildings.furnace = 1; g.step(.25);
  const x = goalNow(g);
  assert.equal(x.id, 'r-pine');
  assert.equal(goalText(g, g.town, x), 'Tap Map, Pine Hollow, then Play Pine Hollow');
  g.go('pinehollow'); g.step(.25); g.go('ridge'); g.step(.25);
  assert.equal(goalNow(g).id, 'r-pine', 'a visit alone is not enough, the strip asks until it is won');
  g.towns.pinehollow.won = true; g.step(.25);
  assert.notEqual((goalNow(g) || {}).id, 'r-pine');
});

test('Pine Hollow walks to its win, then sends the player back to Iron Ridge', () => {
  const g = ridge('ph2'); g.go('pinehollow'); g.step(.25);
  const p = g.towns.pinehollow;
  assert.equal(goalNow(g).id, 'p-tower');
  p.towers.push({ spot: 0, kind: 'crossbow', level: 1, path: null, cd: 0, spent: 0, pulses: 0 }); g.step(.25);
  p.buildings.logcamp = Math.max(2, p.level('logcamp'));
  g.step(.25);
  assert.equal(goalNow(g).id, 'p-clay');
  p.buildings.claybank = 1; g.step(.25);
  assert.equal(goalNow(g).id, 'p-three');
  for (const s of [1, 2]) p.towers.push({ spot: s, kind: 'crossbow', level: 1, path: null, cd: 0, spent: 0, pulses: 0 });
  g.step(.25);
  assert.equal(goalNow(g).id, 'p-win');
  winOutpost(g, p); g.step(.25);
  assert.ok(p.won);
  const back = goalNow(g);
  assert.equal(back.id, 'p-back');
  assert.deepEqual(back.at({ back: 'ridge' }), { el: '#backBtn', go: 'ridge' });
  g.go('ridge'); g.step(.25);
  assert.ok(g.shared.goals.done['p-back']);
});
