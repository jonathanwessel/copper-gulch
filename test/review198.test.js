// Review of 2026.11.19-8: rows that say what they are, damage that rounds as a reader does, amounts on institutions,
// one act per goal and a map line that says the vault filled again.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { explainEmpireIncome, incomeSnap } from '../src/core/explain.js';
import { fmtDmg } from '../src/ui/format.js';
import { divText } from '../src/ui/explain.js';
import { INSTITUTIONS, boughtText } from '../src/data/institutions.js';
import { lostLine } from '../src/ui/lost.js';
import { GOALS } from '../src/data/goals.js';

test('another town\'s income row says what it is and reads the map\'s meter', () => {
  const g = newGame('r198', 'gulch');
  g.addTown('ridge');
  const before = incomeSnap(g);
  const ex = explainEmpireIncome(g, before, incomeSnap(g), 1, { ridge: 9.2 });
  const row = ex.rows.find(r => r.key === 'town:ridge');
  assert.equal(row.label, 'Earned in Iron Ridge');
  assert.equal(row.value, 9.2, 'the same rate as its map label');
});

test('damage rounds to the nearest whole number, so 177.8 reads 178', () => {
  assert.equal(fmtDmg(177.83), '178');
  assert.equal(fmtDmg(177.2), '177');
  assert.equal(fmtDmg(4.25), '4.3');
  assert.equal(fmtDmg(999.7), '999');
});

test('a tiny factor reads as divided by a whole number, never "× almost 0"', () => {
  assert.equal(divText(.0005), '÷ 2,000');
  assert.equal(divText(.0042), '÷ 240');
  assert.doesNotMatch(divText(.00001), /almost/);
});

test('every institution says how much it gives in amounts a player can check', () => {
  for (const i of INSTITUTIONS) {
    assert.match(i.about, /^First upgrade · .* \d+% /, i.name); // its first upgrade, not an "up to" total (review of 2026.11.19-11)
    assert.doesNotMatch(i.about, /[:;]|up to/, i.name);
  }
  const bank = INSTITUTIONS.find(i => i.id === 'bank');
  assert.equal(bank.about, 'First upgrade · You earn 10% more coins.');
  assert.equal(boughtText(bank, 3), 'You earn 21% more coins. Everything costs 5% less.'); // two bought kinds, added up
});

test('the map line after a loss says the vault is full again', () => {
  const town = { def: { name: 'Copper Gulch', short: 'Copper Gulch', boss: 'wagon' }, lost: { why: 'boss' } };
  assert.match(lostLine(town), /got through\. The vault is full again\. Tap Play Copper Gulch, then Resume waves\./);
  assert.match(lostLine({ ...town, lost: { why: 'vault' } }), /^The vault fell and filled up again\./);
});

test('no goal joins two acts with "and save"', () => {
  for (const g of GOALS) assert.doesNotMatch(g.text, / and save /, g.id);
});
