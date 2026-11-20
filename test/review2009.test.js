// M5, words and layout from the screenshot review of 2026.11.20-9: one verb (Upgrade) for buying levels, the Keep
// switches split into how much (Goods) and which good (building cards), price words as a share of the good's best
// price, the old-wave bonus says what earns it, Iron Ridge opens with goals, the Gulch can pay its first Crossbow, and
// a place ready to build is not drawn locked on the map.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { newGame } from '../src/core/setup.js';
import { goalNow } from '../src/core/goals.js';
import { foundTown } from '../src/core/empire.js';
import { GOALS } from '../src/data/goals.js';
import { TOWERS } from '../src/data/towers.js';
import { TOWNS } from '../src/data/towns/index.js';
import { EXPLAINERS } from '../src/data/explainers.js';
import { oldWavesLabel } from '../src/core/explain.js';
import { priceWord, STOCK_LABEL, stockWords, leftWord, span } from '../src/ui/sheets.js';
import { foremanLine } from '../src/ui/explain.js';
import { textIssues } from '../tools/audit.js';

const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('buying a level is called Upgrade everywhere players read it', () => {
  const old = ['Raises one tower', 'Next raise', 'raises a tower', 'Raising a tower', 'Nothing to raise', 'raise a tower', 'Raise a building', 'Buys building levels', 'buys its levels', "'Buys level '", 'Foreman buys levels'];
  for (const f of ['src/ui/sheets.js', 'src/ui/lost.js', 'src/ui/play.js']) for (const s of old) assert.ok(!read(f).includes(s), f + ' still says ' + s);
  for (const e of EXPLAINERS) assert.doesNotMatch(e.text, /\braise/i, e.id);
});

test('Goods says how much it keeps, each building card which good, and prices read as a share of the best', () => {
  assert.equal(STOCK_LABEL, 'Keep for towers');
  assert.equal(stockWords({ stock: 'normal' }), 'Next 2 levels');
  assert.ok(read('src/ui/play.js').includes("'Keep for towers'"));
  assert.equal(priceWord(1), 'Full price');
  assert.equal(priceWord(.4), 'Down 60%');
  assert.equal(priceWord(.001), 'Down 99%');
  for (const s of [.99, .5, .01]) assert.ok(priceWord(s).length <= 11);
});

test('the old-wave bonus names the wave that earns it, and research says time one way', () => {
  assert.equal(oldWavesLabel({ record: 22 }), 'Under best wave 22');
  assert.ok(oldWavesLabel({ record: 120 }).length <= 20);
  assert.equal(span(80), '80 sec'); assert.equal(leftWord(13), '13 sec left'); assert.equal(span(600), '10 min');
  assert.equal(foremanLine('flooded', 'timber'), 'Foreman paused while the timber price is low.');
  for (const s of ['Foreman paused while the timber price is low.', 'Tap Hold waves so no wave can cost you coins']) assert.deepEqual(textIssues(s), []);
});

test('Iron Ridge opens with a goal and walks to the Blast Furnace', () => {
  const g = newGame('r2009', 'gulch'), t = g.town;
  for (const x of GOALS) if (x.town === 'gulch') g.shared.goals.done[x.id] = true;
  t.bestWave = 20; t.coins = 1e6; foundTown(g, 'ridge'); g.go('ridge'); g.step(.25);
  const r = g.towns.ridge;
  assert.equal(goalNow(g).id, 'r-quarry');
  r.buildings.rquarry = 5; g.step(.25);
  assert.equal(goalNow(g).id, 'r-mine');
  r.buildings.ironmine = 5; g.step(.25);
  assert.equal(goalNow(g).id, 'r-coal');
  r.buildings.colliery = 3; g.step(.25);
  assert.equal(goalNow(g).id, 'r-furnace');
});

test('a fresh Copper Gulch can pay its first Crossbow in coins, so its first goal waits only on timber', () => {
  assert.ok(TOWNS.gulch.start.coins >= TOWERS.crossbow.coins);
});

test('a place ready to build is not drawn locked on the map', () => {
  assert.match(read('src/ui/map.js'), /&& !lockedRules\(game, s\.id\)\.ready\)/);
  assert.match(read('src/ui/map.js'), /B\.vault\.hidden = !!st;/);
});
