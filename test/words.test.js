// The words players see now, pinned in one place (roadmap review, 2026-11-20: one label reworded by a review used to
// break up to ten older review tests that each pinned its old words). When a review changes a label, change it here
// and nowhere else; older tests check what the words must do (short, plain, no colon), not the words themselves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { oldWavesLabel } from '../src/core/explain.js';
import { STOCK_LABEL, STOCK_CHOICES, stockWords } from '../src/ui/sheets.js';
import { splitLive, MODE_LINES, goodsSwitch, rateWords, rateShort } from '../src/ui/format.js';
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
  assert.equal(STOCK_LABEL, 'Stock for towers');
  assert.deepEqual(STOCK_CHOICES.map(c => c[1]), ['Normal', 'Lots']);
  assert.equal(stockWords({ stock: 'lots' }), '4 upgrades');
  // clarity fix 8a: a row too small for a step says its number, and a card says a rate in words
  assert.deepEqual(splitLive(5.49, [4.79, .66, .04]).rows, ['4.8', '0.6', '2/min']);
  assert.deepEqual(['116', '2/min'].map(rateWords), ['116 a second', '2 a minute']);
  assert.deepEqual(['116', '2/min'].map(rateShort), ['+116/s', '+2/min']);
  // clarity fix 8d: the two names flagged three times are gone; those modes show their picture and their line
  assert.deepEqual(MODE_LINES, { always: 'Sells spare goods whenever you have some.', skip: 'Stops selling while the price is down.', boom: 'Sells only while the price is up.', off: 'Never sells spare goods.' });
  assert.equal(goodsSwitch({ selling: true }), 'Sell spare · Sells spare goods whenever you have some.');
  // the raider card (owner, 2026-11-22)
  assert.deepEqual(EFFECT_WORDS, { frozen: 'Frozen', poison: 'Poisoned', rot: 'Rotting', spread: 'Spreads poison', fire: 'On fire', slow: 'Slowed', brittle: 'Extra damage' });
  assert.equal(fxLeft(null), 'No end'); assert.equal(fxLeft(3.2), '4s');
  for (const s of Object.values(EFFECT_WORDS)) assert.deepEqual(textIssues(s), [], s);
  // the boss bar's stages (owner, 2026-11-22)
  assert.deepEqual(STAGE_WORDS, { crew: 'Crew off, slower', horsemen: 'Horsemen off, slower', plates: 'Plates off, faster', steam: 'Full steam, faster', bail: 'Crew off, sinking' });
  // clarity fix 8b: the raider card says the stage in a sentence, a bonus says how much it adds, a boom says its time with a noun
  assert.deepEqual(STAGE_LINES, { crew: 'The crew jumped off. The wagon is slower.', horsemen: 'The horsemen rode off. The wagon is slower.', plates: 'Its plates fell off. It is faster.', steam: 'It is at full steam. It is faster.', bail: 'The crew slid down to the road. The airship flies low now, and every tower can hit it.' });
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
  for (const s of ['Won last time', 'Save for towers', BEST_LABEL, 'Read cards aloud', 'Read aloud', 'Stop reading', 'Starts the next research in this town by itself.', 'Up next', 'Coins a second', ...Object.values(MODE_LINES)]) assert.deepEqual(textIssues(s), [], s);
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
  // the Vault sheet's words (gets in, hits left), with no line about the screen (clarity fix 8g); its spotlight on the heart ties the two
  assert.equal(by('vault'), 'Raiders that get in take hits off your vault. At 0 hits left you lose coins and go back two waves. Each wave you beat mends it a little.');
  assert.equal(EXPLAINERS.find(e => e.id === 'vault').at().vault, true); // the vault it names (clarity fix 8l)
  assert.doesNotMatch(by('towers'), /vault/); // shown first in Dry Creek, which has a stockpile
});

test('the Still card says what its poison does to armor', () => {
  assert.equal(eatWords(.5), 'Lose half their armor');
  assert.equal(EATS_ARMOR.from, 10);
  assert.equal(eatWords(1), 'Lose all their armor');
  assert.equal(eatWords(.3), 'Lose 30% of their armor');
  for (const s of ['Poisoned raiders', eatWords(EATS_ARMOR.share)]) assert.deepEqual(textIssues(s), [], s);
});

