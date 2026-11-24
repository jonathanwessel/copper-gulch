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
import { STAGE_WORDS } from '../src/data/foes.js';
import { BEST_LABEL } from '../src/ui/wave.js';
import { priceRow } from '../src/ui/sheets.js';
import { sayable } from '../src/audio/speech.js';

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
  assert.deepEqual(EFFECT_WORDS, { frozen: 'Frozen', poison: 'Poisoned', rot: 'Rotting', spread: 'Spreads poison', fire: 'On fire', slow: 'Slowed', brittle: 'Extra damage' });
  assert.equal(fxLeft(null), 'No end'); assert.equal(fxLeft(3.2), '4s');
  for (const s of Object.values(EFFECT_WORDS)) assert.deepEqual(textIssues(s), [], s);
  // the boss bar's stages (owner, 2026-11-22)
  assert.deepEqual(STAGE_WORDS, { crew: 'Crew off, slower', horsemen: 'Horsemen off, slower', plates: 'Plates off, faster', steam: 'Full steam, faster' });
  // the review of 2026.11.22-12: the tower that hits a raider hardest is a labeled row, a crashed price says it once
  assert.equal(BEST_LABEL, 'Best tower');
  assert.deepEqual(priceRow(.02, .01), ['Under 1 coin each', '']);
  assert.deepEqual(priceRow(12, .5), ['12 coins each', 'Down 50%']);
  assert.deepEqual(priceRow(.5, 1.3), ['Under 1 coin each', 'Up 30%']);
  // the speaker button reads the card's own words (owner, 2026-11-22)
  assert.equal(sayable('Big Shell', 'Hits x2 · slower'), 'Big Shell. Hits 2 times, slower.');
  for (const s of ['Won last time', 'Save for towers', BEST_LABEL, 'Read cards aloud', 'Read aloud', 'Stop reading', 'Starts the next research in this town by itself.', 'Up next', 'a little', 'Coins a second', ...Object.values(MODE_WORDS)]) assert.deepEqual(textIssues(s), [], s);
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
  assert.match(by('vault'), /The heart at the top shows how many hits it has left/); // words read of 2026.11.23-11: tie the vault to the heart
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

test('the sell modes say what each does, and a boom never reads as a drop (review of 2026.11.23-1)', async () => {
  const { MODE_LINES, priceNote } = await import('../src/ui/format.js');
  const { slotWords } = await import('../src/ui/sheets.js');
  assert.deepEqual(MODE_LINES, { always: 'Sells spare goods whenever you have some.', skip: 'Stops selling while the price has crashed.', boom: 'Sells only while the price is way up.', off: 'Never sells spare goods.' });
  for (const k of Object.keys(MODE_WORDS)) { assert.ok(MODE_LINES[k], k); assert.deepEqual(textIssues(MODE_LINES[k]), [], k); assert.ok(MODE_LINES[k].split(' ').length <= 8, k); }
  assert.equal(priceNote({ have: 50, price: .00005, boom: true }), 'The boom lifts it, but you sold a lot of it lately.', 'the price row already says under 1 coin');
  assert.ok(!/comes back/.test(priceNote({ have: 0, price: .00005, boom: true })));
  assert.equal(slotWords({ town: 'gulch', wave: 12, coins: 4321 }, true), 'Copper Gulch · Wave 12 · 4.32K coins');
});

test('a coin goal says how long is left if you save (clarity fix 2, reworded by the review of 2026.11.23-3)', async () => {
  const { readyWords } = await import('../src/core/goals.js');
  assert.equal(readyWords(80), 'about 2 min to go');
  assert.equal(readyWords(30), 'under a minute to go');
  assert.equal(readyWords(4500), 'about 1 h 15 min to go');
});

test('the strip lines of clarity fix 3b part 2', async () => {
  const { CAPITAL_HOLD } = await import('../src/core/goals.js');
  const { GOALS } = await import('../src/data/goals.js');
  assert.equal(CAPITAL_HOLD.text, 'Tap Hold waves while you save for the Capital');
  // part 2b: the Capital's gate passing
  const { capitalReadyWords } = await import('../src/ui/capital.js');
  assert.equal(capitalReadyWords({ town: 'ridge', coins: 25000 }), 'Iron Ridge beat wave 30. The Capital costs 25K coins.');
  assert.deepEqual(textIssues(capitalReadyWords({ town: 'ridge', coins: 25000 })), []);
  const text = id => GOALS.find(g => g.id === id).text;
  assert.equal(text('r-steel'), 'Tap the Steel Mill lot, then tap Build');
  assert.equal(text('r-five8'), 'Upgrade 5 towers to level 8');
  assert.equal(text('r-three10'), 'Upgrade 3 towers to level 10');
});
