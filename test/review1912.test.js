// Review of 2026.11.19-12: a short old-waves row, one foreman line, prices a player can hold, a two-row goods strip,
// crowded map labels show their name only, and the save goal points at the coins it counts.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { newGame } from '../src/core/setup.js';
import { oldWavesLabel } from '../src/core/explain.js';
import { each, sellsFor, goodsLine, goodsSwitch, priceNote, MODE_LINES } from '../src/ui/format.js';
import { stripFit, stripGoods } from '../src/core/reveal.js';
import { crowdedBadges } from '../src/ui/map.js';
import { GOALS } from '../src/data/goals.js';
import { textIssues } from '../tools/audit.js';

const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('the old-waves row is short enough to sit beside its × 3', () => {
  const s = oldWavesLabel({ record: 23 });
  assert.match(s, /^[A-Z][a-z ]{2,19}$/); // short beside × 3 (the words are pinned in test/words.test.js)
  assert.ok(s.length <= 20);
  assert.match(read('src/ui/play.js'), /wave\.classList\.toggle\('old', oldGround\(town\)\)/); // the wave number turns gold
});

test('under 1 coin a price says what 10 or 100 pay', () => {
  // since 2026.11.20-9 every price under 1 coin reads one way (review of 2026.11.20-8: two forms in one list)
  for (const v of [.6, .12, .06, .012]) assert.equal(each(v), 'under 1 coin each');
  assert.equal(each(4.56), '5 coins each'); // whole coins from 1 up (review of 2026.11.20-6)
  assert.equal(each(.97), '1 coin each');
  assert.equal(sellsFor(.004), 'sells for under 1 coin each');
  assert.equal(sellsFor(.6), 'sells for under 1 coin each');
  assert.equal(priceNote({ have: 0, price: .6 }), 'Pays under 1 coin each once you have some to sell.');
});

test('a good the towers keep all of says so, and its switch sells only the extra', () => {
  assert.equal(goodsLine({ have: 19, kept: 19, selling: true, price: 2 }), '19 in stock · 19 for towers · 0 spare');
  assert.equal(goodsSwitch({ have: 19, kept: 19, selling: true }), 'Sell spare · ' + MODE_LINES.always);
  assert.equal(goodsSwitch({ have: 40, kept: 19, selling: true }), 'Sell spare · ' + MODE_LINES.always);
  assert.equal(goodsSwitch({ have: 19, kept: 19, selling: false }), 'Sell spare · ' + MODE_LINES.off);
  assert.match(read('src/ui/sheets.js'), /el\('small', 'plabel', 'Price'\)/); // the price bar has its label
});

test('the goods strip keeps to its room, tower goods first, and says how many more', () => {
  const g = newGame('s1', 'gulch'), t = g.town;
  for (const k of ['timber', 'ore', 'clay', 'planks', 'copper', 'bricks', 'tools']) t.goods[k] = 5;
  const all = stripGoods(t);
  assert.ok(all.length >= 7);
  const { list, more } = stripFit(t, 6);
  assert.equal(list.length, 5); assert.equal(more, all.length - 5);
  for (const k of ['timber', 'ore', 'clay', 'planks']) assert.ok(list.includes(k), k + ' pays for a tower here');
  assert.deepEqual(list, all.filter(x => list.includes(x)), 'in the order of the goods list');
  assert.deepEqual(stripFit(t, 99), { list: all, more: 0 });
});

test('crowded map labels show only their name, never the open card\'s place', () => {
  const rs = [{ x: 100, y: 100, w: 90, h: 40 }, { x: 150, y: 120, w: 90, h: 40, keep: true }, { x: 400, y: 100, w: 90, h: 40 }];
  assert.deepEqual([...crowdedBadges(rs)], [0]);
  assert.equal(crowdedBadges([{ x: 0, y: 0, w: 80, h: 40 }, { x: 0, y: 200, w: 80, h: 40 }]).size, 0);
});

test('the Ridge save is two goals of one act each, and the save one points at the coins', () => {
  const hold = GOALS.find(x => x.id === 'g-hold'), save = GOALS.find(x => x.id === 'g-save');
  assert.ok(GOALS.indexOf(hold) < GOALS.indexOf(save));
  assert.deepEqual(hold.at(), { el: '#holdWaves' });
  assert.deepEqual(save.at({}), { el: '#coins' });
  for (const x of [hold, save]) assert.deepEqual(textIssues(x.text), []);
});

test('one foreman line, the Perks card says Best wave and the deeds after signing, short Auto lines', () => {
  const play = read('src/ui/play.js'), sheets = read('src/ui/sheets.js');
  assert.doesNotMatch(play, /A foreman buys the next level when you have twice its cost/);
  assert.match(play, /'Upgrades to level ' \+ \(L \+ 1\) \+ ' when you have '/);
  assert.match(sheets, /'Best wave ' \+ town\.bestWave/);
  assert.match(sheets, /'After signing'/);
  assert.doesNotMatch(sheets, /Waiting for a tower\. Build one first\./);
});

test('a hold after a lost boss does not tick Tap Hold waves, so the player is still told to hold and save', async () => {
  const { goalContext } = await import('../src/core/goals.js');
  const hold = GOALS.find(x => x.id === 'g-hold'), g = newGame('h1', 'gulch'), t = g.town;
  Object.assign(t.waves, { hold: true, autoHold: true });
  assert.equal(hold.done(goalContext(g, t)), false);
  t.waves.autoHold = false;
  assert.equal(hold.done(goalContext(g, t)), true);
});
