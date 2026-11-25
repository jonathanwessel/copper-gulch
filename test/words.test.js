// The words players see now, pinned in one place (roadmap review, 2026-11-20: one label reworded by a review used to
// break up to ten older review tests that each pinned its old words). When a review changes a label, change it here
// and nowhere else; older tests check what the words must do (short, plain, no colon), not the words themselves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { oldWavesLabel } from '../src/core/explain.js';
import { STOCK_LABEL, STOCK_CHOICES, stockWords } from '../src/ui/sheets.js';
import { splitLive, MODE_WORDS, goodsSwitch, rateWords, rateShort } from '../src/ui/format.js';
import { textIssues } from '../tools/audit.js';
import { EXPLAINERS } from '../src/data/explainers.js';
import { EATS_ARMOR, eatWords } from '../src/data/towers.js';
import { EFFECT_WORDS, fxLeft } from '../src/ui/foe.js';
import { STAGE_WORDS, STAGE_LINES } from '../src/data/foes.js';
import { BEST_LABEL } from '../src/ui/wave.js';
import { priceRow, charterWords, boomWords } from '../src/ui/sheets.js';
import { moreWord } from '../src/ui/explain.js';
import { sayable } from '../src/audio/speech.js';

test('the words on screen today', async () => {
  assert.equal(oldWavesLabel(), 'Wave'); assert.equal(oldWavesLabel({ wave: 7 }), 'Wave 7');
  assert.equal(STOCK_LABEL, 'Save for towers');
  assert.deepEqual(STOCK_CHOICES.map(c => c[1]), ['Normal', 'Lots']);
  assert.equal(stockWords({ stock: 'lots' }), '4 upgrades');
  // clarity fix 8a: a row too small for a step says its number, and a card says a rate in words
  assert.deepEqual(splitLive(5.49, [4.79, .66, .04]).rows, ['4.8', '0.6', '2/min']);
  assert.deepEqual(['116', '2/min'].map(rateWords), ['116 a second', '2 a minute']);
  assert.deepEqual(['116', '2/min'].map(rateShort), ['+116/s', '+2/min']);
  // clarity fix 8d: the two names flagged three times are gone; those modes show their picture and their line
  assert.deepEqual(MODE_WORDS, { always: 'Always', off: 'Off' });
  assert.equal(goodsSwitch({ selling: true }), 'Sell spare · Always');
  // the raider card (owner, 2026-11-22)
  assert.deepEqual(EFFECT_WORDS, { frozen: 'Frozen', poison: 'Poisoned', rot: 'Rotting', spread: 'Spreads poison', fire: 'On fire', slow: 'Slowed', brittle: 'Extra damage' });
  assert.equal(fxLeft(null), 'No end'); assert.equal(fxLeft(3.2), '4s');
  for (const s of Object.values(EFFECT_WORDS)) assert.deepEqual(textIssues(s), [], s);
  // the boss bar's stages (owner, 2026-11-22)
  assert.deepEqual(STAGE_WORDS, { crew: 'Crew off, slower', horsemen: 'Horsemen off, slower', plates: 'Plates off, faster', steam: 'Full steam, faster' });
  // clarity fix 8b: the raider card says the stage in a sentence, a bonus says how much it adds, a boom says its time with a noun
  assert.deepEqual(STAGE_LINES, { crew: 'The crew jumped off. The wagon is slower.', horsemen: 'The horsemen rode off. The wagon is slower.', plates: 'Its plates fell off. It is faster.', steam: 'It is at full steam. It is faster.' });
  for (const s of Object.values(STAGE_LINES)) assert.deepEqual(textIssues(s), [], s);
  assert.deepEqual([1.5, 1.1, .9].map(moreWord), ['50% more', '10% more', '10% less']);
  assert.deepEqual([boomWords(1.6, '1:11'), boomWords(.6, '0:30')], ['Price up for 1:11 more', 'Price down for 0:30 more']);
  // clarity fix 9: the Perks sheet's two plain lines
  assert.deepEqual(charterWords('Copper Gulch'), { keep: 'Copper Gulch starts over at wave 1 with no buildings, goods or research. You keep your coins, your deeds and your other towns.', deed: 'Each deed gives you 25% more coins in every town, forever.' });
  for (const v of Object.values(charterWords('Iron Ridge'))) assert.deepEqual(textIssues(v), [], v);
  // the review of 2026.11.22-12: the tower that hits a raider hardest is a labeled row, a crashed price says it once
  assert.equal(BEST_LABEL, 'Weak to'); // clarity fix 8d: a fact about the raider, not a pick of towers
  // clarity fix 8d: the town's Save for towers choices say what they keep, one stat name for vault and stockpile, the won
  // line, and the charter step's two taps
  {
    const { stockLine } = await import('../src/ui/sheets.js'), { CAN_TAKE } = await import('../src/ui/map.js'), { WON_LINE } = await import('../src/ui/state.js');
    assert.deepEqual(['normal', 'lots'].map(stockLine), ['Keeps goods for 2 upgrades of every tower.', 'Keeps goods for 4 upgrades of every tower.']);
    assert.equal(CAN_TAKE, 'Can take');
    assert.equal(WON_LINE, 'Won. Small raids still come here.');
    for (const s of [stockLine('normal'), stockLine('lots'), CAN_TAKE, WON_LINE]) assert.deepEqual(textIssues(s), [], s);
  }
  assert.deepEqual(priceRow(.02, .01), ['Under 1 coin each', '']);
  assert.deepEqual(priceRow(12, .5), ['12 coins each', 'Down 50%']);
  assert.deepEqual(priceRow(.5, 1.3), ['Under 1 coin each', 'Up 30%']);
  // the speaker button reads the card's own words (owner, 2026-11-22)
  assert.equal(sayable('Big Shell', 'Hits x2 · slower'), 'Big Shell. Hits 2 times, slower.');
  for (const s of ['Won last time', 'Save for towers', BEST_LABEL, 'Read cards aloud', 'Read aloud', 'Stop reading', 'Starts the next research in this town by itself.', 'Up next', 'Coins a second', ...Object.values(MODE_WORDS)]) assert.deepEqual(textIssues(s), [], s);
});

