// The words players see now, pinned in one place (roadmap review, 2026-11-20: one label reworded by a review used to
// break up to ten older review tests that each pinned its old words). When a review changes a label, change it here
// and nowhere else; older tests check what the words must do (short, plain, no colon), not the words themselves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { oldWavesLabel } from '../src/core/explain.js';
import { STOCK_LABEL, STOCK_CHOICES, stockWords } from '../src/ui/sheets.js';
import { splitLive, LITTLE } from '../src/ui/format.js';
import { textIssues } from '../tools/audit.js';
import { EXPLAINERS } from '../src/data/explainers.js';

test('the words on screen today', () => {
  assert.equal(oldWavesLabel(), 'Won last time');
  assert.equal(STOCK_LABEL, 'Save for towers');
  assert.deepEqual(STOCK_CHOICES.map(c => c[1]), ['2 upgrades', '4 upgrades']);
  assert.equal(stockWords({ stock: 'lots' }), '4 upgrades');
  assert.equal(LITTLE, 'a little');
  assert.deepEqual(splitLive(5.49, [4.79, .66, .04]).rows, ['4.8', '0.6', LITTLE]);
  for (const s of ['Won last time', 'Save for towers', 'Line up', 'a little', 'Coins a second']) assert.deepEqual(textIssues(s), [], s);
});

test('the explainers name the controls by their words on screen', () => {
  const by = id => EXPLAINERS.find(e => e.id === id).text;
  assert.match(by('reserve'), /switch Save for towers off/);
  assert.match(by('stock'), /^Tap 4 upgrades/);
  assert.match(by('mortar'), /A dark spot shows where each one will land/);
  assert.match(by('map'), /thin bar under a town/);
  assert.match(by('vault'), /like the stockpile in Dry Creek/);
  assert.doesNotMatch(by('towers'), /vault/); // shown first in Dry Creek, which has a stockpile
});
