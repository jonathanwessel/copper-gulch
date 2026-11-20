// Words and layout from the review of 2026.11.20-4.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { oldWavesLabel } from '../src/core/explain.js';
import { goodsLine, levelsDone } from '../src/ui/format.js';
import { foremanLine } from '../src/ui/explain.js';
import { lostLine } from '../src/ui/lost.js';
import { vaultHits } from '../src/ui/map.js';
import { textIssues } from '../tools/audit.js';

const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('every goods row has one pattern and a price, and never keeps more than there is', () => {
  assert.equal(goodsLine({ have: 84, kept: 84, selling: true, price: 2 }), '84 in stock · 84 for towers · 0 spare');
  assert.equal(goodsLine({ have: 122, kept: 226, selling: true, price: 13 }), '122 in stock · 122 for towers · 0 spare');
  assert.equal(goodsLine({ have: 40, kept: 5, selling: true, price: .7 }), '40 in stock · 5 for towers · 35 spare');
  for (const t of [goodsLine({ have: 84, kept: 84, selling: true, price: 2 }), goodsLine({ have: 3, kept: 0, selling: false, price: 4 })]) {
    assert.doesNotMatch(t, /all kept|extra gets sold|none to sell/);
    assert.deepEqual(textIssues(t), []);
  }
  // the Goods sheet's town switch has its own name, apart from each building's "Keep 84 timber for towers"
  assert.match(read('src/ui/sheets.js'), /setSwitch\(stockBtn, STOCK_LABEL/);
});

test('the foreman, old-waves, research and lost lines read as plain statuses', () => {
  const f = foremanLine('flooded', 'timber');
  assert.equal(f, 'Paused until timber sells for more.');
  assert.doesNotMatch(f, /better .* price/);
  assert.equal(oldWavesLabel({ record: 22 }), 'Before best wave 22');
  assert.ok(oldWavesLabel({ record: 22 }).length <= 20);
  assert.equal(levelsDone(0, 5), '0 of 5 done');
  const town = { def: { name: 'Copper Gulch', short: 'Copper Gulch', boss: 'wagon' }, lost: { why: 'boss', back: 18 } };
  assert.equal(lostLine(town), 'The war wagon got through. Back to wave 18. Tap Play Copper Gulch, then Resume waves.');
  assert.doesNotMatch(lostLine(town), /full again/);
  assert.doesNotMatch(read('src/ui/sheets.js'), /'One at a time\. '/);
  for (const t of [f, lostLine(town), oldWavesLabel({})]) assert.deepEqual(textIssues(t), []);
});

test('the map card says what the vault takes, and the Capital shows its figure once', () => {
  assert.equal(vaultHits({ vault: { hp: 20, max: 20 } }), '20 hits');
  assert.equal(vaultHits({ vault: { hp: 1, max: 20 } }), '1 hit');
  const map = read('src/ui/map.js');
  assert.match(map, /stat\(store \+ ' can take', vaultHits\(t\)/);
  assert.match(map, /B\.line\.hidden = openId === 'capital'/); // the label is just its name while its card is open
  const cap = read('src/ui/capital.js');
  assert.match(cap, /'You have'/);
  assert.match(cap, /'Sent ' \+ fmt\(Math\.floor\(a\.got\)\) \+ ' so far'/);
});

test('power is a count, and the selection keeps clear of bars and cards', () => {
  const play = read('src/ui/play.js');
  assert.match(play, /isGrid\(b\.makes\) \? Math\.floor\(\(made \? made\.value : b\.rate\) \+ 1e-9\) \+ ' power'/);
  const css = read('index.html');
  assert.match(css, /\.play \.card \{ max-height: calc\(100% - var\(--hudtop, 10px\) - 130px/); // a band of map above a town card
  assert.match(css, /\.goalmark\.ontag::after \{ display: none; \}/); // no ring round the goal's tag
  assert.match(css, /transition: opacity \.2s; pointer-events: none;/); // a short toast fade
  assert.match(read('src/render/camera.js'), /q\.y > top \+ TOP_GAP/); // a selection just under the top bar slides down
});
