// A foreman never raises a workshop past what a shipped input can feed (2026.11.22-8: during a wire boom the Falls'
// Wire Mill foreman bought 15 levels in three minutes on Gulch copper that could feed about a third of them, and the
// mill sat starved for the rest of the hour). It waits, short of that good, until the town that makes it makes more.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { foundTown } from '../src/core/empire.js';
import { output, uses } from '../src/core/economy.js';
import { IMPORT_SLACK, importShort, foremanWait } from '../src/core/foremen.js';

function falls() {
  const g = newGame('imp', 'gulch');
  g.addTown('ridge');
  g.towns.ridge.bestWave = 60; g.town.coins = 1e9; g.shared.charter.deeds = 5;
  foundTown(g, 'falls');
  return g;
}

test('the next Wire Mill level waits on Gulch copper once it would use more than the Smelter makes, with some slack', () => {
  const g = falls(), gu = g.towns.gulch, f = g.towns.falls;
  gu.buildings.smelter = 10;
  const make = output(gu, 'smelter');
  // the highest level the Smelter feeds with the slack, and one more
  let L = 1;
  for (; L < 200; L++) { f.buildings.wiremill = L + 1; if (uses(f, 'wiremill', 'copper') * output(f, 'wiremill') > IMPORT_SLACK * make) break; }
  f.buildings.wiremill = L - 1;
  assert.equal(importShort(g, f, 'wiremill'), null, 'level ' + L + ' is fed');
  f.buildings.wiremill = L;
  assert.equal(importShort(g, f, 'wiremill'), 'copper', 'level ' + (L + 1) + ' outruns the Smelter');
  assert.deepEqual(foremanWait(g, f, 'wiremill'), { why: 'short', good: 'copper' });
  // a bigger Smelter lets it grow again
  gu.buildings.smelter = 30;
  assert.equal(importShort(g, f, 'wiremill'), null);
});

test('a town with no shipped inputs never waits on them', () => {
  const g = falls(), gu = g.towns.gulch;
  gu.buildings.saw = 40; gu.buildings.camp = 1;
  assert.equal(importShort(g, gu, 'saw'), null);
});
