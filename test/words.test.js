// The words players see now, pinned in one place (roadmap review, 2026-11-20: one label reworded by a review used to
// break up to ten older review tests that each pinned its old words). When a review changes a label, change it here
// and nowhere else; older tests check what the words must do (short, plain, no colon), not the words themselves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { oldWavesLabel } from '../src/core/explain.js';
import { STOCK_LABEL, STOCK_CHOICES, stockWords } from '../src/ui/sheets.js';
import { splitLive, LITTLE, MODE_WORDS, goodsSwitch } from '../src/ui/format.js';
import { textIssues } from '../tools/audit.js';
import { EXPLAINERS } from '../src/data/explainers.js';
import { EATS_ARMOR, eatWords } from '../src/data/towers.js';
import { EFFECT_WORDS, fxLeft } from '../src/ui/foe.js';

test('the words on screen today', () => {
  assert.equal(oldWavesLabel(), 'Won last time');
  assert.equal(STOCK_LABEL, 'Save for towers');
  assert.deepEqual(STOCK_CHOICES.map(c => c[1]), ['2 upgrades', '4 upgrades']);
  assert.equal(stockWords({ stock: 'lots' }), '4 upgrades');
  assert.equal(LITTLE, 'a little');
  assert.deepEqual(splitLive(5.49, [4.79, .66, .04]).rows, ['4.8', '0.6', LITTLE]);
  assert.deepEqual(MODE_WORDS, { always: 'Always', skip: 'Skip busts', boom: 'Booms only', off: 'Off' });
  assert.equal(goodsSwitch({ selling: true }), 'Sell spare · Always');
  // the raider card (owner, 2026-11-22)
  assert.deepEqual(EFFECT_WORDS, { frozen: 'Frozen', poison: 'Poisoned', rot: 'Rotting', spread: 'Spreads poison', fire: 'On fire', slow: 'Slowed', brittle: 'Brittle' });
  assert.equal(fxLeft(null), 'No end'); assert.equal(fxLeft(3.2), '4s');
  for (const s of Object.values(EFFECT_WORDS)) assert.deepEqual(textIssues(s), [], s);
  for (const s of ['Won last time', 'Save for towers', 'Line up', 'a little', 'Coins a second', ...Object.values(MODE_WORDS)]) assert.deepEqual(textIssues(s), [], s);
});

test('the explainers name the controls by their words on screen', async () => {
  const by = id => EXPLAINERS.find(e => e.id === id).text;
  assert.match(by('reserve'), /switch Save for towers off/);
  assert.match(by('boom'), /then Sell spare to pick when it sells/);
  const { priceWord } = await import('../src/ui/sheets.js');
  assert.deepEqual([1.6, 1, .6].map(priceWord), ['Up 60%', 'Full price', 'Down 40%']);
  assert.match(by('stock'), /^Tap 4 upgrades/);
  assert.match(by('mortar'), /A dark spot shows where each one will land/);
  assert.match(by('map'), /thin bar under a town/);
  assert.match(by('vault'), /like the stockpile in Dry Creek/);
  assert.doesNotMatch(by('towers'), /vault/); // shown first in Dry Creek, which has a stockpile
});

test('the Still card says what its poison does to armor', () => {
  assert.equal(eatWords(.5), 'Lose half their armor');
  assert.equal(EATS_ARMOR.from, 10);
  assert.equal(eatWords(1), 'Lose all their armor');
  assert.equal(eatWords(.3), 'Lose 30% of their armor');
  for (const s of ['Poisoned raiders', eatWords(EATS_ARMOR.share)]) assert.deepEqual(textIssues(s), [], s);
});

test('shots just under one a second never read "One every 1 seconds"', async () => {
  const { shotsWord } = await import('../src/ui/explain.js');
  assert.equal(shotsWord(.96), 'About 1 a second');
  assert.equal(shotsWord(.5), 'One every 2 seconds');
  assert.ok(!/every 1 seconds/.test(shotsWord(.7)));
});
