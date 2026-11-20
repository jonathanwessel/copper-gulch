// M5, words and layout from the screenshot review of 2026.11.20-6: research lines up one item while another runs (no
// grayed "Busy"), the fast raider kind is the Horseman (not "Rider" beside "raider"), a good's price sits on its price
// bar in whole coins, its switch sells only the spare, and the charter line names what goes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { newGame } from '../src/core/setup.js';
import { startResearch, queueResearch, researchLevel, researchBlock } from '../src/core/research.js';
import { migrate, SAVE_VERSION, encode, decode } from '../src/core/save.js';
import { FOES } from '../src/data/foes.js';
import { TOWERS } from '../src/data/towers.js';
import { each, goodsLine, goodsSwitch, priceLabel } from '../src/ui/format.js';
import { textIssues } from '../tools/audit.js';

const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const run = (g, sec) => { for (let i = 0; i < sec * 4; i++) g.step(.25); };
function ready(seed = 'q') {
  const g = newGame(seed, 'gulch'), t = g.town;
  Object.assign(t.waves, { hold: true, timer: 0 });
  t.buildings.camp = 10; t.buildings.saw = 1; g.step(.25);
  t.coins = 1e9;
  return { g, t };
}

test('while one research runs, another lines up and starts when it ends, paid then', () => {
  const { g, t } = ready();
  assert.ok(startResearch(g, t, 'saws'));
  assert.equal(researchBlock(t, 'walls'), 'busy');
  const before = t.coins;
  assert.ok(queueResearch(t, 'walls'));
  assert.equal(t.labNext, 'walls');
  assert.equal(t.coins, before, 'nothing paid while it waits');
  run(g, t.lab.left + 1);
  assert.equal(researchLevel(t, 'saws'), 1);
  assert.ok(t.lab && t.lab.id === 'walls', 'the lined-up item runs');
  assert.ok(t.coins < before, 'paid when it started');
  assert.equal(t.labNext, null);
});

test('a lined-up research waits for coins, can be taken off the line, and never lines up the running item', () => {
  const { g, t } = ready('q2');
  assert.ok(startResearch(g, t, 'saws'));
  assert.equal(queueResearch(t, 'saws'), false, 'the running item cannot line up its own next level');
  assert.ok(queueResearch(t, 'walls'));
  assert.equal(queueResearch(t, 'walls'), false); // a second tap takes it off
  assert.equal(t.labNext, null);
  assert.ok(queueResearch(t, 'walls'));
  t.coins = 0;
  run(g, t.lab.left + 1);
  assert.equal(t.lab, null, 'too few coins: it waits');
  assert.equal(t.labNext, 'walls');
  t.coins = 1e9; run(g, 1);
  assert.ok(t.lab && t.lab.id === 'walls');
});

test('a save from before research could line up loads with nothing lined up', () => {
  assert.equal(SAVE_VERSION, 20);
  const g = newGame('q3', 'gulch'), raw = JSON.parse(encode(g, 1));
  for (const t of Object.values(raw.game.towns)) delete t.labNext;
  raw.v = 19;
  const m = migrate(raw);
  assert.equal(m.v, 20);
  for (const t of Object.values(m.game.towns)) assert.equal(t.labNext, null);
  assert.ok(decode(JSON.stringify(m)));
});

test('the Research sheet lines up the next item, never a grayed Busy button', () => {
  const s = read('src/ui/sheets.js');
  assert.doesNotMatch(s, /'Busy'/);
  assert.match(s, /'Up next'/);
  assert.match(s, /queueResearch\(town, id\)/);
});

test('the fast raider kind is the Horseman, so no word sits beside "raider" one letter off', () => {
  assert.equal(FOES.runner.name, 'Horseman');
  assert.equal(FOES.runner.many, 'Horsemen');
  assert.equal(TOWERS.crossbow.bestText, 'Horsemen');
  for (const f of ['src/data/foes.js', 'src/data/towers.js', 'src/data/explainers.js']) assert.doesNotMatch(read(f), /\bRiders?\b|\briders?\b/);
});

test('a price reads in whole coins from 1 up and sits on the price bar, not in the stock line', () => {
  assert.equal(each(1.5), '2 coins each');
  assert.equal(each(1.02), '1 coin each');
  assert.equal(each(13.4), '13 coins each');
  assert.equal(each(.6), '6 coins per 10');
  assert.equal(goodsLine({ have: 122, kept: 122, selling: true, price: 2 }), '122 in stock · 122 kept for towers');
  assert.equal(priceLabel(2), '2 coins each');
  assert.equal(priceLabel(.001), 'Price'); // the bar's end word says Almost 0
  assert.equal(priceLabel(2, true), 'Price'); // the open breakdown says it
  assert.equal(goodsSwitch({ selling: true }), 'Sell spare · On');
  assert.match(read('src/ui/play.js'), /'Sell spare ' \+ g\.name\.toLowerCase\(\)/);
  assert.match(read('src/ui/sheets.js'), /setSwitch\(stockBtn, 'Save for towers', town\.stock === 'lots' \? 'Lots' : 'Some'/);
  for (const t of [goodsLine({ have: 40, kept: 5, selling: true, price: 2 }), priceLabel(3)]) assert.deepEqual(textIssues(t), []);
});

test('the charter line says what the town starts over without', () => {
  const s = read('src/ui/sheets.js');
  assert.doesNotMatch(s, /foremen go\./);
  assert.match(s, /starts over at wave 1 with no buildings, towers, research or foremen\./);
});
