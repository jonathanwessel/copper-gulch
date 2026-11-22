// Late damage shares (M6a): what each tower kind did after a town's first hour is held to the same limit as the
// first hour (SHARE_MAX), summed over the active seeds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lateShares, SHARE_MAX, CLOSE } from '../tools/balance.js';

const run = (ridge, falls) => ({ ridge: { late: ridge }, capSave: { late: {} }, fSave: null, falls: { late: falls } });

test('a kind over the limit after the first hour is a miss, named by its town', () => {
  const { misses } = lateShares([run({ frost: 50, cannon: 25, still: 25 }, { frost: 30, mortar: 30, cannon: 40 })]);
  assert.equal(misses.length, 2);
  assert.ok(misses.some(m => m.startsWith('Iron Ridge') && m.includes('frost')));
  assert.ok(misses.some(m => m.startsWith('Silver Falls') && m.includes('cannon')));
});

test('the shares add up over every seed and every play in the town', () => {
  const a = run({ frost: 40, mortar: 60 }, { frost: 1, mortar: 1, cannon: 1 }), b = run({ frost: 60, mortar: 40 }, { frost: 1, mortar: 1, cannon: 1 });
  b.capSave.late = { still: 100, crossbow: 100 };
  const { rows, misses } = lateShares([a, b]);
  assert.deepEqual(rows[0].dealt, { frost: 100, mortar: 100, still: 100, crossbow: 100 });
  assert.deepEqual(misses, []);
});

test('a share just under the limit prints a close line, and a town with no late damage is a miss', () => {
  CLOSE.length = 0;
  const n = SHARE_MAX * 100 - 1, { misses } = lateShares([run({ frost: n, cannon: 30, still: 70 - n }, {})]);
  assert.ok(CLOSE.some(x => x.includes('Iron Ridge') && x.includes('frost')));
  assert.deepEqual(misses, ['Silver Falls: no damage after its first hour']);
});
