// Review fixes left from 2026.11.23-9 to -11 (PLAN.md M6a, the batched box): what the screen shows, checked through
// the functions that make it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { idlePick, priceRow } from '../src/ui/sheets.js';
import { researchCost, researchBlock, itemsOf, startResearch } from '../src/core/research.js';

test('an idle town gets a Start button on another place\'s Research sheet, with the cheapest item it can pay for', () => {
  const g = newGame('r1', 'gulch'), t = g.town;
  assert.equal(idlePick(t), null, 'no research open yet');
  t.flags['open:research'] = true; t.coins = 0;
  assert.equal(idlePick(t), null, 'nothing it can pay for');
  t.coins = 1e9;
  const pick = idlePick(t), open = itemsOf(t).filter(id => !researchBlock(t, id));
  assert.ok(pick && open.includes(pick));
  assert.equal(researchCost(t, pick), Math.min(...open.map(id => researchCost(t, id))));
  assert.ok(startResearch(g, t, pick));
  assert.equal(idlePick(t), null, 'busy');
});

test('a Goods row at its usual price says nothing more, and a moved price says how far', () => {
  assert.equal(priceRow(2, 1)[1], '');
  assert.equal(priceRow(2, 1.3)[1], 'Up 30%');
  assert.equal(priceRow(2, .6)[1], 'Down 40%');
});
