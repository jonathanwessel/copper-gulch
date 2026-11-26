/* Clarity fixes 8g and 8h (PLAN.md M6a): one pair of price words, one shape for the sell modes and the raiders card,
   the wall card's count, the mend in words, and the open place's label kept off the places. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { MODE_LINES } from '../src/ui/format.js';
import { boomWords } from '../src/ui/sheets.js';
import { roadLine } from '../src/ui/wave.js';
import { wallUpsWords } from '../src/ui/lost.js';
import { mendLine } from '../src/ui/explain.js';
import { onOwn } from '../src/ui/map.js';
import { textIssues } from '../tools/audit.js';

test('8h (1): the sell modes and the boom line say the price is up or down, in the same words', () => {
  assert.match(boomWords(1.6, '1:11'), /^Price up /);
  assert.match(boomWords(.6, '1:11'), /^Price down /);
  assert.match(MODE_LINES.skip, /the price is down\.$/);
  assert.match(MODE_LINES.boom, /the price is up\.$/);
  for (const s of Object.values(MODE_LINES)) assert.doesNotMatch(s, /crash|way up|rising/);
});

test('8h, the read of 2026.11.25-8: an Off switch says Off beside its picture', async () => {
  const { OFF_WORD } = await import('../src/ui/format.js');
  assert.equal(OFF_WORD, 'Off');
});

test('8h (4): the raiders card leads with where they are, never a total its rows say', () => {
  assert.equal(roadLine(3, 0), '3 on the road. No more to come.');
  assert.equal(roadLine(0, 5), '5 still to come, none on the road yet.');
  assert.equal(roadLine(2, 4), '2 on the road, 4 still to come.');
  for (const s of [roadLine(3, 0), roadLine(0, 5), roadLine(2, 4)]) assert.deepEqual(textIssues(s), [], s);
});

test('8g (3): a town at its wall counts the upgrades it asks for, as the strip does', () => {
  const t = { lost: { ups: 0 } };
  assert.equal(wallUpsWords(t), '8 times');
  t.lost.ups = 5; assert.equal(wallUpsWords(t), '3 more times');
  t.lost.ups = 7; assert.equal(wallUpsWords(t), '1 more time');
  t.lost.ups = 9; assert.equal(wallUpsWords(t), '');
});

test('8g (4): the Vault sheet says the mend in words, with the store its town has', () => {
  const g = newGame('c8g4', 'gulch');
  assert.equal(mendLine(g.town), 'Each wave you beat mends the vault a little.');
  assert.equal(mendLine({ def: { store: 'stockpile' } }), 'Each wave you beat mends the stockpile a little.');
  assert.doesNotMatch(mendLine(g.town), /½|\d/);
});

test('8g (1): a label lies on a place when it covers its middle or a fifth of it', () => {
  const box = { l: 100, t: 100, r: 200, b: 200, x: 150, y: 150 };
  assert.equal(onOwn({ x: 150, y: 160, w: 40, h: 20 }, box), true, 'over the middle');
  assert.equal(onOwn({ x: 120, y: 200, w: 60, h: 50 }, box), true, 'a quarter of it, off the middle');
  assert.equal(onOwn({ x: 120, y: 200, w: 60, h: 30 }, box), false, 'under a fifth');
  assert.equal(onOwn({ x: 150, y: 98, w: 80, h: 30 }, box), false, 'above it');
  assert.equal(onOwn({ x: 150, y: 98, w: 80, h: 30 }, null), false);
});
