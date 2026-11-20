// Review of 2026.11.19-13 and 2026.11.20-1: one Sell label and one price pattern on the Goods sheet, the Blast row opens
// like Damage, Shots and Range, a rate never reads 0.0, and the foreman says when it buys.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { explainTower, oldWavesLabel } from '../src/core/explain.js';
import { goodsLine, goodsSwitch, fmtLive } from '../src/ui/format.js';
import { foremanLine, unitText, blastWord } from '../src/ui/explain.js';
import fs from 'node:fs';

test('the Goods sheet has one Sell label and one price pattern', () => {
  for (const kept of [0, 5, 19]) assert.equal(goodsSwitch({ have: 19, kept, selling: true }), 'Sell spare · On');
  assert.equal(goodsSwitch({ have: 19, kept: 19, selling: false }), 'Sell spare · Off');
  assert.equal(goodsLine({ have: 19, kept: 19, selling: true, price: 2 }), '19 in stock · 19 for towers · 0 spare');
  assert.equal(goodsLine({ have: 40, kept: 5, selling: true, price: 13 }), '40 in stock · 5 for towers · 35 spare');
  assert.equal(goodsLine({ have: 40, selling: false, price: 1.5 }), '40 in stock · 0 for towers · 40 spare'); // every row has its second line (review of 2026.11.20-10)
  for (const t of [goodsLine({ have: 40, selling: false, price: .7 }), goodsLine({ have: 40, kept: 2, selling: true, price: 13 })]) {
    assert.doesNotMatch(t, /if sold|sells for|not sold/);
  }
});

test('the Mortar and Cannon Blast opens with a breakdown in words', () => {
  const g = newGame('b1', 'gulch'), t = g.town;
  t.towers.push({ spot: 3, kind: 'cannon', level: 1, path: null, cd: 0, spent: 0, pulses: 0 });
  const ex = explainTower(t, t.towers[0]);
  assert.ok(ex.splash, 'the cannon has a blast breakdown');
  assert.equal(ex.splash.rows[0].label, 'Base blast');
  assert.match(unitText('blast', ex.splash.value), /^(Small|Wide)$/);
  assert.equal(blastWord(1), 'Small'); assert.equal(blastWord(1.5), 'Wide');
  const play = fs.readFileSync(new URL('../src/ui/play.js', import.meta.url), 'utf8');
  assert.match(play, /line\('Blast', blastWord\(st\.splash\), 'splash'\)/);
});

test('a live rate under 0.1 reads 0, never 0.0', () => {
  assert.equal(fmtLive(.05), '0'); assert.equal(fmtLive(0), '0'); assert.equal(fmtLive(.6), '0.6');
});

test('the foreman says when it buys, and the old-waves row is short', () => {
  assert.equal(foremanLine('flooded', 'timber'), 'Foreman paused while the timber price is low.');
  assert.doesNotMatch(foremanLine('flooded', 'timber'), / or /);
  assert.equal(oldWavesLabel({ record: 23 }), 'Won before signing');
});

test('the words the review flagged are gone', () => {
  const sheets = fs.readFileSync(new URL('../src/ui/sheets.js', import.meta.url), 'utf8');
  assert.doesNotMatch(sheets, /You still pick each tower's path/);
  assert.doesNotMatch(sheets, /Auto picks the best one/);
  const map = fs.readFileSync(new URL('../src/ui/map.js', import.meta.url), 'utf8');
  assert.doesNotMatch(map, /'% done'/);
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /\.place \{[^}]*min-height: 34px/); // the wave bar never drops when Map appears
});