test('the explainers name the controls by their words on screen', async () => {
  const by = id => EXPLAINERS.find(e => e.id === id).text;
  assert.match(by('reserve'), /switch Save for towers off/);
  assert.match(by('boom'), /then Sell spare, to pick when it sells/);
  const { priceWord } = await import('../src/ui/sheets.js');
  assert.deepEqual([1.6, 1, .6].map(priceWord), ['Up 60%', 'Full price', 'Down 40%']);
  assert.match(by('stock'), /^Tap Lots/);
  assert.match(by('mortar'), /A dark spot shows where each one will land/);
  assert.match(by('map'), /Under each town you see if it is fighting/);
  assert.match(by('vault'), /The heart at the top counts the hits the vault can still take/); // words read of 2026.11.23-11: tie the vault to the heart
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
  assert.equal(priceNote({ have: 50, price: .00005, boom: true }), 'You sold a lot lately, so the price is still low.', 'the price row already says under 1 coin');
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
  assert.equal(capitalReadyWords({ town: 'ridge', coins: 25000 }), "Iron Ridge's best wave is 30. The Capital costs 25K coins.");
  assert.deepEqual(textIssues(capitalReadyWords({ town: 'ridge', coins: 25000 })), []);
  const text = id => GOALS.find(g => g.id === id).text;
  assert.equal(text('r-steel'), 'Tap the Steel Mill lot, then tap Build');
  assert.equal(text('r-five8'), 'Upgrade 5 towers to level 8');
  assert.equal(text('r-three10'), 'Upgrade 3 towers to level 10');
});

test('the strip lines of the newcomer climb fix', async () => {
  const { REBUILD_WORDS } = await import('../src/core/goals.js');
  const lines = [
    [REBUILD_WORDS.build('stone pad', 'Frost Lens'), 'Tap the stone pad and build a Frost Lens again'],
    [REBUILD_WORDS.build('Mortar pit', 'Mortar'), 'Tap the Mortar pit and build a Mortar again'],
    [REBUILD_WORDS.swap('Crossbow', 'Frost Lens'), 'Tap the Crossbow, tap Sell, then build a Frost Lens there'],
    [REBUILD_WORDS.hold('Silver Falls'), 'Tap Hold waves while you save to open Silver Falls'],
    [REBUILD_WORDS.play('Silver Falls'), 'Tap Map, then tap Silver Falls'],
  ];
  for (const [got, want] of lines) { assert.equal(got, want); assert.deepEqual(textIssues(got), [], got); }
});

test('the strip lines of the Gulch loss loop fix', async () => {
  const { RESUME_WALL, WALL_WORDS } = await import('../src/core/goals.js');
  const { lostCard } = await import('../src/ui/lost.js');
  const lines = [
    [RESUME_WALL.text, 'Tap a tower and upgrade it, then tap Resume waves'],
    [WALL_WORDS.go('Copper Gulch'), 'Tap Map, Copper Gulch, then upgrade its towers'],
    [lostCard({ def: { name: 'Iron Ridge', boss: 'train' }, lost: { why: 'vault', wave: 45, back: 43, coins: 0 }, waves: {} }).lines[0], 'Your vault fell again. You dropped back to wave 43.'],
  ];
  for (const [got, want] of lines) { assert.equal(got, want); assert.deepEqual(textIssues(got), [], got); }
});
