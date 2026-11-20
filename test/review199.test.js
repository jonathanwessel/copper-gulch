// Review of 2026.11.19-9: a Done goal says what was done, a kept good is named once, a foreman's line is a status, a
// lost toast is one step, the map card matches its labels, and a good with none to sell has no price rows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GOALS } from '../src/data/goals.js';
import { foremanLine, keepLine } from '../src/ui/explain.js';
import { lostToast } from '../src/ui/lost.js';
import { priceNote } from '../src/ui/format.js';
import { vaultHits, badgeRates } from '../src/ui/map.js';

test('every goal says what was done beside the green Done tag', () => {
  for (const g of GOALS) {
    assert.ok(g.doneText, g.id + ' has no done text');
    assert.notEqual(g.doneText, g.text, g.id);
    assert.doesNotMatch(g.doneText, /^Tap |[:;]/, g.id);
  }
  assert.equal(GOALS.find(g => g.id === 'f-sand4').doneText, 'Sand Pit is level 4');
});

test('the goods kept for a path are named without their amounts', () => {
  const t = keepLine(['copper', 'bricks'], 'path');
  assert.equal(t, 'Copper and bricks are kept for this path, not sold.');
  assert.doesNotMatch(t, /\d/);
  assert.equal(keepLine(['timber'], 'upgrade'), 'Timber is kept for this upgrade, not sold.');
});

test('a foreman that is not buying reads as a status, not a story', () => {
  for (const why of ['short', 'flooded', 'slow']) {
    const t = foremanLine(why, 'timber');
    assert.match(t, /^The foreman is not buying\. /); // a status that says who (a second review: "Not buying." named no one)
    assert.doesNotMatch(t, /foreman waits/i);
  }
  assert.equal(foremanLine('flooded', 'timber'), 'The foreman is not buying. Timber sells low and no workshop needs more.');
});

test('the lost toast has one step', () => {
  const town = { def: { name: 'Copper Gulch', short: 'Copper Gulch', boss: 'wagon' }, lost: { why: 'boss', back: 18 }, wave: 18 };
  for (const t of [lostToast(town), lostToast(town, false, null, true)]) assert.equal((t.match(/, then /g) || []).length, 0, t);
});

test('the map card writes the vault in hits and the coins as the label does', () => {
  assert.equal(vaultHits({ vault: { hp: 19.2, max: 20 } }), '20 / 20 hits');
  assert.equal(vaultHits({ vault: { hp: 0, max: 20 } }), '0 / 20 hits');
  const r = badgeRates(.4, { gulch: { income: .4 } });
  assert.equal(r.words.gulch, '+0.4/s'); // the card shows this same word
});

test('a good with none to sell, or a price of almost 0, says so in words instead of price rows', () => {
  assert.match(priceNote({ have: 0, price: 13 }), /^Pays 13 coins each once you have some to sell\.$/);
  assert.match(priceNote({ have: 19, kept: 19, price: 2 }), /once you have some to sell/);
  assert.match(priceNote({ have: 50, price: .00005 }), /pays almost nothing/);
  assert.equal(priceNote({ have: 50, kept: 5, price: 13 }), null);
});
