// Clarity fix 8y: a dark good's square on the goods strip gets a light rim, so crude oil never reads as an empty square.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GOODS } from '../src/data/goods.js';
import { darkGood, contrast, PANEL_CONTRAST } from '../src/ui/format.js';

test('crude oil, coal and tires get the rim, bright goods do not', () => {
  for (const g of ['oil', 'coal', 'tires']) assert.ok(darkGood(GOODS[g].color), g);
  for (const g of ['planks', 'copper', 'sand', 'aluminum']) assert.ok(!darkGood(GOODS[g].color), g);
});
test('every good either stands out from the panel or gets the rim', () => {
  for (const [id, g] of Object.entries(GOODS)) assert.ok(contrast(g.color, '#3b2a20') >= PANEL_CONTRAST || darkGood(g.color), id);
});
