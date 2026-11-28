// Clarity fix 8z (one state one source for outposts): a town's map card names each outpost that tops it up, before any
// goods have moved (outpostFeeds in src/core/map.js, feedLine in src/ui/map.js), and outposts are called outposts on
// their welcome cards, as on the map.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { outpostFeeds } from '../src/core/map.js';
import { feedLine } from '../src/ui/map.js';
import { EXPLAINERS } from '../src/data/explainers.js';

test('the Mesa names Tar Seep for its crude oil and rubber before any has moved', () => {
  const g = newGame('8z', 'gulch'); g.addTown('mesa'); g.addTown('tarseep');
  assert.ok(!Object.keys(g.towns.mesa.drawn || {}).length, 'nothing drawn yet');
  const f = outpostFeeds(g, 'mesa').find(x => x.from === 'tarseep');
  assert.ok(f, 'Tar Seep feeds the Mesa');
  assert.deepEqual([...f.goods].sort(), ['oil', 'rubber']);
  assert.match(feedLine(f, 'mesa'), /^Tar Seep sends .*crude oil.* and rubber when Thunder Mesa runs low\.$/);
  assert.deepEqual(outpostFeeds(g, 'tarseep'), [], 'an outpost has no feeds of its own');
});

test('an outpost not open yet is not named', () => {
  const g = newGame('8z2', 'gulch'); g.addTown('mesa');
  assert.equal(outpostFeeds(g, 'mesa').filter(x => x.from === 'tarseep').length, 0);
});

test('every outpost welcome card says outpost, never camp', () => {
  for (const e of EXPLAINERS.filter(x => /-welcome$/.test(x.id) && ['drycreek', 'pinehollow', 'sandybend', 'tarseep'].includes(x.town))) {
    assert.match(e.text, /outpost/, e.id);
    assert.doesNotMatch(e.text, /\bcamp\b/, e.id);
  }
});
