// M5, words and layout from the screenshot review of 2026.11.20-14: the vault is a heart and the hits it can take, the
// same at a town and an outpost; a price reads first with "have" under it; the path card says either path costs it; the
// old-wave row says why; plainer switch, research, contract and map words; the strip keeps to one row in short
// landscape so a picked building and its ring stay clear of it.
import { stateWord } from '../src/ui/state.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { vaultCount, haveWords } from '../src/ui/format.js';
import { stockWords, STOCK_LABEL } from '../src/ui/sheets.js';
import { oldWavesLabel } from '../src/core/explain.js';
import { HEART_PATH } from '../src/ui/heart.js';
import { EXPLAINERS } from '../src/data/explainers.js';
import { textIssues } from '../tools/audit.js';

const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('the vault is a heart and the hits it can take, one form at every place', () => {
  assert.equal(vaultCount({ hp: 20, max: 20 }), '20');
  assert.equal(vaultCount({ hp: 0.2, max: 20 }), '1');
  for (const max of [1, 20, 99, 150, 999, 5e3, 1e5]) assert.ok(vaultCount({ hp: max, max }).length <= 5, String(max));
  assert.ok(HEART_PATH.length > 20, 'a pixel heart, drawn inline (no other host)');
  const play = read('src/ui/play.js'), map = read('src/ui/map.js');
  assert.ok(!play.includes("'vlabel'"), 'no small Vault or Stock caption');
  assert.ok(play.includes('vaultBtn.append(heart(), vault)'));
  assert.ok(map.includes("vault.append(el('span', '', '·'), heart(), fill)"));
  assert.ok(!map.includes("'· Stock'"));
  const waves = EXPLAINERS.find(e => /^Raiders come in waves/.test(e.text));
  assert.match(waves.text, /lowers the number by the heart/);
});

test('a price comes first, with what you have under it', () => {
  assert.equal(haveWords(400), 'have 400');
  assert.equal(haveWords(12345), 'have 12.3K');
  assert.equal(haveWords(-3), 'have 0');
  const play = read('src/ui/play.js'), sheets = read('src/ui/sheets.js'), cap = read('src/ui/capital.js'), html = read('index.html');
  assert.ok(play.includes("const coinCost = need => fmt(need) + ' coins'"));
  assert.ok(play.includes("el('small', 'hv hn', haveWords(have))"));
  assert.ok(play.includes("el('small', null, 'Either path costs')"));
  assert.ok(sheets.includes("priceOver(x.price, need, 'coins', town.coins)")); // price over have since 2026.11.20-18
  assert.ok(cap.includes('priceOver(small, need, unit, have)'));
  assert.match(html, /\.costrow \.need \{ display: inline-flex; flex-direction: column;/);
  for (const s of ['have 400', 'Either path costs', '35 Influence · have 12']) assert.deepEqual(textIssues(s), [], s);
});

test('the words the review flagged', () => {
  assert.equal(oldWavesLabel(), 'Won before signing');
  assert.ok(oldWavesLabel().length <= 20, 'fits beside × 3');
  assert.equal(STOCK_LABEL, 'Each tower keeps goods for');
  assert.equal(stockWords({ stock: 'normal' }), '2 upgrades');
  assert.equal(stockWords({ stock: 'lots' }), '4 upgrades');
  const sheets = read('src/ui/sheets.js'), cap = read('src/ui/capital.js'), map = read('src/ui/map.js');
  assert.ok(sheets.includes("lineUp ? 'Research next' : 'Research'") && !sheets.includes("'Do next'"));
  assert.ok(cap.includes("el('button', 'btn small', 'Give up'); drop.id = 'contractDrop';") && !cap.includes("'Drop'"));
  assert.ok(stateWord({ state: 'hold', needs: true }) === 'On hold' && !map.includes("' · Waiting'"));
  assert.ok(map.includes('That town starts over at wave 1 and you get deeds.'));
  for (const s of ['Won before signing', 'Each tower keeps goods for', '2 upgrades', 'Research next', 'Give up', 'Tap Perks in a town to sign a charter. That town starts over at wave 1 and you get deeds.']) assert.deepEqual(textIssues(s), [], s);
});

test('short landscape keeps the strip to one row beside a card when its goods fit, and rings clear of it', () => {
  const play = read('src/ui/play.js'), cam = read('src/render/camera.js'), html = read('index.html');
  assert.ok(play.includes('one = shortLand() && (!sw || oneFits(parseInt(sw)))'));
  assert.ok(cam.includes('const offStrip = !lw ||') && cam.includes('const ring = !raw.some(fits) || (offStrip &&'));
  assert.match(html, /\.pathhead small \{ color: var\(--ink\); font-size: \.8rem; \}/, 'Can\'t be undone is not tiny gray');
  assert.match(html, /\.option \.depthrow small \{ font-size: \.78rem; color: var\(--ink\);/);
});
