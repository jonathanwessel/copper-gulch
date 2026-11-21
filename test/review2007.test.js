// M5, words and layout from the screenshot review of 2026.11.20-7: a good's row says how much is spare for Sell spare,
// Save for towers names how many upgrades it saves for, the price bar always starts with the price, the old-wave damage
// row says why it is easier, the Capital's tab and offices have plain names, the charter rows say what earns a deed,
// and a Mortar's two circles read as one highlight.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { newGame } from '../src/core/setup.js';
import { buildTower, towerCost, reserves, setStock, RESERVE } from '../src/core/defense.js';
import { oldWavesLabel } from '../src/core/explain.js';
import { INSTITUTIONS } from '../src/data/institutions.js';
import { EXPLAINERS } from '../src/data/explainers.js';
import { goodsLine, priceLabel } from '../src/ui/format.js';
import { priceWord, stockWords } from '../src/ui/sheets.js';
import { textIssues } from '../tools/audit.js';

const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('a good kept for towers says how many are spare, so Sell spare never looks idle', () => {
  assert.equal(goodsLine({ have: 84, kept: 84, selling: true }), '84 in stock · 84 for towers · 0 spare');
  assert.equal(goodsLine({ have: 122, kept: 84, selling: true }), '122 in stock · 84 for towers · 38 spare');
  assert.equal(goodsLine({ have: 40, kept: 5, selling: false }), '40 in stock · 5 for towers · 35 spare', 'not for sale: the second line still shows (review of 2026.11.20-10)');
  assert.equal(goodsLine({ have: 40, kept: 0, selling: true }), '40 in stock · 0 for towers · 40 spare');
  for (const t of [goodsLine({ have: 122, kept: 84, selling: true })]) assert.deepEqual(textIssues(t), []);
});

test('Save for towers names the upgrades it saves for, and 4 upgrades counts 4 levels of every tower', () => {
  const g = newGame('s7', 'gulch'), t = g.town;
  t.coins = 1e9; t.buildings = { camp: 30, mine: 20, pit: 20, saw: 12, smelter: 12, kiln: 12 };
  Object.assign(t.waves, { phase: 'break', timer: 1e9, hold: true });
  Object.assign(t.goods, { timber: 1e4, ore: 1e4, copper: 1e4, bricks: 1e4 });
  assert.ok(buildTower(g, t, 0, 'crossbow'));
  assert.equal(stockWords(t), '2 upgrades');
  const tw = t.towers[0], lv = n => { let x = 0; for (let i = 0; i < n; i++) x += towerCost(t, tw.kind, tw.level + i).goods.timber || 0; return x; };
  const normal = reserves(t).use.timber, newPart = normal - lv(RESERVE.levels); // the new towers' share (plenty of free pads)
  setStock(t, 'lots');
  assert.equal(stockWords(t), '4 upgrades');
  assert.equal(reserves(t).use.timber, lv(RESERVE.levels * RESERVE.lots) + newPart * RESERVE.lots, 'four levels of every tower and four new towers');
  const ex = EXPLAINERS.find(e => e.id === 'stock');
  assert.equal(ex.title, 'Goods for towers');
  assert.doesNotMatch(ex.text, /Tower stock/);
});

test('the price bar starts with the price in one form, and its end word is only how high it stands', () => {
  assert.equal(priceLabel(2), '2 coins each');
  assert.equal(priceLabel(.7), 'Under 1 coin each');
  assert.equal(priceLabel(.001), 'Under 1 coin each');
  for (const s of [1, .7, .5, .2, .02]) assert.ok(['Full price', 'Down 30%', 'Down 50%', 'Down 80%', 'Down 98%'].includes(priceWord(s)));
  const sheets = read('src/ui/sheets.js');
  assert.match(sheets, /priceLabel\(ex\.value\)/);
  assert.match(sheets, /explainBox\(ex, \{ total: null \}\)/);
});

test('the old-wave damage row says why the wave is easier, short beside × 3', () => {
  const s = oldWavesLabel({ record: 22 });
  assert.match(s, /^[A-Z][a-z ]{2,19}$/); // short beside × 3 (the words are pinned in test/words.test.js)
  assert.ok(s.length <= 20);
  assert.deepEqual(textIssues(s), []);
});

test('the Capital has a Buildings tab, an Offers heading under Contracts, and a Rail Office', () => {
  const c = read('src/ui/capital.js');
  assert.match(c, /\['institutions', 'Buildings'\]/);
  assert.match(c, /el\('h3', '', 'Offers'\)/);
  assert.doesNotMatch(c, /el\('h3', '', 'Contracts'\)/);
  assert.ok(INSTITUTIONS.some(i => i.name === 'Rail Office'));
  assert.ok(!INSTITUTIONS.some(i => /Department/.test(i.name)));
  const tree = EXPLAINERS.find(e => e.id === 'tree');
  assert.match(tree.text, /then Buildings/);
});

test('the charter rows say what earns a deed, the warning is short, and Hire foreman says what it does', () => {
  const s = read('src/ui/sheets.js');
  assert.match(s, /'Best wave ' \+ town\.bestWave/);
  assert.match(s, /fmt\(town\.ownEarned\) \+ ' coins earned here'/);
  const warn = 'Copper Gulch starts over at wave 1 with nothing built. You keep your coins and get deeds.';
  assert.ok(s.includes(" starts over at wave 1 with nothing built. You keep your coins and get deeds.'"));
  assert.ok(warn.length < 100);
  assert.match(read('src/ui/play.js'), /'A foreman upgrades this building for you.'/);
});

test('a Mortar\'s dead zone ring is the color of its reach, and an opened breakdown keeps its Total above the cost bar', () => {
  const sel = read('src/render/select.js');
  assert.doesNotMatch(sel, /#ff7a5a/);
  assert.match(sel, /this\.inner = new THREE\.Mesh\(new THREE\.RingGeometry\(\.965, 1, 64\)[^;]*'#ffc58f'/);
  assert.match(read('src/ui/play.js'), /if \(last !== first && end - top > bottom - roof - 4\) top = /);
});

test('a selected pit near the town\'s edge can slide clear: the camera prefers a part its circle fits in and may go round the selection', () => {
  const cam = read('src/render/camera.js');
  assert.match(cam, /if \(rad > 0 && !a\.o && parts\.some\(b => b\.o/);
  assert.match(cam, /this\.keepAt = \{ x: p\.x, z: p\.z \}/);
  assert.match(cam, /const k = this\.keepAt/);
  assert.match(cam, /if \(rad > 0 && !raw\.some\(fits\)\) for \(const a of raw\)/); // fits nowhere: centered in the roomiest part
});
