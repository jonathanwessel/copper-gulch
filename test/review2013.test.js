// M5, words and layout from the screenshot review of 2026.11.20-13: the vault is a count with its word on the wave bar
// and on a map label that took hits, the path price has its own row, the deed rows use a dot, the old-wave row says a
// fact about the wave, Auto says why it holds, Keep for towers says "each", the map card has no "Playing now", the
// contract toast leaves when the map opens, chips keep the count top right, labels are two lines, Best against reads
// like the stats beside it and landscape cards pin the price and Upgrade last.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { vaultCount } from '../src/ui/format.js';
import { stockWords } from '../src/ui/sheets.js';
import { oldWavesLabel } from '../src/core/explain.js';
import { textIssues } from '../tools/audit.js';

const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('the vault is hits left of full, never more than 5 characters', () => {
  // only the hits beside a heart since the review of 2026.11.20-14
  assert.equal(vaultCount({ hp: 20, max: 20 }), '20');
  assert.equal(vaultCount({ hp: 11.2, max: 20 }), '12', 'a part hit still stands');
  assert.equal(vaultCount({ hp: -3, max: 25 }), '0');
  assert.equal(vaultCount({ hp: 30, max: 25 }), '25');
  assert.equal(vaultCount({ hp: 120, max: 150 }), '120');
  for (const max of [1, 9, 20, 37.5, 99, 100, 999, 5e3, 1e4]) for (const f of [0, .37, 1]) assert.ok(vaultCount({ hp: max * f, max }).length <= 5, max + ' ' + f);
  const play = read('src/ui/play.js'), html = read('index.html');
  assert.ok(play.includes('setText(vault, vaultCount(town.vault))'));
  assert.ok(!play.includes('vaultFill'), 'the bar left');
  assert.match(html, /\.vnum \{[^}]*width: 5ch;[^}]*tabular-nums/);
});

test('a map label shows the vault only once it took hits, with its word', () => {
  const map = read('src/ui/map.js');
  assert.ok(map.includes("vault.append(el('span', '', '·'), heart(), fill)"));
  assert.ok(map.includes('hit = !!tv && tv.hp < tv.max - 1e-9'));
  assert.ok(map.includes('line.append(extra)'), 'the wave and the coins share a line');
  assert.ok(!map.includes("'Playing now'"));
});

test('the words the review flagged', () => {
  assert.equal(stockWords({ stock: 'normal' }), '2 upgrades');
  assert.equal(stockWords({ stock: 'lots' }), '4 upgrades');
  const sheets = read('src/ui/sheets.js'), play = read('src/ui/play.js');
  // the Keep trying the boss line gives its reason (since 2026.11.22-2 the town plays a wave again instead of holding)
  assert.ok(sheets.includes("'Tries again after a tower goes up a level'") && sheets.includes("'Tries again once Auto-towers can upgrade'"));
  assert.ok(!sheets.includes("'On hold for now'"));
  assert.ok(sheets.includes("plural(d, 'deed') + ' · '"), '"2 deeds · 50% more coins"');
  assert.ok(!play.includes("'Either path'"));
  assert.ok(play.includes("{ kind: 'tomap' }") && read('src/main.js').includes("dropToasts('tomap')"));
  for (const s of ['Won last time', '2 upgrades', 'Tries again after a tower goes up a level', 'Tries again once Auto-towers can upgrade', '2 deeds · 50% more coins']) assert.deepEqual(textIssues(s), [], s);
});

test('chips, Best against and landscape cards keep one layout', () => {
  const html = read('index.html'), play = read('src/ui/play.js');
  const phone = html.slice(html.indexOf('@media (max-width: 599px) {'), html.indexOf('@media (min-width: 600px)'));
  assert.match(phone, /\.goodchip b \{ grid-row: 1; grid-column: 2;/, 'the count top right on a phone, as in the narrow strip');
  assert.match(html, /\.goodstrip\.narrow \.goodchip b \{ grid-row: 1; grid-column: 2;/);
  assert.ok(play.includes("key ? 'statrow' : 'statline'"));
  assert.match(html, /> \.statline \{ grid-column: auto; display: flex; flex-direction: column;/);
  assert.match(html, /\.card > \.buybar:not\(\.pathbar\) \{ order: 99; \}/);
  assert.match(html, /\.pathhead \{ display: flex; flex-wrap: wrap;/);
});

test('from the screenshot review of this release: a long wait in minutes, and plural goods go', async () => {
  const { waveTimer } = await import('../src/ui/wave.js');
  const { usedLine } = await import('../src/ui/play.js');
  assert.equal(waveTimer({ phase: 'break', hold: false, timer: 99 }), 'in 99s');
  assert.equal(waveTimer({ phase: 'break', hold: false, timer: 119.5 }), 'in 2m');
  for (const t of [1, 50, 99, 100, 240, 599]) assert.ok(waveTimer({ phase: 'break', hold: false, timer: t }).length <= 6, String(t));
  assert.equal(usedLine({ ids: ['saw'], rate: 0 }, { name: 'Boilers' }), 'Boilers go to the Sawmill.');
  assert.equal(usedLine({ ids: ['saw'], rate: 0 }, { name: 'Glass' }), 'Glass goes to the Sawmill.');
});
