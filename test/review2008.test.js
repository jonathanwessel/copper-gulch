// M5, words and layout from the screenshot review of 2026.11.20-8: one price form under 1 coin, price words that say
// what they measure, the Goods switch named like each building's Keep switch, the bonus named, the path price first,
// one name for one thing (the town's boss, Build and Upgrade at the Capital, the Copper Camp), charter and deeds
// explained on Perks, the Cannon's best target, Sandy Bend goals, and a selection kept clear of the goods strip.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { newGame } from '../src/core/setup.js';
import { goalNow } from '../src/core/goals.js';
import { GOALS } from '../src/data/goals.js';
import { TOWERS } from '../src/data/towers.js';
import { BUILDINGS } from '../src/data/buildings.js';
import { EXPLAINERS } from '../src/data/explainers.js';
import { oldWavesLabel } from '../src/core/explain.js';
import { each, priceLabel } from '../src/ui/format.js';
import { priceWord, STOCK_LABEL } from '../src/ui/sheets.js';
import { foremanLine } from '../src/ui/explain.js';
import { influenceWords } from '../src/ui/capital.js';
import { textIssues } from '../tools/audit.js';

const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('every price under 1 coin reads one way, and the bar ends in a price word', () => {
  for (const v of [.7, .2, .03, .001]) assert.equal(each(v), 'under 1 coin each');
  assert.equal(priceLabel(.001), 'Under 1 coin each');
  assert.equal(priceLabel(2), '2 coins each');
  assert.deepEqual([1, .7, .5, .2, .02].map(priceWord), ['Full price', 'Down 30%', 'Down 50%', 'Down 80%', 'Down 98%']);
});

test('the Goods switch reads like the building cards\' Keep switch and says what it keeps for', () => {
  assert.equal(STOCK_LABEL, 'Keep for towers');
  const ex = EXPLAINERS.find(e => e.id === 'stock');
  assert.match(ex.text, /^Tap Keep for towers/);
  assert.deepEqual(textIssues(ex.text), []);
  assert.ok(read('src/ui/play.js').includes("'Keep for towers'"));
});

test('the bonus is named, the path price comes first, and the foreman says what it waits for', () => {
  assert.equal(oldWavesLabel({ record: 22 }), 'Wave beaten before');
  assert.ok(oldWavesLabel({}).length <= 20);
  assert.equal(foremanLine('flooded', 'timber'), 'Foreman paused while the timber price is low.');
  const play = read('src/ui/play.js');
  assert.match(play, /const coinCost = need => fmtLive\(town\.coins\)/);
  assert.match(play, /const pc = costRow\(c, true\)/);
});

test('one name for one thing: the town\'s boss on Keep trying, Build and Upgrade at the Capital, no group names', () => {
  const sheets = read('src/ui/sheets.js'), cap = read('src/ui/capital.js'), play = read('src/ui/play.js');
  assert.ok(sheets.includes("'Fight the ' + bossName(town) + ' again'"));
  const ex = EXPLAINERS.find(e => e.id === 'retry');
  assert.equal(ex.say({ boss: 'war wagon' }).startsWith('Tap Auto and turn on Fight the war wagon again.'), true);
  assert.doesNotMatch(cap, /'Buy'/);
  assert.match(cap, /'Upgrade'\); b\.dataset\.node/);
  assert.doesNotMatch(cap, /Buy its upgrades/);
  assert.doesNotMatch(play, /'Workshops/);
  assert.doesNotMatch(cap, /workshops/);
  assert.equal(BUILDINGS.dmine.name, 'Copper Camp');
  assert.equal(BUILDINGS.mine.name, 'Copper Mine');
  for (const e of EXPLAINERS) assert.doesNotMatch(e.text, /workshop/i, e.id);
});

test('the Capital says Influence the same way on its card and map label, and the retry badge matches its line', () => {
  assert.equal(influenceWords(10.7), '10 Influence');
  const map = read('src/ui/map.js');
  assert.ok(map.includes('Influence') && map.includes("id = 'influence'")); // under the coins since review of 2026.11.20-10
  assert.match(map, /' · Waiting'/);
  assert.ok(map.includes('Get deeds by signing a charter in Perks.'));
  assert.match(read('src/data/towns/ridge.js'), /makesText: 'iron, steel, rails, boilers and locomotives'/);
});

test('Perks says what a charter does first and what a deed is always, and the win card names its button', () => {
  const s = read('src/ui/sheets.js');
  assert.ok(s.includes("el('p', 'uses', town.def.name + ' starts over at wave 1 with nothing built. You keep your coins and get deeds.')"));
  assert.match(s, /'Sign now and get'/);
  assert.doesNotMatch(s, /each\.hidden = c\.deeds > 0/);
  const won = EXPLAINERS.find(e => e.id === 'dc-won');
  assert.match(won.text, /Tap Play Copper Gulch/);
  assert.equal(won.button, 'Play Copper Gulch');
  assert.doesNotMatch(won.text, /has more buildings and towers/);
});

test('the Cannon says what it is best against, with no "whole group" beside a small blast', () => {
  assert.equal(TOWERS.cannon.bestText, 'Bunched-up raiders');
  assert.doesNotMatch(TOWERS.cannon.about, /whole group/);
  assert.doesNotMatch(EXPLAINERS.find(e => e.id === 'cannon').text, /whole group/);
});

test('Sandy Bend has its own goals, walking to the win and back to Silver Falls; the bots leave them out', () => {
  const s = GOALS.filter(x => x.town === 'sandybend');
  assert.deepEqual(s.map(x => x.id), ['s-tower', 's-quartz', 's-three', 's-win', 's-back']);
  assert.ok(s.every(x => x.side && x.text.length <= 48));
  assert.match(read('tools/balance.js'), /GOALS\.filter\(x => !x\.side && /);
  const g = newGame('sb1', 'gulch'); g.addTown('sandybend'); g.go('sandybend'); g.step(.25);
  assert.equal(goalNow(g, false).id, 's-tower');
  for (const id of ['f-copper', 'f-steel', 'f-rails', 'r-tools']) assert.match(GOALS.find(x => x.id === id).text, /^Tap Map, /, id + ' names what to tap');
  assert.equal(GOALS.find(x => x.id === 'g-hold').text, 'Tap Hold waves so no wave can cost you coins');
});

test('a selection slides clear of the goods strip as well as the card', () => {
  const cam = read('src/render/camera.js');
  assert.match(cam, /setView\(top, cover, low = null\)/);
  assert.match(cam, /if \(lw\) for \(const a of raw\) if \(lw\.l < a\.r && lw\.r > a\.l && lw\.t < a\.b && lw\.t > a\.t\) a\.b = lw\.t - 28;/);
  assert.match(read('src/ui/play.js'), /viewApi\.setView\(top, cb && cb\.height \? .* : null, sb && sb\.height/);
});