test('shots read one way for every tower, whole shots a minute (clarity fix 8j)', async () => {
  const { shotsWord } = await import('../src/ui/explain.js');
  assert.equal(shotsWord(.96), '58 a minute');
  assert.equal(shotsWord(.5), '30 a minute');
  assert.equal(shotsWord(1.4), '84 a minute');
  assert.equal(shotsWord(.001), '1 a minute');
});

test('the sell modes say what each does, and a boom never reads as a drop (review of 2026.11.23-1)', async () => {
  const { MODE_LINES, priceNote } = await import('../src/ui/format.js');
  const { slotWords } = await import('../src/ui/sheets.js');
  assert.deepEqual(MODE_LINES, { always: 'Sells spare goods whenever you have some.', skip: 'Stops selling while the price is down.', boom: 'Sells only while the price is up.', off: 'Never sells spare goods.' });
  for (const k of Object.keys(MODE_LINES)) { assert.ok(MODE_LINES[k], k); assert.deepEqual(textIssues(MODE_LINES[k]), [], k); assert.ok(MODE_LINES[k].split(' ').length <= 8, k); }
  assert.equal(priceNote({ have: 50, price: .00005, boom: true }), null, 'in a boom the rows say why it is low, never a sentence under Price up (read of 2026.11.25-8)');
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
    [RESUME_WALL.text, 'Tap towers and upgrade them, then tap Resume waves'],
    [WALL_WORDS.go('Copper Gulch'), 'Tap Map, Copper Gulch, then upgrade its towers'],
    [lostCard({ def: { name: 'Iron Ridge', boss: 'train' }, lost: { why: 'vault', wave: 45, back: 43, coins: 0 }, waves: {} }).lines[0], 'Your vault fell again. You dropped back to wave 43.'],
  ];
  for (const [got, want] of lines) { assert.equal(got, want); assert.deepEqual(textIssues(got), [], got); }
});

test('the vault has one word for its count (hits) and one for its loss (fell), clarity fix 8i', async () => {
  const { newGame } = await import('../src/core/setup.js');
  const { researchDoneWords } = await import('../src/ui/play.js');
  const { explainVault } = await import('../src/core/explain.js');
  const { RESEARCH } = await import('../src/data/research.js');
  const t = newGame('words-8i', 'gulch').town;
  assert.match(researchDoneWords(t, { id: 'walls', level: 1 }), /^Thick Walls level 1 is done. The vault can take [0-9]+ hits now.$/);
  assert.equal(explainVault(t).rows[0].label, 'Starts with');
  for (const [id, r] of Object.entries(RESEARCH)) if (/vault/.test(r.about || '')) assert.ok(!/heart|break/.test(r.about), id + ': ' + r.about);
});

test('the price has one pair of words, up and down, clarity fix 8i', async () => {
  const { priceNote, LOW_NOTE } = await import('../src/ui/format.js');
  const { foremanLine } = await import('../src/ui/explain.js');
  assert.equal(LOW_NOTE, 'The price is down because you sold a lot.');
  assert.equal(priceNote({ have: 50, price: .00005 }), LOW_NOTE);
  assert.equal(priceNote({ have: 50, price: .00005, bust: true }), null); // clarity fix 8r: the demand row says it with its time
  assert.equal(foremanLine('flooded', 'timber'), 'Foreman paused while the timber price is down.');
  for (const s of [LOW_NOTE, foremanLine('flooded', 'timber')]) { assert.ok(!/ low|comes back/.test(s), s); assert.deepEqual(textIssues(s), [], s); }
});

test('the boss tip card names the boss on the bar, never the word boss, clarity fix 8i', () => {
  const e = EXPLAINERS.find(x => x.id === 'boss-bar');
  assert.equal(e.head({ boss: 'armored train' }), 'The armored train');
  assert.equal(e.say({ boss: 'armored train' }), 'The armored train changes when it is badly hurt. Tap its bar at the top to see what your towers did to it.');
  for (const s of [e.title, e.text, e.say({ boss: 'war wagon' })]) { assert.ok(!/boss/i.test(s), s); assert.deepEqual(textIssues(s), [], s); }
});

