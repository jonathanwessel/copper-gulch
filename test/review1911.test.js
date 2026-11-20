// Review of 2026.11.19-11: the old-waves row says why damage triples, the foreman line says what it does, the price card
// gives one reason at a time, the institutions give amounts a player can check and a bought upgrade has its row.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { newGame } from '../src/core/setup.js';
import { treeOf, applyTree } from '../src/core/tree.js';
import { explainPrice, oldWavesLabel } from '../src/core/explain.js';
import { INSTITUTION, boughtText } from '../src/data/institutions.js';
import { priceNote } from '../src/ui/format.js';
import { foremanLine } from '../src/ui/explain.js';

test('the old-waves row says the towers are stronger and why', () => {
  assert.equal(oldWavesLabel({ record: 23 }), 'Best wave 23 bonus');
});

test('the foreman line says when it buys, never its reasons', () => {
  for (const why of ['short', 'flooded', 'slow']) {
    const t = foremanLine(why, 'timber');
    assert.match(t, /^The foreman buys the next level (once|when) /);
    assert.doesNotMatch(t, /sells low|not buying/);
  }
});

test('a price card gives one reason at a time', () => {
  const kept = priceNote({ have: 19, kept: 19, price: .00005 });
  assert.doesNotMatch(kept, /sold a lot/); // the line above it already says towers need it all
  assert.match(kept, /comes back over time/);
  assert.match(priceNote({ have: 50, price: .00005 }), /^You sold a lot of it lately, so it pays almost nothing now\. The price comes back over time\.$/);
  const sheets = fs.readFileSync(new URL('../src/ui/sheets.js', import.meta.url), 'utf8');
  assert.doesNotMatch(sheets, /Sell lots of one thing/); // no how-it-works line on the Goods sheet
});

test('a bought Price Lists shows on the card and as a row in the price breakdown', () => {
  const g = newGame('i1', 'gulch'), t = g.town, tr = treeOf(g);
  tr.founded.push('market'); tr.nodes.market = 1; applyTree(g);
  assert.equal(boughtText(INSTITUTION.market, 1), 'Goods sell for 10% more.');
  const row = explainPrice(g, t, 'timber').rows.find(r => r.label === 'Market Board');
  assert.ok(row, 'the Market Board row is in the price breakdown'); assert.ok(Math.abs(row.mul - 1.1) < 1e-9);
});

test('the Capital says what Influence is and its toast names a building the card shows', () => {
  const cap = fs.readFileSync(new URL('../src/ui/capital.js', import.meta.url), 'utf8'), map = fs.readFileSync(new URL('../src/ui/map.js', import.meta.url), 'utf8');
  for (const s of [cap, map]) assert.match(s, /Send goods here for coins and Influence. Spend Influence on upgrades/);
  assert.match(cap, /toast\(inst\.name \+ ' upgrade bought\. '/);
});
