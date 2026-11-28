// Clarity fix 8aa (fresh-eyes read of 2026.11.27-8): a good's price in one form on every row, and each cause of a move
// as one to three arrows in place of a percent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paysLine, moveArrows, priceRow } from '../src/ui/sheets.js';

test('the open and the closed row say the price the same way', () => {
  for (const p of [.02, .7, 1, 2, 12]) {
    const line = paysLine(priceRow(p, 1)[0]);
    assert.match(line, /^Pays (under 1 coin|\d+ coins?) each$/, line);
  }
});
test('a cause is one to three arrows by how far it moves the price, with words for a reader', () => {
  const a = [1, 1.01, .9, 1.3, .45, .01, 1.6, 3].map(m => moveArrows(m));
  assert.deepEqual(a.map(x => x.n), [0, 0, 1, 2, 2, 3, 3, 3]);
  assert.deepEqual(a.map(x => x.way), ['', '', 'down', 'up', 'down', 'down', 'up', 'up']);
  for (const x of a) assert.ok(!/%|\d/.test(x.words), x.words);
  assert.ok(a[5].words.includes('less') && a[6].words.includes('more'));
});