test('the words of clarity fixes 8j and 8k', async () => {
  const { waveTimer, roadLine } = await import('../src/ui/wave.js');
  const { repLine, boomWords } = await import('../src/ui/sheets.js');
  const { foremanLine } = await import('../src/ui/explain.js');
  const { levelsDone } = await import('../src/ui/format.js');
  const { shotsWord } = await import('../src/ui/explain.js');
  assert.equal(waveTimer({ phase: 'break', hold: false, timer: 117 }), 'in 1:57');
  assert.equal(shotsWord(1.4), '84 a minute');
  assert.deepEqual([0, 30, 64, 100].map(repLine), ['Fill orders to raise it. Rush orders come at 60.', 'Orders pay 15% more. Rush orders come at 60.', 'Orders pay 32% more. Rush orders come too.', 'Orders pay 50% more. Rush orders come too.']);
  assert.equal(boomWords(1.6, '1:11', .3), 'Demand high for 1:11 more. Price still down.');
  assert.equal(boomWords(1.6, '1:11', 1.2), 'Price up for 1:11 more');
  assert.equal(roadLine(1, 0), '1 on the road. No more to come.');
  assert.equal(foremanLine('flooded', 'timber', '99%'), 'Foreman paused while the timber price is down 99%.');
  assert.equal(levelsDone(2, 5), 'Level 2 of 5');
  for (const s of [repLine(0), repLine(64), boomWords(1.6, '1:11', .3), roadLine(1, 0), foremanLine('flooded', 'timber', '99%')]) assert.deepEqual(textIssues(s), [], s);
});

test('the words of clarity fix 8o', async () => {
  const { ARMS_NAME, ARMS_GO } = await import('../src/ui/sheets.js');
  const { MODE_WORDS } = await import('../src/ui/format.js');
  const { GOALS } = await import('../src/data/goals.js');
  // one name for Call to arms on screen: the side button, its sheet and its tip card
  assert.equal(ARMS_NAME, 'To arms');
  assert.equal(ARMS_GO, 'Call workers out');
  const tip = Object.values(EXPLAINERS).find(e => /workers fight on the road/.test(e.text || ''));
  assert.equal(tip.title, ARMS_NAME);
  assert.match(tip.text, /^Tap To arms /);
  // every sell mode says a short word beside its picture, read on after "Sell spare"
  assert.deepEqual(MODE_WORDS, { always: 'Always', skip: 'Unless down', boom: 'When up', off: 'Off' });
  for (const w of Object.values(MODE_WORDS)) { assert.ok(w.split(' ').length <= 2, w); assert.deepEqual(textIssues('Sell spare ' + w.toLowerCase()), [], w); }
  // a done step says what was done, never "started" beside Done
  assert.equal(GOALS.find(g => g.id === 'g-research').doneText, 'Research picked');
  for (const g of GOALS) if (g.doneText) assert.doesNotMatch(g.doneText, /started|starting|begun/i, g.id);
});

test('clarity fixes 8q and 8r: the price rows, the Capital label and the red line', async () => {
  const { newGame } = await import('../src/core/setup.js');
  const { explainPrice } = await import('../src/core/explain.js');
  const { EXPLAINERS } = await import('../src/data/explainers.js');
  const g = newGame('w8r', 'gulch'), t = g.town;
  g.shared.market.event = { timber: 1.6 }; g.shared.market.boom = { good: 'timber', f: 1.6, left: 71 };
  assert.deepEqual(explainPrice(g, t, 'timber').rows.slice(0, 2).map(r => r.label), ['Usual price', 'Demand high']);
  g.shared.market.event = { timber: .6 };
  assert.equal(explainPrice(g, t, 'timber').rows[1].label, 'Demand low');
  const short = EXPLAINERS.find(e => e.id === 'short');
  assert.equal(short.text, 'A red line under a building level means it ran out of what it needs. Tap the building to see what it is missing.');
  assert.deepEqual(textIssues(short.text), []);
});
